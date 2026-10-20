-- Learning Paths
-- Manually curated, ordered, mixed-content collections (kelas + rekaman +
-- bonus + tools). Items reference content_items so refs stay non-polymorphic.

CREATE TABLE IF NOT EXISTS learning_paths (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  thumbnail_url TEXT,
  level TEXT,                          -- 'beginner' | 'intermediate' | 'advanced' | NULL
  status TEXT NOT NULL DEFAULT 'draft',
  is_featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS learning_path_items (
  id TEXT PRIMARY KEY,
  path_id TEXT NOT NULL REFERENCES learning_paths(id),
  content_id TEXT NOT NULL REFERENCES content_items(id),
  section_label TEXT,                  -- optional grouping rendered as section headers
  sort_order INTEGER NOT NULL DEFAULT 0,
  note TEXT,                           -- catatan kurator ("Tonton dulu sebelum praktik")
  created_at TEXT NOT NULL,
  UNIQUE(path_id, content_id)
);
CREATE INDEX IF NOT EXISTS idx_path_items_path ON learning_path_items(path_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_path_items_content ON learning_path_items(content_id);

-- Path <-> skill association (featured paths on skill landing pages)
CREATE TABLE IF NOT EXISTS learning_path_skills (
  path_id TEXT NOT NULL REFERENCES learning_paths(id),
  skill_id TEXT NOT NULL REFERENCES skills(id),
  PRIMARY KEY (path_id, skill_id)
);
