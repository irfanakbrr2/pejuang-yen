import type { Env } from '../env';

interface AuditParams {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ipHash?: string | null;
}

export async function writeAuditLog(env: Env, params: AuditParams): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, before_data_json, after_data_json, ip_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      params.actorUserId,
      params.action,
      params.entityType,
      params.entityId || null,
      params.before ? JSON.stringify(params.before) : null,
      params.after ? JSON.stringify(params.after) : null,
      params.ipHash || null,
      new Date().toISOString()
    ).run();
  } catch {
    console.error('[audit] Failed to write audit log:', params.action);
  }
}
