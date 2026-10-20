import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware } from '../../middleware/auth';
import { success, error } from '../../lib/response';
import { computeLevel } from '../../lib/gamification';

const userDashboardRoutes = new Hono<{ Bindings: Env }>();

userDashboardRoutes.use('*', authMiddleware());

// ─── GET /api/user/dashboard ───────────────────────────────────────────────
// Consolidated endpoint: replaces 4 separate calls (me, my-classes,
// transactions, notifications) with a single round-trip.
userDashboardRoutes.get('/', async (c) => {
  try {
    const user = c.get('user');
    const now = new Date().toISOString();

    const [membershipRow, enrollmentsResult, ordersResult, notificationsResult, profileRow] = await Promise.all([
      // Active membership
      c.env.DB.prepare(
        `SELECT m.id, m.status, m.starts_at, m.expires_at, m.created_at,
                p.name as plan_name, p.duration_type, p.slug as plan_slug
         FROM memberships m
         JOIN membership_plans p ON m.plan_id = p.id
         WHERE m.user_id = ? AND m.status = 'active'
           AND (m.expires_at IS NULL OR m.expires_at > ?)
         ORDER BY m.created_at DESC LIMIT 1`
      ).bind(user.id, now).first(),

      // Enrolled classes with progress
      c.env.DB.prepare(
        `SELECT c.id, c.slug, c.title, c.thumbnail_url, c.category, e.id as enrollment_id,
           (SELECT COUNT(*) FROM lessons WHERE course_id = c.id AND status = 'published') as total_lessons,
           (SELECT COUNT(*) FROM lesson_progress WHERE enrollment_id = e.id AND status = 'completed') as completed_lessons
         FROM enrollments e
         JOIN courses c ON e.course_id = c.id
         WHERE e.user_id = ? AND e.status = 'active'
         ORDER BY e.enrolled_at DESC`
      ).bind(user.id).all(),

      // Recent transactions (limit 50)
      c.env.DB.prepare(
        `SELECT id, order_number, order_type, product_name, amount, currency,
                status, created_at, paid_at, cancelled_at
         FROM orders
         WHERE user_id = ?
         ORDER BY created_at DESC LIMIT 50`
      ).bind(user.id).all(),

      // Notifications
      c.env.DB.prepare(
        `SELECT id, type, title, body, data_json, read_at, created_at
         FROM notifications
         WHERE user_id = ? AND status = 'sent'
         ORDER BY created_at DESC LIMIT 20`
      ).bind(user.id).all(),
      
      // Profile
      c.env.DB.prepare(
        `SELECT onboarding_completed, recommended_track FROM user_profiles WHERE user_id = ?`
      ).bind(user.id).first(),
    ]);

    const [lastWatchedRow, activityRow, gamificationRow, badgesResult] = await Promise.all([
      // Most recently watched/updated lesson (resume point)
      c.env.DB.prepare(
        `SELECT lp.lesson_id, lp.status, lp.watch_percent, lp.last_position_seconds, lp.updated_at,
                l.title as lesson_title, l.slug as lesson_slug,
                c2.id as course_id, c2.slug as course_slug, c2.title as course_title,
                e.id as enrollment_id
         FROM lesson_progress lp
         JOIN enrollments e ON e.id = lp.enrollment_id
         JOIN lessons l ON l.id = lp.lesson_id
         JOIN courses c2 ON c2.id = e.course_id
         WHERE e.user_id = ? AND e.status = 'active'
         ORDER BY lp.updated_at DESC LIMIT 1`
      ).bind(user.id).first().catch(() => null),

      // Personal activity summary (last 7 days + last active)
      c.env.DB.prepare(
        `SELECT
           (SELECT COUNT(*) FROM user_activity_days WHERE user_id = ? AND activity_date >= date('now', '-7 days')) as active_days_7d,
           (SELECT MAX(activity_date) FROM user_activity_days WHERE user_id = ?) as last_active,
           (SELECT COUNT(*) FROM lesson_progress lp JOIN enrollments e ON e.id = lp.enrollment_id
            WHERE e.user_id = ? AND lp.status = 'completed') as total_lessons_completed`
      ).bind(user.id, user.id, user.id).first().catch(() => null),

      // Gamification: streak + points + today's check-in state
      c.env.DB.prepare(
        `SELECT u.current_streak, u.longest_streak, u.last_streak_date, u.total_active_days,
                COALESCE(up.total_points, 0) as total_points,
                (SELECT COUNT(*) FROM point_transactions pt
                 WHERE pt.user_id = u.id AND pt.action = 'daily_checkin' AND pt.ref_id = date('now')) as checked_in_today,
                (SELECT COALESCE(SUM(points), 0) FROM point_transactions pt
                 WHERE pt.user_id = u.id AND pt.earned_at >= datetime('now', '-7 days')) as weekly_points
         FROM users u
         LEFT JOIN user_points up ON up.user_id = u.id
         WHERE u.id = ?`
      ).bind(user.id).first().catch(() => null),

      // Earned badges
      c.env.DB.prepare(
        `SELECT badge_key, badge_name, earned_at FROM user_badges WHERE user_id = ? ORDER BY earned_at DESC`
      ).bind(user.id).all().catch(() => ({ results: [] })),
    ]);

    // Recommended next lesson within the last-watched course
    let nextLesson: Record<string, unknown> | null = null;
    if (lastWatchedRow?.enrollment_id) {
      nextLesson = await c.env.DB.prepare(
        `SELECT l.id, l.title, l.slug
         FROM lessons l
         WHERE l.course_id = ? AND l.status = 'published'
           AND l.id NOT IN (
             SELECT lesson_id FROM lesson_progress WHERE enrollment_id = ? AND status = 'completed'
           )
         ORDER BY l.sort_order ASC LIMIT 1`
      ).bind(lastWatchedRow.course_id, lastWatchedRow.enrollment_id).first().catch(() => null) as Record<string, unknown> | null;
    }

    const hasActiveMembership =
      !!membershipRow || user.role === 'admin' || user.role === 'super_admin';

    // Free courses — accessible to all logged-in users regardless of enrollment
    const enrolledCourseIds = enrollmentsResult.results.map((e: any) => e.id as string);
    const freePlaceholders = enrolledCourseIds.length > 0 ? enrolledCourseIds.map(() => '?').join(',') : "''";
    let freeQuery = `SELECT c.id, c.slug, c.title, c.thumbnail_url, c.category,
      'free' as access_source,
      (SELECT COUNT(*) FROM lessons WHERE course_id = c.id AND status = 'published') as total_lessons,
      0 as completed_lessons
      FROM courses c WHERE c.status = 'published' AND c.access_type = 'free'`;
    const freeParams: unknown[] = [];
    if (enrolledCourseIds.length > 0) {
      freeQuery += ` AND c.id NOT IN (${freePlaceholders})`;
      freeParams.push(...enrolledCourseIds);
    }
    const freeCourses = await c.env.DB.prepare(freeQuery).bind(...freeParams).all();

    // Membership courses (if applicable)
    let membershipCourses: unknown[] = [];
    if (hasActiveMembership) {
      const enrolledIds = enrollmentsResult.results.map((e: any) => e.id);
      const placeholders = enrolledIds.length > 0 ? enrolledIds.map(() => '?').join(',') : "''";
      let query = `SELECT id, slug, title, thumbnail_url, category, 'membership' as access_source,
                   (SELECT COUNT(*) FROM lessons WHERE course_id = courses.id AND status = 'published') as total_lessons,
                   COALESCE((SELECT COUNT(*) FROM lesson_progress lp JOIN enrollments e ON lp.enrollment_id = e.id WHERE e.course_id = courses.id AND e.user_id = ? AND lp.status = 'completed'), 0) as completed_lessons
                   FROM courses WHERE status = 'published' AND access_type IN ('paid', 'membership_only')`;
      const params: unknown[] = [user.id];
      if (enrolledIds.length > 0) {
        query += ` AND id NOT IN (${placeholders})`;
        params.push(...enrolledIds);
      }
      const rows = await c.env.DB.prepare(query).bind(...params).all();
      membershipCourses = rows.results;
    }

    const formatCourse = (row: any) => {
      const total = row.total_lessons || 0;
      const completed = row.completed_lessons || 0;
      return { ...row, progress: total > 0 ? Math.round((completed / total) * 100) : 0 };
    };

    return success(c, {
      user,
      profile: profileRow || null,
      membership: membershipRow || null,
      hasActiveMembership,
      classes: {
        enrolled: [...enrollmentsResult.results, ...freeCourses.results].map(formatCourse),
        membership: membershipCourses.map(formatCourse),
      },
      transactions: ordersResult.results,
      notifications: notificationsResult.results,
      learning: {
        last_watched: lastWatchedRow || null,
        next_lesson: nextLesson,
      },
      activity: {
        active_days_7d: (activityRow?.active_days_7d as number) || 0,
        last_active: (activityRow?.last_active as string | null) || null,
        total_lessons_completed: (activityRow?.total_lessons_completed as number) || 0,
      },
      gamification: {
        current_streak: (gamificationRow?.current_streak as number) || 0,
        longest_streak: (gamificationRow?.longest_streak as number) || 0,
        total_active_days: (gamificationRow?.total_active_days as number) || 0,
        total_points: (gamificationRow?.total_points as number) || 0,
        weekly_points: (gamificationRow?.weekly_points as number) || 0,
        checked_in_today: ((gamificationRow?.checked_in_today as number) || 0) > 0,
        level: computeLevel((gamificationRow?.total_points as number) || 0),
        badges: (badgesResult as { results: unknown[] })?.results || [],
      },
    });
  } catch (err) {
    console.error('[dashboard]', err);
    return error(c, 'Gagal memuat data dashboard', 500);
  }
});

export default userDashboardRoutes;
