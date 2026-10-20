import type { Env } from '../env';
import { enqueueEmail } from './email-queue';

const ADMIN_NOTIFICATION_EMAIL = 'hallopejuangyen@gmail.com';
const PRIVATE_CONSULTATION_CONTACT = '087827054701';

/**
 * Notifikasi IN-APP untuk semua admin (email/queue nonaktif untuk MVP).
 * Menulis langsung ke tabel notifications sehingga muncul di lonceng admin.
 */
export async function notifyAdminsInApp(
  env: Env,
  params: { type: string; title: string; body: string; data?: unknown }
): Promise<void> {
  try {
    const admins = await env.DB.prepare(
      "SELECT id FROM users WHERE role IN ('admin','super_admin') AND status = 'active'"
    ).all<{ id: string }>();
    if (!admins.results?.length) return;
    const now = new Date().toISOString();
    const stmts = admins.results.map((a) =>
      env.DB.prepare(
        `INSERT INTO notifications (id, user_id, type, title, body, data_json, status, sent_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'sent', ?, ?)`
      ).bind(crypto.randomUUID(), a.id, params.type, params.title, params.body,
        params.data ? JSON.stringify(params.data) : null, now, now)
    );
    await env.DB.batch(stmts);
  } catch (err) {
    console.error('[admin-notif:in-app]', err);
  }
}

type AdminOrderAddon = {
  type: string;
  label: string;
  amount: number;
  status?: string;
};

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatIdr(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount || 0);
}

function adminLayout(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F6F7F9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111827;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F7F9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="padding:20px 24px;border-bottom:1px solid #E5E7EB;">
            <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#8B1414;">PejuangYen Admin</p>
            <h1 style="margin:0;font-size:20px;line-height:1.35;color:#111827;">${escapeHtml(title)}</h1>
          </td>
        </tr>
        <tr><td style="padding:24px;">${content}</td></tr>
        <tr>
          <td style="padding:16px 24px;border-top:1px solid #E5E7EB;background:#F9FAFB;">
            <p style="margin:0;font-size:12px;line-height:1.6;color:#6B7280;">Email otomatis dari platform PejuangYen.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function row(label: string, value: unknown): string {
  return `
    <tr>
      <td style="padding:10px 12px;color:#6B7280;font-size:13px;border-top:1px solid #E5E7EB;">${escapeHtml(label)}</td>
      <td style="padding:10px 12px;color:#111827;font-size:13px;font-weight:600;text-align:right;border-top:1px solid #E5E7EB;">${escapeHtml(value)}</td>
    </tr>`;
}

function detailsTable(rows: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;">${rows}</table>`;
}

function addonRows(addons?: AdminOrderAddon[] | null): string {
  return (addons || [])
    .map((addon) => row(addon.label, formatIdr(addon.amount)))
    .join('');
}

export async function notifyAdminNewRegistration(env: Env, params: {
  userId: string;
  name: string;
  email: string;
  phone?: string | null;
  referralSource?: string | null;
  registeredAt: string;
}) {
  const content = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">Ada user baru yang daftar ke platform PejuangYen.</p>
    ${detailsTable([
      row('Nama', params.name),
      row('Email', params.email),
      row('WhatsApp', params.phone || '-'),
      row('Tau PejuangYen dari', params.referralSource || '-'),
      row('User ID', params.userId),
      row('Waktu daftar', new Date(params.registeredAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })),
    ].join(''))}
  `;

  await enqueueEmail(env, {
    type: 'send_email',
    recipient: ADMIN_NOTIFICATION_EMAIL,
    subject: `User baru daftar PejuangYen - ${params.name}`,
    content: adminLayout('User Baru Daftar Platform', content),
    emailType: 'notification',
  });
}

export async function notifyAdminNewOrder(env: Env, params: {
  orderId: string;
  orderNumber: string;
  orderType: string;
  productName: string;
  productAmount: number;
  paymentAdminFee: number;
  totalAmount: number;
  paymentUrl: string;
  addons?: AdminOrderAddon[];
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  };
  affiliateCode?: string | null;
  createdAt: string;
}) {
  const content = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">Ada order baru yang dibuat di PejuangYen. Status awal order masih menunggu pembayaran.</p>
    ${detailsTable([
      row('Nomor order', params.orderNumber),
      row('Tipe order', params.orderType),
      row('Produk', params.productName),
      row('Harga produk', formatIdr(params.productAmount)),
      addonRows(params.addons),
      row('Biaya admin', formatIdr(params.paymentAdminFee)),
      row('Total invoice', formatIdr(params.totalAmount)),
      row('Nama user', params.user.name),
      row('Email user', params.user.email),
      row('WhatsApp', params.user.phone || '-'),
      row('Affiliate', params.affiliateCode || '-'),
      row('Order ID', params.orderId),
      row('Waktu order', new Date(params.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })),
    ].join(''))}
    <p style="margin:18px 0 0;font-size:13px;line-height:1.7;color:#6B7280;">Link pembayaran: <a href="${escapeHtml(params.paymentUrl)}" style="color:#8B1414;text-decoration:underline;">${escapeHtml(params.paymentUrl)}</a></p>
  `;

  await enqueueEmail(env, {
    type: 'send_email',
    recipient: ADMIN_NOTIFICATION_EMAIL,
    subject: `Order baru PejuangYen - ${params.orderNumber}`,
    content: adminLayout('Order Baru Dibuat', content),
    emailType: 'notification',
  });
}

export async function notifyAdminOrderPaid(env: Env, params: {
  orderId: string;
  orderNumber: string;
  orderType: string;
  productName: string;
  productAmount: number;
  paymentAdminFee: number;
  totalAmount: number;
  addons?: AdminOrderAddon[];
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  };
  affiliateCode?: string | null;
  providerTransactionId?: string | null;
  eventType?: string | null;
  paidAt: string;
}) {
  const content = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">Order PejuangYen sudah dibayar dan status order sudah berubah menjadi paid.</p>
    ${detailsTable([
      row('Nomor order', params.orderNumber),
      row('Status', 'Paid'),
      row('Tipe order', params.orderType),
      row('Produk', params.productName),
      row('Harga produk', formatIdr(params.productAmount)),
      addonRows(params.addons),
      row('Biaya admin', formatIdr(params.paymentAdminFee)),
      row('Total dibayar', formatIdr(params.totalAmount)),
      row('Nama user', params.user.name),
      row('Email user', params.user.email),
      row('WhatsApp', params.user.phone || '-'),
      row('Affiliate', params.affiliateCode || '-'),
      row('Provider transaction', params.providerTransactionId || '-'),
      row('Event webhook', params.eventType || '-'),
      row('Order ID', params.orderId),
      row('Waktu bayar', new Date(params.paidAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })),
    ].join(''))}
  `;

  await enqueueEmail(env, {
    type: 'send_email',
    recipient: ADMIN_NOTIFICATION_EMAIL,
    subject: `Order sudah dibayar PejuangYen - ${params.orderNumber}`,
    content: adminLayout('Order Sudah Dibayar', content),
    emailType: 'notification',
  });
}

export async function notifyAdminPrivateConsultationOrder(env: Env, params: {
  orderId: string;
  orderNumber: string;
  productName: string;
  totalAmount: number;
  paidAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  };
}) {
  const content = `
    <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#374151;">Buyer mengambil add-on <strong>Konsultasi 1:1 Private dengan Irfan</strong>. Follow-up perlu diprioritaskan setelah payment berhasil.</p>
    ${detailsTable([
      row('Nomor order', params.orderNumber),
      row('Plan membership', params.productName),
      row('Total dibayar', formatIdr(params.totalAmount)),
      row('Nama buyer', params.user.name),
      row('Email buyer', params.user.email),
      row('WhatsApp buyer', params.user.phone || '-'),
      row('Order ID', params.orderId),
      row('Waktu bayar', new Date(params.paidAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })),
    ].join(''))}
    <p style="margin:18px 0 0;padding:14px 16px;background:#FEF3C7;border:1px solid #F59E0B;border-radius:10px;font-size:14px;line-height:1.7;color:#78350F;">
      <strong>Instruksi follow-up:</strong> Hubungi Irfan/konfirmasi follow-up di ${PRIVATE_CONSULTATION_CONTACT}. Pastikan buyer dihubungi untuk konfirmasi topik spesifik dan jadwal konsultasi.
    </p>
  `;

  await enqueueEmail(env, {
    type: 'send_email',
    recipient: ADMIN_NOTIFICATION_EMAIL,
    subject: `URGENT: Order Konsultasi 1:1 Private - ${params.orderNumber}`,
    content: adminLayout('Order Konsultasi 1:1 Private', content),
    emailType: 'notification',
  });
}
