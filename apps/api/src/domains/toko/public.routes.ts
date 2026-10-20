import { Hono } from 'hono';
import type { Env } from '../../env';
import { success, error } from '../../lib/response';
import { kvGetOrSet } from '../../lib/cache';

// Storefront publik — tanpa auth, KV cache 60 detik.
// TIDAK pernah membocorkan upload_id/r2_key/external_url.
const publicTokoRoutes = new Hono<{ Bindings: Env }>();

// GET /api/public/toko/:slug — toko + produk aktif
publicTokoRoutes.get('/:slug', async (c) => {
  try {
    const slug = (c.req.param('slug') || '').trim().toLowerCase();
    if (!slug) return error(c, 'Toko tidak ditemukan', 404);

    const data = await kvGetOrSet(c.env, `toko:public:${slug}`, 60, async () => {
      const store = await c.env.DB.prepare(
        `SELECT id, slug, name, description, logo_url, accent_color, custom_html
         FROM creator_stores WHERE slug = ? AND status = 'active'`
      ).bind(slug).first();
      if (!store) return null;

      const products = await c.env.DB.prepare(
        `SELECT id, slug, title, description, thumbnail_url, price, compare_at_price, delivery_type, sales_count
         FROM creator_products WHERE store_id = ? AND status = 'active'
         ORDER BY created_at DESC`
      ).bind(store.id).all();

      return { ...store, products: products.results };
    });

    if (!data) return error(c, 'Toko tidak ditemukan', 404);
    c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
    return success(c, data);
  } catch (err) {
    console.error('[public:toko]', err);
    return error(c, 'Gagal memuat toko', 500);
  }
});

// GET /api/public/toko/:slug/products/:productSlug — detail produk
publicTokoRoutes.get('/:slug/products/:productSlug', async (c) => {
  try {
    const slug = (c.req.param('slug') || '').trim().toLowerCase();
    const productSlug = (c.req.param('productSlug') || '').trim().toLowerCase();

    const data = await kvGetOrSet(c.env, `toko:public:${slug}:${productSlug}`, 60, async () => {
      return await c.env.DB.prepare(
        `SELECT p.id, p.slug, p.title, p.description, p.thumbnail_url, p.price, p.compare_at_price,
                p.delivery_type, p.sales_count,
                s.name as store_name, s.slug as store_slug, s.logo_url as store_logo_url, s.accent_color
         FROM creator_products p
         JOIN creator_stores s ON s.id = p.store_id
         WHERE s.slug = ? AND p.slug = ? AND p.status = 'active' AND s.status = 'active'`
      ).bind(slug, productSlug).first();
    });

    if (!data) return error(c, 'Produk tidak ditemukan', 404);
    c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
    return success(c, data);
  } catch (err) {
    console.error('[public:toko:product]', err);
    return error(c, 'Gagal memuat produk', 500);
  }
});

export default publicTokoRoutes;
