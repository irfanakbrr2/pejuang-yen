-- 0040_personalization.sql
-- Adds tables and columns for the Personalized Resource Library & Onboarding System

CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  role TEXT,
  primary_goal TEXT,
  ai_level TEXT,
  recommended_track TEXT,
  onboarding_completed INTEGER NOT NULL DEFAULT 0,
  onboarding_version INTEGER NOT NULL DEFAULT 1,
  interests_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

CREATE TABLE IF NOT EXISTS resource_tags (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  resource_type TEXT NOT NULL, -- 'course', 'bonus', 'template', etc.
  tag_type TEXT NOT NULL,      -- 'role', 'goal', 'category', 'level'
  tag_value TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_resource_tags_resource ON resource_tags(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_tags_value ON resource_tags(tag_type, tag_value);

-- Add priority scoring to existing resources
ALTER TABLE courses ADD COLUMN priority_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE courses ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0;

ALTER TABLE bonuses ADD COLUMN priority_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bonuses ADD COLUMN is_featured INTEGER NOT NULL DEFAULT 0;
