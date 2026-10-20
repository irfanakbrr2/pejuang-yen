-- Gamification Foundation
-- Learning streaks, points/XP, structured badges, daily check-in, and
-- streak-reminder email dedupe. Powers the learning leaderboard and the
-- retention loop (streak → points → badge → email/notification).

-- 1. Streak counters on users. Dates are 'YYYY-MM-DD' (UTC) to stay
--    consistent with user_activity_days.
ALTER TABLE users ADD COLUMN current_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN longest_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN last_streak_date TEXT;
ALTER TABLE users ADD COLUMN total_active_days INTEGER NOT NULL DEFAULT 0;

-- 2. Lifetime point totals (one row per user). Period leaderboards are
--    computed from point_transactions by earned_at, so no weekly/monthly
--    columns or reset jobs are needed here.
CREATE TABLE IF NOT EXISTS user_points (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  total_points INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

-- 3. Append-only point ledger. UNIQUE(user_id, action, ref_id) +
--    INSERT OR IGNORE makes every award idempotent (no double points on
--    retries or repeated lesson completions).
CREATE TABLE IF NOT EXISTS point_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  points INTEGER NOT NULL,
  action TEXT NOT NULL,                -- 'daily_checkin' | 'lesson_complete' | 'course_complete' | 'webinar_attend' | 'streak_bonus_7' | 'streak_bonus_30' | 'community_comment' | 'referral_signup' | 'referral_paid'
  ref_id TEXT NOT NULL DEFAULT '',     -- lesson/course/webinar/date id the award is tied to
  earned_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pt_dedupe ON point_transactions(user_id, action, ref_id);
CREATE INDEX IF NOT EXISTS idx_pt_earned ON point_transactions(earned_at);
CREATE INDEX IF NOT EXISTS idx_pt_user ON point_transactions(user_id, earned_at);

-- 4. Structured badges (replaces ad-hoc users.badges_json for new badges;
--    growth_ambassador stays on badges_json for backward compatibility).
CREATE TABLE IF NOT EXISTS user_badges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  badge_key TEXT NOT NULL,             -- 'beginner' | 'course_graduate' | 'consistent_7' | 'consistent_30' | 'champion'
  badge_name TEXT NOT NULL,
  ref_id TEXT,
  earned_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ub_dedupe ON user_badges(user_id, badge_key);
CREATE INDEX IF NOT EXISTS idx_ub_user ON user_badges(user_id);

-- 5. Streak reminder email dedupe (one reminder per user per day)
CREATE TABLE IF NOT EXISTS streak_reminder_sends (
  user_id TEXT NOT NULL,
  reminder_date TEXT NOT NULL,         -- 'YYYY-MM-DD' (UTC)
  sent_at TEXT NOT NULL,
  PRIMARY KEY (user_id, reminder_date)
);

-- 6. Webinar attendance: stamped when a registered user clicks the join link
ALTER TABLE webinar_registrations ADD COLUMN attended_at TEXT;
