import { Hono } from 'hono';
import type { Env } from '../../env';
import { success, error } from '../../lib/response';
import { kvGetOrSet } from '../../lib/cache';

const publicDigitalProductsRoutes = new Hono<{ Bindings: Env }>();

// GET /api/public/digital-products/:slug — field publik untuk halaman order (tanpa file/external_url)
publicDigitalProductsRoutes.get('/:slug', async (c) => {
  try {
    const slug = (c.req.param('slug') || '').trim().toLowerCase();
    if (!slug) return error(c, 'Produk tidak ditemukan', 404);

    const product = await kvGetOrSet(c.env, `digital-product:public:${slug}`, 300, async () => {
      return await c.env.DB.prepare(
        `SELECT id, slug, name, description, thumbnail_url, price, compare_at_price, delivery_type
         FROM digital_products WHERE slug = ? AND status = 'active'`
      ).bind(slug).first();
    });

    if (!product) return error(c, 'Produk tidak ditemukan', 404);
    c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
    return success(c, product);
  } catch (err) {
    console.error('[public:digital-products]', err);
    return error(c, 'Gagal memuat produk', 500);
  }
});

export default publicDigitalProductsRoutes;
