-- Analytics API Keys (untuk akses AI tools eksternal)
CREATE TABLE IF NOT EXISTS analytics_api_keys (
  id           TEXT    PRIMARY KEY,
  name         TEXT    NOT NULL,
  key_hash     TEXT    NOT NULL UNIQUE,   -- SHA-256 dari key asli (tidak disimpan)
  key_prefix   TEXT    NOT NULL,          -- 12 karakter pertama untuk identifikasi
  created_by   TEXT    NOT NULL,
  created_at   TEXT    NOT NULL,
  last_used_at TEXT,
  expires_at   TEXT,
  is_active    INTEGER NOT NULL DEFAULT 1,
  request_count INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_analytics_api_keys_hash   ON analytics_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_analytics_api_keys_active ON analytics_api_keys(is_active);
