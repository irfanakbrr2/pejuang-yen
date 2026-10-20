import type { Env } from '../env';
import { bumpChallengeProgress } from '../domains/challenges/service';
import { notifyUser } from './notify';

async function readTotalPoints(env: Env, userId: string): Promise<number> {
  const row = await env.DB.prepare('SELECT total_points FROM user_points WHERE user_id = ?').bind(userId).first();
  return Number(row?.total_points || 0);
}

// Point values per action. ref_id keeps every award idempotent —
// the same (user, action, ref) pair can never earn twice.
export const POINTS: Record<string, number> = {
  daily_checkin: 5,
  lesson_complete: 10,
  course_complete: 100,
  webinar_attend: 50,
  streak_bonus_7: 50,
  streak_bonus_30: 200,
  community_comment: 5,
  referral_signup: 50,
  referral_paid: 200,
};

export const BADGES: Record<string, string> = {
  beginner: 'Beginner',
  course_graduate: 'Course Graduate',
  consistent_7: 'Consistent — 7 Hari',
  consistent_30: 'Consistent — 30 Hari',
};

// ─── Levels (XP progression) ────────────────────────────────────────────────
// Levels are computed purely from user_points.total_points (lifetime cumulative,
// never reset). Each entry is the point floor required to reach that level.
// Curve is roughly exponential so early levels feel quick and later ones earn prestige.
export interface LevelTier {
  level: number;
  title: string;
  floor: number; // total points required to enter this level
}

export const LEVELS: LevelTier[] = [
  { level: 1, title: 'Pemula', floor: 0 },
  { level: 2, title: 'Penjelajah', floor: 100 },
  { level: 3, title: 'Pembelajar', floor: 300 },
  { level: 4, title: 'Praktisi', floor: 700 },
  { level: 5, title: 'Terampil', floor: 1300 },
  { level: 6, title: 'Mahir', floor: 2200 },
  { level: 7, title: 'Ahli', floor: 3500 },
  { level: 8, title: 'Spesialis', floor: 5500 },
  { level: 9, title: 'Mentor', floor: 8500 },
  { level: 10, title: 'AI Master', floor: 13000 },
];

export interface LevelState {
  level: number;
  title: string;
  total_points: number;
  current_floor: number; // points required for current level
  next_at: number | null; // points required for next level (null at max)
  progress_pct: number; // 0–100 progress toward next level (100 at max)
  to_next: number; // points remaining until next level (0 at max)
}

/**
 * Resolve a user's level from their lifetime total points. Pure + synchronous.
 */
export function computeLevel(totalPoints: number): LevelState {
  const pts = Math.max(0, Math.floor(totalPoints || 0));
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (pts >= LEVELS[i].floor) idx = i;
    else break;
  }
  const current = LEVELS[idx];
  const next = LEVELS[idx + 1] || null;
  if (!next) {
    return {
      level: current.level,
      title: current.title,
      total_points: pts,
      current_floor: current.floor,
      next_at: null,
      progress_pct: 100,
      to_next: 0,
    };
  }
  const span = next.floor - current.floor;
  const gained = pts - current.floor;
  const progress_pct = span > 0 ? Math.min(100, Math.round((gained / span) * 100)) : 0;
  return {
    level: current.level,
    title: current.title,
    total_points: pts,
    current_floor: current.floor,
    next_at: next.floor,
    progress_pct,
    to_next: Math.max(0, next.floor - pts),
  };
}

export interface StreakState {
  current_streak: number;
  longest_streak: number;
  total_active_days: number;
  was_extended: boolean; // true when today newly counted (streak grew or reset to 1)
}

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function utcYesterday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Atomically advance the user's daily streak. Same-day calls are no-ops;
 * a yesterday streak increments; anything older resets to 1.
 * Returns the post-update state, or null on failure. Never throws.
 */
export async function updateStreak(env: Env, userId: string): Promise<StreakState | null> {
  try {
    const today = utcToday();
    const yesterday = utcYesterday();

    const before = await env.DB.prepare(
      'SELECT last_streak_date FROM users WHERE id = ?'
    ).bind(userId).first();
    if (!before) return null;
    const alreadyCountedToday = before.last_streak_date === today;

    const result = await env.DB.prepare(
      `UPDATE users SET
         current_streak = CASE
           WHEN last_streak_date = ?1 THEN current_streak
           WHEN last_streak_date = ?2 THEN current_streak + 1
           ELSE 1 END,
         longest_streak = MAX(longest_streak, CASE
           WHEN last_streak_date = ?1 THEN current_streak
           WHEN last_streak_date = ?2 THEN current_streak + 1
           ELSE 1 END),
         total_active_days = CASE
           WHEN last_streak_date = ?1 THEN total_active_days
           ELSE total_active_days + 1 END,
         last_streak_date = ?1
       WHERE id = ?3
       RETURNING current_streak, longest_streak, total_active_days`
    ).bind(today, yesterday, userId).first();

    if (!result) return null;
    return {
      current_streak: (result.current_streak as number) || 0,
      longest_streak: (result.longest_streak as number) || 0,
      total_active_days: (result.total_active_days as number) || 0,
      was_extended: !alreadyCountedToday,
    };
  } catch (err) {
    console.error('[gamification] updateStreak failed:', userId, err);
    return null;
  }
}

/**
 * Award points once per (user, action, ref). Returns true only when the
 * ledger row was newly inserted (i.e. points actually granted). Never throws.
 */
export async function awardPoints(
  env: Env,
  userId: string,
  action: keyof typeof POINTS | string,
  refId: string,
  pointsOverride?: number
): Promise<boolean> {
  try {
    const points = pointsOverride ?? POINTS[action];
    if (!points) return false;
    const now = new Date().toISOString();

    const inserted = await env.DB.prepare(
      `INSERT OR IGNORE INTO point_transactions (id, user_id, points, action, ref_id, earned_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), userId, points, action, refId, now).run();

    if ((inserted.meta?.changes || 0) === 0) return false;

    await env.DB.prepare(
      `INSERT INTO user_points (user_id, total_points, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         total_points = user_points.total_points + excluded.total_points,
         updated_at = excluded.updated_at`
    ).bind(userId, points, now).run();

    return true;
  } catch (err) {
    console.error('[gamification] awardPoints failed:', userId, action, err);
    return false;
  }
}

/**
 * Grant a badge once and notify the user in-app. Returns true when newly
 * earned. Never throws.
 */
export async function awardBadge(env: Env, userId: string, badgeKey: string, refId?: string): Promise<boolean> {
  try {
    const badgeName = BADGES[badgeKey] || badgeKey;
    const now = new Date().toISOString();

    const inserted = await env.DB.prepare(
      `INSERT OR IGNORE INTO user_badges (id, user_id, badge_key, badge_name, ref_id, earned_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), userId, badgeKey, badgeName, refId || null, now).run();

    if ((inserted.meta?.changes || 0) === 0) return false;

    await env.DB.prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, data_json, status, sent_at, created_at)
       VALUES (?, ?, 'system', ?, ?, ?, 'sent', ?, ?)`
    ).bind(
      crypto.randomUUID(),
      userId,
      `Badge Baru: ${badgeName} 🏅`,
      `Selamat! Kamu baru saja meraih badge "${badgeName}". Terus pertahankan momentum belajarmu!`,
      JSON.stringify({ url: '/dashboard', badge_key: badgeKey }),
      now,
      now
    ).run();

    // Push (in-app sudah di-insert di atas).
    await notifyUser(env, userId, {
      title: `Badge Baru: ${badgeName} 🏅`,
      body: `Selamat! Kamu meraih badge "${badgeName}". Pertahankan momentummu!`,
      url: '/dashboard',
      tag: 'badge',
      inApp: false,
    });

    return true;
  } catch (err) {
    console.error('[gamification] awardBadge failed:', userId, badgeKey, err);
    return false;
  }
}

/**
 * Run the full gamification side-effects for a learning event:
 * streak advance, lesson/course points, streak bonuses, and badges.
 * Designed for executionCtx.waitUntil — never throws.
 */
export async function processLearningGamification(
  env: Env,
  userId: string,
  opts: { lessonId?: string; courseId?: string; lessonCompleted?: boolean; courseCompleted?: boolean }
): Promise<void> {
  try {
    const streak = await updateStreak(env, userId);
    const pointsBefore = await readTotalPoints(env, userId);

    if (opts.lessonCompleted && opts.lessonId) {
      const first = await awardPoints(env, userId, 'lesson_complete', opts.lessonId);
      if (first) {
        await bumpChallengeProgress(env, userId, 'lessons', 1);
        await bumpChallengeProgress(env, userId, 'points', POINTS.lesson_complete);
        // First-ever lesson completion → Beginner badge
        const count = await env.DB.prepare(
          `SELECT COUNT(*) as n FROM point_transactions WHERE user_id = ? AND action = 'lesson_complete'`
        ).bind(userId).first();
        if ((count?.n as number) === 1) await awardBadge(env, userId, 'beginner', opts.lessonId);
      }
    }

    if (opts.courseCompleted && opts.courseId) {
      const granted = await awardPoints(env, userId, 'course_complete', opts.courseId);
      if (granted) await bumpChallengeProgress(env, userId, 'points', POINTS.course_complete);
      await awardBadge(env, userId, 'course_graduate', opts.courseId);
    }

    if (streak && streak.current_streak >= 7) {
      // ref binds the bonus to this run of the streak (its start date stays
      // constant as the streak grows) so a future new streak can earn again
      const streakRunStart = new Date(Date.now() - (streak.current_streak - 1) * 86400000).toISOString().slice(0, 10);
      await awardPoints(env, userId, 'streak_bonus_7', streakRunStart);
      await awardBadge(env, userId, 'consistent_7');
      if (streak.current_streak >= 30) {
        await awardPoints(env, userId, 'streak_bonus_30', streakRunStart);
        await awardBadge(env, userId, 'consistent_30');
      }
    }

    // Level-up: bandingkan level sebelum vs sesudah akumulasi poin event ini.
    const pointsAfter = await readTotalPoints(env, userId);
    const before = computeLevel(pointsBefore);
    const after = computeLevel(pointsAfter);
    if (after.level > before.level) {
      await notifyUser(env, userId, {
        title: `Naik ke Level ${after.level} — ${after.title}! 🚀`,
        body: `Kamu sekarang ${after.title}. Terus kumpulkan poin untuk membuka level berikutnya.`,
        url: '/dashboard',
        tag: 'level-up',
      });
    }
  } catch (err) {
    console.error('[gamification] processLearningGamification failed:', userId, err);
  }
}
