// Business logic domain automations: CRUD automation, credential vault, topik,
// trigger manual, dan pemrosesan run (dipanggil dari queue consumer).
import type { Env } from '../../env';
import { AutomationRepository } from './repository';
import { getTemplate, TEMPLATES } from './templates';
import { computeNextRun, scheduleLabel } from './scheduler';
import { executeAutomation } from './engine';
import { enqueueAutomationRun } from '../../lib/automation-queue';
import { encryptSecret, decryptSecret } from '../../lib/crypto-vault';
import type { AutomationConfig, AutomationStatus } from './types';

function nowIso(): string { return new Date().toISOString(); }

export interface ServiceResult<T = unknown> {
  data?: T;
  error?: string;
  status?: number;
}

export class AutomationService {
  private repo: AutomationRepository;
  constructor(private env: Env) {
    this.repo = new AutomationRepository(env);
  }

  private get encKey(): string {
    return this.env.AUTOMATION_ENCRYPTION_KEY || this.env.JWT_SECRET;
  }

  // ─── Templates ─────────────────────────────────────────────────
  listTemplates() {
    return TEMPLATES.map((t) => ({
      key: t.key,
      name: t.name,
      description: t.description,
      credits_per_use: t.credits_per_use,
      usesTopics: t.usesTopics !== false,
      requiredCredentials: t.requiredCredentials,
      configFields: t.configFields,
    }));
  }

  // ─── Automations CRUD ──────────────────────────────────────────
  async list(userId: string) {
    const rows = await this.repo.listByUser(userId);
    return rows.map((r) => ({
      ...r,
      config: undefined,
      config_json: undefined,
      schedule: this.safeConfig(r.config_json).schedule,
    }));
  }

  async get(id: string, userId: string): Promise<ServiceResult> {
    const automation = await this.repo.getById(id, userId);
    if (!automation) return { error: 'Automation tidak ditemukan', status: 404 };
    const [topics, runs] = await Promise.all([
      this.repo.listTopics(id),
      this.repo.listRuns(id, 20),
    ]);
    const template = getTemplate(automation.template_key);
    const config = this.safeConfig(automation.config_json);
    // jangan bocorkan secret apapun; config hanya berisi non-secret + reference id.
    return { data: { automation: { ...automation, config_json: undefined }, config, topics, runs, template } };
  }

  async create(
    userId: string,
    input: { templateKey: string; name: string; config: AutomationConfig; topics?: string[] }
  ): Promise<ServiceResult> {
    const template = getTemplate(input.templateKey);
    if (!template) return { error: 'Template tidak dikenal', status: 400 };
    if (!input.name?.trim()) return { error: 'Nama automation wajib diisi', status: 400 };
    if (!input.config?.schedule) return { error: 'Jadwal wajib diisi', status: 400 };

    const id = crypto.randomUUID();
    const now = nowIso();
    await this.repo.insert({
      id,
      user_id: userId,
      template_key: input.templateKey,
      name: input.name.trim(),
      status: 'paused',
      schedule_label: scheduleLabel(input.config.schedule),
      timezone: 'Asia/Jakarta',
      config_json: JSON.stringify(input.config),
      next_run_at: null,
      last_run_at: null,
      created_at: now,
      updated_at: now,
    });

    if (input.topics?.length) {
      await this.repo.addTopics(id, input.topics);
    }
    return { data: { id }, status: 201 };
  }

  async update(id: string, userId: string, input: { name?: string; config?: AutomationConfig }): Promise<ServiceResult> {
    const automation = await this.repo.getById(id, userId);
    if (!automation) return { error: 'Automation tidak ditemukan', status: 404 };

    const fields: Record<string, unknown> = {};
    if (input.name?.trim()) fields.name = input.name.trim();
    if (input.config) {
      fields.config_json = JSON.stringify(input.config);
      if (input.config.schedule) {
        fields.schedule_label = scheduleLabel(input.config.schedule);
        // jika aktif, recompute next_run
        if (automation.status === 'active') {
          fields.next_run_at = computeNextRun(input.config.schedule);
        }
      }
    }
    await this.repo.update(id, userId, fields);
    return { data: { id } };
  }

  async setStatus(id: string, userId: string, status: AutomationStatus): Promise<ServiceResult> {
    const automation = await this.repo.getById(id, userId);
    if (!automation) return { error: 'Automation tidak ditemukan', status: 404 };
    const config = this.safeConfig(automation.config_json);
    const fields: Record<string, unknown> = { status };
    if (status === 'active') {
      if (!config.schedule) return { error: 'Jadwal belum diset', status: 400 };
      fields.next_run_at = computeNextRun(config.schedule);
    } else {
      fields.next_run_at = null;
    }
    await this.repo.update(id, userId, fields);
    return { data: { id, status } };
  }

  async remove(id: string, userId: string): Promise<ServiceResult> {
    const automation = await this.repo.getById(id, userId);
    if (!automation) return { error: 'Automation tidak ditemukan', status: 404 };
    await this.repo.delete(id, userId);
    return { data: { id } };
  }

  // ─── Topics ────────────────────────────────────────────────────
  async addTopics(id: string, userId: string, topics: string[]): Promise<ServiceResult> {
    const automation = await this.repo.getById(id, userId);
    if (!automation) return { error: 'Automation tidak ditemukan', status: 404 };
    const count = await this.repo.addTopics(id, topics);
    return { data: { added: count } };
  }

  async deleteTopic(id: string, userId: string, topicId: string): Promise<ServiceResult> {
    const automation = await this.repo.getById(id, userId);
    if (!automation) return { error: 'Automation tidak ditemukan', status: 404 };
    await this.repo.deleteTopic(topicId, id);
    return { data: { id: topicId } };
  }

  // ─── Credentials (vault) ───────────────────────────────────────
  async listCredentials(userId: string) {
    const rows = await this.repo.listCredentials(userId);
    // Jangan kembalikan ciphertext/iv — hanya metadata.
    return rows.map((r) => ({ id: r.id, type: r.type, label: r.label, created_at: r.created_at }));
  }

  async createCredential(
    userId: string,
    input: { type: string; label: string; fields: Record<string, string> }
  ): Promise<ServiceResult> {
    if (!input.type || !input.label?.trim()) return { error: 'Tipe & label wajib diisi', status: 400 };
    if (!input.fields || Object.keys(input.fields).length === 0) return { error: 'Field credential kosong', status: 400 };
    const enc = await encryptSecret(input.fields, this.encKey);
    const id = crypto.randomUUID();
    const now = nowIso();
    await this.repo.insertCredential({
      id, user_id: userId, type: input.type, label: input.label.trim(),
      ciphertext: enc.ciphertext, iv: enc.iv, created_at: now, updated_at: now,
    });
    return { data: { id }, status: 201 };
  }

  async deleteCredential(id: string, userId: string): Promise<ServiceResult> {
    await this.repo.deleteCredential(id, userId);
    return { data: { id } };
  }

  // ─── Manual trigger ────────────────────────────────────────────
  async runNow(id: string, userId: string): Promise<ServiceResult> {
    const automation = await this.repo.getById(id, userId);
    if (!automation) return { error: 'Automation tidak ditemukan', status: 404 };
    const runId = crypto.randomUUID();
    await this.repo.createRun({ id: runId, automation_id: id, user_id: userId, trigger: 'manual' });
    await enqueueAutomationRun(this.env, { automationId: id, runId, trigger: 'manual' });
    return { data: { runId }, status: 202 };
  }

  // ─── Run processing (dipanggil consumer) ───────────────────────
  async processRun(automationId: string, runId: string): Promise<void> {
    const run = await this.repo.getRun(runId);
    if (!run || run.status !== 'queued') return; // idempotent
    const automation = await this.repo.getById(automationId);
    if (!automation) {
      await this.repo.updateRun(runId, { status: 'failed', error: 'Automation tidak ditemukan', finished_at: nowIso() });
      return;
    }
    const template = getTemplate(automation.template_key);
    const cost = template?.credits_per_use ?? 0;
    await this.repo.updateRun(runId, { status: 'running', started_at: nowIso() });

    // Credit deduct (atomic) — pola sama dengan domains/tools.
    let deducted = false;
    if (cost > 0) {
      const r = await this.env.DB.prepare(
        `UPDATE user_tool_credits SET balance = balance - ?, total_used = total_used + ?, updated_at = ?
         WHERE user_id = ? AND balance >= ?`
      ).bind(cost, cost, nowIso(), automation.user_id, cost).run();
      if (!r.meta.changes) {
        await this.repo.updateRun(runId, { status: 'failed', error: 'Kredit tidak cukup', finished_at: nowIso() });
        return;
      }
      deducted = true;
      const balRow = await this.env.DB.prepare('SELECT balance FROM user_tool_credits WHERE user_id = ?')
        .bind(automation.user_id).first<{ balance: number }>();
      await this.env.DB.prepare(
        `INSERT INTO tool_credit_transactions (id, user_id, type, amount, balance_after, tool_name, description, created_at)
         VALUES (?, ?, 'usage', ?, ?, 'content_automation', ?, ?)`
      ).bind(crypto.randomUUID(), automation.user_id, -cost, balRow?.balance ?? 0, automation.name, nowIso()).run().catch(() => {});
    }

    try {
      const credentials = await this.resolveCredentials(automation.config_json);
      const result = await executeAutomation(this.env, automation, credentials);
      await this.repo.updateRun(runId, {
        status: 'success',
        finished_at: nowIso(),
        preview: result.preview,
        logs_json: JSON.stringify(result.logs),
        credits_used: cost,
      });
    } catch (err) {
      if (deducted) {
        await this.env.DB.prepare(
          `UPDATE user_tool_credits SET balance = balance + ?, total_used = CASE WHEN total_used >= ? THEN total_used - ? ELSE 0 END, updated_at = ?
           WHERE user_id = ?`
        ).bind(cost, cost, cost, nowIso(), automation.user_id).run().catch(() => {});
      }
      await this.repo.updateRun(runId, {
        status: 'failed',
        finished_at: nowIso(),
        error: String(err instanceof Error ? err.message : err).slice(0, 500),
      });
    }
  }

  /** Resolve & dekripsi credential per role dari config.credentials. Best-effort. */
  private async resolveCredentials(configJson: string): Promise<Record<string, Record<string, string>>> {
    const config = this.safeConfig(configJson);
    const out: Record<string, Record<string, string>> = {};
    const refs = config.credentials || {};
    for (const role of Object.keys(refs)) {
      const credId = refs[role];
      if (!credId) continue;
      const row = await this.repo.getCredential(credId);
      if (!row) continue;
      try {
        out[role] = await decryptSecret({ ciphertext: row.ciphertext, iv: row.iv }, this.encKey);
      } catch (err) {
        console.error('[AUTOMATION] decrypt credential failed', credId, err);
      }
    }
    return out;
  }

  private safeConfig(json: string | null | undefined): AutomationConfig {
    try { return JSON.parse(json || '{}') as AutomationConfig; }
    catch { return { schedule: { mode: 'hourly', atMinute: 30 } }; }
  }
}
