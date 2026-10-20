import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error, paginated } from '../../lib/response';
import { membershipExpiresAt } from '../../lib/dates';
import { kvDelete } from '../../lib/cache';

const adminMemberships = new Hono<{ Bindings: Env }>();

adminMemberships.use('*', authMiddleware());
adminMemberships.use('*', requireRole('admin', 'super_admin'));

// ─── MEMBERSHIP PLANS ────────────────────────────

// GET /api/admin/memberships/plans
adminMemberships.get('/plans', async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT * FROM membership_plans ORDER BY sort_order ASC'
  ).all();
  return success(c, rows.results);
});

// POST /api/admin/memberships/plans
adminMemberships.post('/plans', async (c) => {
  const body = await c.req.json() as {
    slug: string; name: string; description?: string;
    duration_type: string; duration_days?: number;
    price: number; compare_at_price?: number;
    status?: string; sort_order?: number; features_json?: string;
  };
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  if (!body.slug || !body.name || !body.duration_type || body.price === undefined) {
    return error(c, 'slug, name, duration_type, price are required', 400);
  }

  await c.env.DB.prepare(
    `INSERT INTO membership_plans (id, slug, name, description, duration_type, duration_days, price, compare_at_price, status, sort_order, features_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, body.slug, body.name, body.description || null,
    body.duration_type, body.duration_days || null, body.price,
    body.compare_at_price || null, body.status || 'active',
    body.sort_order || 0, body.features_json || null, now, now
  ).run();

  await kvDelete(c.env, 'membership:plans:v1').catch(() => {});

  return success(c, { id }, 201);
});

// PUT /api/admin/memberships/plans/:id
adminMemberships.put('/plans/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json() as Record<string, unknown>;
  const now = new Date().toISOString();

  const existing = await c.env.DB.prepare('SELECT id FROM membership_plans WHERE id = ?').bind(id).first();
  if (!existing) return error(c, 'Plan not found', 404);

  const allowed = ['slug', 'name', 'description', 'duration_type', 'duration_days', 'price', 'compare_at_price', 'status', 'sort_order', 'features_json'];
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const key of allowed) {
    if (key in body) { fields.push(`${key} = ?`); values.push(body[key] ?? null); }
  }
  if (fields.length === 0) return error(c, 'No valid fields to update', 400);

  fields.push('updated_at = ?');
  values.push(now, id);

  await c.env.DB.prepare(
    `UPDATE membership_plans SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  await kvDelete(c.env, 'membership:plans:v1').catch(() => {});

  return success(c, { id });
});

// DELETE /api/admin/memberships/plans/:id
adminMemberships.delete('/plans/:id', async (c) => {
  const id = c.req.param('id');

  const existing = await c.env.DB.prepare('SELECT id FROM membership_plans WHERE id = ?').bind(id).first();
  if (!existing) return error(c, 'Plan not found', 404);

  // Cegah hapus jika masih dipakai membership (jaga riwayat) — arahkan admin nonaktifkan saja.
  const usage = await c.env.DB.prepare(
    'SELECT COUNT(*) AS n FROM memberships WHERE plan_id = ?'
  ).bind(id).first<{ n: number }>();
  if (usage && usage.n > 0) {
    return error(c, `Paket masih dipakai ${usage.n} membership. Ubah status ke Inactive daripada dihapus.`, 409);
  }

  // Bersihkan referensi kupon lalu hapus paket.
  await c.env.DB.prepare('DELETE FROM coupon_plan_eligibility WHERE plan_id = ?').bind(id).run().catch(() => {});
  await c.env.DB.prepare('DELETE FROM membership_plans WHERE id = ?').bind(id).run();

  await kvDelete(c.env, 'membership:plans:v1').catch(() => {});

  return success(c, { id });
});

// ─── USER MEMBERSHIPS ────────────────────────────

// GET /api/admin/memberships — List user memberships (not plans)
adminMemberships.get('/', async (c) => {
  const url = new URL(c.req.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');
  const offset = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const params: unknown[] = [];

  if (status) { where += ` AND m.status = ?`; params.push(status); }
  if (search) { where += ` AND (u.name LIKE ? OR u.email LIKE ?)`; params.push(`%${search}%`, `%${search}%`); }

  const countResult = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM memberships m JOIN users u ON m.user_id = u.id ${where}`
  ).bind(...params).first();
  const total = (countResult?.total as number) || 0;

  const rows = await c.env.DB.prepare(
    `SELECT m.id, m.status, m.starts_at, m.expires_at, m.created_at, m.cancelled_at,
            u.id as user_id, u.name as user_name, u.email as user_email,
            p.name as plan_name, p.duration_type
     FROM memberships m
     JOIN users u ON m.user_id = u.id
     JOIN membership_plans p ON m.plan_id = p.id
     ${where}
     ORDER BY m.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return paginated(c, rows.results, { page, limit, total });
});

// POST /api/admin/memberships/grant — Manually grant membership to user
adminMemberships.post('/grant', async (c) => {
  const actor = c.get('user');
  const body = await c.req.json() as { user_id: string; plan_id: string; notes?: string };
  const { user_id, plan_id } = body;

  if (!user_id || !plan_id) return error(c, 'user_id and plan_id are required', 400);

  const plan = await c.env.DB.prepare('SELECT * FROM membership_plans WHERE id = ?').bind(plan_id).first();
  if (!plan) return error(c, 'Plan not found', 404);

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(user_id).first();
  if (!user) return error(c, 'User not found', 404);

  const now = new Date().toISOString();
  const expiresAt = membershipExpiresAt(now, plan.duration_type as string, plan.duration_days as number | null);
  const membershipId = crypto.randomUUID();

  await c.env.DB.prepare(
    `INSERT INTO memberships (id, user_id, plan_id, status, starts_at, expires_at, source_order_id, created_at, updated_at)
     VALUES (?, ?, ?, 'active', ?, ?, NULL, ?, ?)`
  ).bind(membershipId, user_id, plan_id, now, expiresAt, now, now).run();

  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, after_data_json, created_at)
     VALUES (?, ?, 'grant_membership', 'membership', ?, ?, ?)`
  ).bind(crypto.randomUUID(), actor.id, membershipId, JSON.stringify({ user_id, plan_id, expires_at: expiresAt }), now).run();

  return success(c, { id: membershipId, expires_at: expiresAt }, 201);
});

// POST /api/admin/memberships/:id/revoke
adminMemberships.post('/:id/revoke', async (c) => {
  const id = c.req.param('id');
  const actor = c.get('user');
  const now = new Date().toISOString();

  const membership = await c.env.DB.prepare('SELECT id, status FROM memberships WHERE id = ?').bind(id).first();
  if (!membership) return error(c, 'Membership not found', 404);
  if (membership.status === 'revoked') return error(c, 'Already revoked', 400);

  await c.env.DB.prepare(
    `UPDATE memberships SET status = 'revoked', updated_at = ?, cancelled_at = ? WHERE id = ?`
  ).bind(now, now, id).run();

  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, created_at)
     VALUES (?, ?, 'revoke_membership', 'membership', ?, ?)`
  ).bind(crypto.randomUUID(), actor.id, id, now).run();

  return success(c, { message: 'Membership revoked' });
});

// POST /api/admin/memberships/:id/extend
adminMemberships.post('/:id/extend', async (c) => {
  const id = c.req.param('id');
  const actor = c.get('user');
  const body = await c.req.json() as { days: number };
  const { days } = body;

  if (!days || days <= 0) return error(c, 'days must be a positive number', 400);

  const membership = await c.env.DB.prepare('SELECT id, expires_at FROM memberships WHERE id = ?').bind(id).first();
  if (!membership) return error(c, 'Membership not found', 404);

  const now = new Date().toISOString();
  const base = membership.expires_at ? new Date(membership.expires_at as string) : new Date();
  const newExpiry = new Date(base.getTime() + days * 24 * 3600 * 1000).toISOString();

  await c.env.DB.prepare(
    `UPDATE memberships SET expires_at = ?, updated_at = ? WHERE id = ?`
  ).bind(newExpiry, now, id).run();

  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, after_data_json, created_at)
     VALUES (?, ?, 'extend_membership', 'membership', ?, ?, ?)`
  ).bind(crypto.randomUUID(), actor.id, id, JSON.stringify({ added_days: days, new_expires_at: newExpiry }), now).run();

  return success(c, { expires_at: newExpiry });
});

// POST /api/admin/memberships/:id/reduce
adminMemberships.post('/:id/reduce', async (c) => {
  const id = c.req.param('id');
  const actor = c.get('user');
  const body = await c.req.json() as { days: number };
  const { days } = body;

  if (!days || days <= 0) return error(c, 'days must be a positive number', 400);

  const membership = await c.env.DB.prepare(
    'SELECT id, status, expires_at FROM memberships WHERE id = ?'
  ).bind(id).first() as { id: string; status: string; expires_at: string | null } | null;
  if (!membership) return error(c, 'Membership not found', 404);
  if (!membership.expires_at) return error(c, 'Membership lifetime tidak punya tanggal berakhir untuk dikurangi', 400);

  const now = new Date();
  const currentExpiry = new Date(membership.expires_at);
  const reducedExpiry = new Date(currentExpiry.getTime() - days * 24 * 3600 * 1000);
  const shouldExpireNow = reducedExpiry.getTime() <= now.getTime();
  const newExpiry = (shouldExpireNow ? now : reducedExpiry).toISOString();
  const newStatus = shouldExpireNow ? 'expired' : membership.status;

  await c.env.DB.prepare(
    `UPDATE memberships SET expires_at = ?, status = ?, updated_at = ? WHERE id = ?`
  ).bind(newExpiry, newStatus, now.toISOString(), id).run();

  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, after_data_json, created_at)
     VALUES (?, ?, 'reduce_membership', 'membership', ?, ?, ?)`
  ).bind(
    crypto.randomUUID(),
    actor.id,
    id,
    JSON.stringify({ reduced_days: days, old_expires_at: membership.expires_at, new_expires_at: newExpiry, new_status: newStatus }),
    now.toISOString()
  ).run();

  return success(c, { expires_at: newExpiry, status: newStatus });
});

export default adminMemberships;
