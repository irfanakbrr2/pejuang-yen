-- Pejuang Yen — pinned community posts

ALTER TABLE community_posts ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE community_posts ADD COLUMN pinned_at TEXT;
ALTER TABLE community_posts ADD COLUMN pinned_by_user_id TEXT REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_community_posts_pinned ON community_posts(status, is_pinned, pinned_at DESC);
