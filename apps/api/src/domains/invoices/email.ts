const LOGO_URL = 'https://app.pejuangyen.com/icon-512.png';

function formatRupiah(amount: number, currency = 'IDR'): string {
  if (currency === 'IDR') return `Rp ${amount.toLocaleString('id-ID')}`;
  return `${currency} ${amount.toLocaleString('id-ID')}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

export interface InvoiceEmailParams {
  recipientName: string;
  invoiceNumber: string;
  total: number;
  currency: string;
  dueDate: string | null;
  pdfUrl: string;
  paymentInformation?: string | null;
}

export function invoiceEmailHtml(params: InvoiceEmailParams): string {
  const { recipientName, invoiceNumber, total, currency, dueDate, pdfUrl, paymentInformation } = params;

  const paymentBlock = paymentInformation
    ? `<tr><td style="padding:16px 0 0;">
         <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#9CA3AF;letter-spacing:0.04em;text-transform:uppercase;">Informasi Pembayaran</p>
         <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;white-space:pre-line;">${paymentInformation}</p>
       </td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:40px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:560px;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;">
  <tr><td style="padding:28px 32px 0;">
    <table cellpadding="0" cellspacing="0"><tr>
      <td style="padding-right:10px;"><img src="${LOGO_URL}" alt="PejuangYen" width="36" height="36" style="border-radius:8px;display:block;" /></td>
      <td style="font-size:15px;font-weight:700;color:#111827;letter-spacing:0.02em;">PejuangYen</td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:24px 32px 0;">
    <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;">Invoice ${invoiceNumber}</p>
    <p style="margin:0 0 20px;color:#4B5563;font-size:15px;line-height:1.6;">Halo ${recipientName},</p>
    <p style="margin:0 0 8px;color:#4B5563;font-size:15px;line-height:1.6;">Terima kasih telah bekerja sama dengan PejuangYen. Berikut invoice Anda:</p>
  </td></tr>
  <tr><td style="padding:8px 32px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border-radius:10px;">
      <tr>
        <td style="padding:16px 18px;border-bottom:1px solid #EFEFEF;">
          <p style="margin:0;font-size:12px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.04em;">Nomor Invoice</p>
          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#111827;">${invoiceNumber}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 18px;border-bottom:1px solid #EFEFEF;">
          <p style="margin:0;font-size:12px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.04em;">Total Tagihan</p>
          <p style="margin:2px 0 0;font-size:20px;font-weight:700;color:#111827;">${formatRupiah(total, currency)}</p>
        </td>
      </tr>
      ${dueDate ? `<tr>
        <td style="padding:16px 18px;">
          <p style="margin:0;font-size:12px;color:#9CA3AF;text-transform:uppercase;letter-spacing:0.04em;">Jatuh Tempo</p>
          <p style="margin:2px 0 0;font-size:14px;font-weight:600;color:#111827;">${formatDate(dueDate)}</p>
        </td>
      </tr>` : ''}
    </table>
  </td></tr>
  <tr><td style="padding:24px 32px 0;" align="center">
    <a href="${pdfUrl}" style="display:inline-block;padding:13px 28px;background:#111827;color:#FFFFFF;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Unduh Invoice (PDF)</a>
  </td></tr>
  <tr><td style="padding:14px 32px 0;" align="center">
    <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.6;">Atau salin tautan ini:<br><a href="${pdfUrl}" style="color:#6B7280;">${pdfUrl}</a></p>
  </td></tr>
  <tr><td style="padding:0 32px;">${paymentBlock ? `<table width="100%" cellpadding="0" cellspacing="0">${paymentBlock}</table>` : ''}</td></tr>
  <tr><td style="padding:28px 32px 28px;border-top:1px solid #E5E7EB;margin-top:24px;">
    <p style="margin:24px 0 0;font-size:12px;color:#9CA3AF;line-height:1.6;">Salam,<br>PejuangYen Team — Lembaga Pelatihan Bahasa Jepang & Persiapan Kerja ke Jepang</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
