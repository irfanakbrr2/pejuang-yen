-- Pejuang Yen — Community v2 likes and comments

CREATE TABLE IF NOT EXISTS community_post_likes (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_post_likes_unique ON community_post_likes(post_id, user_id);
CREATE INDEX IF NOT EXISTS idx_community_post_likes_user ON community_post_likes(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS community_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_community_comments_post_created ON community_comments(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_community_comments_author ON community_comments(author_user_id, created_at DESC);
