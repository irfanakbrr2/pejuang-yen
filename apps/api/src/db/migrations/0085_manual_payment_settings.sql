-- Pejuang Yen — pengaturan pembayaran TRANSFER MANUAL (MVP tanpa Pakasir).
-- Nilai placeholder; admin update rekening asli via /admin/settings atau langsung app_settings.
INSERT OR IGNORE INTO app_settings (key, value_json, updated_at) VALUES
  ('manual_bank_name',    '"BCA"',                                   '2026-07-04T00:00:00.000Z'),
  ('manual_bank_account', '"0000000000"',                            '2026-07-04T00:00:00.000Z'),
  ('manual_bank_holder',  '"PT Harapan Pejuangyen Indonesia"',       '2026-07-04T00:00:00.000Z'),
  ('manual_whatsapp',     '"087827054701"',                          '2026-07-04T00:00:00.000Z'),
  ('manual_payment_note', '"Transfer tepat sesuai nominal, lalu konfirmasi ke WhatsApp admin dengan menyertakan NOMOR ORDER. Akses aktif setelah admin memverifikasi pembayaran."', '2026-07-04T00:00:00.000Z');
