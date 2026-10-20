-- Webinar catalog, registration, replay, and affiliate lead attribution.

CREATE TABLE IF NOT EXISTS webinars (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  body_html TEXT,
  thumbnail_url TEXT,
  host_name TEXT,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  capacity INTEGER,
  join_url TEXT,
  calendar_url TEXT,
  recording_url TEXT,
  recording_embed_url TEXT,
  replay_body_html TEXT,
  replay_status TEXT NOT NULL DEFAULT 'hidden',
  form_template_key TEXT NOT NULL DEFAULT 'webinar_free_default',
  seo_title TEXT,
  seo_description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  sort_order INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webinars_status_starts_at ON webinars(status, starts_at);
CREATE INDEX IF NOT EXISTS idx_webinars_replay_status ON webinars(replay_status);
CREATE INDEX IF NOT EXISTS idx_webinars_sort_order ON webinars(sort_order);

CREATE TABLE IF NOT EXISTS webinar_registrations (
  id TEXT PRIMARY KEY,
  webinar_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  coupon_code TEXT NOT NULL DEFAULT 'GROW',
  affiliate_code TEXT,
  status TEXT NOT NULL DEFAULT 'registered',
  registered_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  cancelled_at TEXT,
  FOREIGN KEY (webinar_id) REFERENCES webinars(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webinar_registrations_user_webinar
ON webinar_registrations(webinar_id, user_id);
CREATE INDEX IF NOT EXISTS idx_webinar_registrations_webinar ON webinar_registrations(webinar_id);
CREATE INDEX IF NOT EXISTS idx_webinar_registrations_user ON webinar_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_webinar_registrations_affiliate ON webinar_registrations(affiliate_code);
CREATE INDEX IF NOT EXISTS idx_webinar_registrations_registered_at ON webinar_registrations(registered_at);
