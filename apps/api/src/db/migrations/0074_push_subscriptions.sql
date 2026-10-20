-- WS4/WS5: Web Push subscriptions (RFC 8291 aes128gcm)
-- Satu user bisa punya banyak langganan (multi-device). endpoint unik per langganan.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,   -- kunci publik klien (base64url)
  auth TEXT NOT NULL,     -- auth secret klien (base64url)
  user_agent TEXT,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
