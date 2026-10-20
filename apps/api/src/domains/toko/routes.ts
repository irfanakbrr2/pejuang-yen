import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware } from '../../middleware/auth';
import { rateLimit } from '../../middleware/rate-limit';
import { success, error } from '../../lib/response';
import { isPremiumUser, isCreatorStoreEnabled } from '../../lib/premium';
import { getNumericSetting } from '../../lib/settings';
import { TokoService } from './service';

const tokoRoutes = new Hono<{ Bindings: Env }>();

tokoRoutes.use('*', authMiddleware());

// Guard global: flag platform + premium
tokoRoutes.use('*', async (c, next) => {
  if (!(await isCreatorStoreEnabled(c.env))) {
    return error(c, 'Fitur toko belum tersedia', 403, 'feature_disabled');
  }
  const user = c.get('user');
  if (!(await isPremiumUser(c.env, user))) {
    return error(c, 'Toko khusus member premium — upgrade dulu di /premium', 403, 'premium_required');
  }
  await next();
});

// ── Store ────────────────────────────────────────────────────────────────
tokoRoutes.get('/me', async (c) => {
  try {
    const service = new TokoService(c.env);
    const store = await service.getStoreByUser(c.get('user').id);
    if (!store) return error(c, 'Belum punya toko', 404, 'no_store');
    return success(c, store);
  } catch (err) {
    console.error('[toko:me]', err);
    return error(c, 'Gagal memuat toko', 500);
  }
});

tokoRoutes.post('/', rateLimit({
  max: 3, windowSec: 3600,
  keyFn: (c) => `toko-create:${c.get('user')?.id || 'unknown'}`,
}), async (c) => {
  try {
    const service = new TokoService(c.env);
    const result = await service.createStore(c.get('user'), await c.req.json());
    if ('error' in result) return error(c, result.error, result.status);
    return success(c, result.data, 201);
  } catch (err) {
    console.error('[toko:create]', err);
    return error(c, 'Gagal membuat toko', 500);
  }
});

tokoRoutes.patch('/me', async (c) => {
  try {
    const service = new TokoService(c.env);
    const result = await service.updateStore(c.get('user'), await c.req.json());
    if ('error' in result) return error(c, result.error, result.status);
    return success(c, result.data);
  } catch (err) {
    console.error('[toko:update]', err);
    return error(c, 'Gagal mengubah toko', 500);
  }
});

// ── Produk ───────────────────────────────────────────────────────────────
tokoRoutes.get('/me/products', async (c) => {
  try {
    const service = new TokoService(c.env);
    return success(c, await service.listProducts(c.get('user').id));
  } catch (err) {
    console.error('[toko:products]', err);
    return error(c, 'Gagal memuat produk', 500);
  }
});

tokoRoutes.post('/me/products', async (c) => {
  try {
    const service = new TokoService(c.env);
    const result = await service.upsertProduct(c.get('user'), await c.req.json());
    if ('error' in result) return error(c, result.error, result.status);
    return success(c, result.data, 201);
  } catch (err) {
    console.error('[toko:product-create]', err);
    return error(c, 'Gagal membuat produk', 500);
  }
});

tokoRoutes.patch('/me/products/:id', async (c) => {
  try {
    const service = new TokoService(c.env);
    const result = await service.upsertProduct(c.get('user'), await c.req.json(), c.req.param('id') || '');
    if ('error' in result) return error(c, result.error, result.status);
    return success(c, result.data);
  } catch (err) {
    console.error('[toko:product-update]', err);
    return error(c, 'Gagal mengubah produk', 500);
  }
});

tokoRoutes.delete('/me/products/:id', async (c) => {
  try {
    const service = new TokoService(c.env);
    const result = await service.archiveProduct(c.get('user'), c.req.param('id') || '');
    if ('error' in result) return error(c, result.error, result.status);
    return success(c, result.data);
  } catch (err) {
    console.error('[toko:product-archive]', err);
    return error(c, 'Gagal mengarsipkan produk', 500);
  }
});

// ── Uploads ──────────────────────────────────────────────────────────────
const DELIVERABLE_TYPES = new Set(['application/pdf', 'application/zip', 'application/x-zip-compressed']);
const ASSET_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// File jualan → bucket PRIVAT
tokoRoutes.post('/me/uploads', rateLimit({
  max: 10, windowSec: 3600,
  keyFn: (c) => `toko-upload:${c.get('user')?.id || 'unknown'}`,
}), async (c) => {
  try {
    const user = c.get('user');
    const service = new TokoService(c.env);
    const store = await service.getStoreByUser(user.id);
    if (!store) return error(c, 'Buat toko dulu', 404);

    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return error(c, 'File wajib diisi', 400);
    if (!DELIVERABLE_TYPES.has(file.type)) return error(c, 'Hanya PDF atau ZIP yang diizinkan', 422);
    if (file.size > 50 * 1024 * 1024) return error(c, 'Maksimal 50MB per file', 413);

    // Kuota total per user
    const quotaMb = await getNumericSetting(c.env.DB, 'creator_store_upload_quota_mb', 500);
    const used = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(size), 0) as total FROM creator_uploads WHERE user_id = ? AND status = 'active'`
    ).bind(user.id).first();
    if (Number(used?.total || 0) + file.size > quotaMb * 1024 * 1024) {
      return error(c, `Kuota penyimpanan ${quotaMb}MB terlampaui`, 413);
    }

    const ext = file.type === 'application/pdf' ? 'pdf' : 'zip';
    const key = `creator-files/${store.id}/${crypto.randomUUID()}.${ext}`;
    await c.env.R2_PRIVATE.put(key, file.stream(), { httpMetadata: { contentType: file.type } });

    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO creator_uploads (id, user_id, store_id, r2_key, original_name, size, content_type, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`
    ).bind(id, user.id, store.id, key, file.name, file.size, file.type, new Date().toISOString()).run();

    return success(c, { upload_id: id, original_name: file.name, size: file.size }, 201);
  } catch (err) {
    console.error('[toko:upload]', err);
    return error(c, 'Gagal mengupload file', 500);
  }
});

// Thumbnail/logo → bucket publik (aset marketing)
tokoRoutes.post('/me/assets', rateLimit({
  max: 20, windowSec: 3600,
  keyFn: (c) => `toko-asset:${c.get('user')?.id || 'unknown'}`,
}), async (c) => {
  try {
    const user = c.get('user');
    const service = new TokoService(c.env);
    const store = await service.getStoreByUser(user.id);
    if (!store) return error(c, 'Buat toko dulu', 404);

    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return error(c, 'File wajib diisi', 400);
    if (!ASSET_TYPES.has(file.type)) return error(c, 'Hanya JPG/PNG/WebP', 422);
    if (file.size > 2 * 1024 * 1024) return error(c, 'Maksimal 2MB', 413);

    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const key = `store-assets/${store.id}/${crypto.randomUUID()}.${ext}`;
    await c.env.R2.put(key, file.stream(), { httpMetadata: { contentType: file.type } });

    return success(c, { url: `https://file.pejuangyen.com/${key}` }, 201);
  } catch (err) {
    console.error('[toko:asset]', err);
    return error(c, 'Gagal mengupload gambar', 500);
  }
});

// ── Penjualan, saldo, payout ─────────────────────────────────────────────
tokoRoutes.get('/me/sales', async (c) => {
  try {
    const user = c.get('user');
    const service = new TokoService(c.env);
    const store = await service.getStoreByUser(user.id);
    if (!store) return error(c, 'Toko tidak ditemukan', 404);

    const url = new URL(c.req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = 20;
    const rows = await c.env.DB.prepare(
      `SELECT e.created_at, e.gross_amount, e.fee_amount, e.amount as net_amount, e.order_id,
              o.product_name, o.order_number
       FROM creator_earnings e
       JOIN orders o ON o.id = e.order_id
       WHERE e.store_id = ? AND e.entry_type = 'sale'
       ORDER BY e.created_at DESC LIMIT ? OFFSET ?`
    ).bind(store.id, limit, (page - 1) * limit).all();
    return success(c, rows.results);
  } catch (err) {
    console.error('[toko:sales]', err);
    return error(c, 'Gagal memuat penjualan', 500);
  }
});

tokoRoutes.get('/me/balance', async (c) => {
  try {
    const service = new TokoService(c.env);
    const result = await service.getBalance(c.get('user').id);
    if ('error' in result) return error(c, result.error, result.status);
    return success(c, result.data);
  } catch (err) {
    console.error('[toko:balance]', err);
    return error(c, 'Gagal memuat saldo', 500);
  }
});

tokoRoutes.get('/me/payouts', async (c) => {
  try {
    const user = c.get('user');
    const service = new TokoService(c.env);
    const store = await service.getStoreByUser(user.id);
    if (!store) return error(c, 'Toko tidak ditemukan', 404);
    const rows = await c.env.DB.prepare(
      `SELECT id, amount, status, bank_name, bank_account, transfer_ref, requested_at, paid_at
       FROM creator_payouts WHERE store_id = ? ORDER BY requested_at DESC LIMIT 50`
    ).bind(store.id).all();
    return success(c, rows.results);
  } catch (err) {
    console.error('[toko:payouts]', err);
    return error(c, 'Gagal memuat penarikan', 500);
  }
});

tokoRoutes.post('/me/payouts', rateLimit({
  max: 3, windowSec: 3600,
  keyFn: (c) => `toko-payout:${c.get('user')?.id || 'unknown'}`,
}), async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const service = new TokoService(c.env);
    const result = await service.requestPayout(c.get('user'), body.amount);
    if ('error' in result) return error(c, result.error, result.status);
    return success(c, result.data, 201);
  } catch (err) {
    console.error('[toko:payout-request]', err);
    return error(c, 'Gagal mengajukan penarikan', 500);
  }
});

export default tokoRoutes;
