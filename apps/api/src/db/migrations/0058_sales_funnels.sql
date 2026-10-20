-- Sales Funnel Engine: produk digital (tripwire), funnels, offers, events

-- 1. Produk digital sellable (tripwire & item bump/upsell)
CREATE TABLE IF NOT EXISTS digital_products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  price INTEGER NOT NULL,
  compare_at_price INTEGER,
  delivery_type TEXT NOT NULL DEFAULT 'files',   -- 'files' | 'external_url' | 'service' (tanpa file; admin follow-up)
  external_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',          -- draft | active | archived
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_digital_products_status ON digital_products(status);

CREATE TABLE IF NOT EXISTS digital_product_files (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  title TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_url TEXT,
  r2_key TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES digital_products(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_dpf_product_id ON digital_product_files(product_id);

-- 2. Funnels (owner_user_id NULL = platform/admin; terisi = funnel creator, fase toko)
CREATE TABLE IF NOT EXISTS funnels (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT,
  name TEXT NOT NULL,
  trigger_product_type TEXT NOT NULL,  -- course|membership|webinar_registration|tool_credits|digital_product|creator_product
  trigger_product_id TEXT NOT NULL,    -- id produk ATAU '*' = semua produk tipe ini (exact menang atas wildcard)
  status TEXT NOT NULL DEFAULT 'draft',          -- draft | active | archived
  offer_window_minutes INTEGER NOT NULL DEFAULT 15,
  exit_url TEXT,                       -- redirect setelah offer selesai/ditolak; NULL = default per tipe order
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_funnels_active_trigger
  ON funnels(trigger_product_type, trigger_product_id) WHERE status = 'active';

-- 3. Steps: satu per tipe per funnel
CREATE TABLE IF NOT EXISTS funnel_steps (
  id TEXT PRIMARY KEY,
  funnel_id TEXT NOT NULL,
  step_type TEXT NOT NULL,             -- 'order_bump' | 'upsell' | 'downsell'
  enabled INTEGER NOT NULL DEFAULT 1,
  product_type TEXT NOT NULL,
  product_id TEXT NOT NULL,
  price_override INTEGER,              -- NULL = harga list; selalu dibaca server-side
  headline TEXT,
  description TEXT,
  badge_text TEXT,
  image_url TEXT,
  countdown_seconds INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (funnel_id) REFERENCES funnels(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_funnel_steps_unique ON funnel_steps(funnel_id, step_type);

-- 4. Offer session: SATU per order paid (idempotency anchor upsell)
CREATE TABLE IF NOT EXISTS funnel_offers (
  id TEXT PRIMARY KEY,
  funnel_id TEXT NOT NULL,
  trigger_order_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',     -- open | completed | expired
  upsell_status TEXT,                      -- offered|accepted|declined|converted|skipped
  downsell_status TEXT,
  upsell_order_id TEXT,
  downsell_order_id TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_funnel_offers_user ON funnel_offers(user_id, created_at);

-- 5. Analytics (append-only, INSERT OR IGNORE)
CREATE TABLE IF NOT EXISTS funnel_events (
  id TEXT PRIMARY KEY,
  funnel_id TEXT NOT NULL,
  step_type TEXT NOT NULL,             -- 'order_bump' | 'upsell' | 'downsell'
  event_type TEXT NOT NULL,            -- 'viewed' | 'accepted' | 'declined' | 'converted'
  user_id TEXT,
  offer_id TEXT,
  trigger_order_id TEXT,
  result_order_id TEXT,
  amount INTEGER,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_funnel_events_funnel
  ON funnel_events(funnel_id, step_type, event_type, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_funnel_events_offer_dedupe
  ON funnel_events(offer_id, step_type, event_type) WHERE offer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_funnel_events_order_dedupe
  ON funnel_events(trigger_order_id, step_type, event_type)
  WHERE trigger_order_id IS NOT NULL AND offer_id IS NULL;
