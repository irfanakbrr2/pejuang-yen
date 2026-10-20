import { Hono } from 'hono';
import type { Env } from '../../env';
import { success, error } from '../../lib/response';
import { FunnelsService, FUNNEL_TRIGGER_TYPES } from './service';

const publicFunnelsRoutes = new Hono<{ Bindings: Env }>();

// GET /api/public/funnels/bump?product_type=&product_id=
// Resolve order bump aktif untuk produk trigger. Tanpa auth (dipakai guest checkout).
publicFunnelsRoutes.get('/bump', async (c) => {
  try {
    const productType = (c.req.query('product_type') || '').trim();
    const productId = (c.req.query('product_id') || '').trim();
    if (!productId || !(FUNNEL_TRIGGER_TYPES as readonly string[]).includes(productType)) {
      return success(c, null);
    }

    const service = new FunnelsService(c.env);
    const bump = await service.resolveBump(productType, productId);
    if (!bump) return success(c, null);

    // Impression (non-dedupe, seperti tracking_events) — fire and forget
    c.executionCtx.waitUntil(
      service.repository.recordEvent({
        funnelId: bump.funnelId,
        stepType: 'order_bump',
        eventType: 'viewed',
      })
    );

    return success(c, bump.dto);
  } catch (err) {
    console.error('[public:funnels:bump]', err);
    return error(c, 'Gagal memuat penawaran', 500);
  }
});

export default publicFunnelsRoutes;
