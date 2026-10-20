// AI Pulse — Weekly Digest. Kirim ringkasan top item minggu ini ke member yang
// memberi consent marketing. Dipanggil cron tiap Senin. Cap per-run agar aman
// di dalam batas waktu cron Worker.
import type { Env } from '../../env';
import { sendMailketingEmail } from '../../services/mailketing';
import { AiPulseRepository } from './repository';
import { toListItem } from './mapper';

const MAX_RECIPIENTS_PER_RUN = 500;
const DIGEST_ITEM_COUNT = 6;

interface DigestResult {
  sent: number;
  items: number;
  skipped: boolean;
}

function impactLabel(level: string): string {
  if (level === 'major') return 'MAJOR';
  if (level === 'breaking') return 'BREAKING';
  return 'UPDATE';
}

function buildDigestHtml(appUrl: string, items: ReturnType<typeof toListItem>[]): string {
  const rows = items
    .map((it) => {
      const url = `${appUrl}/ai-pulse/${it.slug}`;
      return `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #DBEAFE;">
          <span style="display:inline-block;font:600 11px/1 monospace;color:#D97706;letter-spacing:.5px;">${impactLabel(it.impact_level)}</span>
          <a href="${url}" style="display:block;margin-top:6px;font:600 16px/1.4 Arial,sans-serif;color:#1E3A8A;text-decoration:none;">${it.title}</a>
          <p style="margin:6px 0 0;font:400 14px/1.6 Arial,sans-serif;color:#475569;">${it.summary ?? ''}</p>
        </td>
      </tr>`;
    })
    .join('');

  return `<!doctype html><html><body style="margin:0;background:#F8FAFC;padding:24px;">
  <table role="presentation" width="100%" style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #DBEAFE;border-radius:12px;">
    <tr><td style="padding:24px;">
      <p style="margin:0;font:700 12px/1 monospace;color:#1E40AF;letter-spacing:1px;">AI PULSE // WEEKLY DIGEST</p>
      <h1 style="margin:8px 0 0;font:700 22px/1.3 Arial,sans-serif;color:#1E3A8A;">Intel AI minggu ini</h1>
      <p style="margin:6px 0 0;font:400 14px/1.6 Arial,sans-serif;color:#64748B;">Update penting yang sudah kami ubah jadi paket pembelajaran siap praktik.</p>
      <table role="presentation" width="100%" style="margin-top:12px;">${rows}</table>
      <a href="${appUrl}/ai-pulse" style="display:inline-block;margin-top:20px;padding:12px 20px;background:#1E40AF;color:#fff;font:600 14px Arial,sans-serif;border-radius:8px;text-decoration:none;">Buka AI Pulse Terminal</a>
      <p style="margin:24px 0 0;font:400 12px/1.6 Arial,sans-serif;color:#94A3B8;">Tidak ingin email ini? <a href="{{unsubscribe_url}}" style="color:#94A3B8;">Berhenti berlangganan</a>.</p>
    </td></tr>
  </table></body></html>`;
}

export async function sendWeeklyAiPulseDigest(env: Env): Promise<DigestResult> {
  const repo = new AiPulseRepository(env.DB);
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const rows = await repo.topForDigest(since, DIGEST_ITEM_COUNT);

  if (rows.length === 0) {
    return { sent: 0, items: 0, skipped: true };
  }

  const items = rows.map(toListItem);
  const appUrl = (env.APP_URL || 'https://pejuangyen.com').replace(/\/+$/, '');
  const html = buildDigestHtml(appUrl, items);
  const subject = `AI Pulse: ${items.length} intel AI penting minggu ini`;

  // Penerima: member dengan consent marketing & status email sehat.
  const recipientsRes = await env.DB
    .prepare(
      `SELECT u.email as email
       FROM email_marketing_profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.marketing_consent = 1
         AND p.email_status IN ('active', 'unknown')
         AND u.status = 'active'
       LIMIT ?`
    )
    .bind(MAX_RECIPIENTS_PER_RUN)
    .all<{ email: string }>();

  const recipients = recipientsRes.results ?? [];
  let sent = 0;
  for (const r of recipients) {
    if (!r.email) continue;
    const res = await sendMailketingEmail(
      env,
      { recipient: r.email, subject, content: html, campaignId: 'ai_pulse_weekly' },
      env.DB
    ).catch(() => ({ success: false }));
    if (res.success) sent++;
  }

  return { sent, items: items.length, skipped: false };
}
