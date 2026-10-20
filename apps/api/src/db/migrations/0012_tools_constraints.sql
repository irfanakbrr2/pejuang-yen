-- Indexes for tool credit system performance
-- Added after initial schema (SQLite can't ALTER TABLE to add CHECK constraints)

CREATE INDEX IF NOT EXISTS idx_credit_tx_order ON tool_credit_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_type ON tool_credit_transactions(user_id, type);
CREATE INDEX IF NOT EXISTS idx_orders_tool_credits ON orders(user_id, product_id, order_type, status, created_at);
