import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error, paginated } from '../../lib/response';
import { sendMailketingEmail } from '../../services/mailketing';
import { sendWhatsAppMessage } from '../../services/whatsapp';
import { commissionPaidEmailHtml } from '../../lib/email-templates';

const adminCommissionsRoutes = new Hono<{ Bindings: Env }>();

// Biaya admin penarikan komisi affiliate (dipotong dari komisi saat dibayar).
const WITHDRAWAL_ADMIN_FEE = 2500;

adminCommissionsRoutes.use('*', authMiddleware());
adminCommissionsRoutes.use('*', requireRole('admin', 'super_admin'));

// GET /api/admin/commissions — List all commissions
adminCommissionsRoutes.get('/', async (c) => {
  const url = new URL(c.req.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');
  const offset = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const params: unknown[] = [];

  if (status) { where += ` AND c.status = ?`; params.push(status); }
  if (search) { where += ` AND (aff_u.name LIKE ? OR aff_u.email LIKE ? OR c.affiliate_code LIKE ?)`; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

  const countResult = await c.env.DB.prepare(
    `SELECT COUNT(*) as total
     FROM affiliate_commissions c
     JOIN users aff_u ON c.affiliate_user_id = aff_u.id
     ${where}`
  ).bind(...params).first();
  const total = (countResult?.total as number) || 0;

  const rows = await c.env.DB.prepare(
    `SELECT c.id, c.affiliate_code, c.amount, c.commission_rate, c.commission_amount,
            c.status, c.created_at, c.approved_at, c.rejected_at, c.paid_at, c.notes,
            aff_u.name as affiliate_name, aff_u.email as affiliate_email, aff_u.phone as affiliate_phone,
            aa.payout_name, aa.payout_bank_name, aa.payout_bank_account,
            buyer_u.name as buyer_name, buyer_u.email as buyer_email, buyer_u.phone as buyer_phone,
            o.order_number, o.order_type, o.product_name
     FROM affiliate_commissions c
     JOIN users aff_u ON c.affiliate_user_id = aff_u.id
     JOIN users buyer_u ON c.buyer_user_id = buyer_u.id
     JOIN orders o ON c.order_id = o.id
     LEFT JOIN affiliate_accounts aa ON c.affiliate_code = aa.affiliate_code
     ${where}
     ORDER BY c.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  const withFee = rows.results.map((r: any) => ({
    ...r,
    withdrawal_fee: WITHDRAWAL_ADMIN_FEE,
    net_amount: Math.max(0, Number(r.commission_amount || 0) - WITHDRAWAL_ADMIN_FEE),
  }));

  return paginated(c, withFee, { page, limit, total });
});

// POST /api/admin/commissions/:id/approve
adminCommissionsRoutes.post('/:id/approve', async (c) => {
  const id = c.req.param('id');
  const actor = c.get('user');
  const now = new Date().toISOString();

  const commission = await c.env.DB.prepare(
    'SELECT id, status FROM affiliate_commissions WHERE id = ?'
  ).bind(id).first();
  if (!commission) return error(c, 'Commission not found', 404);
  if (commission.status !== 'pending') return error(c, `Cannot approve commission with status: ${commission.status}`, 400);

  await c.env.DB.prepare(
    `UPDATE affiliate_commissions SET status = 'approved', approved_at = ? WHERE id = ?`
  ).bind(now, id).run();

  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, created_at)
     VALUES (?, ?, 'approve_commission', 'affiliate_commission', ?, ?)`
  ).bind(crypto.randomUUID(), actor.id, id, now).run();

  return success(c, { message: 'Commission approved' });
});

// POST /api/admin/commissions/:id/reject
adminCommissionsRoutes.post('/:id/reject', async (c) => {
  const id = c.req.param('id');
  const actor = c.get('user');
  const body = await c.req.json().catch(() => ({})) as { notes?: string };
  const now = new Date().toISOString();

  const commission = await c.env.DB.prepare(
    'SELECT id, status FROM affiliate_commissions WHERE id = ?'
  ).bind(id).first();
  if (!commission) return error(c, 'Commission not found', 404);
  if (commission.status === 'paid') return error(c, 'Cannot reject a paid commission', 400);

  await c.env.DB.prepare(
    `UPDATE affiliate_commissions SET status = 'rejected', rejected_at = ?, notes = COALESCE(?, notes) WHERE id = ?`
  ).bind(now, body.notes || null, id).run();

  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, created_at)
     VALUES (?, ?, 'reject_commission', 'affiliate_commission', ?, ?)`
  ).bind(crypto.randomUUID(), actor.id, id, now).run();

  return success(c, { message: 'Commission rejected' });
});

// POST /api/admin/commissions/:id/mark-paid
adminCommissionsRoutes.post('/:id/mark-paid', async (c) => {
  const id = c.req.param('id');
  const actor = c.get('user');
  const now = new Date().toISOString();

  const commission = await c.env.DB.prepare(
    `SELECT c.id, c.status, c.commission_amount, c.affiliate_code,
            aff_u.name as affiliate_name, aff_u.email as affiliate_email, aff_u.phone as affiliate_phone,
            o.order_number, o.product_name
     FROM affiliate_commissions c
     JOIN users aff_u ON c.affiliate_user_id = aff_u.id
     JOIN orders o ON c.order_id = o.id
     WHERE c.id = ?`
  ).bind(id).first() as any;
  if (!commission) return error(c, 'Commission not found', 404);
  if (commission.status === 'paid') return error(c, 'Already paid', 400);
  if (commission.status === 'rejected') return error(c, 'Cannot mark rejected commission as paid', 400);

  await c.env.DB.prepare(
    `UPDATE affiliate_commissions SET status = 'paid', paid_at = ? WHERE id = ?`
  ).bind(now, id).run();

  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, created_at)
     VALUES (?, ?, 'mark_commission_paid', 'affiliate_commission', ?, ?)`
  ).bind(crypto.randomUUID(), actor.id, id, now).run();

  const affiliateFirstName = ((commission.affiliate_name as string) || 'Kamu').split(' ')[0];
  const commissionAmount = Number(commission.commission_amount || 0);
  const netAmount = Math.max(0, commissionAmount - WITHDRAWAL_ADMIN_FEE);
  const fmtIdr = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
  const formattedAmount = fmtIdr(commissionAmount);
  const formattedFee = fmtIdr(WITHDRAWAL_ADMIN_FEE);
  const formattedNet = fmtIdr(netAmount);

  const emailResult = commission.affiliate_email
    ? await sendMailketingEmail(c.env, {
      recipient: commission.affiliate_email as string,
      subject: `Komisi affiliate kamu sudah dibayar: ${formattedAmount}`,
      content: commissionPaidEmailHtml({
        name: affiliateFirstName,
        commissionAmount,
        productName: commission.product_name as string | null,
        orderNumber: commission.order_number as string | null,
        paidAt: now,
      }),
      emailType: 'transactional',
    }, c.env.DB).catch((err) => {
      console.error('[admin:commissions] paid email failed:', err);
      return { success: false, error: 'email failed' };
    })
    : { success: false, skipped: true, error: 'affiliate email missing' };

  const whatsappMessage = [
    `Halo ${affiliateFirstName}, komisi affiliate PejuangYen kamu sudah dibayar.`,
    '',
    `Komisi: ${formattedAmount}`,
    `Biaya admin: ${formattedFee}`,
    `Diterima: ${formattedNet}`,
    commission.product_name ? `Produk: ${commission.product_name}` : '',
    commission.order_number ? `Order: ${commission.order_number}` : '',
    '',
    'Cek detailnya di dashboard affiliate:',
    'https://app.pejuangyen.com/affiliate',
  ].filter(Boolean).join('\n');

  const whatsappResult = await sendWhatsAppMessage(
    c.env,
    commission.affiliate_phone as string | null,
    whatsappMessage
  ).catch((err) => {
    console.error('[admin:commissions] paid whatsapp failed:', err);
    return { success: false, error: 'whatsapp failed' };
  });

  return success(c, {
    message: 'Commission marked as paid',
    notifications: {
      email: emailResult,
      whatsapp: whatsappResult,
    },
  });
});

export default adminCommissionsRoutes;
