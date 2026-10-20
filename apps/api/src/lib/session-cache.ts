import type { Context } from 'hono';
import type { Env } from '../env';
import type { UserPublic } from '@growwithai/shared';

/**
 * Cache validasi session di KV untuk melepas D1 primary dari beban "siapa kamu"
 * di SETIAP request terautentikasi. Pola read-mostly: lookup KV dulu, miss →
 * query D1 → tulis balik ke KV dengan TTL pendek.
 *
 * Konsistensi: KV eventually-consistent + TTL, jadi revoke session yang TIDAK
 * lewat logout (reset password, revoke-all, suspend admin) baru efektif setelah
 * ≤ SESSION_CACHE_TTL detik. Logout meng-invalidate key-nya langsung (punya token
 * dari cookie). Aksi sensitif harus tetap memvalidasi ke D1, jangan andalkan cache.
 */
export const SESSION_CACHE_TTL = 60; // detik — staleness maksimum untuk revoke non-logout

export interface CachedSession {
  user: UserPublic;
  sessionId: string;
}

const cacheKey = (tokenHash: string) => `sess:${tokenHash}`;

export async function hashToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function getCachedSession(env: Env, tokenHash: string): Promise<CachedSession | null> {
  try {
    return (await env.KV.get(cacheKey(tokenHash), 'json')) as CachedSession | null;
  } catch (err) {
    console.error('[session-cache] get failed:', err);
    return null;
  }
}

export function putCachedSession(env: Env, tokenHash: string, value: CachedSession): Promise<void> {
  return env.KV
    .put(cacheKey(tokenHash), JSON.stringify(value), { expirationTtl: SESSION_CACHE_TTL })
    .catch((err) => console.error('[session-cache] put failed:', err));
}

export function invalidateCachedSession(env: Env, tokenHash: string): Promise<void> {
  return env.KV.delete(cacheKey(tokenHash)).catch((err) =>
    console.error('[session-cache] delete failed:', err)
  );
}

export function getSessionCookie(c: Context, name = 'session'): string | undefined {
  const cookieHeader = c.req.header('cookie');
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}
