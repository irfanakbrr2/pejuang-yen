// Akses D1 untuk domain automations. Raw SQL (konsisten dgn domain lain).
import type { Env } from '../../env';
import type { AutomationRow, AutomationRunRow, CredentialRow, RunStatus } from './types';

export class AutomationRepository {
  constructor(private env: Env) {}

  private get db() { return this.env.DB; }

  // ─── automations ───────────────────────────────────────────────
  async listByUser(userId: string): Promise<AutomationRow[]> {
    const res = await this.db.prepare(
      `SELECT * FROM automations WHERE user_id = ? ORDER BY created_at DESC`
    ).bind(userId).all<AutomationRow>();
    return res.results || [];
  }

  async getById(id: string, userId?: string): Promise<AutomationRow | null> {
    const sql = userId
      ? `SELECT * FROM automations WHERE id = ? AND user_id = ?`
      : `SELECT * FROM automations WHERE id = ?`;
    const stmt = userId ? this.db.prepare(sql).bind(id, userId) : this.db.prepare(sql).bind(id);
    return (await stmt.first<AutomationRow>()) || null;
  }

  async insert(row: AutomationRow): Promise<void> {
    await this.db.prepare(
      `INSERT INTO automations
       (id, user_id, template_key, name, status, schedule_label, timezone, config_json, next_run_at, last_run_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      row.id, row.user_id, row.template_key, row.name, row.status,
      row.schedule_label, row.timezone, row.config_json,
      row.next_run_at, row.last_run_at, row.created_at, row.updated_at
    ).run();
  }

  async update(id: string, userId: string, fields: Partial<AutomationRow>): Promise<void> {
    const keys = Object.keys(fields);
    if (keys.length === 0) return;
    const set = keys.map((k) => `${k} = ?`).join(', ');
    const values = keys.map((k) => (fields as Record<string, unknown>)[k]);
    await this.db.prepare(
      `UPDATE automations SET ${set}, updated_at = ? WHERE id = ? AND user_id = ?`
    ).bind(...values, new Date().toISOString(), id, userId).run();
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.db.prepare(`DELETE FROM automation_topics WHERE automation_id = ?`).bind(id).run();
    await this.db.prepare(`DELETE FROM automation_runs WHERE automation_id = ? AND user_id = ?`).bind(id, userId).run();
    await this.db.prepare(`DELETE FROM automations WHERE id = ? AND user_id = ?`).bind(id, userId).run();
  }

  /** Automation aktif yang sudah jatuh tempo (untuk scheduler). */
  async findDue(nowIso: string, limit = 50): Promise<AutomationRow[]> {
    const res = await this.db.prepare(
      `SELECT * FROM automations
       WHERE status = 'active' AND next_run_at IS NOT NULL AND next_run_at <= ?
       ORDER BY next_run_at ASC LIMIT ?`
    ).bind(nowIso, limit).all<AutomationRow>();
    return res.results || [];
  }

  async setNextRun(id: string, nextRunAt: string | null, lastRunAt: string): Promise<void> {
    await this.db.prepare(
      `UPDATE automations SET next_run_at = ?, last_run_at = ?, updated_at = ? WHERE id = ?`
    ).bind(nextRunAt, lastRunAt, new Date().toISOString(), id).run();
  }

  // ─── credentials ───────────────────────────────────────────────
  async listCredentials(userId: string): Promise<CredentialRow[]> {
    const res = await this.db.prepare(
      `SELECT * FROM automation_credentials WHERE user_id = ? ORDER BY created_at DESC`
    ).bind(userId).all<CredentialRow>();
    return res.results || [];
  }

  async getCredential(id: string, userId?: string): Promise<CredentialRow | null> {
    const sql = userId
      ? `SELECT * FROM automation_credentials WHERE id = ? AND user_id = ?`
      : `SELECT * FROM automation_credentials WHERE id = ?`;
    const stmt = userId ? this.db.prepare(sql).bind(id, userId) : this.db.prepare(sql).bind(id);
    return (await stmt.first<CredentialRow>()) || null;
  }

  async insertCredential(row: CredentialRow): Promise<void> {
    await this.db.prepare(
      `INSERT INTO automation_credentials (id, user_id, type, label, ciphertext, iv, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(row.id, row.user_id, row.type, row.label, row.ciphertext, row.iv, row.created_at, row.updated_at).run();
  }

  async deleteCredential(id: string, userId: string): Promise<void> {
    await this.db.prepare(`DELETE FROM automation_credentials WHERE id = ? AND user_id = ?`).bind(id, userId).run();
  }

  // ─── topics ────────────────────────────────────────────────────
  async addTopics(automationId: string, topics: string[]): Promise<number> {
    const now = new Date().toISOString();
    let count = 0;
    for (const topic of topics) {
      const t = topic.trim();
      if (!t) continue;
      await this.db.prepare(
        `INSERT INTO automation_topics (id, automation_id, topic, used_at, created_at) VALUES (?, ?, ?, NULL, ?)`
      ).bind(crypto.randomUUID(), automationId, t, now).run();
      count++;
    }
    return count;
  }

  async listTopics(automationId: string): Promise<Array<{ id: string; topic: string; used_at: string | null }>> {
    const res = await this.db.prepare(
      `SELECT id, topic, used_at FROM automation_topics WHERE automation_id = ? ORDER BY created_at ASC`
    ).bind(automationId).all<{ id: string; topic: string; used_at: string | null }>();
    return res.results || [];
  }

  async deleteTopic(id: string, automationId: string): Promise<void> {
    await this.db.prepare(`DELETE FROM automation_topics WHERE id = ? AND automation_id = ?`).bind(id, automationId).run();
  }

  // ─── runs ──────────────────────────────────────────────────────
  async createRun(row: { id: string; automation_id: string; user_id: string; trigger: string }): Promise<void> {
    await this.db.prepare(
      `INSERT INTO automation_runs (id, automation_id, user_id, status, trigger, created_at)
       VALUES (?, ?, ?, 'queued', ?, ?)`
    ).bind(row.id, row.automation_id, row.user_id, row.trigger, new Date().toISOString()).run();
  }

  async listRuns(automationId: string, limit = 20): Promise<AutomationRunRow[]> {
    const res = await this.db.prepare(
      `SELECT * FROM automation_runs WHERE automation_id = ? ORDER BY created_at DESC LIMIT ?`
    ).bind(automationId, limit).all<AutomationRunRow>();
    return res.results || [];
  }

  async getRun(id: string): Promise<AutomationRunRow | null> {
    return (await this.db.prepare(`SELECT * FROM automation_runs WHERE id = ?`).bind(id).first<AutomationRunRow>()) || null;
  }

  async updateRun(
    id: string,
    fields: { status?: RunStatus; started_at?: string; finished_at?: string; preview?: string; error?: string; logs_json?: string; credits_used?: number }
  ): Promise<void> {
    const keys = Object.keys(fields);
    if (keys.length === 0) return;
    const set = keys.map((k) => `${k} = ?`).join(', ');
    const values = keys.map((k) => (fields as Record<string, unknown>)[k]);
    await this.db.prepare(`UPDATE automation_runs SET ${set} WHERE id = ?`).bind(...values, id).run();
  }
}
