-- Unified Content Registry
-- Discovery mirror over courses / bonuses / webinar_recordings / AI tools.
-- Source-of-truth stays in the per-type tables; rows here are kept in sync
-- by syncContentItem() on every admin write (see src/lib/content-sync.ts).

CREATE TABLE IF NOT EXISTS content_items (
  id TEXT PRIMARY KEY,                 -- '<content_type>:<ref_id>'
  content_type TEXT NOT NULL,          -- 'course' | 'bonus' | 'recording' | 'tool'
  ref_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  format TEXT NOT NULL,                -- 'kelas' | bonus_type values | 'rekaman' | 'ai_tool'
  level TEXT,                          -- NULL = cocok semua level
  access_type TEXT,
  price INTEGER,
  priority_score INTEGER NOT NULL DEFAULT 0,
  is_featured INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',-- 'published' | 'draft' | 'archived'
  search_text TEXT,                    -- lower(title + description + skill/tag names)
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(content_type, ref_id)
);

CREATE INDEX IF NOT EXISTS idx_content_items_type_status ON content_items(content_type, status);
CREATE INDEX IF NOT EXISTS idx_content_items_status_score ON content_items(status, priority_score DESC);
CREATE INDEX IF NOT EXISTS idx_content_items_slug ON content_items(content_type, slug);

-- Backfill: courses
INSERT OR IGNORE INTO content_items (
  id, content_type, ref_id, slug, title, description, thumbnail_url,
  format, level, access_type, price, priority_score, is_featured, status,
  search_text, published_at, created_at, updated_at
)
SELECT
  'course:' || id, 'course', id, slug, title,
  COALESCE(short_description, description), thumbnail_url,
  'kelas', level, access_type, price,
  COALESCE(priority_score, 0), COALESCE(is_featured, 0), status,
  lower(title || ' ' || COALESCE(short_description, '')),
  published_at, created_at, updated_at
FROM courses;

-- Backfill: bonuses (format = bonus_type so format browsing can distinguish
-- template vs prompt_pack vs ebook)
INSERT OR IGNORE INTO content_items (
  id, content_type, ref_id, slug, title, description, thumbnail_url,
  format, level, access_type, priority_score, is_featured, status,
  search_text, published_at, created_at, updated_at
)
SELECT
  'bonus:' || id, 'bonus', id, slug, title, description,
  COALESCE(NULLIF(thumbnail_url, ''),
    (SELECT bf.thumbnail_url FROM bonus_files bf
     WHERE bf.bonus_id = bonuses.id AND bf.thumbnail_url IS NOT NULL AND bf.thumbnail_url != ''
     ORDER BY bf.sort_order ASC, bf.created_at ASC LIMIT 1)), -- fallback: thumbnail file pertama
  COALESCE(bonus_type, 'file'), NULL, access_type,
  COALESCE(priority_score, 0), COALESCE(is_featured, 0),
  CASE status WHEN 'active' THEN 'published' ELSE status END, -- bonuses memakai 'active'
  lower(title || ' ' || COALESCE(description, '')),
  published_at, created_at, updated_at
FROM bonuses;

-- Backfill: webinar recordings
-- recordings status 'public'/'hidden'/'membership_only' maps to registry
-- status (published/draft) + access_type (free/membership_only)
INSERT OR IGNORE INTO content_items (
  id, content_type, ref_id, slug, title, description, thumbnail_url,
  format, access_type, priority_score, is_featured, status,
  search_text, published_at, created_at, updated_at
)
SELECT
  'recording:' || id, 'recording', id, slug, title, subtitle, thumbnail_url,
  'rekaman',
  CASE status WHEN 'membership_only' THEN 'membership_only' ELSE 'free' END,
  COALESCE(sort_order, 0), 0,
  CASE status WHEN 'hidden' THEN 'draft' ELSE 'published' END,
  lower(title || ' ' || COALESCE(subtitle, '')),
  recorded_at, created_at, updated_at
FROM webinar_recordings;

-- Seed: AI tools (TOOLS_CATALOG lives in code, no source table;
-- resyncAll() reconciles registry rows against the catalog)
INSERT OR IGNORE INTO content_items (
  id, content_type, ref_id, slug, title, description, format,
  access_type, status, search_text, created_at, updated_at
)
VALUES (
  'tool:web_prompt_generator', 'tool', 'web_prompt_generator', 'web-prompt-generator',
  'PRD Generator',
  'Buat AI Builder Prompt + PRD lengkap dengan mode Gemini cepat dan Kimi deep.',
  'ai_tool', 'free', 'published',
  'prd generator buat ai builder prompt + prd lengkap dengan mode gemini cepat dan kimi deep.',
  datetime('now'), datetime('now')
);
