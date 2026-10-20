import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error, paginated } from '../../lib/response';

const adminPaymentsRoutes = new Hono<{ Bindings: Env }>();
adminPaymentsRoutes.use('*', authMiddleware());
adminPaymentsRoutes.use('*', requireRole('admin', 'super_admin'));

adminPaymentsRoutes.get('/', async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const limit = Math.min(100, parseInt(c.req.query('limit') || '50', 10));
  const status = c.req.query('status');
  const offset = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const params: unknown[] = [];

  if (status) { where += ' AND p.status = ?'; params.push(status); }

  const total = ((await c.env.DB.prepare(`SELECT COUNT(*) as n FROM payments p ${where}`).bind(...params).first())?.n as number) || 0;
  const rows = await c.env.DB.prepare(
    `SELECT p.*, o.order_number FROM payments p
     LEFT JOIN orders o ON p.order_id = o.id
     ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return paginated(c, rows.results, { page, limit, total });
});

adminPaymentsRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const payment = await c.env.DB.prepare('SELECT * FROM payments WHERE id = ?').bind(id).first();
  if (!payment) return error(c, 'Payment not found', 404);
  return success(c, payment);
});

// DELETE /api/admin/payments/:id
// Deletes only the payment record. It intentionally does not update orders,
// memberships, enrollments, user_access, or tool credits.
adminPaymentsRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const payment = await c.env.DB.prepare(
    `SELECT p.*, o.order_number
     FROM payments p
     LEFT JOIN orders o ON o.id = p.order_id
     WHERE p.id = ?`
  ).bind(id).first();
  if (!payment) return error(c, 'Payment not found', 404);

  const admin = c.get('user');
  const now = new Date().toISOString();

  await c.env.DB.prepare('DELETE FROM payments WHERE id = ?').bind(id).run();

  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, before_data_json, after_data_json, created_at)
     VALUES (?, ?, 'delete_payment_record', 'payment', ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(),
    admin.id,
    id,
    JSON.stringify(payment),
    JSON.stringify({ deleted: true, access_affected: false }),
    now
  ).run();

  return success(c, { message: 'Payment record deleted. User access was not changed.' });
});

export default adminPaymentsRoutes;
