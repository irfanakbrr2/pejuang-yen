-- Add category column to community_posts for proper topic filtering
ALTER TABLE community_posts ADD COLUMN category TEXT DEFAULT 'perkenalan'
  CHECK (category IN ('pengumuman', 'pertanyaan', 'wins', 'perkenalan', 'share-build', 'tools-ai'));

CREATE INDEX IF NOT EXISTS idx_community_posts_category ON community_posts(category, status, published_at DESC);
