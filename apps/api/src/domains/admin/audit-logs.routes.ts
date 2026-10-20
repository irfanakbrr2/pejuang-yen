import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, paginated } from '../../lib/response';

const adminAuditLogsRoutes = new Hono<{ Bindings: Env }>();
adminAuditLogsRoutes.use('*', authMiddleware());
adminAuditLogsRoutes.use('*', requireRole('admin', 'super_admin'));

adminAuditLogsRoutes.get('/', async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const limit = Math.min(100, parseInt(c.req.query('limit') || '50', 10));
  const action = c.req.query('action');
  const offset = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const params: unknown[] = [];

  if (action) { where += ' AND action LIKE ?'; params.push(`%${action}%`); }

  const total = ((await c.env.DB.prepare(`SELECT COUNT(*) as n FROM audit_logs ${where}`).bind(...params).first())?.n as number) || 0;
  const rows = await c.env.DB.prepare(
    `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return paginated(c, rows.results, { page, limit, total });
});

export default adminAuditLogsRoutes;
