-- Reprice every remaining legacy 20% affiliate commission to 30%, including paid history.

UPDATE affiliate_commissions
SET commission_rate = 30,
    commission_amount = CAST(amount * 0.30 AS INTEGER)
WHERE commission_rate = 20;
