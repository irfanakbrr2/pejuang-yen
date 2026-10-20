-- Seed funnel produksi (idempotent — INSERT OR IGNORE, id tetap)

-- 1. Produk layanan: Konsultasi 1:1 Private (upsell membership)
INSERT OR IGNORE INTO digital_products (id, slug, name, description, price, compare_at_price, delivery_type, status, sort_order, created_at, updated_at)
VALUES (
  'dp-konsultasi-1on1', 'konsultasi-1on1-private', 'Konsultasi 1:1 Private dengan Irfan',
  'Sesi private untuk audit strategi, workflow AI, funnel, automation, atau problem bisnis yang sedang kamu hadapi. Tim akan menghubungi kamu via WhatsApp untuk konfirmasi topik dan jadwal.',
  2500000, NULL, 'service', 'active', 0, datetime('now'), datetime('now')
);

-- 2. Funnel: Membership (semua plan) → upsell Konsultasi 1:1 → tolak → dashboard
INSERT OR IGNORE INTO funnels (id, owner_user_id, name, trigger_product_type, trigger_product_id, status, offer_window_minutes, exit_url, created_at, updated_at)
VALUES ('funnel-membership-konsultasi', NULL, 'Membership → Konsultasi 1:1', 'membership', '*', 'active', 15, NULL, datetime('now'), datetime('now'));

INSERT OR IGNORE INTO funnel_steps (id, funnel_id, step_type, enabled, product_type, product_id, price_override, headline, description, badge_text, countdown_seconds, created_at, updated_at)
VALUES (
  'step-membership-upsell-konsultasi', 'funnel-membership-konsultasi', 'upsell', 1,
  'digital_product', 'dp-konsultasi-1on1', NULL,
  'Tunggu! Tambahkan Sesi 1:1 Private dengan Irfan',
  'Punya masalah spesifik yang ingin dibedah langsung? Audit strategi, workflow AI, funnel, automation, atau problem bisnismu — Irfan bantu arahkan langkah paling praktis supaya kamu tidak nebak-nebak sendiri. Penawaran ini hanya muncul sekali.',
  'Slot Terbatas', 300, datetime('now'), datetime('now')
);

-- 3. Funnel: Webinar berbayar (semua) → upsell Lifetime → downsell Tahunan → halaman webinar
INSERT OR IGNORE INTO funnels (id, owner_user_id, name, trigger_product_type, trigger_product_id, status, offer_window_minutes, exit_url, created_at, updated_at)
VALUES ('funnel-webinar-premium', NULL, 'Webinar → Membership Premium', 'webinar_registration', '*', 'active', 15, NULL, datetime('now'), datetime('now'));

INSERT OR IGNORE INTO funnel_steps (id, funnel_id, step_type, enabled, product_type, product_id, price_override, headline, description, badge_text, countdown_seconds, created_at, updated_at)
VALUES (
  'step-webinar-upsell-lifetime', 'funnel-webinar-premium', 'upsell', 1,
  'membership', 'plan-lifetime', NULL,
  'Penawaran Sekali Lewat: Upgrade ke Lifetime',
  'Kamu baru saja mengamankan slot webinar — sekalian buka SEMUA kelas, live session 2x sebulan, rekaman, bonus & template selamanya. Bayar sekali, tidak ada perpanjangan.',
  'Akses Selamanya', 300, datetime('now'), datetime('now')
);

INSERT OR IGNORE INTO funnel_steps (id, funnel_id, step_type, enabled, product_type, product_id, price_override, headline, description, badge_text, countdown_seconds, created_at, updated_at)
VALUES (
  'step-webinar-downsell-yearly', 'funnel-webinar-premium', 'downsell', 1,
  'membership', 'plan-yearly', NULL,
  'Atau mulai dengan Membership Tahunan',
  'Belum siap Lifetime? Membership Tahunan membuka semua kelas, live session + rekaman, bonus & template selama 12 bulan penuh.',
  'Paling Populer', 300, datetime('now'), datetime('now')
);
