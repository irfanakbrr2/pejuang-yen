-- Creator Store ("Toko") — toko premium user, produk digital, ledger saldo, payout

-- 1. Toko: satu per user, premium-gated
CREATE TABLE IF NOT EXISTS creator_stores (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  accent_color TEXT,
  status TEXT NOT NULL DEFAULT 'active',       -- active | suspended
  platform_fee_rate INTEGER,                   -- NULL = pakai app_settings creator_store_fee_rate
  payout_account_holder TEXT,
  payout_bank_name TEXT,
  payout_bank_account TEXT,
  suspended_at TEXT,
  suspended_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_creator_stores_status ON creator_stores(status);

-- 2. Produk toko: file download (R2 privat) atau link eksternal
CREATE TABLE IF NOT EXISTS creator_products (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  price INTEGER NOT NULL,
  compare_at_price INTEGER,
  delivery_type TEXT NOT NULL,                 -- 'file' | 'link'
  upload_id TEXT,
  external_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',        -- draft | active | suspended | archived
  sales_count INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  suspended_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (store_id) REFERENCES creator_stores(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_products_store_slug ON creator_products(store_id, slug);
CREATE INDEX IF NOT EXISTS idx_creator_products_status ON creator_products(status);

-- 3. Upload file jualan (bucket R2 PRIVAT — kuota per user)
CREATE TABLE IF NOT EXISTS creator_uploads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL,
  size INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',       -- active | deleted
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (store_id) REFERENCES creator_stores(id)
);
CREATE INDEX IF NOT EXISTS idx_creator_uploads_user ON creator_uploads(user_id, status);

-- 4. Ledger saldo creator: balance = SUM(amount). Credit sale (+net), debit payout (-X).
CREATE TABLE IF NOT EXISTS creator_earnings (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  entry_type TEXT NOT NULL,                    -- sale | payout | payout_reversal | adjustment
  amount INTEGER NOT NULL,                     -- signed
  gross_amount INTEGER,
  fee_rate INTEGER,
  fee_amount INTEGER,
  order_id TEXT,
  payout_id TEXT,
  eligible_at TEXT NOT NULL,                   -- sale: paid_at + hold_days; debit: langsung
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (store_id) REFERENCES creator_stores(id)
);
-- Anti double-credit: satu sale entry per order (bukti sama dgn affiliate_commissions.order_id UNIQUE)
CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_earnings_sale_order
  ON creator_earnings(order_id) WHERE entry_type = 'sale' AND order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_earnings_payout
  ON creator_earnings(payout_id, entry_type) WHERE payout_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_creator_earnings_store ON creator_earnings(store_id, created_at);

-- 5. Permintaan penarikan (mirror flow admin commissions)
CREATE TABLE IF NOT EXISTS creator_payouts (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',      -- pending | approved | paid | rejected
  account_holder TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  bank_account TEXT NOT NULL,
  transfer_ref TEXT,
  notes TEXT,
  requested_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT,
  paid_at TEXT,
  FOREIGN KEY (store_id) REFERENCES creator_stores(id)
);
CREATE INDEX IF NOT EXISTS idx_creator_payouts_status ON creator_payouts(status);
CREATE INDEX IF NOT EXISTS idx_creator_payouts_store ON creator_payouts(store_id);

-- 6. Setting (Pejuang Yen: Creator Store DINONAKTIFKAN — affiliate murni saja)
INSERT OR IGNORE INTO app_settings (key, value_json, updated_at) VALUES
  ('creator_store_enabled', 'false', datetime('now')),
  ('creator_store_fee_rate', '2', datetime('now')),
  ('creator_payout_min_amount', '100000', datetime('now')),
  ('creator_store_max_products', '20', datetime('now')),
  ('creator_store_upload_quota_mb', '500', datetime('now')),
  ('creator_earnings_hold_days', '7', datetime('now'));
