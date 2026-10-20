-- Migration: 0042_webinar_registration_gate

-- 1. webinars table extensions
ALTER TABLE webinars ADD COLUMN free_registration_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE webinars ADD COLUMN paid_registration_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE webinars ADD COLUMN paid_registration_price INTEGER NOT NULL DEFAULT 99000;
ALTER TABLE webinars ADD COLUMN share_required_count INTEGER NOT NULL DEFAULT 2;
ALTER TABLE webinars ADD COLUMN share_message_template TEXT;
ALTER TABLE webinars ADD COLUMN short_link_enabled INTEGER NOT NULL DEFAULT 1;

-- 2. webinar_registrations table extensions
ALTER TABLE webinar_registrations ADD COLUMN registration_type TEXT;
ALTER TABLE webinar_registrations ADD COLUMN payment_order_id TEXT;
ALTER TABLE webinar_registrations ADD COLUMN share_confirmation_checked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE webinar_registrations ADD COLUMN share_confirmed_at TEXT;
ALTER TABLE webinar_registrations ADD COLUMN referral_click_id TEXT;
ALTER TABLE webinar_registrations ADD COLUMN short_link_id TEXT;
ALTER TABLE webinar_registrations ADD COLUMN source_referrer_user_id TEXT;
ALTER TABLE webinar_registrations ADD COLUMN attribution_source TEXT;
ALTER TABLE webinar_registrations ADD COLUMN attribution_campaign TEXT;
ALTER TABLE webinar_registrations ADD COLUMN selected_at TEXT;
ALTER TABLE webinar_registrations ADD COLUMN confirmed_at TEXT;

-- 3. shortlinks table extensions
ALTER TABLE shortlinks ADD COLUMN destination_type TEXT;
ALTER TABLE shortlinks ADD COLUMN destination_id TEXT;
ALTER TABLE shortlinks ADD COLUMN campaign TEXT;
ALTER TABLE shortlinks ADD COLUMN source TEXT;

-- 4. shortlink_clicks table extensions
ALTER TABLE shortlink_clicks ADD COLUMN click_id TEXT;
ALTER TABLE shortlink_clicks ADD COLUMN referrer_user_id TEXT;
ALTER TABLE shortlink_clicks ADD COLUMN converted_user_id TEXT;
ALTER TABLE shortlink_clicks ADD COLUMN converted_registration_id TEXT;
ALTER TABLE shortlink_clicks ADD COLUMN converted_order_id TEXT;
ALTER TABLE shortlink_clicks ADD COLUMN converted_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shortlink_clicks_click_id ON shortlink_clicks(click_id);
