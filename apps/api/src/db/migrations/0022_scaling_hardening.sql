-- Scale launch hardening: additive constraints and query indexes only.

-- Keep one canonical row per provider event before adding the unique guard.
DELETE FROM webhook_events
WHERE provider_event_id IS NOT NULL
  AND id NOT IN (
    SELECT id
    FROM (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY provider_event_id
               ORDER BY
                 CASE processing_status WHEN 'processed' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
                 received_at ASC
             ) AS rn
      FROM webhook_events
      WHERE provider_event_id IS NOT NULL
    )
    WHERE rn = 1
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_provider_event_id_unique
ON webhook_events(provider_event_id)
WHERE provider_event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_tx_purchase_order_unique
ON tool_credit_transactions(order_id, type)
WHERE order_id IS NOT NULL AND type = 'purchase';

DELETE FROM payments
WHERE provider_transaction_id IS NOT NULL
  AND id NOT IN (
    SELECT id
    FROM (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY provider_transaction_id
               ORDER BY created_at ASC
             ) AS rn
      FROM payments
      WHERE provider_transaction_id IS NOT NULL
    )
    WHERE rn = 1
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_transaction_id_unique
ON payments(provider_transaction_id)
WHERE provider_transaction_id IS NOT NULL;

DELETE FROM memberships
WHERE source_order_id IS NOT NULL
  AND id NOT IN (
    SELECT id
    FROM (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY source_order_id
               ORDER BY created_at ASC
             ) AS rn
      FROM memberships
      WHERE source_order_id IS NOT NULL
    )
    WHERE rn = 1
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_memberships_source_order_unique
ON memberships(source_order_id)
WHERE source_order_id IS NOT NULL;

DELETE FROM user_access
WHERE source_id IS NOT NULL
  AND id NOT IN (
    SELECT id
    FROM (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY source_type, source_id, resource_type, resource_id
               ORDER BY created_at ASC
             ) AS rn
      FROM user_access
      WHERE source_id IS NOT NULL
    )
    WHERE rn = 1
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_access_source_resource_unique
ON user_access(source_type, source_id, resource_type, resource_id)
WHERE source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_access_user_resource_active
ON user_access(user_id, resource_type, resource_id, status, starts_at, expires_at);

CREATE INDEX IF NOT EXISTS idx_memberships_user_active_expiry
ON memberships(user_id, status, starts_at, expires_at);

CREATE INDEX IF NOT EXISTS idx_memberships_status_expiry
ON memberships(status, expires_at);

CREATE INDEX IF NOT EXISTS idx_affiliate_commissions_code_status_created
ON affiliate_commissions(affiliate_code, status, created_at);

CREATE INDEX IF NOT EXISTS idx_orders_user_created
ON orders(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_orders_status_created
ON orders(status, created_at);
