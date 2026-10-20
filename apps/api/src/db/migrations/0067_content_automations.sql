-- 0067_content_automations.sql
-- AI Content Automation tool — engine workflow template-driven (pengganti n8n).
-- Tabel: automations (instance per user), automation_credentials (vault terenkripsi),
-- automation_topics (rotasi topik), automation_runs (riwayat eksekusi + log).

CREATE TABLE IF NOT EXISTS automations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  template_key TEXT NOT NULL,            -- key template built-in (mis. 'auto_ai_thread')
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'paused', -- active | paused | draft
  schedule_label TEXT,                   -- label jadwal human-readable (mis. 'Tiap jam :30 WIB')
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  config_json TEXT NOT NULL DEFAULT '{}',-- konfigurasi template-specific (schedule, prompt override, accountId, dst)
  next_run_at TEXT,                      -- ISO; saat status=active & <= now -> enqueue
  last_run_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_automations_due ON automations(status, next_run_at);
CREATE INDEX IF NOT EXISTS idx_automations_user ON automations(user_id, created_at);

CREATE TABLE IF NOT EXISTS automation_credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,        -- repliz | telegram | ...
  label TEXT NOT NULL,
  ciphertext TEXT NOT NULL,  -- base64 AES-GCM (JSON fields terenkripsi)
  iv TEXT NOT NULL,          -- base64 IV
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_automation_credentials_user ON automation_credentials(user_id, type);

CREATE TABLE IF NOT EXISTS automation_topics (
  id TEXT PRIMARY KEY,
  automation_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (automation_id) REFERENCES automations(id)
);
CREATE INDEX IF NOT EXISTS idx_automation_topics_pick ON automation_topics(automation_id, used_at);

CREATE TABLE IF NOT EXISTS automation_runs (
  id TEXT PRIMARY KEY,
  automation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',   -- queued | running | success | failed
  trigger TEXT NOT NULL DEFAULT 'schedule',-- schedule | manual
  started_at TEXT,
  finished_at TEXT,
  preview TEXT,
  error TEXT,
  logs_json TEXT,
  credits_used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (automation_id) REFERENCES automations(id)
);
CREATE INDEX IF NOT EXISTS idx_automation_runs_automation ON automation_runs(automation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_automation_runs_user ON automation_runs(user_id, created_at);
