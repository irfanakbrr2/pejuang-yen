CREATE TABLE IF NOT EXISTS failed_queue_logs (
    id TEXT PRIMARY KEY,
    queue_name TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    error_message TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_failed_queue_logs_created ON failed_queue_logs(created_at);
