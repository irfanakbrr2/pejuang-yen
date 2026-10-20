import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error } from '../../lib/response';

const analyticsKeysRoutes = new Hono<{ Bindings: Env }>();
analyticsKeysRoutes.use('*', authMiddleware());
analyticsKeysRoutes.use('*', requireRole('admin', 'super_admin'));

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// GET /api/admin/analytics-keys
analyticsKeysRoutes.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, name, key_prefix, created_at, last_used_at, expires_at, is_active, request_count
     FROM analytics_api_keys ORDER BY created_at DESC`
  ).all();
  return success(c, rows.results);
});

// POST /api/admin/analytics-keys — generate new key, returned ONCE
analyticsKeysRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({})) as { name?: string; expires_at?: string };
  if (!body.name?.trim()) return error(c, 'name is required', 400);

  const user = c.get('user') as { id: string };

  const randBytes = crypto.getRandomValues(new Uint8Array(24));
  const randHex = Array.from(randBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  const key = `gwa_${randHex}`;
  const prefix = key.slice(0, 12);
  const hash = await sha256hex(key);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO analytics_api_keys (id, name, key_hash, key_prefix, created_by, created_at, expires_at, is_active, request_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)`
  ).bind(id, body.name.trim(), hash, prefix, user.id, now, body.expires_at ?? null).run();

  // key is returned here and NEVER again
  return success(c, { id, name: body.name.trim(), key, key_prefix: prefix, created_at: now }, 201);
});

// DELETE /api/admin/analytics-keys/:id — soft revoke
analyticsKeysRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const result = await c.env.DB.prepare(
    `UPDATE analytics_api_keys SET is_active = 0 WHERE id = ?`
  ).bind(id).run();
  if (!result.meta.changes) return error(c, 'API key not found', 404);
  return success(c, { revoked: true });
});

export default analyticsKeysRoutes;
