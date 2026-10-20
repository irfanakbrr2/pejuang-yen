-- 0062_analytics_indexes.sql
-- Index pendukung untuk perluasan /admin/analytics (Webinar, Affiliate, Retensi,
-- Pembayaran, Email, AI Tools, + perluasan Engagement/Learning).
-- TIDAK ada perubahan skema/kolom — murni index performa. Semua IF NOT EXISTS
-- sehingga aman dijalankan ulang dan tidak menabrak index yang sudah ada.

-- ── Webinar funnel ──
CREATE INDEX IF NOT EXISTS idx_webinar_registrations_attended_at
  ON webinar_registrations(attended_at);
CREATE INDEX IF NOT EXISTS idx_webinar_registrations_webinar_registered
  ON webinar_registrations(webinar_id, registered_at);
CREATE INDEX IF NOT EXISTS idx_funnels_trigger_product_type
  ON funnels(trigger_product_type);

-- ── Konversi webinar + time-to-convert (subquery orders per user) ──
CREATE INDEX IF NOT EXISTS idx_orders_user_status_paid_at
  ON orders(user_id, status, paid_at);

-- ── Affiliate analytics (subquery per affiliate_code dalam rentang) ──
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_code_created
  ON affiliate_clicks(affiliate_code, created_at);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_code_created
  ON affiliate_commissions(affiliate_code, created_at);
CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_created
  ON affiliate_commissions(created_at);

-- ── Retensi / pergerakan membership ──
CREATE INDEX IF NOT EXISTS idx_memberships_status_expires
  ON memberships(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_memberships_status_cancelled
  ON memberships(status, cancelled_at);
CREATE INDEX IF NOT EXISTS idx_memberships_starts_at
  ON memberships(starts_at);
CREATE INDEX IF NOT EXISTS idx_users_created_at
  ON users(created_at);

-- ── Payment health ──
CREATE INDEX IF NOT EXISTS idx_payments_status_created
  ON payments(status, created_at);
CREATE INDEX IF NOT EXISTS idx_funnel_offers_created
  ON funnel_offers(created_at);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_status_redeemed
  ON coupon_redemptions(status, redeemed_at);

-- ── Learning drop-off ──
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson
  ON lesson_progress(lesson_id);

-- ── Engagement geo ──
CREATE INDEX IF NOT EXISTS idx_tracking_events_country
  ON tracking_events(country);
