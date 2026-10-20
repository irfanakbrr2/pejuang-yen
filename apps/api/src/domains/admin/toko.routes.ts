import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error, paginated } from '../../lib/response';
import { enqueueEmail } from '../../lib/email-queue';

const adminTokoRoutes = new Hono<{ Bindings: Env }>();

adminTokoRoutes.use('*', authMiddleware());
adminTokoRoutes.use('*', requireRole('admin', 'super_admin'));

function auditLog(c: { env: Env }, actorId: string, action: string, entityType: string, entityId: string, after: Record<string, unknown>) {
  return c.env.DB.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, before_data_json, after_data_json, ip_hash, created_at)
     VALUES (?, ?, ?, ?, ?, NULL, ?, NULL, ?)`
  ).bind(crypto.randomUUID(), actorId, action, entityType, entityId, JSON.stringify(after), new Date().toISOString()).run().catch(() => {});
}

// ── Stores ───────────────────────────────────────────────────────────────
adminTokoRoutes.get('/stores', async (c) => {
  try {
    const url = new URL(c.req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = 20;
    const [rows, totalRow] = await Promise.all([
      c.env.DB.prepare(
        `SELECT s.*, u.name as owner_name, u.email as owner_email,
           (SELECT COUNT(*) FROM creator_products p WHERE p.store_id = s.id AND p.status = 'active') as active_products,
           (SELECT COALESCE(SUM(gross_amount), 0) FROM creator_earnings e WHERE e.store_id = s.id AND e.entry_type = 'sale') as gmv,
           (SELECT COALESCE(SUM(amount), 0) FROM creator_earnings e WHERE e.store_id = s.id) as balance
         FROM creator_stores s JOIN users u ON u.id = s.user_id
         ORDER BY s.created_at DESC LIMIT ? OFFSET ?`
      ).bind(limit, (page - 1) * limit).all(),
      c.env.DB.prepare('SELECT COUNT(*) as total FROM creator_stores').first(),
    ]);
    return paginated(c, rows.results, { page, limit, total: Number(totalRow?.total || 0) });
  } catch (err) {
    console.error('[admin:toko:stores]', err);
    return error(c, 'Gagal memuat toko', 500);
  }
});

adminTokoRoutes.post('/stores/:id/suspend', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `UPDATE creator_stores SET status = 'suspended', suspended_at = ?, suspended_reason = ?, updated_at = ? WHERE id = ?`
    ).bind(now, body.reason || null, now, id).run();
    await auditLog(c, c.get('user').id, 'creator_store_suspended', 'creator_store', id, { reason: body.reason || null });
    return success(c, { id });
  } catch (err) {
    console.error('[admin:toko:suspend]', err);
    return error(c, 'Gagal menangguhkan toko', 500);
  }
});

adminTokoRoutes.post('/stores/:id/activate', async (c) => {
  try {
    const id = c.req.param('id');
    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `UPDATE creator_stores SET status = 'active', suspended_at = NULL, suspended_reason = NULL, updated_at = ? WHERE id = ?`
    ).bind(now, id).run();
    await auditLog(c, c.get('user').id, 'creator_store_activated', 'creator_store', id, {});
    return success(c, { id });
  } catch (err) {
    console.error('[admin:toko:activate]', err);
    return error(c, 'Gagal mengaktifkan toko', 500);
  }
});

// ── Products moderation ──────────────────────────────────────────────────
adminTokoRoutes.get('/products', async (c) => {
  try {
    const url = new URL(c.req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = 20;
    const [rows, totalRow] = await Promise.all([
      c.env.DB.prepare(
        `SELECT p.*, s.slug as store_slug, s.name as store_name
         FROM creator_products p JOIN creator_stores s ON s.id = p.store_id
         ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
      ).bind(limit, (page - 1) * limit).all(),
      c.env.DB.prepare('SELECT COUNT(*) as total FROM creator_products').first(),
    ]);
    return paginated(c, rows.results, { page, limit, total: Number(totalRow?.total || 0) });
  } catch (err) {
    console.error('[admin:toko:products]', err);
    return error(c, 'Gagal memuat produk', 500);
  }
});

adminTokoRoutes.post('/products/:id/suspend', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `UPDATE creator_products SET status = 'suspended', suspended_reason = ?, updated_at = ? WHERE id = ?`
    ).bind(body.reason || null, now, id).run();
    await auditLog(c, c.get('user').id, 'creator_product_suspended', 'creator_product', id, { reason: body.reason || null });
    return success(c, { id });
  } catch (err) {
    console.error('[admin:toko:product-suspend]', err);
    return error(c, 'Gagal menangguhkan produk', 500);
  }
});

adminTokoRoutes.post('/products/:id/activate', async (c) => {
  try {
    const id = c.req.param('id');
    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `UPDATE creator_products SET status = 'active', suspended_reason = NULL, updated_at = ? WHERE id = ?`
    ).bind(now, id).run();
    await auditLog(c, c.get('user').id, 'creator_product_activated', 'creator_product', id, {});
    return success(c, { id });
  } catch (err) {
    console.error('[admin:toko:product-activate]', err);
    return error(c, 'Gagal mengaktifkan produk', 500);
  }
});

// ── Payout queue (mirror admin commissions) ──────────────────────────────
adminTokoRoutes.get('/payouts', async (c) => {
  try {
    const url = new URL(c.req.url);
    const status = url.searchParams.get('status') || '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = 20;
    const where = status ? 'WHERE cp.status = ?' : '';
    const bindings: unknown[] = status ? [status] : [];

    const [rows, totalRow] = await Promise.all([
      c.env.DB.prepare(
        `SELECT cp.*, s.name as store_name, s.slug as store_slug, u.email as owner_email
         FROM creator_payouts cp
         JOIN creator_stores s ON s.id = cp.store_id
         JOIN users u ON u.id = cp.user_id
         ${where} ORDER BY cp.requested_at DESC LIMIT ? OFFSET ?`
      ).bind(...bindings, limit, (page - 1) * limit).all(),
      c.env.DB.prepare(`SELECT COUNT(*) as total FROM creator_payouts cp ${where}`).bind(...bindings).first(),
    ]);
    return paginated(c, rows.results, { page, limit, total: Number(totalRow?.total || 0) });
  } catch (err) {
    console.error('[admin:toko:payouts]', err);
    return error(c, 'Gagal memuat penarikan', 500);
  }
});

adminTokoRoutes.post('/payouts/:id/approve', async (c) => {
  try {
    const id = c.req.param('id');
    const now = new Date().toISOString();
    const res = await c.env.DB.prepare(
      `UPDATE creator_payouts SET status = 'approved', reviewed_at = ?, reviewed_by = ? WHERE id = ? AND status = 'pending'`
    ).bind(now, c.get('user').id, id).run();
    if ((res.meta?.changes || 0) === 0) return error(c, 'Penarikan tidak dalam status pending', 400);
    await auditLog(c, c.get('user').id, 'creator_payout_approved', 'creator_payout', id, {});
    return success(c, { id });
  } catch (err) {
    console.error('[admin:toko:payout-approve]', err);
    return error(c, 'Gagal menyetujui penarikan', 500);
  }
});

// Reject → saldo dikembalikan via reversal credit (idempoten: unique payout_id+entry_type)
adminTokoRoutes.post('/payouts/:id/reject', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const payout = await c.env.DB.prepare('SELECT * FROM creator_payouts WHERE id = ?').bind(id).first();
    if (!payout) return error(c, 'Penarikan tidak ditemukan', 404);
    if (payout.status === 'paid') return error(c, 'Penarikan sudah dibayar — tidak bisa ditolak', 400);
    if (payout.status === 'rejected') return success(c, { id });

    const now = new Date().toISOString();
    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE creator_payouts SET status = 'rejected', reviewed_at = ?, reviewed_by = ?, notes = ? WHERE id = ? AND status IN ('pending', 'approved')`
      ).bind(now, c.get('user').id, body.reason || null, id),
      c.env.DB.prepare(
        `INSERT OR IGNORE INTO creator_earnings (id, store_id, user_id, entry_type, amount, payout_id, eligible_at, note, created_at)
         VALUES (?, ?, ?, 'payout_reversal', ?, ?, ?, 'Penarikan ditolak — saldo dikembalikan', ?)`
      ).bind(crypto.randomUUID(), payout.store_id, payout.user_id, Number(payout.amount), id, now, now),
    ]);
    await auditLog(c, c.get('user').id, 'creator_payout_rejected', 'creator_payout', id, { reason: body.reason || null });
    return success(c, { id });
  } catch (err) {
    console.error('[admin:toko:payout-reject]', err);
    return error(c, 'Gagal menolak penarikan', 500);
  }
});

adminTokoRoutes.post('/payouts/:id/mark-paid', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const payout = await c.env.DB.prepare('SELECT * FROM creator_payouts WHERE id = ?').bind(id).first();
    if (!payout) return error(c, 'Penarikan tidak ditemukan', 404);

    const now = new Date().toISOString();
    const res = await c.env.DB.prepare(
      `UPDATE creator_payouts SET status = 'paid', paid_at = ?, transfer_ref = ? WHERE id = ? AND status IN ('pending', 'approved')`
    ).bind(now, body.transfer_ref || null, id).run();
    if ((res.meta?.changes || 0) === 0) return error(c, 'Penarikan tidak bisa ditandai dibayar', 400);

    await auditLog(c, c.get('user').id, 'creator_payout_paid', 'creator_payout', id, { transfer_ref: body.transfer_ref || null });

    // Email creator (fire-and-forget)
    c.executionCtx.waitUntil((async () => {
      const owner = await c.env.DB.prepare('SELECT name, email FROM users WHERE id = ?').bind(payout.user_id).first();
      if (!owner?.email) return;
      const firstName = ((owner.name as string) || '').split(' ')[0] || 'Creator';
      await enqueueEmail(c.env, {
        type: 'send_email',
        recipient: owner.email as string,
        subject: 'Penarikan saldo tokomu sudah ditransfer',
        content: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
          <h2 style="color:#0F6E56;">Penarikan Berhasil 💸</h2>
          <p>Halo ${firstName},</p>
          <p>Penarikan saldo sebesar <strong>Rp${Number(payout.amount).toLocaleString('id-ID')}</strong> sudah ditransfer ke rekening ${payout.bank_name} ${payout.bank_account}.</p>
          ${body.transfer_ref ? `<p>Referensi transfer: <strong>${body.transfer_ref}</strong></p>` : ''}
        </div>`,
        emailType: 'transactional',
      }).catch((err) => console.error('[admin:toko] payout email error:', err));
    })());

    return success(c, { id });
  } catch (err) {
    console.error('[admin:toko:payout-paid]', err);
    return error(c, 'Gagal menandai penarikan', 500);
  }
});

// ── Stats platform ───────────────────────────────────────────────────────
adminTokoRoutes.get('/stats', async (c) => {
  try {
    const row = await c.env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM creator_stores WHERE status = 'active') as active_stores,
         (SELECT COUNT(*) FROM creator_products WHERE status = 'active') as active_products,
         (SELECT COALESCE(SUM(gross_amount), 0) FROM creator_earnings WHERE entry_type = 'sale') as gmv,
         (SELECT COALESCE(SUM(fee_amount), 0) FROM creator_earnings WHERE entry_type = 'sale') as fee_revenue,
         (SELECT COALESCE(SUM(amount), 0) FROM creator_earnings) as payout_liability,
         (SELECT COUNT(*) FROM creator_payouts WHERE status = 'pending') as pending_payouts`
    ).first();
    return success(c, row);
  } catch (err) {
    console.error('[admin:toko:stats]', err);
    return error(c, 'Gagal memuat statistik', 500);
  }
});

export default adminTokoRoutes;
