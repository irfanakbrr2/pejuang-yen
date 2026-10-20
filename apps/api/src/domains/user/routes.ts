import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { success, error } from '../../lib/response';
import { checkUserAccess } from '../../services/user-access';
import { hashPassword, verifyPassword } from '../../lib/password';
import { updateProfileSchema, changePasswordSchema, recordMilestoneSchema, CITY_BY_CODE, MENU_MILESTONES } from '@growwithai/shared';
import type { MemberMapCity, MemberMapResponse, ChecklistResponse, MenuMilestone } from '@growwithai/shared';
import { trackServerEvent } from '../../lib/tracking';
import { processLearningGamification, updateStreak, awardPoints, awardBadge } from '../../lib/gamification';

const MEMBER_MAP_CACHE_KEY = 'cache:member-map:v1';
const MEMBER_MAP_CACHE_TTL = 300; // 5 menit
const MEMBER_MAP_MEMBERS_PER_CITY = 30;

const userRoutes = new Hono<{ Bindings: Env }>();

// All user routes require auth
userRoutes.use('*', authMiddleware());

// ─── GET /api/user/my-classes ───────────
userRoutes.get('/my-classes', async (c) => {
  try {
    const user = c.get('user');

    const enrollments = await c.env.DB.prepare(
      `SELECT c.id, c.slug, c.title, c.thumbnail_url, c.category, e.id as enrollment_id,
         (SELECT COUNT(*) FROM lessons WHERE course_id = c.id AND status = 'published') as total_lessons,
         (SELECT COUNT(*) FROM lesson_progress WHERE enrollment_id = e.id AND status = 'completed') as completed_lessons,
         (SELECT COUNT(*) FROM enrollments ce WHERE ce.course_id = c.id AND ce.status = 'active') as enrolled_count,
         (SELECT json_group_array(json_object('avatar_url', u.avatar_url, 'badges_json', u.badges_json, 'seed', u.id))
          FROM (
            SELECT us.avatar_url, us.badges_json, us.id
            FROM enrollments en
            JOIN users us ON en.user_id = us.id
            WHERE en.course_id = c.id AND en.status = 'active'
            ORDER BY en.enrolled_at DESC LIMIT 3
          ) u) as participants_preview
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       WHERE e.user_id = ? AND e.status = 'active' AND c.status = 'published'
       ORDER BY e.enrolled_at DESC`
    ).bind(user.id).all();

    // Free courses are accessible to all logged-in users — include them even without enrollment
    const enrolledCourseIds = enrollments.results.map((e: any) => e.id as string);
    const freePlaceholders = enrolledCourseIds.length > 0 ? enrolledCourseIds.map(() => '?').join(',') : "''";
    let freeQuery = `SELECT c.id, c.slug, c.title, c.thumbnail_url, c.category,
      'free' as access_source,
      (SELECT COUNT(*) FROM lessons WHERE course_id = c.id AND status = 'published') as total_lessons,
      0 as completed_lessons,
      (SELECT COUNT(*) FROM enrollments ce WHERE ce.course_id = c.id AND ce.status = 'active') as enrolled_count,
      (SELECT json_group_array(json_object('avatar_url', u.avatar_url, 'badges_json', u.badges_json, 'seed', u.id))
       FROM (
         SELECT us.avatar_url, us.badges_json, us.id
         FROM enrollments en
         JOIN users us ON en.user_id = us.id
         WHERE en.course_id = c.id AND en.status = 'active'
         ORDER BY en.enrolled_at DESC LIMIT 3
       ) u) as participants_preview
      FROM courses c WHERE c.status = 'published' AND c.access_type = 'free'`;
    const freeParams: unknown[] = [];
    if (enrolledCourseIds.length > 0) {
      freeQuery += ` AND c.id NOT IN (${freePlaceholders})`;
      freeParams.push(...enrolledCourseIds);
    }
    const freeCourses = await c.env.DB.prepare(freeQuery).bind(...freeParams).all();

    const now = new Date().toISOString();
    const membership = await c.env.DB.prepare(
      `SELECT id FROM memberships WHERE user_id = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > ?)`
    ).bind(user.id, now).first();

    let membershipCourses: any[] = [];
    if (membership || user.role === 'admin' || user.role === 'super_admin') {
      const enrolledIds = enrollments.results.map((e) => e.id);
      const placeholders = enrolledIds.length > 0 ? enrolledIds.map(() => '?').join(',') : "''";

      let query = `SELECT id, slug, title, thumbnail_url, category, 'membership' as access_source,
                   (SELECT COUNT(*) FROM lessons WHERE course_id = courses.id AND status = 'published') as total_lessons,
                   COALESCE((SELECT COUNT(*) FROM lesson_progress lp JOIN enrollments e ON lp.enrollment_id = e.id WHERE e.course_id = courses.id AND e.user_id = ? AND lp.status = 'completed'), 0) as completed_lessons,
                   (SELECT COUNT(*) FROM enrollments ce WHERE ce.course_id = courses.id AND ce.status = 'active') as enrolled_count,
                   (SELECT json_group_array(json_object('avatar_url', u.avatar_url, 'badges_json', u.badges_json, 'seed', u.id))
                    FROM (
                      SELECT us.avatar_url, us.badges_json, us.id
                      FROM enrollments en
                      JOIN users us ON en.user_id = us.id
                      WHERE en.course_id = courses.id AND en.status = 'active'
                      ORDER BY en.enrolled_at DESC LIMIT 3
                    ) u) as participants_preview
                   FROM courses WHERE status = 'published' AND access_type IN ('paid', 'membership_only')`;
      const params: unknown[] = [user.id];
      if (enrolledIds.length > 0) {
        query += ` AND id NOT IN (${placeholders})`;
        params.push(...enrolledIds);
      }

      const membershipRows = await c.env.DB.prepare(query).bind(...params).all();
      membershipCourses = membershipRows.results;
    }

    const formatCourse = (row: any) => {
      const total = row.total_lessons || 0;
      const completed = row.completed_lessons || 0;
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
      
      let participants_preview = [];
      try {
        if (row.participants_preview) participants_preview = JSON.parse(row.participants_preview);
      } catch (e) {}

      return { ...row, progress, participants_preview };
    };

    return success(c, {
      enrolled: [...enrollments.results, ...freeCourses.results].map(formatCourse),
      membership: membershipCourses.map(formatCourse),
      hasActiveMembership: !!membership || user.role === 'admin' || user.role === 'super_admin'
    });
  } catch (err) {
    console.error('[user:my-classes]', err);
    return error(c, 'Gagal memuat kelas', 500);
  }
});

// ─── POST /api/user/enroll/free ───────────
userRoutes.post('/enroll/free', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const courseId = body.course_id;

    if (!courseId) return error(c, 'Course ID is required', 400);

    const course = await c.env.DB.prepare('SELECT access_type FROM courses WHERE id = ?').bind(courseId).first();
    if (!course) return error(c, 'Course not found', 404);
    if (course.access_type !== 'free') return error(c, 'This course is not free', 403);

    const existing = await c.env.DB.prepare('SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?').bind(user.id, courseId).first();
    if (existing) return success(c, { message: 'Already enrolled' });

    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `INSERT INTO enrollments (id, user_id, course_id, status, enrolled_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)`
    ).bind(crypto.randomUUID(), user.id, courseId, now, now).run();

    return success(c, { message: 'Enrolled successfully' }, 201);
  } catch (err) {
    console.error('[user:enroll/free]', err);
    return error(c, 'Gagal melakukan enrollment', 500);
  }
});

// ─── GET /api/user/progress/:courseSlug ───────────
// Returns course data, modules, lessons AND user progress for the learning interface
userRoutes.get('/progress/:courseSlug', async (c) => {
  try {
    const user = c.get('user');
    const courseSlug = c.req.param('courseSlug');

    const course = await c.env.DB.prepare('SELECT * FROM courses WHERE slug = ?').bind(courseSlug).first();
    if (!course) return error(c, 'Course not found', 404);

    const access = await checkUserAccess(c.env, user.id, course.id as string);
    if (!access.hasAccess) return error(c, 'You do not have access to this course', 403);

    const now = new Date().toISOString();
    const activeMembership = await c.env.DB.prepare(
      `SELECT id FROM memberships
       WHERE user_id = ? AND status = 'active'
         AND starts_at <= ?
         AND (expires_at IS NULL OR expires_at > ?)
       LIMIT 1`
    ).bind(user.id, now, now).first();
    const hasActiveMembership = !!activeMembership || user.role === 'admin' || user.role === 'super_admin';

    let enrollment = await c.env.DB.prepare('SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?').bind(user.id, course.id).first();
    if (!enrollment) {
      const newId = crypto.randomUUID();
      const now = new Date().toISOString();
      await c.env.DB.prepare(
        `INSERT INTO enrollments (id, user_id, course_id, status, enrolled_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)`
      ).bind(newId, user.id, course.id, now, now).run();
      enrollment = { id: newId };
    }

    const modules = await c.env.DB.prepare('SELECT * FROM course_modules WHERE course_id = ? ORDER BY sort_order ASC').bind(course.id).all();
    const lessons = await c.env.DB.prepare('SELECT * FROM lessons WHERE course_id = ? AND status = ? ORDER BY sort_order ASC').bind(course.id, 'published').all();
    const progress = await c.env.DB.prepare('SELECT lesson_id, status FROM lesson_progress WHERE enrollment_id = ?').bind(enrollment.id).all();

    const completedLessonIds = new Set(progress.results.filter(p => p.status === 'completed').map(p => p.lesson_id));

    const modulesWithLessons = modules.results.map((mod: any) => ({
      ...mod,
      lessons: lessons.results.filter((l: any) => l.module_id === mod.id).map((l: any) => ({
        ...l,
        is_completed: completedLessonIds.has(l.id)
      })),
    }));

    return success(c, {
      course,
      enrollment_id: enrollment.id,
      modules: modulesWithLessons,
      access_reason: access.accessReason,
      has_active_membership: hasActiveMembership
    });
  } catch (err) {
    console.error('[user:progress]', err);
    return error(c, 'Gagal memuat data kursus', 500);
  }
});

// ─── POST /api/user/progress/complete ───────────
userRoutes.post('/progress/complete', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { enrollment_id, lesson_id, is_completed = true, score, max_score } = body;

    if (!enrollment_id || !lesson_id) return error(c, 'Missing required fields', 400);

    // Verify enrollment belongs to user AND lesson belongs to the same course as the enrollment.
    // Without the lesson-course check, a user could use a free course enrollment_id to mark
    // lessons from a premium course as completed (IDOR / Broken Object Level Authorization).
    const enrollment = await c.env.DB.prepare(
      `SELECT e.id, e.course_id, e.progress_percent FROM enrollments e
       JOIN lessons l ON l.course_id = e.course_id AND l.id = ?
       WHERE e.id = ? AND e.user_id = ?`
    ).bind(lesson_id, enrollment_id, user.id).first();
    if (!enrollment) return error(c, 'Unauthorized or lesson does not belong to this course', 403);

    const now = new Date().toISOString();
    const lessonStatus = is_completed ? 'completed' : 'in_progress';
    const scoreVal = typeof score === 'number' ? score : null;
    const maxScoreVal = typeof max_score === 'number' ? max_score : null;

    await c.env.DB.prepare(
      `INSERT INTO lesson_progress (id, enrollment_id, lesson_id, status, completed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(enrollment_id, lesson_id) DO UPDATE SET
         status = excluded.status,
         updated_at = excluded.updated_at,
         completed_at = CASE WHEN excluded.status = 'completed' THEN excluded.completed_at ELSE NULL END`
    ).bind(crypto.randomUUID(), enrollment_id, lesson_id, lessonStatus, is_completed ? now : null, now).run();

    // Score update — best effort, silently skipped if quiz score columns not yet migrated
    if (scoreVal !== null) {
      await c.env.DB.prepare(
        'UPDATE lesson_progress SET score = ?, max_score = ? WHERE enrollment_id = ? AND lesson_id = ?'
      ).bind(scoreVal, maxScoreVal, enrollment_id, lesson_id).run().catch(() => {});
    }

    // Recalculate enrollment progress and sync to enrollments table
    const stats = await c.env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM lessons l
          JOIN enrollments e ON l.course_id = e.course_id
          WHERE e.id = ? AND l.status = 'published') AS total_lessons,
         COUNT(CASE WHEN lp.status = 'completed' THEN 1 END) AS completed_lessons
       FROM lesson_progress lp
       WHERE lp.enrollment_id = ?`
    ).bind(enrollment_id, enrollment_id).first() as { total_lessons: number; completed_lessons: number } | null;

    if (stats && stats.total_lessons > 0) {
      const pct = Math.round((stats.completed_lessons / stats.total_lessons) * 100);
      const allDone = pct === 100;
      const wasAllDoneBefore = enrollment.progress_percent === 100;
      await c.env.DB.prepare(
        `UPDATE enrollments SET
           progress_percent = ?,
           completed_at = CASE WHEN ? = 1 AND completed_at IS NULL THEN ? ELSE completed_at END
         WHERE id = ?`
      ).bind(pct, allDone ? 1 : 0, now, enrollment_id).run();

      if (allDone && !wasAllDoneBefore) {
        await c.env.DB.prepare(
          `INSERT INTO notifications (id, user_id, type, title, body, data_json, status, sent_at, created_at)
           VALUES (?, ?, 'completion', ?, ?, ?, 'sent', ?, ?)`
        ).bind(
          crypto.randomUUID(),
          user.id,
          'Kelas Selesai 🎉',
          `Selamat! Kamu telah berhasil menyelesaikan seluruh materi di kelas ini.`,
          JSON.stringify({ url: '/certificates' }),
          now,
          now
        ).run();

        c.executionCtx.waitUntil(trackServerEvent(c.env, {
          event_name: 'course_completed',
          event_category: 'learning',
          user_id: user.id,
          course_id: enrollment.course_id as string,
        }));
      }
    }

    if (is_completed) {
      c.executionCtx.waitUntil(trackServerEvent(c.env, {
        event_name: 'lesson_completed',
        event_category: 'learning',
        user_id: user.id,
        course_id: enrollment.course_id as string,
        lesson_id,
      }));
    }

    const courseJustCompleted = !!(stats && stats.total_lessons > 0 &&
      Math.round((stats.completed_lessons / stats.total_lessons) * 100) === 100 &&
      enrollment.progress_percent !== 100);
    if (is_completed || courseJustCompleted) {
      c.executionCtx.waitUntil(processLearningGamification(c.env, user.id, {
        lessonId: lesson_id,
        courseId: enrollment.course_id as string,
        lessonCompleted: !!is_completed,
        courseCompleted: courseJustCompleted,
      }));
    }

    return success(c, { message: 'Progress updated' });
  } catch (err) {
    console.error('[user:progress/complete]', err);
    return error(c, 'Gagal menyimpan progress', 500);
  }
});

// ─── POST /api/user/progress/watch ───────────
// Throttled video watch-position updates from the lesson player. Watch
// columns only ever grow (MAX semantics); completion status is untouched.
userRoutes.post('/progress/watch', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    const { enrollment_id, lesson_id, position_seconds, duration_seconds, milestone } = body;

    if (!enrollment_id || !lesson_id) return error(c, 'Missing required fields', 400);
    const position = Math.max(0, Math.floor(Number(position_seconds) || 0));
    const duration = Math.max(0, Math.floor(Number(duration_seconds) || 0));
    const watchPercent = duration > 0 ? Math.min(100, Math.round((position / duration) * 100)) : 0;

    // Same IDOR guard as /progress/complete
    const enrollment = await c.env.DB.prepare(
      `SELECT e.id, e.course_id FROM enrollments e
       JOIN lessons l ON l.course_id = e.course_id AND l.id = ?
       WHERE e.id = ? AND e.user_id = ?`
    ).bind(lesson_id, enrollment_id, user.id).first();
    if (!enrollment) return error(c, 'Unauthorized or lesson does not belong to this course', 403);

    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `INSERT INTO lesson_progress (id, enrollment_id, lesson_id, status, completed_at, updated_at, watch_seconds, watch_percent, last_position_seconds)
       VALUES (?, ?, ?, 'in_progress', NULL, ?, ?, ?, ?)
       ON CONFLICT(enrollment_id, lesson_id) DO UPDATE SET
         watch_seconds = MAX(lesson_progress.watch_seconds, excluded.watch_seconds),
         watch_percent = MAX(lesson_progress.watch_percent, excluded.watch_percent),
         last_position_seconds = excluded.last_position_seconds,
         status = CASE WHEN lesson_progress.status = 'completed' THEN 'completed' ELSE 'in_progress' END,
         updated_at = excluded.updated_at`
    ).bind(crypto.randomUUID(), enrollment_id, lesson_id, now, position, watchPercent, position).run();

    const milestoneVal = Number(milestone);
    if ([25, 50, 75].includes(milestoneVal)) {
      c.executionCtx.waitUntil(trackServerEvent(c.env, {
        event_name: 'lesson_progress',
        event_category: 'learning',
        user_id: user.id,
        course_id: enrollment.course_id as string,
        lesson_id,
        metadata: { milestone: milestoneVal, position_seconds: position, duration_seconds: duration },
      }));
    }

    return success(c, { message: 'Watch progress updated' });
  } catch (err) {
    console.error('[user:progress/watch]', err);
    return error(c, 'Gagal menyimpan progress tontonan', 500);
  }
});

// ─── GET /api/user/profile ───────────
userRoutes.get('/profile', async (c) => {
  try {
    const user = c.get('user');
    const profile = await c.env.DB.prepare(
      'SELECT u.id, u.name, u.email, u.phone, u.avatar_url, u.bio, u.city_code, u.map_visibility, p.role, p.primary_goal, p.ai_level, p.recommended_track, p.onboarding_completed, p.interests_json ' +
      'FROM users u LEFT JOIN user_profiles p ON u.id = p.user_id WHERE u.id = ?'
    ).bind(user.id).first();
    
    if (profile && profile.interests_json) {
      try {
        profile.interests = JSON.parse(profile.interests_json as string);
      } catch (e) {}
      delete profile.interests_json;
    }
    
    return success(c, profile);
  } catch (err) {
    console.error('[user:profile/get]', err);
    return error(c, 'Gagal memuat profil', 500);
  }
});

// ─── POST /api/user/onboarding ───────────
userRoutes.post('/onboarding', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();
    
    const { role, primary_goal, ai_level, interests, recommended_track } = body;
    const now = new Date().toISOString();

    // interests = array skill id; validasi terhadap taxonomy
    let validInterests: string[] = [];
    if (Array.isArray(interests) && interests.length > 0) {
      const placeholders = interests.slice(0, 10).map(() => '?').join(', ');
      const rows = await c.env.DB.prepare(
        `SELECT id FROM skills WHERE id IN (${placeholders}) AND is_active = 1`
      ).bind(...interests.slice(0, 10)).all<{ id: string }>();
      validInterests = rows.results.map((r) => r.id);
    }
    const onboardingVersion = validInterests.length > 0 ? 2 : 1;

    await c.env.DB.prepare(
      `INSERT INTO user_profiles (id, user_id, role, primary_goal, ai_level, recommended_track, onboarding_completed, onboarding_version, interests_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         role = COALESCE(excluded.role, user_profiles.role),
         primary_goal = COALESCE(excluded.primary_goal, user_profiles.primary_goal),
         ai_level = COALESCE(excluded.ai_level, user_profiles.ai_level),
         recommended_track = COALESCE(excluded.recommended_track, user_profiles.recommended_track),
         onboarding_completed = 1,
         onboarding_version = excluded.onboarding_version,
         interests_json = COALESCE(excluded.interests_json, user_profiles.interests_json),
         updated_at = excluded.updated_at`
    ).bind(
      crypto.randomUUID(),
      user.id,
      role || null,
      primary_goal || null,
      ai_level || null,
      recommended_track || null,
      onboardingVersion,
      validInterests.length > 0 ? JSON.stringify(validInterests) : null,
      now,
      now
    ).run();

    c.executionCtx.waitUntil(trackServerEvent(c.env, {
      event_name: 'onboarding_completed',
      event_category: 'auth',
      user_id: user.id,
      metadata: {
        role: role || null,
        primary_goal: primary_goal || null,
        ai_level: ai_level || null,
      },
    }));

    return success(c, { message: 'Onboarding saved successfully' });
  } catch (err) {
    console.error('[user:onboarding]', err);
    return error(c, 'Gagal menyimpan onboarding', 500);
  }
});

userRoutes.put('/profile', validate(updateProfileSchema), async (c) => {
  try {
    const user = c.get('user');
    const body = c.get('validatedBody' as never) as {
      name: string;
      phone?: string | null;
      avatar_url?: string | null;
      bio?: string | null;
      city_code?: string | null;
      map_visibility?: string;
    };

    const now = new Date().toISOString();
    // Dynamic SET: field yang tidak dikirim tidak disentuh; null eksplisit menghapus nilai
    const sets = ['name = ?', 'updated_at = ?'];
    const binds: unknown[] = [body.name.trim(), now];
    if ('phone' in body) { sets.splice(1, 0, 'phone = ?'); binds.splice(1, 0, body.phone || null); }
    if (body.avatar_url) { sets.push('avatar_url = ?'); binds.push(body.avatar_url); }
    if ('bio' in body) { sets.push('bio = ?'); binds.push(body.bio?.trim() || null); }
    if ('city_code' in body) { sets.push('city_code = ?'); binds.push(body.city_code || null); }
    if (body.map_visibility) { sets.push('map_visibility = ?'); binds.push(body.map_visibility); }

    await c.env.DB.prepare(
      `UPDATE users SET ${sets.join(', ')} WHERE id = ?`
    ).bind(...binds, user.id).run();

    if ('city_code' in body || body.map_visibility) {
      c.executionCtx.waitUntil(c.env.KV.delete(MEMBER_MAP_CACHE_KEY));
    }

    return success(c, { message: 'Profile updated' });
  } catch (err) {
    console.error('[user:profile]', err);
    return error(c, 'Gagal memperbarui profil', 500);
  }
});

// ─── GET /api/user/member-map ───────────
// Agregat peta member per kota. Hanya row opt-in (anonymous/name/full) yang di-scan;
// identitas (nama/avatar/tier) hanya untuk 'name'/'full', bio hanya untuk 'full'.
userRoutes.get('/member-map', async (c) => {
  try {
    const user = c.get('user');

    let aggregate: { cities: MemberMapCity[]; total_members: number } | null = null;
    const cached = await c.env.KV.get(MEMBER_MAP_CACHE_KEY, 'json');
    if (cached) {
      aggregate = cached as { cities: MemberMapCity[]; total_members: number };
    } else {
      const now = new Date().toISOString();
      const rows = await c.env.DB.prepare(
        `SELECT u.city_code, u.map_visibility, u.name, u.avatar_url, u.bio,
                EXISTS(SELECT 1 FROM memberships m
                       WHERE m.user_id = u.id AND m.status = 'active'
                         AND (m.expires_at IS NULL OR m.expires_at > ?)) AS is_premium
         FROM users u
         WHERE u.status = 'active' AND u.city_code IS NOT NULL
           AND u.map_visibility IN ('anonymous', 'name', 'full')`
      ).bind(now).all<{
        city_code: string; map_visibility: string; name: string;
        avatar_url: string | null; bio: string | null; is_premium: number;
      }>();

      const byCity = new Map<string, MemberMapCity>();
      let total = 0;
      for (const row of rows.results) {
        const city = CITY_BY_CODE[row.city_code];
        if (!city) continue;
        let entry = byCity.get(city.code);
        if (!entry) {
          entry = { code: city.code, name: city.name, province: city.province, lat: city.lat, lng: city.lng, count: 0, members: [] };
          byCity.set(city.code, entry);
        }
        entry.count += 1;
        total += 1;
        if (row.map_visibility !== 'anonymous' && entry.members.length < MEMBER_MAP_MEMBERS_PER_CITY) {
          entry.members.push({
            name: row.name,
            avatar_url: row.avatar_url,
            bio: row.map_visibility === 'full' ? row.bio : null,
            tier: row.is_premium ? 'premium' : 'free',
          });
        }
      }

      aggregate = {
        cities: [...byCity.values()].sort((a, b) => b.count - a.count),
        total_members: total,
      };
      c.executionCtx.waitUntil(
        c.env.KV.put(MEMBER_MAP_CACHE_KEY, JSON.stringify(aggregate), { expirationTtl: MEMBER_MAP_CACHE_TTL })
      );
    }

    const me = await c.env.DB.prepare(
      'SELECT city_code, map_visibility FROM users WHERE id = ?'
    ).bind(user.id).first<{ city_code: string | null; map_visibility: string }>();

    const response: MemberMapResponse = {
      ...aggregate,
      me: {
        city_code: me?.city_code ?? null,
        map_visibility: (me?.map_visibility ?? 'hidden') as MemberMapResponse['me']['map_visibility'],
      },
    };
    return success(c, response);
  } catch (err) {
    console.error('[user:member-map]', err);
    return error(c, 'Gagal memuat peta member', 500);
  }
});

// ─── GET /api/user/member-map/:cityCode ───────────
// Daftar member satu kota, dipaginasi (untuk popup peta). Hanya row name/full yang
// ditampilkan (anonymous tidak pernah masuk daftar). bio hanya untuk 'full'.
userRoutes.get('/member-map/:cityCode', async (c) => {
  try {
    const cityCode = c.req.param('cityCode');
    if (!(cityCode in CITY_BY_CODE)) return error(c, 'Kota tidak valid', 404);

    const limit = 12;
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
    const offset = (page - 1) * limit;
    const now = new Date().toISOString();

    const totalRow = await c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM users
       WHERE status = 'active' AND city_code = ? AND map_visibility IN ('name', 'full')`
    ).bind(cityCode).first<{ n: number }>();
    const total = totalRow?.n ?? 0;

    const rows = await c.env.DB.prepare(
      `SELECT u.name, u.avatar_url, u.bio, u.map_visibility,
              EXISTS(SELECT 1 FROM memberships m
                     WHERE m.user_id = u.id AND m.status = 'active'
                       AND (m.expires_at IS NULL OR m.expires_at > ?)) AS is_premium
       FROM users u
       WHERE u.status = 'active' AND u.city_code = ? AND u.map_visibility IN ('name', 'full')
       ORDER BY is_premium DESC, u.name COLLATE NOCASE ASC, u.id ASC
       LIMIT ? OFFSET ?`
    ).bind(now, cityCode, limit, offset).all<{
      name: string; avatar_url: string | null; bio: string | null; map_visibility: string; is_premium: number;
    }>();

    const members = rows.results.map((r) => ({
      name: r.name,
      avatar_url: r.avatar_url,
      bio: r.map_visibility === 'full' ? r.bio : null,
      tier: r.is_premium ? 'premium' : 'free',
    }));

    return success(c, { city_code: cityCode, page, limit, total, members });
  } catch (err) {
    console.error('[user:member-map/city]', err);
    return error(c, 'Gagal memuat member kota', 500);
  }
});

// ─── POST /api/user/milestones ───────────
userRoutes.post('/milestones', validate(recordMilestoneSchema), async (c) => {
  try {
    const user = c.get('user');
    const body = c.get('validatedBody' as never) as { milestone: MenuMilestone };

    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO user_milestones (user_id, milestone, created_at) VALUES (?, ?, ?)'
    ).bind(user.id, body.milestone, new Date().toISOString()).run();

    return success(c, { recorded: true });
  } catch (err) {
    console.error('[user:milestones]', err);
    return error(c, 'Gagal menyimpan milestone', 500);
  }
});

// ─── GET /api/user/checklist ───────────
userRoutes.get('/checklist', async (c) => {
  try {
    const user = c.get('user');

    const [profileRow, lessonRow, milestoneRows] = await Promise.all([
      c.env.DB.prepare(
        'SELECT name, phone, avatar_url, bio, city_code FROM users WHERE id = ?'
      ).bind(user.id).first<{ name: string | null; phone: string | null; avatar_url: string | null; bio: string | null; city_code: string | null }>(),
      c.env.DB.prepare(
        `SELECT EXISTS(
           SELECT 1 FROM lesson_progress lp
           JOIN enrollments e ON lp.enrollment_id = e.id
           WHERE e.user_id = ?
         ) AS started`
      ).bind(user.id).first<{ started: number }>(),
      c.env.DB.prepare(
        'SELECT milestone FROM user_milestones WHERE user_id = ?'
      ).bind(user.id).all<{ milestone: string }>(),
    ]);

    const missing: string[] = [];
    if (!profileRow?.name) missing.push('Nama');
    if (!profileRow?.phone) missing.push('No. WhatsApp');
    if (!profileRow?.avatar_url) missing.push('Avatar');
    if (!profileRow?.bio) missing.push('Deskripsi tentang saya');

    const visitedSet = new Set(milestoneRows.results.map((r) => r.milestone));
    const visited = Object.fromEntries(
      MENU_MILESTONES.map((m) => [m, visitedSet.has(m)])
    ) as Record<MenuMilestone, boolean>;

    const checklist: ChecklistResponse = {
      profile: { done: missing.length === 0, missing },
      map: { done: true }, // Peta Member (GWA) dinonaktifkan untuk PejuangYen — tidak dihitung
      first_lesson: { done: !!lessonRow?.started },
      menus: { done: MENU_MILESTONES.every((m) => visitedSet.has(m)), visited },
      completed: 0,
      total: 3,
    };
    checklist.completed = [
      checklist.profile.done,
      checklist.first_lesson.done,
      checklist.menus.done,
    ].filter(Boolean).length;

    return success(c, checklist);
  } catch (err) {
    console.error('[user:checklist]', err);
    return error(c, 'Gagal memuat checklist', 500);
  }
});

// ─── GET /api/user/membership ───────────
userRoutes.get('/membership', async (c) => {
  try {
    const user = c.get('user');
    const now = new Date().toISOString();

    const membership = await c.env.DB.prepare(
      `SELECT m.id, m.status, m.starts_at, m.expires_at, m.created_at,
              p.name as plan_name, p.duration_type, p.slug as plan_slug
       FROM memberships m
       JOIN membership_plans p ON m.plan_id = p.id
       WHERE m.user_id = ? AND m.status = 'active'
         AND (m.expires_at IS NULL OR m.expires_at > ?)
       ORDER BY m.created_at DESC
       LIMIT 1`
    ).bind(user.id, now).first();

    return success(c, membership || null);
  } catch (err) {
    console.error('[user:membership]', err);
    return error(c, 'Gagal memuat membership', 500);
  }
});

// ─── GET /api/user/transactions ───────────
userRoutes.get('/transactions', async (c) => {
  try {
    const user = c.get('user');

    const orders = await c.env.DB.prepare(
      `SELECT id, order_number, order_type, product_name, amount, currency,
              status, created_at, paid_at, cancelled_at
       FROM orders
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`
    ).bind(user.id).all();

    return success(c, orders.results);
  } catch (err) {
    console.error('[user:transactions]', err);
    return error(c, 'Gagal memuat transaksi', 500);
  }
});

// ─── GET /api/user/notifications ───────────
userRoutes.get('/notifications', async (c) => {
  try {
    const user = c.get('user');
    const rows = await c.env.DB.prepare(
      `SELECT id, type, title, body, data_json, read_at, created_at
       FROM notifications
       WHERE user_id = ? AND status = 'sent'
       ORDER BY created_at DESC LIMIT 20`
    ).bind(user.id).all();
    return success(c, rows.results);
  } catch (err) {
    console.error('[user:notifications]', err);
    return error(c, 'Gagal memuat notifikasi', 500);
  }
});

// ─── PATCH /api/user/notifications/read-all ───────────
// Didefinisikan SEBELUM /:id/read agar pasti tidak tertangkap sebagai :id.
userRoutes.patch('/notifications/read-all', async (c) => {
  try {
    const user = c.get('user');
    await c.env.DB.prepare(
      `UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL`
    ).bind(new Date().toISOString(), user.id).run();
    return success(c, { message: 'All marked as read' });
  } catch (err) {
    console.error('[user:notifications/read-all]', err);
    return error(c, 'Gagal memperbarui notifikasi', 500);
  }
});

// ─── PATCH /api/user/notifications/:id/read ───────────
userRoutes.patch('/notifications/:id/read', async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    await c.env.DB.prepare(
      `UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?`
    ).bind(new Date().toISOString(), id, user.id).run();
    return success(c, { message: 'Marked as read' });
  } catch (err) {
    console.error('[user:notifications/read]', err);
    return error(c, 'Gagal memperbarui notifikasi', 500);
  }
});

// ─── POST /api/user/checkin ───────────
// Daily check-in: advances the streak and awards 5 points, max once per
// UTC day (idempotent via point_transactions unique index on ref_id = date).
userRoutes.post('/checkin', async (c) => {
  try {
    const user = c.get('user');
    const today = new Date().toISOString().slice(0, 10);

    const streak = await updateStreak(c.env, user.id);
    const awarded = await awardPoints(c.env, user.id, 'daily_checkin', today);

    const newBadges: string[] = [];
    if (streak && streak.current_streak >= 7) {
      const streakRunStart = new Date(Date.now() - (streak.current_streak - 1) * 86400000).toISOString().slice(0, 10);
      await awardPoints(c.env, user.id, 'streak_bonus_7', streakRunStart);
      if (await awardBadge(c.env, user.id, 'consistent_7')) newBadges.push('consistent_7');
      if (streak.current_streak >= 30) {
        await awardPoints(c.env, user.id, 'streak_bonus_30', streakRunStart);
        if (await awardBadge(c.env, user.id, 'consistent_30')) newBadges.push('consistent_30');
      }
    }

    const totals = await c.env.DB.prepare(
      'SELECT total_points FROM user_points WHERE user_id = ?'
    ).bind(user.id).first();

    return success(c, {
      checked_in: awarded,
      already_checked_in: !awarded,
      current_streak: streak?.current_streak || 0,
      longest_streak: streak?.longest_streak || 0,
      total_points: (totals?.total_points as number) || 0,
      new_badges: newBadges,
    });
  } catch (err) {
    console.error('[user:checkin]', err);
    return error(c, 'Gagal melakukan check-in', 500);
  }
});

// ─── POST /api/user/change-password ───────────
userRoutes.post('/change-password', validate(changePasswordSchema), async (c) => {
  try {
    const user = c.get('user');
    const body = c.get('validatedBody' as never) as { current_password: string; new_password: string };

    const dbUser = await c.env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first();
    if (!dbUser?.password_hash) return error(c, 'Unauthorized', 401);

    const valid = await verifyPassword(body.current_password, dbUser.password_hash as string);
    if (!valid) return error(c, 'Password saat ini salah', 401);

    const newHash = await hashPassword(body.new_password);
    const now = new Date().toISOString();
    await c.env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').bind(newHash, now, user.id).run();

    return success(c, { message: 'Password berhasil diubah' });
  } catch (err) {
    console.error('[user:change-password]', err);
    return error(c, 'Gagal mengubah password', 500);
  }
});

export default userRoutes;
