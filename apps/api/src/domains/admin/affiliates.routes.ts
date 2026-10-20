import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error, paginated } from '../../lib/response';
import { FREE_AFFILIATE_MAX_COMMISSION_RATE } from '../../lib/settings';

const adminAffiliatesRoutes = new Hono<{ Bindings: Env }>();
adminAffiliatesRoutes.use('*', authMiddleware());
adminAffiliatesRoutes.use('*', requireRole('admin', 'super_admin'));

// GET /api/admin/affiliates — List all affiliate accounts
adminAffiliatesRoutes.get('/', async (c) => {
  const url = new URL(c.req.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
  const search = url.searchParams.get('search');
  const offset = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const params: unknown[] = [];

  if (search) {
    where += ` AND (u.name LIKE ? OR u.email LIKE ? OR a.affiliate_code LIKE ? OR a.public_ref_code LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  const countResult = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM affiliate_accounts a JOIN users u ON a.user_id = u.id ${where}`
  ).bind(...params).first();
  const total = (countResult?.total as number) || 0;

  const rows = await c.env.DB.prepare(
    `SELECT a.id, a.affiliate_code, a.public_ref_code, a.status, a.default_commission_rate,
            a.payout_name, a.payout_bank_name, a.payout_bank_account,
            a.created_at, u.name, u.email,
            COUNT(ac.id) as total_referrals,
            COALESCE(SUM(CASE WHEN ac.status = 'paid' THEN ac.commission_amount ELSE 0 END), 0) as total_paid
     FROM affiliate_accounts a
     JOIN users u ON a.user_id = u.id
     LEFT JOIN affiliate_commissions ac ON ac.affiliate_code = a.affiliate_code
     ${where}
     GROUP BY a.id, a.affiliate_code, a.public_ref_code, a.status, a.default_commission_rate,
              a.payout_name, a.payout_bank_name, a.payout_bank_account,
              a.created_at, u.name, u.email
     ORDER BY a.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return paginated(c, rows.results, { page, limit, total });
});

// GET /api/admin/affiliates/:id — Get single affiliate
adminAffiliatesRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');

  const affiliate = await c.env.DB.prepare(
    `SELECT a.*, u.name, u.email
     FROM affiliate_accounts a
     JOIN users u ON a.user_id = u.id
     WHERE a.id = ?`
  ).bind(id).first();

  if (!affiliate) return error(c, 'Affiliate not found', 404);

  const clicks = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM affiliate_clicks WHERE affiliate_code = ?`
  ).bind(affiliate.affiliate_code).first();

  return success(c, { ...affiliate, total_clicks: clicks?.count || 0 });
});

// PUT /api/admin/affiliates/:id — Update affiliate status / commission rate
adminAffiliatesRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json() as {
    status?: string;
    default_commission_rate?: number;
  };
  const now = new Date().toISOString();

  const existing = await c.env.DB.prepare('SELECT id FROM affiliate_accounts WHERE id = ?').bind(id).first();
  if (!existing) return error(c, 'Affiliate not found', 404);

  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.status !== undefined) { fields.push('status = ?'); values.push(body.status); }
  if (body.default_commission_rate !== undefined) {
    const rate = Number(body.default_commission_rate);
    if (!Number.isFinite(rate) || rate < 0 || rate > FREE_AFFILIATE_MAX_COMMISSION_RATE) {
      return error(c, `Default commission rate must be between 0 and ${FREE_AFFILIATE_MAX_COMMISSION_RATE}`, 400);
    }
    fields.push('default_commission_rate = ?');
    values.push(rate);
  }

  if (fields.length === 0) return error(c, 'No fields to update', 400);

  fields.push('updated_at = ?');
  values.push(now, id);

  await c.env.DB.prepare(
    `UPDATE affiliate_accounts SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  return success(c, { message: 'Affiliate updated' });
});

export default adminAffiliatesRoutes;
