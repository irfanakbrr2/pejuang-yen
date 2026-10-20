-- Free-user affiliates use a maximum 10% default commission.
-- Membership orders still pay 30% at commission creation time.

INSERT INTO app_settings (key, value_json, updated_at)
VALUES ('default_commission_rate', '10', datetime('now'))
ON CONFLICT(key) DO UPDATE SET
  value_json = excluded.value_json,
  updated_at = excluded.updated_at;

UPDATE affiliate_accounts
SET default_commission_rate = 10,
    updated_at = datetime('now')
WHERE default_commission_rate > 10;

UPDATE affiliate_commissions
SET commission_rate = 10,
    commission_amount = CAST(amount * 0.10 AS INTEGER)
WHERE commission_rate > 10
  AND status IN ('pending', 'approved')
  AND order_id IN (
    SELECT id FROM orders WHERE order_type != 'membership'
  );
