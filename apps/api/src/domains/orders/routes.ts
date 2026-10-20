import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware } from '../../middleware/auth';
import { success, error, paginated } from '../../lib/response';
import { OrdersService } from './service';

const ordersRoutes = new Hono<{ Bindings: Env }>();

ordersRoutes.use('*', authMiddleware());

ordersRoutes.get('/', async (c) => {
  try {
    const service = new OrdersService(c.env);
    const user = c.get('user');
    const url = new URL(c.req.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await service.getOrdersByUser(user.id, page, limit) as any;
    if (result.error) return error(c, result.error, result.status || 400);
    return paginated(c, result.data, result.pagination);
  } catch (err) {
    console.error('[orders:list]', err);
    return error(c, 'Gagal memuat order', 500);
  }
});

ordersRoutes.get('/:id', async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');

    const order = await c.env.DB.prepare(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?'
    ).bind(id, user.id).first();

    if (!order) return error(c, 'Order not found', 404);
    return success(c, order);
  } catch (err) {
    console.error('[orders:detail]', err);
    return error(c, 'Gagal memuat detail order', 500);
  }
});

export default ordersRoutes;
