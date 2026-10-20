-- Pastikan 1 nomor WhatsApp = 1 akun.
-- (Email sudah NOT NULL UNIQUE sejak 0001_initial_schema.sql.)

-- 1) Bebaskan nomor pada akun duplikat yang tidak aktif.
--    Nomor 081386907288 dipakai 2 akun atas nama "Randy": satu tanpa aktivitas
--    apa pun, satu lagi sudah punya order paid + membership. Nomor dipertahankan
--    di akun yang aktif; akun tanpa aktivitas di-NULL-kan nomornya (akun tidak
--    dihapus). Pada DB selain production baris ini no-op.
UPDATE users SET phone = NULL, updated_at = '2026-06-14T00:00:00.000Z'
WHERE id = '258afb1a-9f38-4ce3-9f45-397aec4777a6' AND phone = '081386907288';

-- 2) Partial unique index: nomor non-kosong wajib unik di seluruh akun
--    (mencakup semua jalur pembuatan akun + aman dari race condition).
--    NULL / '' dikecualikan agar user tanpa nomor tidak ikut terkunci.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique
  ON users(phone) WHERE phone IS NOT NULL AND phone != '';
