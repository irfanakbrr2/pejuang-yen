import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error, paginated } from '../../lib/response';

const adminDigitalProductsRoutes = new Hono<{ Bindings: Env }>();

adminDigitalProductsRoutes.use('*', authMiddleware());
adminDigitalProductsRoutes.use('*', requireRole('admin', 'super_admin'));

const SLUG_RE = /^[a-z0-9-]{3,80}$/;
const DELIVERY_TYPES = new Set(['files', 'external_url', 'service']);
const STATUSES = new Set(['draft', 'active', 'archived']);

// GET /api/admin/digital-products?page&limit&search
adminDigitalProductsRoutes.get('/', async (c) => {
  try {
    const url = new URL(c.req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)), 100);
    const search = (url.searchParams.get('search') || '').trim();

    const where = search ? `WHERE name LIKE ? OR slug LIKE ?` : '';
    const bindings = search ? [`%${search}%`, `%${search}%`] : [];

    const [rows, totalRow] = await Promise.all([
      c.env.DB.prepare(
        `SELECT p.*, (SELECT COUNT(*) FROM digital_product_files f WHERE f.product_id = p.id) as file_count,
                (SELECT COUNT(*) FROM orders o WHERE o.order_type = 'digital_product' AND o.product_id = p.id AND o.status = 'paid') as sales_count
         FROM digital_products p ${where} ORDER BY p.sort_order ASC, p.created_at DESC LIMIT ? OFFSET ?`
      ).bind(...bindings, limit, (page - 1) * limit).all(),
      c.env.DB.prepare(`SELECT COUNT(*) as total FROM digital_products ${where}`).bind(...bindings).first(),
    ]);

    return paginated(c, rows.results, { page, limit, total: Number(totalRow?.total || 0) });
  } catch (err) {
    console.error('[admin:digital-products:list]', err);
    return error(c, 'Gagal memuat produk digital', 500);
  }
});

// POST /api/admin/digital-products
adminDigitalProductsRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const slug = String(body.slug || '').trim().toLowerCase();
    const name = String(body.name || '').trim();
    const price = Number(body.price);
    const deliveryType = String(body.delivery_type || 'files');

    if (!SLUG_RE.test(slug)) return error(c, 'Slug tidak valid (huruf kecil, angka, strip, 3-80 karakter)', 400);
    if (!name) return error(c, 'Nama wajib diisi', 400);
    if (!Number.isFinite(price) || price <= 0) return error(c, 'Harga harus lebih dari 0', 400);
    if (!DELIVERY_TYPES.has(deliveryType)) return error(c, 'delivery_type tidak valid', 400);
    if (deliveryType === 'external_url' && !/^https:\/\//.test(String(body.external_url || ''))) {
      return error(c, 'external_url wajib https untuk delivery_type external_url', 400);
    }

    const existing = await c.env.DB.prepare('SELECT id FROM digital_products WHERE slug = ?').bind(slug).first();
    if (existing) return error(c, 'Slug sudah dipakai', 409);

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO digital_products (id, slug, name, description, thumbnail_url, price, compare_at_price, delivery_type, external_url, status, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, slug, name,
      body.description || null, body.thumbnail_url || null,
      Math.floor(price), body.compare_at_price ? Math.floor(Number(body.compare_at_price)) : null,
      deliveryType, body.external_url || null,
      STATUSES.has(body.status) ? body.status : 'draft',
      Number(body.sort_order) || 0, now, now
    ).run();

    return success(c, { id }, 201);
  } catch (err) {
    console.error('[admin:digital-products:create]', err);
    return error(c, 'Gagal membuat produk digital', 500);
  }
});

// GET /api/admin/digital-products/:id — detail + files
adminDigitalProductsRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const product = await c.env.DB.prepare('SELECT * FROM digital_products WHERE id = ?').bind(id).first();
    if (!product) return error(c, 'Produk tidak ditemukan', 404);
    const files = await c.env.DB.prepare(
      'SELECT * FROM digital_product_files WHERE product_id = ? ORDER BY sort_order ASC, created_at ASC'
    ).bind(id).all();
    return success(c, { ...product, files: files.results });
  } catch (err) {
    console.error('[admin:digital-products:detail]', err);
    return error(c, 'Gagal memuat produk', 500);
  }
});

// PUT /api/admin/digital-products/:id
adminDigitalProductsRoutes.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const product = await c.env.DB.prepare('SELECT * FROM digital_products WHERE id = ?').bind(id).first();
    if (!product) return error(c, 'Produk tidak ditemukan', 404);

    const slug = body.slug !== undefined ? String(body.slug).trim().toLowerCase() : (product.slug as string);
    const name = body.name !== undefined ? String(body.name).trim() : (product.name as string);
    const price = body.price !== undefined ? Number(body.price) : Number(product.price);
    const deliveryType = body.delivery_type !== undefined ? String(body.delivery_type) : (product.delivery_type as string);
    const status = body.status !== undefined ? String(body.status) : (product.status as string);

    if (!SLUG_RE.test(slug)) return error(c, 'Slug tidak valid', 400);
    if (!name) return error(c, 'Nama wajib diisi', 400);
    if (!Number.isFinite(price) || price <= 0) return error(c, 'Harga harus lebih dari 0', 400);
    if (!DELIVERY_TYPES.has(deliveryType)) return error(c, 'delivery_type tidak valid', 400);
    if (!STATUSES.has(status)) return error(c, 'status tidak valid', 400);

    if (slug !== product.slug) {
      const clash = await c.env.DB.prepare('SELECT id FROM digital_products WHERE slug = ? AND id != ?').bind(slug, id).first();
      if (clash) return error(c, 'Slug sudah dipakai', 409);
    }

    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `UPDATE digital_products SET slug = ?, name = ?, description = ?, thumbnail_url = ?, price = ?, compare_at_price = ?,
         delivery_type = ?, external_url = ?, status = ?, sort_order = ?, updated_at = ?
       WHERE id = ?`
    ).bind(
      slug, name,
      body.description !== undefined ? (body.description || null) : product.description,
      body.thumbnail_url !== undefined ? (body.thumbnail_url || null) : product.thumbnail_url,
      Math.floor(price),
      body.compare_at_price !== undefined ? (body.compare_at_price ? Math.floor(Number(body.compare_at_price)) : null) : product.compare_at_price,
      deliveryType,
      body.external_url !== undefined ? (body.external_url || null) : product.external_url,
      status,
      body.sort_order !== undefined ? Number(body.sort_order) || 0 : product.sort_order,
      now, id
    ).run();

    return success(c, { id });
  } catch (err) {
    console.error('[admin:digital-products:update]', err);
    return error(c, 'Gagal mengubah produk', 500);
  }
});

// DELETE /api/admin/digital-products/:id — hanya bila belum pernah diorder
adminDigitalProductsRoutes.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const ordered = await c.env.DB.prepare(
      `SELECT id FROM orders WHERE order_type = 'digital_product' AND product_id = ? LIMIT 1`
    ).bind(id).first();
    if (ordered) return error(c, 'Produk sudah pernah diorder — arsipkan saja (status archived)', 400);

    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM digital_product_files WHERE product_id = ?').bind(id),
      c.env.DB.prepare('DELETE FROM digital_products WHERE id = ?').bind(id),
    ]);
    return success(c, { deleted: true });
  } catch (err) {
    console.error('[admin:digital-products:delete]', err);
    return error(c, 'Gagal menghapus produk', 500);
  }
});

// POST /api/admin/digital-products/:id/files
adminDigitalProductsRoutes.post('/:id/files', async (c) => {
  try {
    const id = c.req.param('id');
    const product = await c.env.DB.prepare('SELECT id FROM digital_products WHERE id = ?').bind(id).first();
    if (!product) return error(c, 'Produk tidak ditemukan', 404);

    const body = await c.req.json();
    const title = String(body.title || '').trim();
    if (!title) return error(c, 'Judul file wajib diisi', 400);
    if (!body.file_url && !body.r2_key) return error(c, 'file_url atau r2_key wajib diisi', 400);

    const fileId = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO digital_product_files (id, product_id, title, file_type, file_url, r2_key, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      fileId, id, title, String(body.file_type || 'file'),
      body.file_url || null, body.r2_key || null,
      Number(body.sort_order) || 0, new Date().toISOString()
    ).run();

    return success(c, { id: fileId }, 201);
  } catch (err) {
    console.error('[admin:digital-products:file-create]', err);
    return error(c, 'Gagal menambah file', 500);
  }
});

// DELETE /api/admin/digital-products/:id/files/:fileId
adminDigitalProductsRoutes.delete('/:id/files/:fileId', async (c) => {
  try {
    await c.env.DB.prepare('DELETE FROM digital_product_files WHERE id = ? AND product_id = ?')
      .bind(c.req.param('fileId'), c.req.param('id')).run();
    return success(c, { deleted: true });
  } catch (err) {
    console.error('[admin:digital-products:file-delete]', err);
    return error(c, 'Gagal menghapus file', 500);
  }
});

export default adminDigitalProductsRoutes;
