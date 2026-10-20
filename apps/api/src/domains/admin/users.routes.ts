import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error, paginated } from '../../lib/response';
import { writeAuditLog } from '../../lib/audit';
import { hashPassword } from '../../lib/password';
import { CITY_BY_CODE } from '@growwithai/shared';

const adminUsers = new Hono<{ Bindings: Env }>();

adminUsers.use('*', authMiddleware());
adminUsers.use('*', requireRole('admin', 'super_admin'));

// GET /api/admin/users
adminUsers.get('/', async (c) => {
  const url = new URL(c.req.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
  const search = url.searchParams.get('search');
  const offset = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const params: unknown[] = [];

  if (search) { where += ` AND (name LIKE ? OR email LIKE ?)`; params.push(`%${search}%`, `%${search}%`); }

  const countResult = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM users ${where}`).bind(...params).first();
  const total = (countResult?.total as number) || 0;

  const rows = await c.env.DB.prepare(
    `SELECT id, name, email, role, phone, status, created_at, last_login_at FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return paginated(c, rows.results, { page, limit, total });
});

// GET /api/admin/users/:id
adminUsers.get('/:id', async (c) => {
  const id = c.req.param('id');
  const user = await c.env.DB.prepare(
    'SELECT id, name, email, role, phone, city_code, status, created_at, last_login_at FROM users WHERE id = ?'
  ).bind(id).first();
  if (!user) return error(c, 'User not found', 404);
  const cityName = user.city_code ? (CITY_BY_CODE[user.city_code as string]?.name ?? null) : null;
  return success(c, { ...user, city_name: cityName });
});

// GET /api/admin/users/:id/journey — attribution + lifecycle timeline
adminUsers.get('/:id/journey', async (c) => {
  const id = c.req.param('id');
  const user = await c.env.DB.prepare(
    'SELECT id, name, email, role, phone, status, created_at, last_login_at FROM users WHERE id = ?'
  ).bind(id).first();
  if (!user) return error(c, 'User not found', 404);

  const [attribution, profile, orders, memberships, enrollments, activity, events] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM user_attribution WHERE user_id = ?').bind(id).first(),
    c.env.DB.prepare(
      'SELECT role, primary_goal, ai_level, onboarding_completed FROM user_profiles WHERE user_id = ?'
    ).bind(id).first(),
    c.env.DB.prepare(
      `SELECT id, order_number, order_type, product_name, amount, status, affiliate_code, coupon_code, created_at, paid_at
       FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
    ).bind(id).all(),
    c.env.DB.prepare(
      `SELECT m.id, m.plan_id, mp.name as plan_name, m.status, m.starts_at, m.expires_at, m.source_order_id, m.created_at
       FROM memberships m LEFT JOIN membership_plans mp ON mp.id = m.plan_id
       WHERE m.user_id = ? ORDER BY m.created_at DESC LIMIT 20`
    ).bind(id).all(),
    c.env.DB.prepare(
      `SELECT e.id, e.course_id, c2.title as course_title, e.progress_percent, e.status, e.enrolled_at, e.completed_at
       FROM enrollments e LEFT JOIN courses c2 ON c2.id = e.course_id
       WHERE e.user_id = ? ORDER BY e.enrolled_at DESC LIMIT 50`
    ).bind(id).all(),
    c.env.DB.prepare(
      `SELECT COUNT(*) as active_days_30, MAX(activity_date) as last_active
       FROM user_activity_days
       WHERE user_id = ? AND activity_date >= date('now', '-30 days')`
    ).bind(id).first(),
    c.env.DB.prepare(
      `SELECT id, event_name, event_category, page_url, utm_source, utm_medium, utm_campaign,
              affiliate_code, course_id, lesson_id, webinar_id, order_id,
              payment_amount, payment_status, plan_before, plan_after, device_type, metadata_json, created_at
       FROM tracking_events WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`
    ).bind(id).all(),
  ]);

  const lastActiveAllTime = await c.env.DB.prepare(
    `SELECT MAX(activity_date) as last_active FROM user_activity_days WHERE user_id = ?`
  ).bind(id).first();

  return success(c, {
    user,
    profile: profile || null,
    attribution: attribution || null,
    orders: orders.results,
    memberships: memberships.results,
    enrollments: enrollments.results,
    activity: {
      active_days_30: (activity?.active_days_30 as number) || 0,
      last_active: (lastActiveAllTime?.last_active as string | null) || (activity?.last_active as string | null) || null,
    },
    events: events.results,
  });
});

// PUT /api/admin/users/:id — Edit user name, email, role
adminUsers.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json() as { name?: string; email?: string; role?: string };
  const actor = c.get('user');

  const existing = await c.env.DB.prepare('SELECT id, name, email, role, status FROM users WHERE id = ?').bind(id).first();
  if (!existing) return error(c, 'User not found', 404);

  const allowedRoles = ['user', 'admin', 'super_admin'];
  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.name && body.name.trim()) { fields.push('name = ?'); values.push(body.name.trim()); }
  if (body.email && body.email.trim()) { fields.push('email = ?'); values.push(body.email.trim().toLowerCase()); }
  if (body.role && allowedRoles.includes(body.role)) {
    if (actor.role !== 'super_admin') return error(c, 'Only super_admin can update roles', 403);
    if (actor.id === id && body.role !== existing.role) return error(c, 'Cannot change your own role', 400);

    if (existing.role === 'super_admin' && body.role !== 'super_admin') {
      const countRow = await c.env.DB.prepare(
        "SELECT COUNT(*) as total FROM users WHERE role = 'super_admin' AND status = 'active'"
      ).first() as { total?: number } | null;
      if (Number(countRow?.total || 0) <= 1) {
        return error(c, 'Cannot downgrade the last active super_admin', 400);
      }
    }

    fields.push('role = ?');
    values.push(body.role);
  }

  if (fields.length === 0) return error(c, 'No valid fields to update', 400);

  const now = new Date().toISOString();
  fields.push('updated_at = ?');
  values.push(now, id);

  await c.env.DB.prepare(
    `UPDATE users SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  await writeAuditLog(c.env, {
    actorUserId: actor.id,
    action: 'update_user',
    entityType: 'user',
    entityId: id,
    before: existing,
    after: body,
  });

  return success(c, { message: 'User updated successfully' });
});

// PUT /api/admin/users/:id/status
adminUsers.put('/:id/status', async (c) => {
  const id = c.req.param('id');
  const actor = c.get('user');
  const body = await c.req.json() as { status: string };
  const { status } = body;

  const allowed = ['active', 'banned', 'suspended'];
  if (!allowed.includes(status)) return error(c, 'Invalid status', 400);

  const existing = await c.env.DB.prepare('SELECT id, role, status FROM users WHERE id = ?').bind(id).first();
  if (!existing) return error(c, 'User not found', 404);
  if (existing.role === 'super_admin' && actor.role !== 'super_admin') {
    return error(c, 'Only super_admin can update super_admin status', 403);
  }
  if (existing.role === 'super_admin' && status !== 'active') {
    const countRow = await c.env.DB.prepare(
      "SELECT COUNT(*) as total FROM users WHERE role = 'super_admin' AND status = 'active'"
    ).first() as { total?: number } | null;
    if (Number(countRow?.total || 0) <= 1) {
      return error(c, 'Cannot disable the last active super_admin', 400);
    }
  }

  const now = new Date().toISOString();
  await c.env.DB.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').bind(status, now, id).run();

  await writeAuditLog(c.env, {
    actorUserId: actor.id,
    action: 'update_user_status',
    entityType: 'user',
    entityId: id,
    before: { status: existing.status },
    after: { status },
  });

  return success(c, { message: `User status updated to ${status}` });
});

// POST /api/admin/users/:id/grant-access
adminUsers.post('/:id/grant-access', async (c) => {
  const userId = c.req.param('id');
  const body = await c.req.json() as { resource_type: string; resource_id: string };
  const { resource_type, resource_id } = body;

  if (!resource_type || !resource_id) return error(c, 'resource_type and resource_id are required', 400);

  const now = new Date().toISOString();

  if (resource_type === 'course') {
    const existing = await c.env.DB.prepare('SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?').bind(userId, resource_id).first();
    if (!existing) {
      await c.env.DB.prepare(
        `INSERT INTO enrollments (id, user_id, course_id, status, enrolled_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?)`
      ).bind(crypto.randomUUID(), userId, resource_id, now, now).run();
    }
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO user_access (id, user_id, access_type, resource_type, resource_id, source_type, status, starts_at, created_at, updated_at)
       VALUES (?, ?, 'lifetime', 'course', ?, 'admin_grant', 'active', ?, ?, ?)`
    ).bind(crypto.randomUUID(), userId, resource_id, now, now, now).run();
  }

  return success(c, { message: 'Access granted' });
});

// POST /:id/reset-password — admin set password sementara (tanpa perlu email/Mailketing).
// Berguna saat user lupa password & email reset belum aktif. Password dikembalikan sekali ke admin.
adminUsers.post('/:id/reset-password', async (c) => {
  const userId = c.req.param('id');
  const user = await c.env.DB.prepare('SELECT id, email FROM users WHERE id = ?')
    .bind(userId).first<{ id: string; email: string }>();
  if (!user) return error(c, 'User tidak ditemukan', 404);

  // Password sementara acak, tanpa karakter ambigu (0/O/1/l/I).
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const rnd = new Uint8Array(12);
  crypto.getRandomValues(rnd);
  const tempPassword = Array.from(rnd, (b) => alphabet[b % alphabet.length]).join('');

  const now = new Date().toISOString();
  await c.env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .bind(await hashPassword(tempPassword), now, userId).run();
  // Cabut semua sesi aktif → user wajib login ulang dengan password baru.
  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();

  const actor = c.get('user');
  await writeAuditLog(c.env, {
    actorUserId: actor?.id,
    action: 'reset_user_password',
    entityType: 'user',
    entityId: userId,
  }).catch(() => {});

  return success(c, { message: 'Password direset', temp_password: tempPassword, email: user.email });
});

export default adminUsers;
