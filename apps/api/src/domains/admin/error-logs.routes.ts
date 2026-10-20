import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, paginated } from '../../lib/response';

const adminErrorLogsRoutes = new Hono<{ Bindings: Env }>();
adminErrorLogsRoutes.use('*', authMiddleware());
adminErrorLogsRoutes.use('*', requireRole('admin', 'super_admin'));

adminErrorLogsRoutes.get('/', async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const limit = Math.min(100, parseInt(c.req.query('limit') || '50', 10));
  const offset = (page - 1) * limit;

  const total = ((await c.env.DB.prepare('SELECT COUNT(*) as n FROM error_logs').first())?.n as number) || 0;
  const rows = await c.env.DB.prepare(
    'SELECT * FROM error_logs ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).bind(limit, offset).all();

  return paginated(c, rows.results, { page, limit, total });
});

export default adminErrorLogsRoutes;
