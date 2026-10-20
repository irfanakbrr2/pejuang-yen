-- Tools Credit System
-- Monetisasi AI tools dengan sistem kredit

-- 1. Credit balance per user
CREATE TABLE IF NOT EXISTS user_tool_credits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  balance INTEGER NOT NULL DEFAULT 0,
  total_purchased INTEGER NOT NULL DEFAULT 0,
  total_used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id)
);

-- 2. Audit trail setiap perubahan kredit
CREATE TABLE IF NOT EXISTS tool_credit_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  type TEXT NOT NULL CHECK(type IN ('bonus', 'purchase', 'usage', 'refund', 'admin_adjust')),
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  tool_name TEXT,
  order_id TEXT REFERENCES orders(id),
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. Paket kredit yang dijual
CREATE TABLE IF NOT EXISTS tool_credit_packages (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  credits INTEGER NOT NULL,
  price INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 4. Log penggunaan tools per eksekusi
CREATE TABLE IF NOT EXISTS tool_usage_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  tool_name TEXT NOT NULL,
  credits_used INTEGER NOT NULL DEFAULT 1,
  input_summary TEXT,
  status TEXT NOT NULL DEFAULT 'success' CHECK(status IN ('success', 'failed', 'refunded')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed paket kredit default
INSERT OR IGNORE INTO tool_credit_packages (id, name, credits, price, sort_order)
VALUES
  ('pkg_starter', 'Starter', 10, 19000, 1),
  ('pkg_growth', 'Growth', 50, 80000, 2),
  ('pkg_pro', 'Pro', 100, 150000, 3);

CREATE INDEX IF NOT EXISTS idx_tool_credits_user ON user_tool_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON tool_credit_transactions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tool_usage_user ON tool_usage_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tool_usage_tool ON tool_usage_logs(tool_name, created_at);
