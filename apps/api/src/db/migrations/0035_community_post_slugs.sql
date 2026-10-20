-- Pejuang Yen — Human-readable community post URLs

ALTER TABLE community_posts ADD COLUMN slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_posts_slug ON community_posts(slug) WHERE slug IS NOT NULL;
