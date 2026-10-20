-- Pakasir embedded checkout
-- orders: provider-agnostic payment info
ALTER TABLE orders ADD COLUMN payment_provider TEXT;
ALTER TABLE orders ADD COLUMN payment_method TEXT;

-- payments: satu row = satu payment attempt
-- provider_transaction_id (sudah UNIQUE partial idx dari 0022) = gateway order id pakasir (GWA-xxx / GWA-xxx-R2)
ALTER TABLE payments ADD COLUMN payment_method TEXT;
ALTER TABLE payments ADD COLUMN fee INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN total_payment INTEGER;
ALTER TABLE payments ADD COLUMN payment_number TEXT;
ALTER TABLE payments ADD COLUMN expired_at TEXT;

UPDATE orders SET payment_provider = 'mayar'
WHERE mayar_transaction_id IS NOT NULL AND payment_provider IS NULL;

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_status ON payments(provider, status);
