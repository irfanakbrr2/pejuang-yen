const COMMUNITY_WHATSAPP_URL = 'https://chat.whatsapp.com/REPLACE_PEJUANGYEN_COMMUNITY_GROUP';

function notionLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;padding:40px 16px;">
<tr><td align="center">
<table width="100%" style="max-width:600px;background:#FFFFFF;">
<tr><td style="padding:0 0 16px;"><span style="font-size:13px;font-weight:600;color:#999999;letter-spacing:0.04em;text-transform:uppercase;">PejuangYen</span></td></tr>
<tr><td style="border-top:1px solid #E5E5E5;padding:32px 0 0;"></td></tr>
<tr><td style="padding:8px 0 32px;">${content}</td></tr>
<tr><td style="border-top:1px solid #E5E5E5;padding:24px 0 0;">
<p style="margin:0;font-size:12px;color:#999999;line-height:1.6;">PejuangYen - Lembaga Pelatihan Bahasa Jepang & Persiapan Kerja ke Jepang</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function resetPasswordEmailHtml(resetUrl: string): string {
  return notionLayout(`
    <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#111827;">Reset Password</p>
    <p style="margin:0 0 16px;color:#4B5563;font-size:15px;line-height:1.6;">Kami menerima permintaan reset password untuk akun PejuangYen kamu.</p>
    <p style="margin:0 0 20px;color:#4B5563;font-size:15px;line-height:1.6;">Klik tombol di bawah untuk membuat password baru. Link ini berlaku selama 1 jam, jadi sebaiknya digunakan segera.</p>
    <a href="${resetUrl}" style="display:inline-block;padding:11px 22px;background:#1A1A1A;color:#FFFFFF;text-decoration:none;border-radius:4px;font-weight:500;font-size:14px;letter-spacing:0.01em;">Reset Password</a>
    <p style="margin:20px 0 0;font-size:13px;color:#9CA3AF;line-height:1.6;">Kalau kamu tidak meminta reset password, abaikan email ini. Kalau ada pertanyaan, tanyakan di grup WhatsApp komunitas: <a href="${COMMUNITY_WHATSAPP_URL}" style="color:#6B7280;text-decoration:underline;">Join grup komunitas</a>.</p>
  `);
}
