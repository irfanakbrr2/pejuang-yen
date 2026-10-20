import type { Context, Next } from 'hono';
import type { Env } from '../env';
import type { UserPublic } from '@growwithai/shared';
import {
  hashToken,
  getCachedSession,
  putCachedSession,
  getSessionCookie as getCookie,
} from '../lib/session-cache';

// Extend Hono context variables
declare module 'hono' {
  interface ContextVariableMap {
    user: UserPublic;
    sessionId: string;
  }
}

/**
 * Resolve session from KV cache first, falling back to D1. On a D1 hit the result
 * is written back to KV (TTL pendek) so subsequent requests skip the primary.
 * Returns null when no valid session exists.
 */
async function resolveSession(
  c: Context<{ Bindings: Env }>,
  tokenHash: string
): Promise<{ user: UserPublic; sessionId: string } | null> {
  const cached = await getCachedSession(c.env, tokenHash);
  if (cached) return cached;

  const session = await c.env.DB.prepare(
    `SELECT s.id, s.user_id, s.expires_at,
            u.id as uid, u.email, u.name, u.phone, u.avatar_url, u.role, u.status, u.created_at, u.city_code
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ?
       AND s.expires_at > ?
       AND s.revoked_at IS NULL
       AND u.status = 'active'
     LIMIT 1`
  ).bind(tokenHash, new Date().toISOString()).first();

  if (!session) return null;

  const user: UserPublic = {
    id: session.uid as string,
    email: session.email as string,
    name: session.name as string,
    phone: session.phone as string | undefined,
    avatar_url: session.avatar_url as string | undefined,
    role: session.role as UserPublic['role'],
    status: session.status as UserPublic['status'],
    created_at: session.created_at as string,
    city_code: session.city_code as string | undefined,
  };
  const resolved = { user, sessionId: session.id as string };

  // Tulis balik ke KV tanpa blokir response.
  c.executionCtx.waitUntil(putCachedSession(c.env, tokenHash, resolved));
  return resolved;
}

/**
 * Auth middleware — validates session cookie and sets user in context
 */
export function authMiddleware() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const sessionToken = getCookie(c, 'session');
    if (!sessionToken) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const tokenHash = await hashToken(sessionToken);
    const resolved = await resolveSession(c, tokenHash);

    if (!resolved) {
      return c.json({ success: false, error: 'Session expired' }, 401);
    }

    c.set('user', resolved.user);
    c.set('sessionId', resolved.sessionId);

    await next();
  };
}

/**
 * Optional Auth middleware — sets user in context if session is valid, but does not block if unauthorized
 */
export function optionalAuthMiddleware() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const sessionToken = getCookie(c, 'session');
    if (!sessionToken) {
      return await next();
    }

    try {
      const tokenHash = await hashToken(sessionToken);
      const resolved = await resolveSession(c, tokenHash);
      if (resolved) {
        c.set('user', resolved.user);
        c.set('sessionId', resolved.sessionId);
      }
    } catch (err) {
      // ignore
    }

    await next();
  };
}


/**
 * Role middleware — restricts access to specific roles
 */
export function requireRole(...roles: string[]) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }
    if (!roles.includes(user.role)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    await next();
  };
}
