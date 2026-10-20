import type { Env } from '../env';

export async function logError(env: Env, source: string, message: string, stack?: string, metadata?: unknown): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO error_logs (id, source, message, stack, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      source,
      message,
      stack || null,
      metadata ? JSON.stringify(metadata) : null,
      new Date().toISOString()
    ).run();
  } catch {
    console.error('[logger] Failed to write error log:', message);
  }
}
