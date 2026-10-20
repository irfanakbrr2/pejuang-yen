-- Pre-launch promo membership plans (1-6 Juni 2026)
-- 3 plan dengan bonus 2x durasi akses; Lifetime harga spesial Rp 999.000
-- Setelah promo berakhir: ubah status ke 'inactive' via admin panel

INSERT OR IGNORE INTO membership_plans (id, slug, name, description, duration_type, duration_days, price, compare_at_price, status, sort_order, created_at, updated_at)
VALUES
  ('plan-monthly-promo', 'monthly-promo',
   'Monthly Pre-launch Special', 'Promo pre-launch: beli 1 bulan, dapat 2 bulan akses (60 hari)',
   'monthly', 60, 99000, 199000, 'active', 10,
   '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z'),

  ('plan-annual-promo', 'annual-promo',
   'Annual Pre-launch Special', 'Promo pre-launch: beli 1 tahun, dapat 2 tahun akses (730 hari)',
   'yearly', 730, 499000, 1500000, 'active', 11,
   '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z'),

  ('plan-lifetime-promo', 'lifetime-promo',
   'Lifetime Pre-launch Special', 'Promo pre-launch: akses selamanya, harga spesial Rp 999.000',
   'lifetime', NULL, 999000, 1500000, 'active', 12,
   '2026-06-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z');
