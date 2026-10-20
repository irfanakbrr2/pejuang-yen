-- Align affiliate default commission with the current global business setting.
-- Existing accounts still at the legacy default 20% are considered non-custom and moved to 30%.

INSERT INTO app_settings (key, value_json, updated_at)
VALUES ('default_commission_rate', '"30"', datetime('now'))
ON CONFLICT(key) DO UPDATE SET
  value_json = excluded.value_json,
  updated_at = excluded.updated_at;

UPDATE affiliate_accounts
SET default_commission_rate = 30,
    updated_at = datetime('now')
WHERE default_commission_rate = 20;
