import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { error, paginated, success } from '../../lib/response';

const adminWebhooksRoutes = new Hono<{ Bindings: Env }>();
adminWebhooksRoutes.use('*', authMiddleware());
adminWebhooksRoutes.use('*', requireRole('admin', 'super_admin'));

// GET /api/admin/webhooks — webhook health list
adminWebhooksRoutes.get('/', async (c) => {
  const url = new URL(c.req.url);
  const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1), 100);
  const status = url.searchParams.get('status') || 'attention';
  const offset = (page - 1) * limit;

  let where = `WHERE 1=1`;
  const params: unknown[] = [];

  if (status === 'attention') {
    where += ` AND (processing_status = 'failed' OR (processing_status = 'pending' AND received_at < datetime('now', '-5 minutes')))`;
  } else if (status && status !== 'all') {
    where += ` AND processing_status = ?`;
    params.push(status);
  }

  const totalRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM webhook_events ${where}`
  ).bind(...params).first();

  const rows = await c.env.DB.prepare(
    `SELECT id, provider, event_type, provider_event_id, provider_transaction_id,
            order_id, processing_status, received_at, processed_at, error_message
     FROM webhook_events
     ${where}
     ORDER BY received_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return paginated(c, rows.results, { page, limit, total: Number(totalRow?.total || 0) });
});

// GET /api/admin/webhooks/stats — volume and attention summary
adminWebhooksRoutes.get('/stats', async (c) => {
  const [statusRows, hourlyRows] = await Promise.all([
    c.env.DB.prepare(
      `SELECT processing_status, COUNT(*) as count
       FROM webhook_events
       WHERE received_at >= datetime('now', '-24 hours')
       GROUP BY processing_status`
    ).all(),
    c.env.DB.prepare(
      `SELECT strftime('%Y-%m-%dT%H:00:00Z', received_at) as hour, COUNT(*) as count
       FROM webhook_events
       WHERE received_at >= datetime('now', '-24 hours')
       GROUP BY hour
       ORDER BY hour DESC`
    ).all(),
  ]);

  return success(c, {
    by_status: statusRows.results,
    hourly: hourlyRows.results,
  });
});

// POST /api/admin/webhooks/:id/retry — mark failed/pending event as retry-requested
adminWebhooksRoutes.post('/:id/retry', async (c) => {
  const id = c.req.param('id');
  const now = new Date().toISOString();

  const webhook = await c.env.DB.prepare(
    `SELECT id, processing_status FROM webhook_events WHERE id = ?`
  ).bind(id).first();

  if (!webhook) return error(c, 'Webhook event not found', 404);
  if (webhook.processing_status === 'processed') {
    return error(c, 'Processed webhook cannot be retried', 400);
  }

  await c.env.DB.prepare(
    `UPDATE webhook_events
     SET processing_status = 'pending', error_message = NULL, processed_at = NULL
     WHERE id = ?`
  ).bind(id).run();

  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, after_data_json, created_at)
     VALUES (?, ?, 'webhook_retry_requested', 'webhook_event', ?, ?, ?)`
  ).bind(crypto.randomUUID(), c.get('user').id, id, JSON.stringify({ status: 'pending' }), now).run();

  return success(c, { message: 'Webhook marked for retry' });
});

export default adminWebhooksRoutes;
