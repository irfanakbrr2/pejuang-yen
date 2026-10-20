-- Pejuang Yen — Community comment moderation

ALTER TABLE community_comments ADD COLUMN moderation_status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE community_comments ADD COLUMN moderation_reason TEXT;
ALTER TABLE community_comments ADD COLUMN moderated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_community_comments_moderation ON community_comments(moderation_status, created_at DESC);
