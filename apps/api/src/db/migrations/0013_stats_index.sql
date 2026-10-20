-- Index untuk stats query admin tools
-- Query filter by order_type + status + paid_at — index harus dimulai dari order_type

CREATE INDEX IF NOT EXISTS idx_orders_type_status_paid
ON orders(order_type, status, paid_at);
