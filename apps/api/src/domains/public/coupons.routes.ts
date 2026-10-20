import { Hono } from 'hono';
import type { Env } from '../../env';
import { success, error } from '../../lib/response';

const publicCouponsRoutes = new Hono<{ Bindings: Env }>();

publicCouponsRoutes.post('/validate', async (c) => {
  try {
    const body = await c.req.json();
    const { code, product_id, order_type } = body;

    if (!code || !product_id || order_type !== 'membership') {
      return error(c, 'Kupon tidak valid untuk produk ini', 400);
    }

    const codeUpper = code.toUpperCase();
    const coupon = await c.env.DB.prepare(
      `SELECT * FROM coupons WHERE code = ? LIMIT 1`
    ).bind(codeUpper).first() as any;

    if (!coupon) {
      return error(c, 'Kupon tidak ditemukan', 404);
    }

    if (!coupon.is_active) {
      return error(c, 'Kupon tidak aktif', 400);
    }

    const now = new Date().getTime();
    if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) {
      return error(c, 'Kupon belum bisa digunakan', 400);
    }
    if (coupon.expires_at && new Date(coupon.expires_at).getTime() < now) {
      return error(c, 'Kupon sudah kadaluarsa', 400);
    }

    if (coupon.usage_limit_total) {
      const usageCount = await c.env.DB.prepare(
        `SELECT COUNT(*) as count FROM coupon_redemptions WHERE coupon_id = ? AND status = 'paid'`
      ).bind(coupon.id).first() as any;
      if (usageCount.count >= coupon.usage_limit_total) {
        return error(c, 'Batas penggunaan kupon sudah habis', 400);
      }
    }

    const plans = await c.env.DB.prepare(
      `SELECT plan_id FROM coupon_plan_eligibility WHERE coupon_id = ?`
    ).bind(coupon.id).all();

    if (plans.results.length > 0) {
      const isEligible = plans.results.some((p: any) => p.plan_id === product_id);
      if (!isEligible) {
        return error(c, 'Kupon tidak berlaku untuk paket ini', 400);
      }
    }

    // Return coupon details so frontend can calculate discount
    return success(c, {
      id: coupon.id,
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      max_discount_amount: coupon.max_discount_amount,
      minimum_order_amount: coupon.minimum_order_amount
    });

  } catch (err) {
    console.error('[public:coupons:validate]', err);
    return error(c, 'Gagal memvalidasi kupon', 500);
  }
});

export default publicCouponsRoutes;
