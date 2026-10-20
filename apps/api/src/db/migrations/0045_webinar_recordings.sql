-- Webinar Recordings Table

CREATE TABLE IF NOT EXISTS webinar_recordings (
  id TEXT PRIMARY KEY,
  webinar_id TEXT, -- Optional, if it came from a managed webinar
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT,
  body_html TEXT,
  thumbnail_url TEXT,
  recording_url TEXT,
  recording_embed_url TEXT,
  category TEXT,
  format TEXT,
  tags TEXT,
  status TEXT NOT NULL DEFAULT 'hidden', -- 'public', 'hidden', 'membership_only'
  recorded_at TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (webinar_id) REFERENCES webinars(id)
);

CREATE INDEX IF NOT EXISTS idx_webinar_recordings_status ON webinar_recordings(status);
CREATE INDEX IF NOT EXISTS idx_webinar_recordings_recorded_at ON webinar_recordings(recorded_at);
CREATE INDEX IF NOT EXISTS idx_webinar_recordings_sort_order ON webinar_recordings(sort_order);

-- Copy existing recordings from webinars table
INSERT INTO webinar_recordings (
  id, webinar_id, slug, title, subtitle, body_html, thumbnail_url, 
  recording_url, recording_embed_url, category, format, tags, 
  status, recorded_at, sort_order, created_at, updated_at
)
SELECT 
  -- Use a new UUID for the recording record, or we can use the webinar ID.
  -- But since a webinar might have a recording, and we might decouple them later,
  -- using a new ID is better. However, sqlite doesn't have a built-in UUID in all versions.
  -- To be safe, we can use the webinar id + '-rec' as the recording ID for migration.
  id || '-rec', id, slug || '-rec', title, subtitle, replay_body_html, thumbnail_url,
  recording_url, recording_embed_url, category, format, tags,
  replay_status, starts_at, sort_order, created_at, updated_at
FROM webinars
WHERE (recording_url IS NOT NULL OR recording_embed_url IS NOT NULL) 
  AND replay_status != 'hidden';
