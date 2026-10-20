import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error, paginated } from '../../lib/response';
import { AccessService } from '../access/service';
import { membershipExpiresAt } from '../../lib/dates';
import { sendMailketingEmail } from '../../services/mailketing';
import { renderSequenceEmail } from '../../lib/email-templates';

const adminOrdersRoutes = new Hono<{ Bindings: Env }>();
adminOrdersRoutes.use('*', authMiddleware());
adminOrdersRoutes.use('*', requireRole('admin', 'super_admin'));

adminOrdersRoutes.get('/', async (c) => {
  const url = new URL(c.req.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
  const status = url.searchParams.get('status');
  const orderType = url.searchParams.get('order_type');
  const membershipPlanId = url.searchParams.get('membership_plan_id');
  const search = url.searchParams.get('search');
  const hasPrivateConsultation = url.searchParams.get('has_private_consultation') === 'true';
  const offset = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const params: unknown[] = [];

  if (status) { where += ' AND o.status = ?'; params.push(status); }
  if (orderType) { where += ' AND o.order_type = ?'; params.push(orderType); }
  if (membershipPlanId) {
    where += " AND o.order_type = 'membership' AND o.product_id = ?";
    params.push(membershipPlanId);
  }
  if (hasPrivateConsultation) {
    where += " AND o.metadata_json LIKE ?";
    params.push('%"private_1on1_consultation"%');
  }
  if (search) {
    where += ' AND (u.name LIKE ? OR u.email LIKE ? OR o.order_number LIKE ? OR o.product_name LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q, q, q);
  }

  const countResult = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM orders o JOIN users u ON o.user_id = u.id ${where}`
  ).bind(...params).first();
  const total = (countResult?.total as number) || 0;

  params.push(limit, offset);
  const rows = await c.env.DB.prepare(
    `SELECT o.*, u.name as user_name, u.email as user_email
     FROM orders o
     JOIN users u ON o.user_id = u.id
     ${where}
     ORDER BY o.created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params).all();

  return paginated(c, rows.results, { page, limit, total });
});

adminOrdersRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const order = await c.env.DB.prepare(
    `SELECT o.*, u.name as user_name, u.email as user_email
     FROM orders o
     JOIN users u ON o.user_id = u.id
     WHERE o.id = ?`
  ).bind(id).first();
  if (!order) return error(c, 'Order not found', 404);
  return success(c, order);
});

// PATCH /api/admin/orders/:id/status
adminOrdersRoutes.patch('/:id/status', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json() as { status: string };
  const { status } = body;

  const allowed = ['pending', 'paid', 'failed', 'cancelled'];
  if (!allowed.includes(status)) return error(c, 'Status tidak valid', 400);

  const order = await c.env.DB.prepare(
    `SELECT o.*, u.name as user_name, u.email as user_email
     FROM orders o JOIN users u ON o.user_id = u.id WHERE o.id = ?`
  ).bind(id).first();
  if (!order) return error(c, 'Order not found', 404);
  if (order.status === status) return success(c, { message: 'Status tidak berubah' });

  const now = new Date().toISOString();
  const admin = c.get('user');

  const paidAt = status === 'paid' ? (order.paid_at || now) : null;
  await c.env.DB.prepare(
    `UPDATE orders SET status = ?, updated_at = ?, paid_at = ? WHERE id = ?`
  ).bind(status, now, paidAt, id).run();

  // Jika di-mark paid dan sebelumnya bukan paid — provisioning akses
  if (status === 'paid' && order.status !== 'paid') {
    const accessService = new AccessService(c.env);

    if (order.order_type === 'course') {
      const existing = await c.env.DB.prepare(
        'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?'
      ).bind(order.user_id, order.product_id).first();

      if (!existing) {
        await c.env.DB.prepare(
          `INSERT INTO enrollments (id, user_id, course_id, status, enrolled_at, updated_at)
           VALUES (?, ?, ?, 'active', ?, ?)`
        ).bind(crypto.randomUUID(), order.user_id, order.product_id, now, now).run();
      }
      await accessService.grantCourseAccessFromOrder(id, order.user_id as string, order.product_id as string);

    } else if (order.order_type === 'membership') {
      const plan = await c.env.DB.prepare(
        'SELECT name, duration_type, duration_days FROM membership_plans WHERE id = ?'
      ).bind(order.product_id).first();

      if (plan) {
        await accessService.grantMembershipAccessFromOrder(
          id,
          order.user_id as string,
          order.product_id as string,
          plan.duration_type as string,
          plan.duration_days as number | null,
        );
      }
    }
  }

  // Jika order paid dibatalkan/digagalkan, cabut akses yang berasal dari order ini.
  if (order.status === 'paid' && status !== 'paid') {
    if (order.order_type === 'course') {
      await c.env.DB.prepare(
        `UPDATE user_access
         SET status = 'revoked', updated_at = ?
         WHERE source_type = 'order' AND source_id = ? AND status = 'active'`
      ).bind(now, id).run();
    } else if (order.order_type === 'membership') {
      await c.env.DB.prepare(
        `UPDATE memberships
         SET status = 'revoked', updated_at = ?, cancelled_at = ?
         WHERE source_order_id = ? AND status = 'active'`
      ).bind(now, now, id).run();
    }
  }

  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, before_data_json, after_data_json, created_at)
     VALUES (?, ?, 'update_status', 'order', ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(), admin.id, id,
    JSON.stringify({ status: order.status }),
    JSON.stringify({ status }),
    now
  ).run();

  return success(c, { message: 'Status order diperbarui' });
});

// POST /api/admin/orders/:id/remind
adminOrdersRoutes.post('/:id/remind', async (c) => {
  const id = c.req.param('id');
  const order = await c.env.DB.prepare(
    `SELECT o.*, u.name as user_name, u.email as user_email
     FROM orders o JOIN users u ON o.user_id = u.id WHERE o.id = ?`
  ).bind(id).first();
  
  if (!order) return error(c, 'Order not found', 404);
  if (order.status !== 'pending') return error(c, 'Hanya order pending yang bisa dikirimi pengingat', 400);

  const checkoutUrl = `${c.env.APP_URL || 'https://app.pejuangyen.com'}/checkout/${order.id}`;
  const productName = (order.product_name as string) || 'Kelas PejuangYen';
  
  const content = renderSequenceEmail('abandoned_checkout_1', checkoutUrl, {
    userName: order.user_name as string,
    productName: productName,
  });

  const mailRes = await sendMailketingEmail(c.env, {
    recipient: order.user_email as string,
    subject: `Selesaikan pembayaran untuk ${productName}`,
    content,
    emailType: 'transactional',
  }, c.env.DB);

  if (!mailRes.success) {
    return error(c, mailRes.error || 'Gagal mengirim email pengingat', 500);
  }

  const now = new Date().toISOString();
  const admin = c.get('user');

  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, before_data_json, after_data_json, created_at)
     VALUES (?, ?, 'send_reminder', 'order', ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(), admin.id, id,
    JSON.stringify({ status: order.status }),
    JSON.stringify({ reminded: true }),
    now
  ).run();

  return success(c, { message: 'Email pengingat berhasil dikirim' });
});

export default adminOrdersRoutes;
