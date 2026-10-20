-- Backfill welcome credits for users who existed before AI Tools credits.
-- Idempotent: users who already have any bonus transaction are skipped.
-- Note: BEGIN/COMMIT removed — D1 remote does not support explicit transactions.

INSERT INTO user_tool_credits (id, user_id, balance, total_purchased, total_used, created_at, updated_at)
SELECT
  'utc_welcome_' || u.id,
  u.id,
  3,
  0,
  0,
  datetime('now'),
  datetime('now')
FROM users u
WHERE NOT EXISTS (
  SELECT 1
  FROM tool_credit_transactions t
  WHERE t.user_id = u.id
    AND t.type = 'bonus'
)
ON CONFLICT(user_id) DO UPDATE SET
  balance = user_tool_credits.balance + 3,
  updated_at = datetime('now')
WHERE NOT EXISTS (
  SELECT 1
  FROM tool_credit_transactions t
  WHERE t.user_id = excluded.user_id
    AND t.type = 'bonus'
);

INSERT OR IGNORE INTO tool_credit_transactions (
  id,
  user_id,
  type,
  amount,
  balance_after,
  description,
  created_at
)
SELECT
  'welcome_bonus_' || u.id,
  u.id,
  'bonus',
  3,
  COALESCE(utc.balance, 3),
  'Kredit selamat datang - gratis 3 kredit',
  datetime('now')
FROM users u
LEFT JOIN user_tool_credits utc ON utc.user_id = u.id
WHERE NOT EXISTS (
  SELECT 1
  FROM tool_credit_transactions t
  WHERE t.user_id = u.id
    AND t.type = 'bonus'
);
