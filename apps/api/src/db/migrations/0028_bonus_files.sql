CREATE TABLE IF NOT EXISTS bonus_files (
  id TEXT PRIMARY KEY,
  bonus_id TEXT NOT NULL,
  title TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_url TEXT,
  r2_key TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (bonus_id) REFERENCES bonuses(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_bonus_files_bonus_id ON bonus_files(bonus_id);
