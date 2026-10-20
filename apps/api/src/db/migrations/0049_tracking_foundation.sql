-- Tracking Foundation
-- First-party event tracking, first/last-touch attribution, activity days
-- (DAU/WAU/MAU), lesson watch progress, and daily aggregates for admin
-- analytics. Raw tracking_events rows are purged after 90 days by the daily
-- cron; aggregates and user_activity_days are kept forever.

-- 1. Raw event log (append-only, 90-day retention)
CREATE TABLE IF NOT EXISTS tracking_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,                        -- NULL for anonymous visitors
  anonymous_id TEXT,
  session_id TEXT,
  event_name TEXT NOT NULL,
  event_category TEXT,                 -- 'page' | 'auth' | 'commerce' | 'learning' | 'webinar' | 'content'
  page_url TEXT,
  referrer_url TEXT,
  landing_page TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  affiliate_code TEXT,
  referral_code TEXT,
  course_id TEXT,
  lesson_id TEXT,
  webinar_id TEXT,
  bonus_id TEXT,
  recording_id TEXT,
  order_id TEXT,
  coupon_code TEXT,
  plan_before TEXT,
  plan_after TEXT,
  payment_amount INTEGER,
  payment_status TEXT,
  device_type TEXT,                    -- 'mobile' | 'tablet' | 'desktop'
  country TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_te_name_created ON tracking_events(event_name, created_at);
CREATE INDEX IF NOT EXISTS idx_te_user_created ON tracking_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_te_anon ON tracking_events(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_te_created ON tracking_events(created_at);
-- Backend commerce events (payment_success, membership_upgraded,
-- checkout_started) occur at most once per order. INSERT OR IGNORE +
-- this partial unique index makes webhook retries structurally dedup-safe.
CREATE UNIQUE INDEX IF NOT EXISTS idx_te_order_event
  ON tracking_events(order_id, event_name) WHERE order_id IS NOT NULL;

-- 2. Per-user attribution. first_* is written once and never overwritten;
--    last_* follows the most recent campaign signal before signup/purchase.
CREATE TABLE IF NOT EXISTS user_attribution (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  first_source TEXT,
  first_medium TEXT,
  first_campaign TEXT,
  first_landing_page TEXT,
  first_referrer TEXT,
  first_affiliate_code TEXT,
  first_referral_code TEXT,
  first_webinar_id TEXT,
  first_touch_at TEXT,
  last_source TEXT,
  last_medium TEXT,
  last_campaign TEXT,
  last_landing_page TEXT,
  last_referrer TEXT,
  last_affiliate_code TEXT,
  last_referral_code TEXT,
  last_webinar_id TEXT,
  last_touch_at TEXT,
  signup_source TEXT,                  -- "darimana tahu kami" answer on register
  upgrade_source TEXT,
  upgrade_medium TEXT,
  upgrade_campaign TEXT,
  upgrade_page TEXT,
  upgrade_webinar_id TEXT,
  upgraded_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 3. One row per user per active day. Upserted at ingest time so DAU/WAU/MAU
--    and last-active are queryable in real time. Tiny table, kept forever.
CREATE TABLE IF NOT EXISTS user_activity_days (
  user_id TEXT NOT NULL,
  activity_date TEXT NOT NULL,         -- 'YYYY-MM-DD' (UTC)
  first_seen_at TEXT NOT NULL,
  PRIMARY KEY (user_id, activity_date)
);
CREATE INDEX IF NOT EXISTS idx_uad_date ON user_activity_days(activity_date);

-- 4. Video watch progress on the existing per-lesson progress rows
ALTER TABLE lesson_progress ADD COLUMN watch_seconds INTEGER NOT NULL DEFAULT 0;
ALTER TABLE lesson_progress ADD COLUMN watch_percent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE lesson_progress ADD COLUMN last_position_seconds INTEGER NOT NULL DEFAULT 0;

-- 5. Daily aggregates computed by the daily cron (kept forever)
CREATE TABLE IF NOT EXISTS events_daily (
  event_date TEXT NOT NULL,            -- 'YYYY-MM-DD' (UTC)
  event_name TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  unique_users INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (event_date, event_name)
);

CREATE TABLE IF NOT EXISTS acquisition_daily (
  event_date TEXT NOT NULL,            -- 'YYYY-MM-DD' (UTC)
  source TEXT NOT NULL DEFAULT '(none)',
  medium TEXT NOT NULL DEFAULT '(none)',
  campaign TEXT NOT NULL DEFAULT '(none)',
  signups INTEGER NOT NULL DEFAULT 0,
  checkouts INTEGER NOT NULL DEFAULT 0,
  payments INTEGER NOT NULL DEFAULT 0,
  revenue INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (event_date, source, medium, campaign)
);
