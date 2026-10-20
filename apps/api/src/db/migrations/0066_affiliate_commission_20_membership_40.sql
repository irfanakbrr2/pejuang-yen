-- Komisi affiliate: standar (non-membership) naik 10% -> 20%, membership premium 30% -> 40%.
-- Membership rate ditetapkan di kode (MEMBERSHIP_AFFILIATE_COMMISSION_RATE), tidak disimpan di DB.
-- Komisi yang SUDAH tercatat (affiliate_commissions) sengaja TIDAK diubah retroaktif
-- agar tidak mengubah nominal yang sudah terutang untuk penjualan lampau.

-- 1) Default rate non-membership: dipakai saat hitung komisi & saat registrasi affiliate baru.
INSERT INTO app_settings (key, value_json, updated_at)
VALUES ('default_commission_rate', '20', datetime('now'))
ON CONFLICT(key) DO UPDATE SET
  value_json = excluded.value_json,
  updated_at = excluded.updated_at;

-- 2) Naikkan akun affiliate yang masih di standar lama (10%) ke standar baru (20%).
--    Akun dengan rate kustom (selain 10%) dibiarkan agar penyesuaian admin tidak tertimpa.
UPDATE affiliate_accounts
SET default_commission_rate = 20,
    updated_at = datetime('now')
WHERE default_commission_rate = 10;
