-- Public affiliate aliases for trust-friendly pejuangyen.link links.

ALTER TABLE affiliate_accounts ADD COLUMN public_ref_code TEXT;

UPDATE affiliate_accounts
SET public_ref_code = lower(substr(hex(randomblob(4)), 1, 7))
WHERE public_ref_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_affiliate_accounts_public_ref_code
ON affiliate_accounts(public_ref_code);
