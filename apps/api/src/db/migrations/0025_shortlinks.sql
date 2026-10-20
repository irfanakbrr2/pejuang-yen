-- Shortlinks: user-created short redirect links under pejuangyen.link/l/{slug}

CREATE TABLE IF NOT EXISTS shortlinks (
  id           TEXT    PRIMARY KEY,
  user_id      TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug         TEXT    NOT NULL,
  destination_url TEXT NOT NULL,
  title        TEXT,
  click_count  INTEGER NOT NULL DEFAULT 0,
  is_active    INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT    NOT NULL,
  updated_at   TEXT    NOT NULL
);

-- Slug must be globally unique (enforced at DB level, not just app level)
CREATE UNIQUE INDEX idx_shortlinks_slug    ON shortlinks(slug);
CREATE INDEX        idx_shortlinks_user_id ON shortlinks(user_id);
CREATE INDEX        idx_shortlinks_created ON shortlinks(created_at);

-- Per-visit click log (for basic analytics)
CREATE TABLE IF NOT EXISTS shortlink_clicks (
  id           TEXT PRIMARY KEY,
  shortlink_id TEXT NOT NULL REFERENCES shortlinks(id) ON DELETE CASCADE,
  ip_hash      TEXT,
  user_agent_hash TEXT,
  referer_url  TEXT,
  created_at   TEXT NOT NULL
);

CREATE INDEX idx_shortlink_clicks_link ON shortlink_clicks(shortlink_id);
CREATE INDEX idx_shortlink_clicks_at   ON shortlink_clicks(created_at);
