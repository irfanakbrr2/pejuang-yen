import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error, paginated } from '../../lib/response';

const adminAnalyticsRoutes = new Hono<{ Bindings: Env }>();
adminAnalyticsRoutes.use('*', authMiddleware());
adminAnalyticsRoutes.use('*', requireRole('admin', 'super_admin'));

function clampDays(raw: string | undefined, fallback: number): number {
  const parsed = parseInt(raw || '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(365, Math.max(1, parsed));
}

function utcDate(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}

function isIsoDate(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// ─── GET /api/admin/analytics/overview?days=30 ───────────
adminAnalyticsRoutes.get('/overview', async (c) => {
  const days = clampDays(c.req.query('days'), 30);
  const from = utcDate(days - 1);
  const today = utcDate(0);

  const [active, signups, revenue, trend, todayLive] = await Promise.all([
    c.env.DB.prepare(
      `SELECT
         (SELECT COUNT(DISTINCT user_id) FROM user_activity_days WHERE activity_date = ?) as dau,
         (SELECT COUNT(DISTINCT user_id) FROM user_activity_days WHERE activity_date >= ?) as wau,
         (SELECT COUNT(DISTINCT user_id) FROM user_activity_days WHERE activity_date >= ?) as mau`
    ).bind(today, utcDate(6), utcDate(29)).first(),
    c.env.DB.prepare(
      `SELECT COUNT(*) as n FROM users WHERE created_at >= ?`
    ).bind(`${from}T00:00:00.000Z`).first(),
    c.env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as orders FROM orders WHERE status = 'paid' AND paid_at >= ?`
    ).bind(`${from}T00:00:00.000Z`).first(),
    c.env.DB.prepare(
      `SELECT event_date, event_name, count, unique_users FROM events_daily
       WHERE event_date >= ? ORDER BY event_date ASC`
    ).bind(from).all(),
    c.env.DB.prepare(
      `SELECT event_name, COUNT(*) as count, COUNT(DISTINCT user_id) as unique_users
       FROM tracking_events WHERE created_at >= ? GROUP BY event_name`
    ).bind(`${today}T00:00:00.000Z`).all(),
  ]);

  return success(c, {
    dau: (active?.dau as number) || 0,
    wau: (active?.wau as number) || 0,
    mau: (active?.mau as number) || 0,
    signups_period: (signups?.n as number) || 0,
    revenue_period: (revenue?.total as number) || 0,
    paid_orders_period: (revenue?.orders as number) || 0,
    trend: trend.results,
    today: todayLive.results.map((r) => ({ ...r, event_date: today })),
  });
});

// ─── GET /api/admin/analytics/commerce?days=30 ───────────
// Tab Penjualan: conversion checkout, status order, metode pembayaran,
// performa sales funnel, kupon, AOV. (Metrik MRR/ARR ada di /admin/revenue — jangan duplikasi.)
adminAnalyticsRoutes.get('/commerce', async (c) => {
  const days = clampDays(c.req.query('days'), 30);
  const from = utcDate(days - 1);
  const fromTs = `${from}T00:00:00.000Z`;
  const today = utcDate(0);

  const FUNNEL_EVENTS = ['checkout_intent', 'checkout_started', 'payment_success'];

  const [funnelDaily, funnelToday, orderStatus, paymentMethods, funnelPerf, topCoupons, aovByType, aovTrend] = await Promise.all([
    c.env.DB.prepare(
      `SELECT event_name, SUM(count) as count FROM events_daily
       WHERE event_date >= ? AND event_name IN ('checkout_intent','checkout_started','payment_success')
       GROUP BY event_name`
    ).bind(from).all(),
    c.env.DB.prepare(
      `SELECT event_name, COUNT(*) as count FROM tracking_events
       WHERE created_at >= ? AND event_name IN ('checkout_intent','checkout_started','payment_success')
       GROUP BY event_name`
    ).bind(`${today}T00:00:00.000Z`).all(),
    c.env.DB.prepare(
      `SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as amount
       FROM orders WHERE created_at >= ? GROUP BY status`
    ).bind(fromTs).all(),
    c.env.DB.prepare(
      `SELECT COALESCE(NULLIF(payment_method, ''), '(unknown)') as payment_method,
              COALESCE(NULLIF(payment_provider, ''), '(unknown)') as payment_provider,
              COUNT(*) as count, COALESCE(SUM(amount), 0) as revenue
       FROM orders WHERE status = 'paid' AND paid_at >= ?
       GROUP BY 1, 2 ORDER BY revenue DESC`
    ).bind(fromTs).all(),
    c.env.DB.prepare(
      `SELECT f.id as funnel_id, f.name as funnel_name, fe.step_type,
              SUM(CASE WHEN fe.event_type = 'viewed' THEN 1 ELSE 0 END) as viewed,
              SUM(CASE WHEN fe.event_type = 'accepted' THEN 1 ELSE 0 END) as accepted,
              SUM(CASE WHEN fe.event_type = 'declined' THEN 1 ELSE 0 END) as declined,
              SUM(CASE WHEN fe.event_type = 'converted' THEN 1 ELSE 0 END) as converted,
              COALESCE(SUM(CASE WHEN fe.event_type = 'converted' THEN fe.amount ELSE 0 END), 0) as revenue
       FROM funnel_events fe JOIN funnels f ON f.id = fe.funnel_id
       WHERE fe.created_at >= ?
       GROUP BY f.id, fe.step_type ORDER BY revenue DESC`
    ).bind(fromTs).all(),
    c.env.DB.prepare(
      `SELECT coupon_code, COUNT(*) as redemptions,
              COALESCE(SUM(discount_amount), 0) as discount_total,
              COALESCE(SUM(total_amount), 0) as revenue
       FROM coupon_redemptions WHERE status = 'paid' AND redeemed_at >= ?
       GROUP BY coupon_code ORDER BY redemptions DESC LIMIT 10`
    ).bind(fromTs).all(),
    c.env.DB.prepare(
      `SELECT order_type, COUNT(*) as orders, COALESCE(SUM(amount), 0) as revenue,
              CAST(ROUND(AVG(amount)) AS INTEGER) as aov
       FROM orders WHERE status = 'paid' AND paid_at >= ? AND amount > 0
       GROUP BY order_type ORDER BY revenue DESC`
    ).bind(fromTs).all(),
    c.env.DB.prepare(
      `SELECT substr(paid_at, 1, 10) as day, COUNT(*) as orders,
              COALESCE(SUM(amount), 0) as revenue,
              CAST(ROUND(AVG(amount)) AS INTEGER) as aov
       FROM orders WHERE status = 'paid' AND paid_at >= ? AND amount > 0
       GROUP BY 1 ORDER BY 1 ASC`
    ).bind(fromTs).all(),
  ]);

  // Gabungkan agregat harian + live hari ini
  const funnel: Record<string, number> = {};
  for (const name of FUNNEL_EVENTS) funnel[name] = 0;
  for (const row of funnelDaily.results as { event_name: string; count: number }[]) {
    funnel[row.event_name] = (funnel[row.event_name] || 0) + Number(row.count || 0);
  }
  for (const row of funnelToday.results as { event_name: string; count: number }[]) {
    funnel[row.event_name] = (funnel[row.event_name] || 0) + Number(row.count || 0);
  }
  const conversionRate = funnel.checkout_started > 0
    ? funnel.payment_success / funnel.checkout_started
    : null;

  const funnelPerformance = (funnelPerf.results as Record<string, unknown>[]).map((row) => {
    const viewed = Number(row.viewed || 0);
    return {
      ...row,
      accept_rate: viewed > 0 ? Number(row.accepted || 0) / viewed : null,
      convert_rate: viewed > 0 ? Number(row.converted || 0) / viewed : null,
    };
  });

  return success(c, {
    funnel: { ...funnel, conversion_rate: conversionRate },
    order_status: orderStatus.results,
    payment_methods: paymentMethods.results,
    funnel_performance: funnelPerformance,
    top_coupons: topCoupons.results,
    aov_by_type: aovByType.results,
    aov_trend: aovTrend.results,
  });
});

// ─── GET /api/admin/analytics/sources?from&to ───────────
adminAnalyticsRoutes.get('/sources', async (c) => {
  const from = isIsoDate(c.req.query('from')) ? c.req.query('from')! : utcDate(29);
  const to = isIsoDate(c.req.query('to')) ? c.req.query('to')! : utcDate(0);

  const [acquisition, firstTouch, signupSources, upgradeSources] = await Promise.all([
    c.env.DB.prepare(
      `SELECT source, medium, campaign,
              SUM(signups) as signups, SUM(checkouts) as checkouts,
              SUM(payments) as payments, SUM(revenue) as revenue
       FROM acquisition_daily
       WHERE event_date >= ? AND event_date <= ?
       GROUP BY source, medium, campaign
       ORDER BY revenue DESC, signups DESC
       LIMIT 100`
    ).bind(from, to).all(),
    c.env.DB.prepare(
      `SELECT COALESCE(NULLIF(first_source, ''), '(none)') as source, COUNT(*) as users
       FROM user_attribution GROUP BY 1 ORDER BY users DESC LIMIT 50`
    ).all(),
    c.env.DB.prepare(
      `SELECT COALESCE(NULLIF(signup_source, ''), '(none)') as source, COUNT(*) as users
       FROM user_attribution GROUP BY 1 ORDER BY users DESC LIMIT 50`
    ).all(),
    c.env.DB.prepare(
      `SELECT COALESCE(NULLIF(ua.upgrade_source, ''), '(none)') as source,
              COUNT(*) as upgrades,
              COALESCE(SUM(o.amount), 0) as revenue
       FROM user_attribution ua
       LEFT JOIN orders o ON o.user_id = ua.user_id AND o.status = 'paid' AND o.order_type = 'membership'
       WHERE ua.upgraded_at IS NOT NULL
       GROUP BY 1 ORDER BY revenue DESC LIMIT 50`
    ).all(),
  ]);

  return success(c, {
    from,
    to,
    acquisition: acquisition.results,
    first_touch: firstTouch.results,
    signup_sources: signupSources.results,
    upgrade_sources: upgradeSources.results,
  });
});

// ─── GET /api/admin/analytics/engagement?days=30 ───────────
adminAnalyticsRoutes.get('/engagement', async (c) => {
  const days = clampDays(c.req.query('days'), 30);
  const from = utcDate(days - 1);
  const fromTs = `${from}T00:00:00.000Z`;

  const [
    activeTrend, learningEvents, topCourses, landingPages,
    geo, devices,
    checkins, streakDist, topBadges,
    communityPosts, communityComments, communityLikes, topContributors,
  ] = await Promise.all([
    // ── existing sections (unchanged) ──
    c.env.DB.prepare(
      `SELECT activity_date, COUNT(DISTINCT user_id) as active_users
       FROM user_activity_days WHERE activity_date >= ?
       GROUP BY activity_date ORDER BY activity_date ASC`
    ).bind(from).all(),
    c.env.DB.prepare(
      `SELECT event_name, SUM(count) as count, MAX(unique_users) as unique_users
       FROM events_daily
       WHERE event_date >= ? AND event_name IN ('lesson_started', 'lesson_completed', 'course_completed', 'bonus_viewed', 'recording_viewed', 'page_view')
       GROUP BY event_name`
    ).bind(from).all(),
    c.env.DB.prepare(
      `SELECT te.course_id, c2.title as course_title, COUNT(*) as completions, COUNT(DISTINCT te.user_id) as users
       FROM tracking_events te
       LEFT JOIN courses c2 ON c2.id = te.course_id
       WHERE te.event_name = 'lesson_completed' AND te.created_at >= ?
       GROUP BY te.course_id ORDER BY completions DESC LIMIT 10`
    ).bind(fromTs).all(),
    c.env.DB.prepare(
      `SELECT COALESCE(NULLIF(landing_page, ''), '(none)') as landing_page, COUNT(*) as views
       FROM tracking_events
       WHERE event_name = 'page_view' AND created_at >= ?
       GROUP BY 1 ORDER BY views DESC LIMIT 20`
    ).bind(fromTs).all(),

    // ── geo: page views per country (top 12) ──
    c.env.DB.prepare(
      `SELECT COALESCE(NULLIF(country, ''), '(unknown)') as country, COUNT(*) as events
       FROM tracking_events
       WHERE event_name = 'page_view' AND created_at >= ?
       GROUP BY 1 ORDER BY events DESC LIMIT 12`
    ).bind(fromTs).all(),

    // ── devices: page views per device_type ──
    c.env.DB.prepare(
      `SELECT COALESCE(NULLIF(device_type, ''), '(unknown)') as device_type, COUNT(*) as count
       FROM tracking_events
       WHERE event_name = 'page_view' AND created_at >= ?
       GROUP BY 1 ORDER BY count DESC`
    ).bind(fromTs).all(),

    // ── gamification: daily check-ins in range ──
    c.env.DB.prepare(
      `SELECT COUNT(*) as n FROM point_transactions
       WHERE action = 'daily_checkin' AND earned_at >= ?`
    ).bind(fromTs).first(),
    // ── gamification: streak distribution (all users) ──
    c.env.DB.prepare(
      `SELECT
         SUM(CASE WHEN current_streak = 0 THEN 1 ELSE 0 END) as b0,
         SUM(CASE WHEN current_streak BETWEEN 1 AND 6 THEN 1 ELSE 0 END) as b1,
         SUM(CASE WHEN current_streak BETWEEN 7 AND 29 THEN 1 ELSE 0 END) as b2,
         SUM(CASE WHEN current_streak >= 30 THEN 1 ELSE 0 END) as b3
       FROM users WHERE status = 'active'`
    ).first(),
    // ── gamification: top badges ──
    c.env.DB.prepare(
      `SELECT badge_key, COUNT(*) as count
       FROM user_badges
       GROUP BY badge_key ORDER BY count DESC LIMIT 10`
    ).all(),

    // ── community: posts in range (published) ──
    c.env.DB.prepare(
      `SELECT COUNT(*) as n FROM community_posts
       WHERE status = 'published' AND created_at >= ?`
    ).bind(fromTs).first(),
    // ── community: comments in range ──
    c.env.DB.prepare(
      `SELECT COUNT(*) as n FROM community_comments WHERE created_at >= ?`
    ).bind(fromTs).first(),
    // ── community: likes in range ──
    c.env.DB.prepare(
      `SELECT COUNT(*) as n FROM community_post_likes WHERE created_at >= ?`
    ).bind(fromTs).first(),
    // ── community: top contributors by (posts + comments) in range ──
    c.env.DB.prepare(
      `SELECT u.id as user_id, u.name,
              COALESCE(p.posts, 0) as posts,
              COALESCE(cm.comments, 0) as comments,
              COALESCE(p.posts, 0) + COALESCE(cm.comments, 0) as total
       FROM users u
       LEFT JOIN (
         SELECT author_user_id, COUNT(*) as posts FROM community_posts
         WHERE created_at >= ? GROUP BY author_user_id
       ) p ON p.author_user_id = u.id
       LEFT JOIN (
         SELECT author_user_id, COUNT(*) as comments FROM community_comments
         WHERE created_at >= ? GROUP BY author_user_id
       ) cm ON cm.author_user_id = u.id
       WHERE COALESCE(p.posts, 0) + COALESCE(cm.comments, 0) > 0
       ORDER BY total DESC LIMIT 10`
    ).bind(fromTs, fromTs).all(),
  ]);

  const sd = streakDist as Record<string, number> | null;
  const streak_distribution = [
    { bucket: '0', users: Number(sd?.b0) || 0 },
    { bucket: '1-6', users: Number(sd?.b1) || 0 },
    { bucket: '7-29', users: Number(sd?.b2) || 0 },
    { bucket: '30+', users: Number(sd?.b3) || 0 },
  ];

  return success(c, {
    active_trend: activeTrend.results,
    learning_events: learningEvents.results,
    top_courses: topCourses.results,
    top_landing_pages: landingPages.results,
    geo: geo.results,
    devices: devices.results,
    gamification: {
      checkins: (checkins?.n as number) || 0,
      streak_distribution,
      top_badges: topBadges.results,
    },
    community: {
      posts: (communityPosts?.n as number) || 0,
      comments: (communityComments?.n as number) || 0,
      likes: (communityLikes?.n as number) || 0,
      top_contributors: topContributors.results,
    },
  });
});

// ─── GET /api/admin/analytics/learning ───────────
adminAnalyticsRoutes.get('/learning', async (c) => {
  const [courses, atRisk, topLearners, lessonDropoff, courseDropoffSummary] = await Promise.all([
    c.env.DB.prepare(
      `SELECT c2.id, c2.title,
              COUNT(e.id) as enrollments,
              ROUND(AVG(e.progress_percent), 1) as avg_progress,
              SUM(CASE WHEN e.progress_percent = 100 THEN 1 ELSE 0 END) as completed,
              SUM(CASE WHEN e.progress_percent > 0 AND e.progress_percent < 100 THEN 1 ELSE 0 END) as in_progress,
              SUM(CASE WHEN e.progress_percent = 0 THEN 1 ELSE 0 END) as not_started
       FROM courses c2
       LEFT JOIN enrollments e ON e.course_id = c2.id
       WHERE c2.status = 'published'
       GROUP BY c2.id ORDER BY enrollments DESC`
    ).all(),
    c.env.DB.prepare(
      `SELECT u.id, u.name, u.email, e.progress_percent, c2.title as course_title, o.paid_at
       FROM enrollments e
       JOIN users u ON u.id = e.user_id
       JOIN courses c2 ON c2.id = e.course_id
       JOIN orders o ON o.user_id = u.id AND o.status = 'paid'
       WHERE e.progress_percent < 20
         AND o.paid_at < datetime('now', '-7 days')
       GROUP BY e.id
       ORDER BY o.paid_at DESC
       LIMIT 50`
    ).all(),
    c.env.DB.prepare(
      `SELECT u.id, u.name, u.email,
              COUNT(DISTINCT uad.activity_date) as active_days_30,
              MAX(uad.activity_date) as last_active
       FROM user_activity_days uad
       JOIN users u ON u.id = uad.user_id
       WHERE uad.activity_date >= ?
       GROUP BY u.id ORDER BY active_days_30 DESC LIMIT 20`
    ).bind(utcDate(29)).all(),
    // lesson_dropoff: per published lesson of published courses, avg watch_percent
    // and number of progress rows. LEFT JOIN so zero-progress lessons still appear.
    // Ordering uses lessons.sort_order (verified column). Cap 300 rows.
    c.env.DB.prepare(
      `SELECT l.course_id as course_id,
              c2.title as course_title,
              l.id as lesson_id,
              l.title as lesson_title,
              l.sort_order as lesson_order,
              ROUND(AVG(lp.watch_percent), 1) as avg_watch_percent,
              COUNT(lp.id) as viewers
       FROM lessons l
       JOIN courses c2 ON c2.id = l.course_id
       LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id
       WHERE c2.status = 'published' AND l.status = 'published'
       GROUP BY l.id
       ORDER BY c2.sort_order ASC, c2.title ASC, l.sort_order ASC, l.created_at ASC, l.id ASC
       LIMIT 300`
    ).all(),
    // course_dropoff_summary: per published course, overall avg watch_percent + the
    // lesson with the steepest drop (lowest avg watch_percent among lessons with viewers).
    c.env.DB.prepare(
      `SELECT c2.id as course_id,
              c2.title as course_title,
              ROUND(AVG(lp.watch_percent), 1) as avg_watch_percent,
              COUNT(lp.id) as viewers,
              (SELECT l2.id FROM lessons l2
                 JOIN lesson_progress lp2 ON lp2.lesson_id = l2.id
               WHERE l2.course_id = c2.id AND l2.status = 'published'
               GROUP BY l2.id
               ORDER BY AVG(lp2.watch_percent) ASC, l2.sort_order ASC
               LIMIT 1) as steepest_drop_lesson_id,
              (SELECT l3.title FROM lessons l3
                 JOIN lesson_progress lp3 ON lp3.lesson_id = l3.id
               WHERE l3.course_id = c2.id AND l3.status = 'published'
               GROUP BY l3.id
               ORDER BY AVG(lp3.watch_percent) ASC, l3.sort_order ASC
               LIMIT 1) as steepest_drop_lesson_title
       FROM courses c2
       JOIN lessons l ON l.course_id = c2.id AND l.status = 'published'
       LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id
       WHERE c2.status = 'published'
       GROUP BY c2.id
       ORDER BY avg_watch_percent ASC
       LIMIT 100`
    ).all(),
  ]);

  return success(c, {
    courses: courses.results,
    low_progress_paid_users: atRisk.results,
    top_engaged_users: topLearners.results,
    lesson_dropoff: lessonDropoff.results,
    course_dropoff_summary: courseDropoffSummary.results,
  });
});

// ─── GET /api/admin/analytics/member-health ───────────
// Classifies paid members (active membership) by recent activity so the
// admin can act on retention, not just observe traffic:
//   active  — ≥3 active days in the last 30 days
//   at_risk — some activity in the last 30 days, but <3 active days
//   dormant — no activity at all in the last 14 days
adminAnalyticsRoutes.get('/member-health', async (c) => {
  const now = new Date().toISOString();
  const d30 = utcDate(29);
  const d14 = utcDate(13);

  const members = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.current_streak,
            p.name as plan_name,
            (SELECT COUNT(*) FROM user_activity_days uad
             WHERE uad.user_id = u.id AND uad.activity_date >= ?) as active_days_30,
            (SELECT MAX(activity_date) FROM user_activity_days uad
             WHERE uad.user_id = u.id) as last_active
     FROM memberships m
     JOIN users u ON u.id = m.user_id
     JOIN membership_plans p ON p.id = m.plan_id
     WHERE m.status = 'active' AND (m.expires_at IS NULL OR m.expires_at > ?)
       AND u.status = 'active'
     GROUP BY u.id`
  ).bind(d30, now).all();

  const active: unknown[] = [];
  const atRisk: unknown[] = [];
  const dormant: unknown[] = [];

  for (const row of members.results as any[]) {
    const activeDays = Number(row.active_days_30) || 0;
    const lastActive = (row.last_active as string | null) || null;
    const entry = {
      id: row.id,
      name: row.name,
      email: row.email,
      plan_name: row.plan_name,
      active_days_30: activeDays,
      last_active: lastActive,
      current_streak: Number(row.current_streak) || 0,
    };
    if (!lastActive || lastActive < d14) dormant.push(entry);
    else if (activeDays >= 3) active.push(entry);
    else atRisk.push(entry);
  }

  const sortByLastActive = (a: any, b: any) => (a.last_active || '').localeCompare(b.last_active || '');
  dormant.sort(sortByLastActive);
  atRisk.sort(sortByLastActive);

  return success(c, {
    total_paid_members: members.results.length,
    counts: { active: active.length, at_risk: atRisk.length, dormant: dormant.length },
    active: active.slice(0, 50),
    at_risk: atRisk.slice(0, 50),
    dormant: dormant.slice(0, 50),
  });
});

// ─── GET /api/admin/analytics/events ───────────
adminAnalyticsRoutes.get('/events', async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const limit = Math.min(100, parseInt(c.req.query('limit') || '50', 10));
  const offset = (page - 1) * limit;
  const eventName = c.req.query('event_name');
  const userId = c.req.query('user_id');
  const email = c.req.query('email');
  const from = c.req.query('from');
  const to = c.req.query('to');

  let where = 'WHERE 1=1';
  const params: unknown[] = [];

  if (eventName) { where += ' AND te.event_name = ?'; params.push(eventName); }
  if (userId) { where += ' AND te.user_id = ?'; params.push(userId); }
  if (email) {
    const userRow = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase().trim()).first();
    if (!userRow) return paginated(c, [], { page, limit, total: 0 });
    where += ' AND te.user_id = ?';
    params.push(userRow.id);
  }
  if (isIsoDate(from)) { where += ' AND te.created_at >= ?'; params.push(`${from}T00:00:00.000Z`); }
  if (isIsoDate(to)) { where += ' AND te.created_at <= ?'; params.push(`${to}T23:59:59.999Z`); }

  const total = ((await c.env.DB.prepare(`SELECT COUNT(*) as n FROM tracking_events te ${where}`).bind(...params).first())?.n as number) || 0;
  const rows = await c.env.DB.prepare(
    `SELECT te.*, u.email as user_email, u.name as user_name
     FROM tracking_events te
     LEFT JOIN users u ON u.id = te.user_id
     ${where}
     ORDER BY te.created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return paginated(c, rows.results, { page, limit, total });
});

// ─── GET /api/admin/analytics/export?type=events|sources ───────────
adminAnalyticsRoutes.get('/export', async (c) => {
  const type = c.req.query('type') || 'events';
  const from = isIsoDate(c.req.query('from')) ? c.req.query('from')! : utcDate(29);
  const to = isIsoDate(c.req.query('to')) ? c.req.query('to')! : utcDate(0);

  let header: string[];
  let rows: Record<string, unknown>[];

  if (type === 'sources') {
    const result = await c.env.DB.prepare(
      `SELECT event_date, source, medium, campaign, signups, checkouts, payments, revenue
       FROM acquisition_daily
       WHERE event_date >= ? AND event_date <= ?
       ORDER BY event_date ASC LIMIT 10000`
    ).bind(from, to).all();
    header = ['event_date', 'source', 'medium', 'campaign', 'signups', 'checkouts', 'payments', 'revenue'];
    rows = result.results as Record<string, unknown>[];
  } else if (type === 'events') {
    const result = await c.env.DB.prepare(
      `SELECT te.created_at, te.event_name, te.event_category, u.email as user_email,
              te.page_url, te.utm_source, te.utm_medium, te.utm_campaign,
              te.affiliate_code, te.course_id, te.lesson_id, te.webinar_id,
              te.order_id, te.payment_amount, te.payment_status, te.device_type, te.country
       FROM tracking_events te
       LEFT JOIN users u ON u.id = te.user_id
       WHERE te.created_at >= ? AND te.created_at <= ?
       ORDER BY te.created_at DESC LIMIT 10000`
    ).bind(`${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`).all();
    header = ['created_at', 'event_name', 'event_category', 'user_email', 'page_url', 'utm_source', 'utm_medium', 'utm_campaign', 'affiliate_code', 'course_id', 'lesson_id', 'webinar_id', 'order_id', 'payment_amount', 'payment_status', 'device_type', 'country'];
    rows = result.results as Record<string, unknown>[];
  } else {
    return error(c, 'Unknown export type', 400);
  }

  const csv = [
    header.join(','),
    ...rows.map((row) => header.map((key) => csvEscape(row[key])).join(',')),
  ].join('\n');

  return c.body(csv, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="analytics-${type}-${from}-${to}.csv"`,
  });
});

// ─── GET /api/admin/analytics/webinar-funnel?days=30 ───────────
// Tab Webinar: corong registrasi → hadir → konversi. Kehadiran ditandai oleh
// attended_at (kolom ditambah di migration 0050; di-stamp saat user klik join).
// Konversi = registran yang punya order PAID dengan paid_at SETELAH registered_at-nya.
adminAnalyticsRoutes.get('/webinar-funnel', async (c) => {
  const days = clampDays(c.req.query('days'), 30);
  const from = utcDate(days - 1);
  const fromTs = `${from}T00:00:00.000Z`;

  const [summary, perWebinar, byMembership, upsell] = await Promise.all([
    c.env.DB.prepare(
      `SELECT
         COUNT(*) AS total_registered,
         SUM(CASE WHEN wr.attended_at IS NOT NULL THEN 1 ELSE 0 END) AS total_attended,
         SUM(CASE WHEN EXISTS (
                SELECT 1 FROM orders o
                WHERE o.user_id = wr.user_id AND o.status = 'paid'
                  AND o.paid_at IS NOT NULL AND o.paid_at > wr.registered_at
              ) THEN 1 ELSE 0 END) AS total_converted,
         COALESCE(SUM((
                SELECT COALESCE(SUM(o.amount), 0) FROM orders o
                WHERE o.user_id = wr.user_id AND o.status = 'paid'
                  AND o.paid_at IS NOT NULL AND o.paid_at > wr.registered_at
              )), 0) AS attributed_revenue
       FROM webinar_registrations wr
       WHERE wr.status IN ('registered', 'registered_free', 'registered_paid')
         AND wr.registered_at >= ?`
    ).bind(fromTs).first(),
    c.env.DB.prepare(
      `SELECT
         w.id AS webinar_id,
         w.title AS title,
         w.starts_at AS starts_at,
         COUNT(wr.id) AS registered,
         SUM(CASE WHEN wr.attended_at IS NOT NULL THEN 1 ELSE 0 END) AS attended,
         SUM(CASE WHEN EXISTS (
                SELECT 1 FROM orders o
                WHERE o.user_id = wr.user_id AND o.status = 'paid'
                  AND o.paid_at IS NOT NULL AND o.paid_at > wr.registered_at
              ) THEN 1 ELSE 0 END) AS converted,
         COALESCE(SUM((
                SELECT COALESCE(SUM(o.amount), 0) FROM orders o
                WHERE o.user_id = wr.user_id AND o.status = 'paid'
                  AND o.paid_at IS NOT NULL AND o.paid_at > wr.registered_at
              )), 0) AS revenue
       FROM webinars w
       JOIN webinar_registrations wr
         ON wr.webinar_id = w.id
        AND wr.status IN ('registered', 'registered_free', 'registered_paid')
       GROUP BY w.id
       ORDER BY registered DESC`
    ).all(),
    c.env.DB.prepare(
      `SELECT
         COALESCE(wr.membership_status_at_registration, 'free') AS membership_status_at_registration,
         COUNT(*) AS registered
       FROM webinar_registrations wr
       WHERE wr.status IN ('registered', 'registered_free', 'registered_paid')
         AND wr.registered_at >= ?
       GROUP BY 1
       ORDER BY registered DESC`
    ).bind(fromTs).all(),
    c.env.DB.prepare(
      `SELECT
         fe.step_type AS step_type,
         SUM(CASE WHEN fe.event_type = 'viewed' THEN 1 ELSE 0 END) AS viewed,
         SUM(CASE WHEN fe.event_type = 'accepted' THEN 1 ELSE 0 END) AS accepted,
         SUM(CASE WHEN fe.event_type = 'converted' THEN 1 ELSE 0 END) AS converted,
         COALESCE(SUM(CASE WHEN fe.event_type = 'converted' THEN fe.amount ELSE 0 END), 0) AS revenue
       FROM funnel_events fe
       JOIN funnels f ON f.id = fe.funnel_id
       WHERE f.trigger_product_type = 'webinar_registration'
         AND fe.created_at >= ?
       GROUP BY fe.step_type
       ORDER BY viewed DESC`
    ).bind(fromTs).all(),
  ]);

  const totalRegistered = (summary?.total_registered as number) || 0;
  const totalAttended = (summary?.total_attended as number) || 0;
  const totalConverted = (summary?.total_converted as number) || 0;

  return success(c, {
    summary: {
      total_registered: totalRegistered,
      total_attended: totalAttended,
      attendance_rate: totalRegistered > 0 ? totalAttended / totalRegistered : 0,
      total_converted: totalConverted,
      conversion_rate: totalRegistered > 0 ? totalConverted / totalRegistered : 0,
      attributed_revenue: (summary?.attributed_revenue as number) || 0,
    },
    per_webinar: perWebinar.results,
    registration_by_membership_status: byMembership.results,
    webinar_upsell: upsell.results,
  });
});

// ─── GET /api/admin/analytics/affiliates?days=30 ─────────────────────────────
// Tab Affiliate: ringkasan performa afiliasi, pipeline komisi (liability), top affiliate.
adminAnalyticsRoutes.get('/affiliates', async (c) => {
  const days = clampDays(c.req.query('days'), 30);
  const from = utcDate(days - 1);
  const fromTs = `${from}T00:00:00.000Z`;

  const [summary, pipeline, topAffiliates] = await Promise.all([
    c.env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM affiliate_accounts) as total_affiliates,
         (SELECT COUNT(*) FROM affiliate_accounts WHERE status = 'active') as active_affiliates,
         (SELECT COUNT(*) FROM affiliate_clicks WHERE created_at >= ?) as total_clicks,
         (SELECT COUNT(*) FROM affiliate_commissions WHERE created_at >= ?) as total_conversions,
         (SELECT COALESCE(SUM(o.amount), 0)
            FROM affiliate_commissions ac
            JOIN orders o ON o.id = ac.order_id
            WHERE ac.created_at >= ? AND o.status = 'paid') as attributed_revenue,
         (SELECT COALESCE(SUM(commission_amount), 0)
            FROM affiliate_commissions WHERE created_at >= ?) as commission_total`
    ).bind(fromTs, fromTs, fromTs, fromTs).first(),
    c.env.DB.prepare(
      `SELECT status, COUNT(*) as count, COALESCE(SUM(commission_amount), 0) as amount
       FROM affiliate_commissions
       GROUP BY status`
    ).all(),
    c.env.DB.prepare(
      `SELECT
         aa.affiliate_code,
         u.name,
         COALESCE((SELECT COUNT(*) FROM affiliate_clicks acl
                    WHERE acl.affiliate_code = aa.affiliate_code AND acl.created_at >= ?), 0) as clicks,
         COALESCE((SELECT COUNT(*) FROM affiliate_commissions acm
                    WHERE acm.affiliate_code = aa.affiliate_code AND acm.created_at >= ?), 0) as conversions,
         COALESCE((SELECT SUM(o.amount) FROM affiliate_commissions acm
                    JOIN orders o ON o.id = acm.order_id
                    WHERE acm.affiliate_code = aa.affiliate_code AND acm.created_at >= ? AND o.status = 'paid'), 0) as attributed_revenue,
         COALESCE((SELECT SUM(acm.commission_amount) FROM affiliate_commissions acm
                    WHERE acm.affiliate_code = aa.affiliate_code AND acm.created_at >= ?), 0) as commission_amount
       FROM affiliate_accounts aa
       LEFT JOIN users u ON u.id = aa.user_id
       ORDER BY attributed_revenue DESC, clicks DESC
       LIMIT 15`
    ).bind(fromTs, fromTs, fromTs, fromTs).all(),
  ]);

  const totalClicks = (summary?.total_clicks as number) || 0;
  const totalConv = (summary?.total_conversions as number) || 0;

  const pipelineRows = (pipeline.results as Array<{ status: string; count: number; amount: number }>).map((r) => ({
    status: r.status,
    count: r.count || 0,
    amount: r.amount || 0,
  }));

  const top = (topAffiliates.results as Array<{
    affiliate_code: string; name: string | null; clicks: number;
    conversions: number; attributed_revenue: number; commission_amount: number;
  }>).map((r) => ({
    affiliate_code: r.affiliate_code,
    name: r.name,
    clicks: r.clicks || 0,
    conversions: r.conversions || 0,
    attributed_revenue: r.attributed_revenue || 0,
    commission_amount: r.commission_amount || 0,
    conversion_rate: (r.clicks || 0) > 0 ? (r.conversions || 0) / r.clicks : 0,
  }));

  return success(c, {
    summary: {
      total_affiliates: (summary?.total_affiliates as number) || 0,
      active_affiliates: (summary?.active_affiliates as number) || 0,
      total_clicks: totalClicks,
      total_conversions: totalConv,
      conversion_rate: totalClicks > 0 ? totalConv / totalClicks : 0,
      attributed_revenue: (summary?.attributed_revenue as number) || 0,
      commission_total: (summary?.commission_total as number) || 0,
    },
    commission_pipeline: pipelineRows,
    top_affiliates: top,
  });
});

// ─── GET /api/admin/analytics/retention ───────────
// Tab Retensi: cohort retention bulanan, pergerakan membership (new/churn),
// dan distribusi waktu signup→konversi berbayar pertama. Berbasis bulan.
adminAnalyticsRoutes.get('/retention', async (c) => {
  const now = new Date();
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const windowStartTs = windowStart.toISOString();
  const windowStartMonth = windowStartTs.slice(0, 7);

  const [cohortSizes, cohortRetention, movementNew, movementChurn, movementActive, convertRows] =
    await Promise.all([
      c.env.DB.prepare(
        `SELECT substr(created_at, 1, 7) AS cohort, COUNT(*) AS size
         FROM users
         WHERE created_at >= ?
         GROUP BY cohort
         ORDER BY cohort ASC`
      ).bind(windowStartTs).all(),
      c.env.DB.prepare(
        `SELECT cohort,
                (CAST(substr(act_month,1,4) AS INTEGER) * 12 + CAST(substr(act_month,6,2) AS INTEGER))
                  - (CAST(substr(cohort,1,4) AS INTEGER) * 12 + CAST(substr(cohort,6,2) AS INTEGER)) AS month_offset,
                COUNT(DISTINCT user_id) AS active_users
         FROM (
           SELECT u.id AS user_id,
                  substr(u.created_at, 1, 7) AS cohort,
                  substr(uad.activity_date, 1, 7) AS act_month
           FROM users u
           JOIN user_activity_days uad ON uad.user_id = u.id
           WHERE u.created_at >= ?
             AND substr(uad.activity_date, 1, 7) >= substr(u.created_at, 1, 7)
         )
         GROUP BY cohort, month_offset
         HAVING month_offset >= 0
         ORDER BY cohort ASC, month_offset ASC`
      ).bind(windowStartTs).all(),
      c.env.DB.prepare(
        `SELECT substr(created_at, 1, 7) AS month, COUNT(*) AS new
         FROM memberships
         WHERE created_at >= ?
         GROUP BY month`
      ).bind(windowStartTs).all(),
      c.env.DB.prepare(
        `SELECT month, COUNT(*) AS churned FROM (
           SELECT substr(cancelled_at, 1, 7) AS month
           FROM memberships
           WHERE status = 'cancelled' AND cancelled_at IS NOT NULL AND cancelled_at >= ?
           UNION ALL
           SELECT substr(expires_at, 1, 7) AS month
           FROM memberships
           WHERE status = 'expired' AND expires_at IS NOT NULL AND expires_at >= ?
         )
         GROUP BY month`
      ).bind(windowStartTs, windowStartTs).all(),
      c.env.DB.prepare(
        `WITH RECURSIVE months(m) AS (
           SELECT ?
           UNION ALL
           SELECT strftime('%Y-%m', date(m || '-01', '+1 month'))
           FROM months WHERE m < strftime('%Y-%m', 'now')
         )
         SELECT months.m AS month,
                (SELECT COUNT(*) FROM memberships ms
                  WHERE substr(ms.starts_at, 1, 7) <= months.m
                    AND (ms.expires_at IS NULL OR substr(ms.expires_at, 1, 7) > months.m)
                    AND (ms.cancelled_at IS NULL OR substr(ms.cancelled_at, 1, 7) > months.m)
                ) AS active_end
         FROM months`
      ).bind(windowStartMonth).all(),
      c.env.DB.prepare(
        `SELECT CAST(julianday(first_paid) - julianday(u.created_at) AS INTEGER) AS days
         FROM users u
         JOIN (
           SELECT user_id, MIN(paid_at) AS first_paid
           FROM orders
           WHERE status = 'paid' AND paid_at IS NOT NULL
           GROUP BY user_id
         ) fp ON fp.user_id = u.id
         WHERE first_paid >= u.created_at`
      ).all(),
    ]);

  const sizeByCohort = new Map<string, number>();
  for (const r of cohortSizes.results as { cohort: string; size: number }[]) {
    sizeByCohort.set(r.cohort, Number(r.size) || 0);
  }
  const retByCohort = new Map<string, { month_offset: number; active_users: number; pct: number }[]>();
  for (const r of cohortRetention.results as { cohort: string; month_offset: number; active_users: number }[]) {
    const size = sizeByCohort.get(r.cohort) || 0;
    const active = Number(r.active_users) || 0;
    const arr = retByCohort.get(r.cohort) || [];
    arr.push({
      month_offset: Number(r.month_offset) || 0,
      active_users: active,
      pct: size > 0 ? Math.round((active / size) * 1000) / 10 : 0,
    });
    retByCohort.set(r.cohort, arr);
  }
  const cohorts = [...sizeByCohort.keys()].sort().slice(0, 12).map((cohort) => ({
    cohort,
    size: sizeByCohort.get(cohort) || 0,
    retained: (retByCohort.get(cohort) || []).sort((a, b) => a.month_offset - b.month_offset),
  }));

  const newByMonth = new Map<string, number>();
  for (const r of movementNew.results as { month: string; new: number }[]) {
    newByMonth.set(r.month, Number(r.new) || 0);
  }
  const churnByMonth = new Map<string, number>();
  for (const r of movementChurn.results as { month: string; churned: number }[]) {
    if (r.month) churnByMonth.set(r.month, Number(r.churned) || 0);
  }
  const membership_movement = (movementActive.results as { month: string; active_end: number }[]).map((r) => {
    const newCount = newByMonth.get(r.month) || 0;
    const churned = churnByMonth.get(r.month) || 0;
    const activeEnd = Number(r.active_end) || 0;
    const base = activeEnd + churned;
    return {
      month: r.month,
      new: newCount,
      churned,
      active_end: activeEnd,
      churn_rate: base > 0 ? Math.round((churned / base) * 1000) / 1000 : null,
    };
  });

  const dayValues = (convertRows.results as { days: number }[])
    .map((r) => Number(r.days))
    .filter((d) => Number.isFinite(d) && d >= 0)
    .sort((a, b) => a - b);
  const buckets = [
    { bucket: '0', count: 0 },
    { bucket: '1-3', count: 0 },
    { bucket: '4-7', count: 0 },
    { bucket: '8-30', count: 0 },
    { bucket: '31+', count: 0 },
  ];
  for (const d of dayValues) {
    if (d === 0) buckets[0].count++;
    else if (d <= 3) buckets[1].count++;
    else if (d <= 7) buckets[2].count++;
    else if (d <= 30) buckets[3].count++;
    else buckets[4].count++;
  }
  const median_days = dayValues.length
    ? dayValues[Math.floor((dayValues.length - 1) / 2)]
    : null;

  return success(c, {
    cohorts,
    membership_movement,
    time_to_convert: { buckets, median_days },
  });
});

// ─── GET /api/admin/analytics/payment-health?days=30 ───────────
// Tab Pembayaran: kesehatan pembayaran, kedalaman funnel offer, ROI kupon.
adminAnalyticsRoutes.get('/payment-health', async (c) => {
  const days = clampDays(c.req.query('days'), 30);
  const from = utcDate(days - 1);
  const fromTs = `${from}T00:00:00.000Z`;

  const [methodRows, retryRow, feeRow, offerRows, couponRows] = await Promise.all([
    c.env.DB.prepare(
      `SELECT COALESCE(NULLIF(payment_method, ''), '(unknown)') as payment_method,
              COALESCE(NULLIF(provider, ''), '(unknown)') as provider,
              SUM(CASE WHEN status = 'paid'    THEN 1 ELSE 0 END) as paid,
              SUM(CASE WHEN status = 'failed'  THEN 1 ELSE 0 END) as failed,
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
              COUNT(*) as total
       FROM payments
       WHERE created_at >= ?
       GROUP BY 1, 2
       ORDER BY total DESC`
    ).bind(fromTs).all(),
    c.env.DB.prepare(
      `WITH retry_orders AS (
         SELECT DISTINCT p.order_id
         FROM payments p
         WHERE p.created_at >= ? AND p.provider_transaction_id LIKE '%-R%'
       )
       SELECT
         (SELECT COUNT(*) FROM retry_orders) as orders_with_retry,
         (SELECT COUNT(*) FROM retry_orders ro
            JOIN orders o ON o.id = ro.order_id
           WHERE o.status = 'paid') as recovered_orders`
    ).bind(fromTs).first(),
    c.env.DB.prepare(
      `SELECT COALESCE(SUM(fee), 0) as total_fee,
              COALESCE(SUM(COALESCE(total_payment, amount)), 0) as total_payment,
              COALESCE(SUM(amount), 0) as total_amount
       FROM payments
       WHERE status = 'paid' AND created_at >= ?`
    ).bind(fromTs).first(),
    c.env.DB.prepare(
      `SELECT upsell_status, downsell_status, status
       FROM funnel_offers
       WHERE created_at >= ?`
    ).bind(fromTs).all(),
    c.env.DB.prepare(
      `SELECT coupon_code,
              COUNT(*) as redemptions,
              COALESCE(SUM(discount_amount), 0) as discount_total,
              COALESCE(SUM(total_amount), 0) as revenue
       FROM coupon_redemptions
       WHERE status = 'paid' AND redeemed_at >= ?
       GROUP BY coupon_code
       ORDER BY revenue DESC
       LIMIT 10`
    ).bind(fromTs).all(),
  ]);

  const methodSuccess = (methodRows.results as Record<string, unknown>[]).map((r) => {
    const paid = Number(r.paid || 0);
    const failed = Number(r.failed || 0);
    const denom = paid + failed;
    return {
      payment_method: r.payment_method,
      provider: r.provider,
      paid,
      failed,
      pending: Number(r.pending || 0),
      total: Number(r.total || 0),
      success_rate: denom > 0 ? paid / denom : null,
    };
  });

  const ordersWithRetry = Number(retryRow?.orders_with_retry || 0);
  const recoveredOrders = Number(retryRow?.recovered_orders || 0);

  const upsell: Record<string, number> = {};
  const downsell: Record<string, number> = {};
  let expired = 0;
  let total = 0;
  let upsellDeclined = 0;
  let downsellConverted = 0;
  for (const row of offerRows.results as Record<string, unknown>[]) {
    total++;
    if (row.status === 'expired') expired++;
    const us = (row.upsell_status as string) || null;
    const ds = (row.downsell_status as string) || null;
    if (us) {
      upsell[us] = (upsell[us] || 0) + 1;
      if (us === 'declined') upsellDeclined++;
    }
    if (ds) {
      downsell[ds] = (downsell[ds] || 0) + 1;
      if (ds === 'converted') downsellConverted++;
    }
  }
  const downsellRescueRate = upsellDeclined > 0 ? downsellConverted / upsellDeclined : null;

  const totalPaid = methodSuccess.reduce((s, m) => s + m.paid, 0);
  const totalFailed = methodSuccess.reduce((s, m) => s + m.failed, 0);
  const failedDenom = totalPaid + totalFailed;

  const couponRoi = (couponRows.results as Record<string, unknown>[]).map((r) => {
    const revenue = Number(r.revenue || 0);
    const discount = Number(r.discount_total || 0);
    return {
      coupon_code: r.coupon_code,
      redemptions: Number(r.redemptions || 0),
      discount_total: discount,
      revenue,
      discount_pct_of_revenue: revenue > 0 ? discount / revenue : null,
    };
  });

  return success(c, {
    method_success: methodSuccess,
    retry_recovery: {
      orders_with_retry: ordersWithRetry,
      recovered_orders: recoveredOrders,
      recovery_rate: ordersWithRetry > 0 ? recoveredOrders / ordersWithRetry : null,
    },
    gateway_fee: {
      total_fee: Number(feeRow?.total_fee || 0),
      total_payment: Number(feeRow?.total_payment || 0),
      total_amount: Number(feeRow?.total_amount || 0),
    },
    failed_summary: {
      total_failed: totalFailed,
      total_paid: totalPaid,
      failed_rate: failedDenom > 0 ? totalFailed / failedDenom : null,
    },
    funnel_offers: {
      upsell,
      downsell,
      downsell_rescue_rate: downsellRescueRate,
      expired,
      total,
    },
    coupon_roi: couponRoi,
  });
});

// ─── GET /api/admin/analytics/email?days=30 ───────────
// Tab Email: performa campaign, funnel sequence, event breakdown, suppression growth.
adminAnalyticsRoutes.get('/email', async (c) => {
  const days = clampDays(c.req.query('days'), 30);
  const from = utcDate(days - 1);
  const fromTs = `${from}T00:00:00.000Z`;

  const [campaignsRes, totalsRow, seqPerfRes, eventTrendRes, suppTotalRow, suppNewRow] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, name, status, sent_count, open_count, click_count,
              bounce_count, unsubscribe_count, revenue_attributed
       FROM email_campaigns
       ORDER BY created_at DESC
       LIMIT 20`
    ).all(),
    c.env.DB.prepare(
      `SELECT
         COALESCE(SUM(sent_count), 0)        AS sent,
         COALESCE(SUM(open_count), 0)        AS open,
         COALESCE(SUM(click_count), 0)       AS click,
         COALESCE(SUM(bounce_count), 0)      AS bounce,
         COALESCE(SUM(unsubscribe_count), 0) AS unsub,
         COALESCE(SUM(revenue_attributed), 0) AS revenue
       FROM email_campaigns
       WHERE created_at >= ?`
    ).bind(fromTs).first(),
    c.env.DB.prepare(
      `SELECT s.id, s.name, s.trigger_event, s.status,
         COALESCE(SUM(CASE WHEN st.status = 'active'    THEN 1 ELSE 0 END), 0) AS active,
         COALESCE(SUM(CASE WHEN st.status = 'completed' THEN 1 ELSE 0 END), 0) AS completed,
         COALESCE(SUM(CASE WHEN st.status = 'paused'    THEN 1 ELSE 0 END), 0) AS paused
       FROM email_sequences s
       LEFT JOIN user_email_sequence_state st ON st.sequence_id = s.id
       GROUP BY s.id, s.name, s.trigger_event, s.status
       ORDER BY (active + completed + paused) DESC, s.name ASC`
    ).all(),
    c.env.DB.prepare(
      `SELECT event_type, COUNT(*) AS count
       FROM email_events
       WHERE created_at >= ?
       GROUP BY event_type
       ORDER BY count DESC`
    ).bind(fromTs).all(),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS total FROM email_suppression_list`
    ).first(),
    c.env.DB.prepare(
      `SELECT COUNT(*) AS n FROM email_suppression_list WHERE created_at >= ?`
    ).bind(fromTs).first(),
  ]);

  const campaigns = (campaignsRes.results as Record<string, unknown>[]).map((r) => {
    const sent = (r.sent_count as number) || 0;
    return {
      ...r,
      open_rate: sent > 0 ? ((r.open_count as number) / sent) * 100 : 0,
      click_rate: sent > 0 ? ((r.click_count as number) / sent) * 100 : 0,
    };
  });

  const sent = (totalsRow?.sent as number) || 0;
  const open = (totalsRow?.open as number) || 0;
  const click = (totalsRow?.click as number) || 0;
  const bounce = (totalsRow?.bounce as number) || 0;
  const unsub = (totalsRow?.unsub as number) || 0;

  return success(c, {
    campaigns,
    totals: {
      sent,
      open,
      click,
      bounce,
      unsub,
      revenue: (totalsRow?.revenue as number) || 0,
      open_rate: sent > 0 ? (open / sent) * 100 : 0,
      click_rate: sent > 0 ? (click / sent) * 100 : 0,
      bounce_rate: sent > 0 ? (bounce / sent) * 100 : 0,
      unsub_rate: sent > 0 ? (unsub / sent) * 100 : 0,
    },
    sequence_performance: seqPerfRes.results,
    event_trend: eventTrendRes.results,
    suppression: {
      total: (suppTotalRow?.total as number) || 0,
      new_in_range: (suppNewRow?.n as number) || 0,
    },
  });
});

// ─── GET /api/admin/analytics/tools-economy?days=30 ───────────
// Tab AI Tools: ekonomi kredit (terjual/terpakai), liability saldo, top tools, success/fail.
adminAnalyticsRoutes.get('/tools-economy', async (c) => {
  const days = clampDays(c.req.query('days'), 30);
  const from = utcDate(days - 1);
  const fromTs = `${from}T00:00:00.000Z`;
  // tool_usage_logs / tool_credit_transactions store created_at as 'YYYY-MM-DD HH:MM:SS'
  // (datetime('now')), so compare against a space-format lower bound too.
  const fromDt = `${from} 00:00:00`;

  const [summary, usageTrend, topTools, successBreakdown] = await Promise.all([
    c.env.DB.prepare(
      `SELECT
         (SELECT COALESCE(SUM(amount), 0) FROM tool_credit_transactions
            WHERE type = 'purchase' AND created_at >= ?) AS credits_purchased,
         (SELECT COALESCE(SUM(credits_used), 0) FROM tool_usage_logs
            WHERE status = 'success' AND created_at >= ?) AS credits_used,
         (SELECT COALESCE(SUM(amount), 0) FROM orders
            WHERE order_type = 'tool_credits' AND status = 'paid' AND paid_at >= ?) AS revenue_from_credits,
         (SELECT COALESCE(SUM(balance), 0) FROM user_tool_credits) AS outstanding_balance,
         (SELECT COUNT(DISTINCT user_id) FROM tool_usage_logs
            WHERE created_at >= ?) AS active_users`
    ).bind(fromDt, fromDt, fromTs, fromDt).first(),
    c.env.DB.prepare(
      `SELECT substr(created_at, 1, 10) AS day, COALESCE(SUM(credits_used), 0) AS credits_used
       FROM tool_usage_logs
       WHERE created_at >= ?
       GROUP BY substr(created_at, 1, 10)
       ORDER BY day ASC`
    ).bind(fromDt).all(),
    c.env.DB.prepare(
      `SELECT tool_name,
              COUNT(*) AS uses,
              COALESCE(SUM(credits_used), 0) AS credits_used,
              SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success,
              SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
              ROUND(
                100.0 * SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)
                / NULLIF(SUM(CASE WHEN status IN ('success','failed') THEN 1 ELSE 0 END), 0)
              , 1) AS success_rate
       FROM tool_usage_logs
       WHERE created_at >= ?
       GROUP BY tool_name
       ORDER BY uses DESC
       LIMIT 15`
    ).bind(fromDt).all(),
    c.env.DB.prepare(
      `SELECT status, COUNT(*) AS count
       FROM tool_usage_logs
       WHERE created_at >= ?
       GROUP BY status`
    ).bind(fromDt).all(),
  ]);

  return success(c, {
    summary: {
      credits_purchased: (summary?.credits_purchased as number) || 0,
      credits_used: (summary?.credits_used as number) || 0,
      revenue_from_credits: (summary?.revenue_from_credits as number) || 0,
      outstanding_balance: (summary?.outstanding_balance as number) || 0,
      active_users: (summary?.active_users as number) || 0,
    },
    usage_trend: usageTrend.results,
    top_tools: topTools.results,
    success_breakdown: successBreakdown.results,
  });
});

export default adminAnalyticsRoutes;
