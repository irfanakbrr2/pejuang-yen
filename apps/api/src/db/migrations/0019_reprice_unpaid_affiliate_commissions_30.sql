-- Reprice unpaid commissions that were created with the legacy 20% default.
-- Paid rows are left unchanged as historical payout records.

UPDATE affiliate_commissions
SET commission_rate = 30,
    commission_amount = CAST(amount * 0.30 AS INTEGER)
WHERE commission_rate = 20
  AND status IN ('pending', 'approved');
