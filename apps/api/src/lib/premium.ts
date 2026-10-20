import type { Env } from '../env';

/** Member premium = punya membership aktif apa pun; admin/super_admin bypass. */
export async function isPremiumUser(env: Env, user: { id: string; role?: string }): Promise<boolean> {
  if (user.role === 'admin' || user.role === 'super_admin') return true;
  const now = new Date().toISOString();
  const row = await env.DB.prepare(
    `SELECT m.id FROM memberships m
     WHERE m.user_id = ? AND m.status = 'active'
       AND (m.expires_at IS NULL OR m.expires_at > ?)
     LIMIT 1`
  ).bind(user.id, now).first();
  return !!row;
}

export async function isCreatorStoreEnabled(env: Env): Promise<boolean> {
  const row = await env.DB.prepare("SELECT value_json FROM app_settings WHERE key = 'creator_store_enabled'").first();
  if (!row?.value_json) return false;
  try {
    const parsed = JSON.parse(String(row.value_json));
    return parsed === true || parsed === 'true' || parsed === 1;
  } catch {
    return String(row.value_json).toLowerCase().includes('true');
  }
}
