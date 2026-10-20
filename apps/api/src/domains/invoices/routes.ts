import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error, paginated } from '../../lib/response';
import { sendMailketingEmail } from '../../services/mailketing';
import { invoiceEmailHtml } from './email';

const invoiceRoutes = new Hono<{ Bindings: Env }>();

invoiceRoutes.use('*', authMiddleware());
invoiceRoutes.use('*', requireRole('admin', 'super_admin'));

interface ItemInput {
  item_name: string;
  description?: string | null;
  quantity?: number;
  unit_price?: number;
}

function toInt(v: unknown, fallback = 0): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : fallback;
}

/** Generate next invoice number for the current year: PY-INV-2026-0001 */
async function nextInvoiceNumber(db: D1Database): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PY-INV-${year}-`;
  const last = await db
    .prepare(`SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY invoice_number DESC LIMIT 1`)
    .bind(`${prefix}%`)
    .first<{ invoice_number: string }>();

  let seq = 1;
  if (last?.invoice_number) {
    const tail = last.invoice_number.slice(prefix.length);
    const parsed = parseInt(tail, 10);
    if (Number.isFinite(parsed)) seq = parsed + 1;
  }
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

function computeTotals(items: ItemInput[], discount: number, tax: number) {
  const normalized = items.map((it) => {
    const quantity = Math.max(1, toInt(it.quantity, 1));
    const unit_price = toInt(it.unit_price, 0);
    return {
      item_name: String(it.item_name || '').trim(),
      description: it.description ? String(it.description) : null,
      quantity,
      unit_price,
      total: quantity * unit_price,
    };
  });
  const subtotal = normalized.reduce((sum, it) => sum + it.total, 0);
  const total = Math.max(0, subtotal - discount + tax);
  return { normalized, subtotal, total };
}

// ─── List / Archive ──────────────────────────────────────────────────────────
invoiceRoutes.get('/', async (c) => {
  try {
    const url = new URL(c.req.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const offset = (page - 1) * limit;
    const status = url.searchParams.get('status') || '';
    const search = (url.searchParams.get('search') || '').trim();

    const where: string[] = [];
    const params: unknown[] = [];
    if (status) {
      where.push('status = ?');
      params.push(status);
    }
    if (search) {
      where.push('(invoice_number LIKE ? OR company_name LIKE ? OR recipient_name LIKE ? OR recipient_email LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows, totalRow] = await Promise.all([
      c.env.DB.prepare(
        `SELECT id, invoice_number, company_name, recipient_name, recipient_email,
                invoice_date, due_date, currency, total, status, pdf_url, created_by, created_at
         FROM invoices ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`
      ).bind(...params, limit, offset).all(),
      c.env.DB.prepare(`SELECT COUNT(*) as count FROM invoices ${whereSql}`).bind(...params).first<{ count: number }>(),
    ]);

    return paginated(c, rows.results, { page, limit, total: totalRow?.count || 0 });
  } catch (err) {
    console.error('[admin:invoices:list]', err);
    return error(c, 'Gagal memuat invoice', 500);
  }
});

// ─── Create ──────────────────────────────────────────────────────────────────
invoiceRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const {
      company_name, recipient_name, recipient_email, recipient_phone,
      company_address, tax_number, invoice_date, due_date, currency,
      discount, tax, payment_method, payment_information, notes, items,
    } = body;

    if (!company_name || !recipient_name || !recipient_email) {
      return error(c, 'Nama perusahaan, nama penerima, dan email wajib diisi', 400);
    }
    if (!Array.isArray(items) || items.length === 0) {
      return error(c, 'Minimal satu item invoice diperlukan', 400);
    }

    const discountAmt = toInt(discount, 0);
    const taxAmt = toInt(tax, 0);
    const { normalized, subtotal, total } = computeTotals(items, discountAmt, taxAmt);

    const id = crypto.randomUUID();
    const invoiceNumber = await nextInvoiceNumber(c.env.DB);
    const now = new Date().toISOString();
    const user = c.get('user');

    await c.env.DB.prepare(
      `INSERT INTO invoices (
        id, invoice_number, company_name, recipient_name, recipient_email, recipient_phone,
        company_address, tax_number, invoice_date, due_date, currency,
        subtotal, discount, tax, total, status,
        payment_method, payment_information, notes, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, invoiceNumber, company_name, recipient_name, recipient_email, recipient_phone || null,
      company_address || null, tax_number || null, invoice_date || now.slice(0, 10), due_date || null, currency || 'IDR',
      subtotal, discountAmt, taxAmt, total,
      payment_method || null, payment_information || null, notes || null, user?.name || user?.email || null, now, now
    ).run();

    const itemStmts = normalized.map((it, idx) =>
      c.env.DB.prepare(
        `INSERT INTO invoice_items (id, invoice_id, item_name, description, quantity, unit_price, total, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), id, it.item_name, it.description, it.quantity, it.unit_price, it.total, idx)
    );
    if (itemStmts.length) await c.env.DB.batch(itemStmts);

    return success(c, { id, invoice_number: invoiceNumber }, 201);
  } catch (err) {
    console.error('[admin:invoices:create]', err);
    return error(c, 'Gagal membuat invoice', 500);
  }
});

// ─── Detail ──────────────────────────────────────────────────────────────────
invoiceRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const invoice = await c.env.DB.prepare(`SELECT * FROM invoices WHERE id = ?`).bind(id).first();
    if (!invoice) return error(c, 'Invoice tidak ditemukan', 404);

    const items = await c.env.DB.prepare(
      `SELECT id, item_name, description, quantity, unit_price, total FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC`
    ).bind(id).all();

    return success(c, { ...invoice, items: items.results });
  } catch (err) {
    console.error('[admin:invoices:detail]', err);
    return error(c, 'Gagal memuat detail invoice', 500);
  }
});

// ─── Update ──────────────────────────────────────────────────────────────────
invoiceRoutes.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const existing = await c.env.DB.prepare(`SELECT id FROM invoices WHERE id = ?`).bind(id).first();
    if (!existing) return error(c, 'Invoice tidak ditemukan', 404);

    const body = await c.req.json();
    const {
      company_name, recipient_name, recipient_email, recipient_phone,
      company_address, tax_number, invoice_date, due_date, currency,
      discount, tax, payment_method, payment_information, notes, items,
    } = body;

    if (!company_name || !recipient_name || !recipient_email) {
      return error(c, 'Nama perusahaan, nama penerima, dan email wajib diisi', 400);
    }
    if (!Array.isArray(items) || items.length === 0) {
      return error(c, 'Minimal satu item invoice diperlukan', 400);
    }

    const discountAmt = toInt(discount, 0);
    const taxAmt = toInt(tax, 0);
    const { normalized, subtotal, total } = computeTotals(items, discountAmt, taxAmt);
    const now = new Date().toISOString();

    await c.env.DB.prepare(
      `UPDATE invoices SET
        company_name = ?, recipient_name = ?, recipient_email = ?, recipient_phone = ?,
        company_address = ?, tax_number = ?, invoice_date = ?, due_date = ?, currency = ?,
        subtotal = ?, discount = ?, tax = ?, total = ?,
        payment_method = ?, payment_information = ?, notes = ?, updated_at = ?
       WHERE id = ?`
    ).bind(
      company_name, recipient_name, recipient_email, recipient_phone || null,
      company_address || null, tax_number || null, invoice_date || now.slice(0, 10), due_date || null, currency || 'IDR',
      subtotal, discountAmt, taxAmt, total,
      payment_method || null, payment_information || null, notes || null, now, id
    ).run();

    await c.env.DB.prepare(`DELETE FROM invoice_items WHERE invoice_id = ?`).bind(id).run();
    const itemStmts = normalized.map((it, idx) =>
      c.env.DB.prepare(
        `INSERT INTO invoice_items (id, invoice_id, item_name, description, quantity, unit_price, total, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), id, it.item_name, it.description, it.quantity, it.unit_price, it.total, idx)
    );
    if (itemStmts.length) await c.env.DB.batch(itemStmts);

    return success(c, { message: 'Invoice diperbarui' });
  } catch (err) {
    console.error('[admin:invoices:update]', err);
    return error(c, 'Gagal memperbarui invoice', 500);
  }
});

// ─── Update status ───────────────────────────────────────────────────────────
invoiceRoutes.patch('/:id/status', async (c) => {
  try {
    const id = c.req.param('id');
    const { status } = await c.req.json();
    const allowed = ['draft', 'generated', 'sent', 'paid', 'cancelled', 'overdue'];
    if (!allowed.includes(status)) return error(c, 'Status tidak valid', 400);

    const res = await c.env.DB.prepare(
      `UPDATE invoices SET status = ?, updated_at = ? WHERE id = ?`
    ).bind(status, new Date().toISOString(), id).run();
    if (!res.meta.changes) return error(c, 'Invoice tidak ditemukan', 404);

    return success(c, { message: 'Status diperbarui', status });
  } catch (err) {
    console.error('[admin:invoices:status]', err);
    return error(c, 'Gagal memperbarui status', 500);
  }
});

// ─── Delete ──────────────────────────────────────────────────────────────────
invoiceRoutes.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const invoice = await c.env.DB.prepare(`SELECT pdf_url, invoice_number FROM invoices WHERE id = ?`).bind(id).first<{ pdf_url: string | null; invoice_number: string }>();
    if (!invoice) return error(c, 'Invoice tidak ditemukan', 404);

    await c.env.DB.prepare(`DELETE FROM invoice_items WHERE invoice_id = ?`).bind(id).run();
    await c.env.DB.prepare(`DELETE FROM invoice_email_logs WHERE invoice_id = ?`).bind(id).run();
    await c.env.DB.prepare(`DELETE FROM invoices WHERE id = ?`).bind(id).run();

    if (invoice.pdf_url && c.env.R2) {
      await c.env.R2.delete(`invoices/${invoice.invoice_number}.pdf`).catch(() => {});
    }

    return success(c, { message: 'Invoice dihapus' });
  } catch (err) {
    console.error('[admin:invoices:delete]', err);
    return error(c, 'Gagal menghapus invoice', 500);
  }
});

// ─── Upload generated PDF (raw application/pdf body) ─────────────────────────
invoiceRoutes.post('/:id/pdf', async (c) => {
  try {
    const id = c.req.param('id');
    const invoice = await c.env.DB.prepare(`SELECT invoice_number, status FROM invoices WHERE id = ?`).bind(id).first<{ invoice_number: string; status: string }>();
    if (!invoice) return error(c, 'Invoice tidak ditemukan', 404);
    if (!c.env.R2) return error(c, 'Penyimpanan file (R2) belum aktif. PDF invoice tidak dapat disimpan sampai R2 diaktifkan.', 503);

    const buf = await c.req.arrayBuffer();
    if (!buf || buf.byteLength === 0) return error(c, 'PDF kosong', 400);

    const key = `invoices/${invoice.invoice_number}.pdf`;
    await c.env.R2.put(key, buf, { httpMetadata: { contentType: 'application/pdf' } });

    const pdfUrl = `https://file.pejuangyen.com/${key}`;
    const now = new Date().toISOString();
    const nextStatus = invoice.status === 'draft' ? 'generated' : invoice.status;

    await c.env.DB.prepare(
      `UPDATE invoices SET pdf_url = ?, status = ?, updated_at = ? WHERE id = ?`
    ).bind(pdfUrl, nextStatus, now, id).run();

    return success(c, { pdf_url: pdfUrl, status: nextStatus });
  } catch (err) {
    console.error('[admin:invoices:pdf]', err);
    return error(c, 'Gagal menyimpan PDF', 500);
  }
});

// ─── Send invoice email ──────────────────────────────────────────────────────
invoiceRoutes.post('/:id/send', async (c) => {
  try {
    const id = c.req.param('id');
    const invoice = await c.env.DB.prepare(`SELECT * FROM invoices WHERE id = ?`).bind(id).first<Record<string, unknown>>();
    if (!invoice) return error(c, 'Invoice tidak ditemukan', 404);
    if (!invoice.pdf_url) return error(c, 'Buat PDF terlebih dahulu sebelum mengirim email', 400);

    const recipientEmail = String(invoice.recipient_email);
    const html = invoiceEmailHtml({
      recipientName: String(invoice.recipient_name),
      invoiceNumber: String(invoice.invoice_number),
      total: Number(invoice.total),
      currency: String(invoice.currency || 'IDR'),
      dueDate: invoice.due_date ? String(invoice.due_date) : null,
      pdfUrl: String(invoice.pdf_url),
      paymentInformation: invoice.payment_information ? String(invoice.payment_information) : null,
    });

    const result = await sendMailketingEmail(c.env, {
      recipient: recipientEmail,
      subject: `Invoice ${invoice.invoice_number} dari PejuangYen`,
      content: html,
      emailType: 'transactional',
    }, c.env.DB);

    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `INSERT INTO invoice_email_logs (id, invoice_id, recipient_email, delivery_status, provider_response, sent_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(), id, recipientEmail,
      result.success ? 'sent' : 'failed',
      JSON.stringify(result.message || result.error || result.data || null).slice(0, 1000),
      now
    ).run();

    if (!result.success) {
      return error(c, `Gagal mengirim email: ${result.error || result.message || 'unknown'}`, 502);
    }

    if (invoice.status === 'draft' || invoice.status === 'generated') {
      await c.env.DB.prepare(`UPDATE invoices SET status = 'sent', updated_at = ? WHERE id = ?`).bind(now, id).run();
    }

    return success(c, { message: 'Invoice terkirim', status: 'sent' });
  } catch (err) {
    console.error('[admin:invoices:send]', err);
    return error(c, 'Gagal mengirim invoice', 500);
  }
});

export default invoiceRoutes;
