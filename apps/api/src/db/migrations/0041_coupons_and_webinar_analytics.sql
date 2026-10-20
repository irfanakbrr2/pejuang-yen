-- Add snapshot fields to webinar_registrations
ALTER TABLE webinar_registrations ADD COLUMN membership_status_at_registration TEXT;
ALTER TABLE webinar_registrations ADD COLUMN membership_plan_at_registration TEXT;
ALTER TABLE webinar_registrations ADD COLUMN membership_expires_at_registration TEXT;
ALTER TABLE webinar_registrations ADD COLUMN user_created_at_registration TEXT;

-- Add coupon tracking fields to orders
ALTER TABLE orders ADD COLUMN coupon_id TEXT;
ALTER TABLE orders ADD COLUMN coupon_code TEXT;
ALTER TABLE orders ADD COLUMN discount_type TEXT;
ALTER TABLE orders ADD COLUMN discount_value INTEGER;
ALTER TABLE orders ADD COLUMN discount_amount INTEGER;
ALTER TABLE orders ADD COLUMN subtotal_amount INTEGER;
ALTER TABLE orders ADD COLUMN total_amount INTEGER;

-- Create coupons table
CREATE TABLE IF NOT EXISTS coupons (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL, -- 'percentage' or 'fixed_amount'
  discount_value INTEGER NOT NULL,
  max_discount_amount INTEGER,
  minimum_order_amount INTEGER,
  starts_at TEXT,
  expires_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  usage_limit_total INTEGER,
  usage_limit_per_user INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_status ON coupons(is_active);

-- Create coupon_plan_eligibility table
CREATE TABLE IF NOT EXISTS coupon_plan_eligibility (
  coupon_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  PRIMARY KEY (coupon_id, plan_id),
  FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES membership_plans(id) ON DELETE CASCADE
);

-- Create coupon_redemptions table
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id TEXT PRIMARY KEY,
  coupon_id TEXT NOT NULL,
  coupon_code TEXT NOT NULL,
  user_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  membership_plan TEXT,
  subtotal_amount INTEGER NOT NULL,
  discount_amount INTEGER NOT NULL,
  total_amount INTEGER NOT NULL,
  redeemed_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY (coupon_id) REFERENCES coupons(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon_id ON coupon_redemptions(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user_id ON coupon_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_status ON coupon_redemptions(status);

-- Create webinar_coupons table
CREATE TABLE IF NOT EXISTS webinar_coupons (
  webinar_id TEXT NOT NULL,
  coupon_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (webinar_id, coupon_id),
  FOREIGN KEY (webinar_id) REFERENCES webinars(id) ON DELETE CASCADE,
  FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE
);
