-- Pejuang Yen — Premium community feed

CREATE TABLE IF NOT EXISTS community_posts (
  id TEXT PRIMARY KEY,
  author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,
  image_r2_key TEXT,
  image_url TEXT,
  image_content_type TEXT,
  image_size INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published')),
  source_role TEXT NOT NULL DEFAULT 'user',
  approved_by_user_id TEXT REFERENCES users(id),
  approved_at TEXT,
  published_at TEXT,
  broadcast_queued_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_community_posts_status_published_at ON community_posts(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_author ON community_posts(author_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON community_posts(created_at DESC);
