-- WS1: Affiliate tiers (Bronze/Silver/Gold/Platinum)
-- Tier dihitung dari total komisi paid kumulatif dan menaikkan batas rate komisi.
-- Kolom `tier` di-cache di affiliate_accounts agar query leaderboard/komisi tidak
-- perlu menghitung ulang setiap saat; sumber kebenaran tetap SUM(commission paid).

ALTER TABLE affiliate_accounts ADD COLUMN tier TEXT NOT NULL DEFAULT 'bronze';

-- Backfill tier dari total komisi yang sudah dibayar per affiliate.
-- Ambang: silver >= 1jt, gold >= 5jt, platinum >= 20jt (lihat lib/settings.ts).
UPDATE affiliate_accounts
SET tier = (
  SELECT CASE
    WHEN paid >= 20000000 THEN 'platinum'
    WHEN paid >= 5000000  THEN 'gold'
    WHEN paid >= 1000000  THEN 'silver'
    ELSE 'bronze'
  END
  FROM (
    SELECT COALESCE(SUM(ac.commission_amount), 0) AS paid
    FROM affiliate_commissions ac
    WHERE ac.affiliate_user_id = affiliate_accounts.user_id
      AND ac.status = 'paid'
  )
);

CREATE INDEX IF NOT EXISTS idx_affiliate_accounts_tier ON affiliate_accounts(tier);
