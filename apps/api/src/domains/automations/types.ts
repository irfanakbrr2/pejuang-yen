// Tipe bersama untuk domain automations.

export type AutomationStatus = 'active' | 'paused' | 'draft';
export type RunStatus = 'queued' | 'running' | 'success' | 'failed';
export type RunTrigger = 'schedule' | 'manual';

/** Jadwal — disimpan di config_json.schedule. Granularitas cron = 10 menit. */
export type Schedule =
  | { mode: 'interval'; everyMinutes: number }
  | { mode: 'hourly'; atMinute: number }            // tiap jam pada menit tertentu (WIB)
  | { mode: 'daily'; atHour: number; atMinute: number } // sekali sehari jam HH:MM WIB
  | { mode: 'daily_times'; times: { hour: number; minute: number }[] }; // beberapa jam/hari (maks 5, WIB)

/** Konfigurasi automation (template-specific). Disimpan sebagai config_json. */
export interface AutomationConfig {
  schedule: Schedule;
  /** Peta role credential -> id row automation_credentials. */
  credentials?: Record<string, string>;
  /** Override system prompt default template (opsional). */
  systemPromptOverride?: string;
  /** Repliz target (bukan secret). */
  replizAccountId?: string;
  replizUserId?: string;
  /** Telegram chat tujuan notifikasi (bukan secret). */
  telegramChatId?: string;
  [key: string]: unknown;
}

export interface AutomationRow {
  id: string;
  user_id: string;
  template_key: string;
  name: string;
  status: AutomationStatus;
  schedule_label: string | null;
  timezone: string;
  config_json: string;
  next_run_at: string | null;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationRunRow {
  id: string;
  automation_id: string;
  user_id: string;
  status: RunStatus;
  trigger: RunTrigger;
  started_at: string | null;
  finished_at: string | null;
  preview: string | null;
  error: string | null;
  logs_json: string | null;
  credits_used: number;
  created_at: string;
}

export interface CredentialRow {
  id: string;
  user_id: string;
  type: string;
  label: string;
  ciphertext: string;
  iv: string;
  created_at: string;
  updated_at: string;
}
