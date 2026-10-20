import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware } from '../../middleware/auth';
import { rateLimit } from '../../middleware/rate-limit';
import { success, error } from '../../lib/response';

// Endpoint PEMBELI produk toko — auth saja, TANPA gate premium
// (pembeli tidak harus member premium; yang premium hanyalah pemilik toko).
const purchasesRoutes = new Hono<{ Bindings: Env }>();

purchasesRoutes.use('*', authMiddleware());

async function hasCreatorProductAccess(env: Env, userId: string, productId: string): Promise<boolean> {
  const now = new Date().toISOString();
  const row = await env.DB.prepare(
    `SELECT id FROM user_access
     WHERE user_id = ? AND resource_type = 'creator_product' AND resource_id = ?
       AND status = 'active' AND starts_at <= ? AND (expires_at IS NULL OR expires_at > ?)`
  ).bind(userId, productId, now, now).first();
  return !!row;
}

// GET /api/purchases — produk toko yang dibeli user
purchasesRoutes.get('/', async (c) => {
  try {
    const user = c.get('user');
    const now = new Date().toISOString();
    const rows = await c.env.DB.prepare(
      `SELECT p.id, p.slug, p.title, p.description, p.thumbnail_url, p.delivery_type,
              CASE WHEN p.delivery_type = 'link' THEN p.external_url END as external_url,
              s.name as store_name, s.slug as store_slug,
              ua.created_at as purchased_at
       FROM user_access ua
       JOIN creator_products p ON p.id = ua.resource_id
       JOIN creator_stores s ON s.id = p.store_id
       WHERE ua.user_id = ? AND ua.resource_type = 'creator_product' AND ua.status = 'active'
         AND ua.starts_at <= ? AND (ua.expires_at IS NULL OR ua.expires_at > ?)
       ORDER BY ua.created_at DESC`
    ).bind(user.id, now, now).all();
    return success(c, rows.results);
  } catch (err) {
    console.error('[purchases:list]', err);
    return error(c, 'Gagal memuat pembelian', 500);
  }
});

// GET /api/purchases/download/:productId — stream file dari bucket PRIVAT
purchasesRoutes.get('/download/:productId', rateLimit({
  max: 10, windowSec: 60,
  keyFn: (c) => `toko-download:${c.get('user')?.id || c.req.header('cf-connecting-ip') || 'unknown'}`,
}), async (c) => {
  try {
    const user = c.get('user');
    const productId = c.req.param('productId') || '';

    const product = await c.env.DB.prepare(
      `SELECT p.id, p.title, p.delivery_type, p.upload_id, s.user_id as store_user_id
       FROM creator_products p JOIN creator_stores s ON s.id = p.store_id
       WHERE p.id = ?`
    ).bind(productId).first();
    if (!product || product.delivery_type !== 'file' || !product.upload_id) {
      return error(c, 'File tidak ditemukan', 404);
    }

    const isOwner = product.store_user_id === user.id;
    const isAdmin = user.role === 'admin' || user.role === 'super_admin';
    if (!isOwner && !isAdmin && !(await hasCreatorProductAccess(c.env, user.id, productId))) {
      return error(c, 'Kamu belum membeli produk ini', 403);
    }

    const upload = await c.env.DB.prepare(
      `SELECT r2_key, original_name, content_type FROM creator_uploads WHERE id = ? AND status = 'active'`
    ).bind(product.upload_id).first();
    if (!upload) return error(c, 'File tidak ditemukan', 404);

    const object = await c.env.R2_PRIVATE.get(upload.r2_key as string);
    if (!object) return error(c, 'File tidak ditemukan di penyimpanan', 404);

    const safeName = String(upload.original_name || 'produk').replace(/[^\w.\- ]/g, '_');
    return new Response(object.body, {
      headers: {
        'Content-Type': (upload.content_type as string) || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeName}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('[purchases:download]', err);
    return error(c, 'Gagal mengunduh file', 500);
  }
});

export default purchasesRoutes;
