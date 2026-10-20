-- 0079_ai_pulse.sql
-- AI Pulse — "Bloomberg for AI" Intelligence Terminal (GRATIS PENUH, publik).
-- Alur curated + AI-assist: cron fetch sumber -> AI buat draft learning package
-- -> admin approve -> publish. Tidak ada paywall: semua item status='published'
-- bersifat publik (tanpa login). Bookmark satu-satunya aksi yang butuh login.

-- 1. Sumber intel (RSS/API). URL bisa di-CRUD admin.
CREATE TABLE IF NOT EXISTS ai_pulse_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'rss',     -- 'rss' | 'api'
  url TEXT NOT NULL,
  category TEXT,                         -- label sumber (mis. 'official-blog', 'community')
  enabled INTEGER NOT NULL DEFAULT 1,
  last_fetched_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_pulse_sources_enabled ON ai_pulse_sources(enabled);

-- 2. Item intel + learning package hasil AI.
CREATE TABLE IF NOT EXISTS ai_pulse_items (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  source_id TEXT REFERENCES ai_pulse_sources(id),
  source_name TEXT,
  source_url TEXT,
  thumbnail_url TEXT,
  published_at TEXT,                     -- tanggal asli dari sumber
  dedup_hash TEXT NOT NULL UNIQUE,       -- hash normalized url+title -> cegah duplikat
  -- AI-generated learning package
  summary TEXT,
  why_it_matters TEXT,
  who_should_use TEXT,
  use_cases_json TEXT,                   -- JSON array of string
  faq_json TEXT,                         -- JSON array of {q,a}
  business_insight TEXT,
  -- taxonomy (reuse tabel categories cat_01..cat_09)
  primary_category_id TEXT REFERENCES categories(id),
  tags_json TEXT,                        -- JSON array of string
  impact_level TEXT NOT NULL DEFAULT 'update',  -- 'major' | 'update' | 'breaking'
  -- linking ke produk (mesin konversi funnel)
  related_course_ids_json TEXT,
  related_bonus_ids_json TEXT,
  related_automation_template_keys_json TEXT,
  -- lifecycle
  status TEXT NOT NULL DEFAULT 'draft',  -- 'draft' | 'published' | 'archived'
  featured INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  ai_model TEXT,                         -- model yang dipakai untuk draft
  published_at_internal TEXT,            -- saat admin publish (≠ published_at sumber)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ai_pulse_items_status ON ai_pulse_items(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_pulse_items_category ON ai_pulse_items(primary_category_id);
CREATE INDEX IF NOT EXISTS idx_ai_pulse_items_featured ON ai_pulse_items(featured, status);

-- 3. Bookmark per user (perlu login).
CREATE TABLE IF NOT EXISTS ai_pulse_bookmarks (
  user_id TEXT NOT NULL REFERENCES users(id),
  item_id TEXT NOT NULL REFERENCES ai_pulse_items(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_pulse_bookmarks_user ON ai_pulse_bookmarks(user_id, created_at DESC);

-- 4. Seed sumber awal (RSS resmi + komunitas). Admin bisa edit/tambah lewat CRUD.
INSERT OR IGNORE INTO ai_pulse_sources (id, name, type, url, category, enabled, created_at, updated_at) VALUES
  ('src_openai',     'OpenAI News',         'rss', 'https://openai.com/news/rss.xml',            'official-blog', 1, datetime('now'), datetime('now')),
  ('src_anthropic',  'Anthropic News',      'rss', 'https://www.anthropic.com/rss.xml',          'official-blog', 1, datetime('now'), datetime('now')),
  ('src_googleai',   'Google – The Keyword AI', 'rss', 'https://blog.google/technology/ai/rss/', 'official-blog', 1, datetime('now'), datetime('now')),
  ('src_huggingface','Hugging Face Blog',   'rss', 'https://huggingface.co/blog/feed.xml',       'official-blog', 1, datetime('now'), datetime('now')),
  ('src_hn_ai',      'Hacker News (AI)',    'rss', 'https://hnrss.org/newest?q=AI&points=150',   'community',     1, datetime('now'), datetime('now'));
