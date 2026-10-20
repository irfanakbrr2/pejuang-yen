-- UI/UX revamp: embed HTML toko + index analytics commerce

-- Toko: section HTML custom di storefront (dirender sandboxed iframe di FE)
ALTER TABLE creator_stores ADD COLUMN custom_html TEXT;

-- Analytics commerce: range scan by created_at
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_funnel_events_created ON funnel_events(created_at);
