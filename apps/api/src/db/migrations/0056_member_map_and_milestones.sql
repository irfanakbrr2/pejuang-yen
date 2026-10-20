-- 0056_member_map_and_milestones.sql
-- Peta Member: bio, kota, visibilitas opt-in (default hidden) + milestone onboarding checklist

ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN city_code TEXT;
ALTER TABLE users ADD COLUMN map_visibility TEXT NOT NULL DEFAULT 'hidden';

-- Partial index: scan peta member hanya menyentuh row yang opt-in
CREATE INDEX IF NOT EXISTS idx_users_map_visible
  ON users(city_code)
  WHERE map_visibility != 'hidden' AND city_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_milestones (
  user_id TEXT NOT NULL,
  milestone TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, milestone),
  FOREIGN KEY (user_id) REFERENCES users(id)
) WITHOUT ROWID;
