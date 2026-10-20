import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware } from '../../middleware/auth';
import { success, error } from '../../lib/response';

const userDigitalProductsRoutes = new Hono<{ Bindings: Env }>();

userDigitalProductsRoutes.use('*', authMiddleware());

async function hasProductAccess(env: Env, userId: string, productId: string): Promise<boolean> {
  const now = new Date().toISOString();
  const row = await env.DB.prepare(
    `SELECT id FROM user_access
     WHERE user_id = ? AND resource_type = 'digital_product' AND resource_id = ?
       AND status = 'active' AND starts_at <= ? AND (expires_at IS NULL OR expires_at > ?)`
  ).bind(userId, productId, now, now).first();
  return !!row;
}

// GET /api/user/digital-products — produk yang dimiliki user
userDigitalProductsRoutes.get('/', async (c) => {
  try {
    const user = c.get('user');
    const now = new Date().toISOString();
    const rows = await c.env.DB.prepare(
      `SELECT p.id, p.slug, p.name, p.description, p.thumbnail_url, p.delivery_type, ua.created_at as granted_at
       FROM user_access ua
       JOIN digital_products p ON p.id = ua.resource_id
       WHERE ua.user_id = ? AND ua.resource_type = 'digital_product' AND ua.status = 'active'
         AND ua.starts_at <= ? AND (ua.expires_at IS NULL OR ua.expires_at > ?)
       ORDER BY ua.created_at DESC`
    ).bind(user.id, now, now).all();
    return success(c, rows.results);
  } catch (err) {
    console.error('[user:digital-products:list]', err);
    return error(c, 'Gagal memuat produk', 500);
  }
});

// GET /api/user/digital-products/:slug — detail + files (gated: tanpa akses → file_url/external_url di-scrub)
userDigitalProductsRoutes.get('/:slug', async (c) => {
  try {
    const user = c.get('user');
    const slug = (c.req.param('slug') || '').trim().toLowerCase();

    const product = await c.env.DB.prepare(
      `SELECT id, slug, name, description, thumbnail_url, price, compare_at_price, delivery_type, external_url, status
       FROM digital_products WHERE slug = ?`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ).bind(slug).first() as any;
    if (!product || (product.status !== 'active' && user.role !== 'admin' && user.role !== 'super_admin')) {
      return error(c, 'Produk tidak ditemukan', 404);
    }

    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    const hasAccess = isAdmin || await hasProductAccess(c.env, user.id, product.id as string);

    const files = await c.env.DB.prepare(
      `SELECT id, title, file_type, file_url, r2_key, sort_order FROM digital_product_files
       WHERE product_id = ? ORDER BY sort_order ASC, created_at ASC`
    ).bind(product.id).all();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scrubbedFiles = files.results.map((f: any) => hasAccess ? f : { ...f, file_url: null, r2_key: null });

    return success(c, {
      ...product,
      external_url: hasAccess ? product.external_url : null,
      has_access: hasAccess,
      files: scrubbedFiles,
    });
  } catch (err) {
    console.error('[user:digital-products:detail]', err);
    return error(c, 'Gagal memuat produk', 500);
  }
});

export default userDigitalProductsRoutes;
