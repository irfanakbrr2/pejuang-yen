import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware } from '../../middleware/auth';
import { rateLimit } from '../../middleware/rate-limit';
import { success, error } from '../../lib/response';
import { FunnelsService } from './service';

const funnelsRoutes = new Hono<{ Bindings: Env }>();

funnelsRoutes.use('*', authMiddleware());

// GET /api/funnels/offer/:orderId — offer aktif untuk order paid (refresh-safe)
funnelsRoutes.get('/offer/:orderId', async (c) => {
  try {
    const service = new FunnelsService(c.env);
    const result = await service.getOffer(c.get('user'), c.req.param('orderId') || '');
    if ('error' in result) return error(c, result.error, result.status || 400);
    return success(c, result.data);
  } catch (err) {
    console.error('[funnels:offer]', err);
    return error(c, 'Gagal memuat penawaran', 500);
  }
});

// POST /api/funnels/offer/:orderId/accept — buat order upsell/downsell (idempoten)
funnelsRoutes.post('/offer/:orderId/accept', rateLimit({
  max: 5,
  windowSec: 60,
  keyFn: (c) => `funnel-accept:${c.get('user')?.id || c.req.header('cf-connecting-ip') || 'unknown'}`,
}), async (c) => {
  try {
    const service = new FunnelsService(c.env);
    const body = await c.req.json().catch(() => ({}));
    const result = await service.acceptOffer(
      c.get('user'),
      c.req.param('orderId') || '',
      String(body.step_type || ''),
      String(body.payment_method || 'qris'),
      c.executionCtx
    );
    if ('error' in result) return error(c, result.error, result.status || 400);
    return success(c, result.data);
  } catch (err) {
    console.error('[funnels:accept]', err);
    return error(c, 'Gagal memproses penawaran', 500);
  }
});

// POST /api/funnels/offer/:orderId/decline — tolak step → downsell / selesai
funnelsRoutes.post('/offer/:orderId/decline', rateLimit({
  max: 10,
  windowSec: 60,
  keyFn: (c) => `funnel-decline:${c.get('user')?.id || c.req.header('cf-connecting-ip') || 'unknown'}`,
}), async (c) => {
  try {
    const service = new FunnelsService(c.env);
    const body = await c.req.json().catch(() => ({}));
    const result = await service.declineOffer(
      c.get('user'),
      c.req.param('orderId') || '',
      String(body.step_type || '')
    );
    if ('error' in result) return error(c, result.error, result.status || 400);
    return success(c, result.data);
  } catch (err) {
    console.error('[funnels:decline]', err);
    return error(c, 'Gagal memproses penawaran', 500);
  }
});

export default funnelsRoutes;
