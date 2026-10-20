import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error, paginated } from '../../lib/response';

const adminCouponsRoutes = new Hono<{ Bindings: Env }>();

adminCouponsRoutes.use('*', authMiddleware(), requireRole('admin', 'super_admin'));

// List Coupons
adminCouponsRoutes.get('/', async (c) => {
  try {
    const url = new URL(c.req.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    const [rows, totalRow] = await Promise.all([
      c.env.DB.prepare(
        `SELECT * FROM coupons ORDER BY created_at DESC LIMIT ? OFFSET ?`
      ).bind(limit, offset).all(),
      c.env.DB.prepare(`SELECT COUNT(*) as count FROM coupons`).first() as any
    ]);

    const total = totalRow?.count || 0;
    return paginated(c, rows.results, { page, limit, total });
  } catch (err) {
    console.error('[admin:coupons:list]', err);
    return error(c, 'Gagal memuat kupon', 500);
  }
});

// Create Coupon
adminCouponsRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { code, name, description, discount_type, discount_value, max_discount_amount, minimum_order_amount, starts_at, expires_at, usage_limit_total, usage_limit_per_user, eligible_plans } = body;

    if (!code || !name || !discount_type || discount_value === undefined) {
      return error(c, 'Data kupon tidak lengkap', 400);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const existing = await c.env.DB.prepare('SELECT id FROM coupons WHERE code = ? LIMIT 1').bind(code).first();
    if (existing) {
      return error(c, 'Kode kupon sudah digunakan', 400);
    }

    await c.env.DB.prepare(
      `INSERT INTO coupons (id, code, name, description, discount_type, discount_value, max_discount_amount, minimum_order_amount, starts_at, expires_at, usage_limit_total, usage_limit_per_user, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, code.toUpperCase(), name, description || null, discount_type, discount_value, max_discount_amount || null, minimum_order_amount || null, starts_at || null, expires_at || null, usage_limit_total || null, usage_limit_per_user || null, now, now
    ).run();

    if (Array.isArray(eligible_plans) && eligible_plans.length > 0) {
      const stmts = eligible_plans.map((planId: string) => 
        c.env.DB.prepare(`INSERT INTO coupon_plan_eligibility (coupon_id, plan_id) VALUES (?, ?)`).bind(id, planId)
      );
      await c.env.DB.batch(stmts);
    }

    return success(c, { id }, 201);
  } catch (err) {
    console.error('[admin:coupons:create]', err);
    return error(c, 'Gagal membuat kupon', 500);
  }
});

// Get Coupon Detail
adminCouponsRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const coupon = await c.env.DB.prepare(`SELECT * FROM coupons WHERE id = ?`).bind(id).first() as any;
    if (!coupon) return error(c, 'Kupon tidak ditemukan', 404);

    const plans = await c.env.DB.prepare(`SELECT plan_id FROM coupon_plan_eligibility WHERE coupon_id = ?`).bind(id).all();
    coupon.eligible_plans = plans.results.map((p: any) => p.plan_id);

    return success(c, coupon);
  } catch (err) {
    console.error('[admin:coupons:detail]', err);
    return error(c, 'Gagal memuat detail kupon', 500);
  }
});

// Update Coupon
adminCouponsRoutes.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { name, description, is_active, starts_at, expires_at, usage_limit_total, usage_limit_per_user, eligible_plans } = body;

    const now = new Date().toISOString();

    await c.env.DB.prepare(
      `UPDATE coupons SET name = ?, description = ?, is_active = ?, starts_at = ?, expires_at = ?, usage_limit_total = ?, usage_limit_per_user = ?, updated_at = ? WHERE id = ?`
    ).bind(
      name, description || null, is_active ? 1 : 0, starts_at || null, expires_at || null, usage_limit_total || null, usage_limit_per_user || null, now, id
    ).run();

    if (Array.isArray(eligible_plans)) {
      await c.env.DB.prepare(`DELETE FROM coupon_plan_eligibility WHERE coupon_id = ?`).bind(id).run();
      if (eligible_plans.length > 0) {
        const stmts = eligible_plans.map((planId: string) => 
          c.env.DB.prepare(`INSERT INTO coupon_plan_eligibility (coupon_id, plan_id) VALUES (?, ?)`).bind(id, planId)
        );
        await c.env.DB.batch(stmts);
      }
    }

    return success(c, { message: 'Kupon diperbarui' });
  } catch (err) {
    console.error('[admin:coupons:update]', err);
    return error(c, 'Gagal memperbarui kupon', 500);
  }
});

// Delete Coupon
adminCouponsRoutes.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    // Check if used
    const used = await c.env.DB.prepare(`SELECT id FROM coupon_redemptions WHERE coupon_id = ? LIMIT 1`).bind(id).first();
    if (used) {
      return error(c, 'Kupon sudah digunakan dan tidak bisa dihapus, silakan nonaktifkan saja.', 400);
    }

    await c.env.DB.prepare(`DELETE FROM coupons WHERE id = ?`).bind(id).run();
    return success(c, { message: 'Kupon dihapus' });
  } catch (err) {
    console.error('[admin:coupons:delete]', err);
    return error(c, 'Gagal menghapus kupon', 500);
  }
});

export default adminCouponsRoutes;
