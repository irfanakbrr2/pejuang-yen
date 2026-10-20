import type { Env } from '../env';

const MAILKETING_BASE = 'https://api.mailketing.co.id/api/v1';
// Mail Hub terpusat (email.sahabatcuan.id) — semua KIRIM email lewat sini.
// Fungsi list/subscriber/credits tetap ke Mailketing langsung.
const MAIL_HUB_BASE = 'https://email.sahabatcuan.id';
const INTERNAL_MAIL_DOMAIN = 'pejuangyen.com';
// Mailketing-approved sender. All transactional mail (OTP, password reset,
// admin notifications, etc.) is sent from this address. Untuk deliverability
// inbox, pastikan SPF/DKIM pejuangyen.com terpasang di Cloudflare DNS.
const DEFAULT_FROM_EMAIL = 'noreply@pejuangyen.com';
const DEFAULT_FROM_NAME = 'PejuangYen';

export interface MailketingResponse {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
}

export interface SendEmailParams {
  recipient: string;
  subject: string;
  content: string;
  fromName?: string;
  fromEmail?: string;
  campaignId?: string;
  sequenceId?: string;
  userId?: string;
  emailType?: 'transactional' | 'marketing' | 'lifecycle' | 'notification';
}

export interface AddSubscriberParams {
  listId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: string;
  interest?: string;
  source?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  membershipStatus?: string;
  purchaseStatus?: string;
}

export interface MailketingList {
  id: string;
  name: string;
  count?: number;
}

export interface CreditInfo {
  balance: number;
  isWarning: boolean;
  isCritical: boolean;
  isEmpty: boolean;
}

async function callMailketing(
  endpoint: string,
  body: Record<string, unknown>
): Promise<MailketingResponse> {
  const res = await fetch(`${MAILKETING_BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = { message: text }; }

  if (!res.ok) {
    return { success: false, error: `HTTP ${res.status}`, data };
  }

  const d = data as Record<string, unknown>;
  return {
    success: d.status === 'success' || d.success === true,
    message: (d.message as string) || undefined,
    data: d.data ?? d,
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getEmailDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() || '';
}

async function deliverToInternalCloudMail(
  env: Env,
  params: SendEmailParams,
  content: string
): Promise<MailketingResponse | null> {
  if (!env.MAIL_DB || getEmailDomain(params.recipient) !== INTERNAL_MAIL_DOMAIN) {
    return null;
  }

  const recipient = params.recipient.toLowerCase();
  const account = await env.MAIL_DB.prepare(
    `SELECT account_id, user_id, name FROM account WHERE email COLLATE NOCASE = ? AND is_del = 0 LIMIT 1`
  ).bind(recipient).first<{
    account_id: number;
    user_id: number;
    name: string;
  }>();

  if (!account) {
    return null;
  }

  const fromEmail = params.fromEmail || DEFAULT_FROM_EMAIL;
  const fromName = params.fromName || DEFAULT_FROM_NAME;
  const now = new Date().toISOString();
  const recipientJson = JSON.stringify([{ address: recipient, name: account.name || recipient.split('@')[0] }]);

  await env.MAIL_DB.prepare(
    `INSERT INTO email (
      send_email, name, account_id, user_id, subject, content, text,
      cc, bcc, recipient, to_email, to_name, message_id, type, status,
      unread, is_del, create_time
    ) VALUES (?, ?, ?, ?, ?, ?, ?, '[]', '[]', ?, ?, ?, ?, 0, 0, 0, 0, ?)`
  ).bind(
    fromEmail,
    fromName,
    account.account_id,
    account.user_id,
    params.subject,
    content,
    stripHtml(content),
    recipientJson,
    recipient,
    account.name || recipient.split('@')[0],
    `<${crypto.randomUUID()}@pejuangyen.com>`,
    now
  ).run();

  await env.MAIL_DB.prepare(
    `UPDATE account SET latest_email_time = ? WHERE account_id = ?`
  ).bind(now, account.account_id).run();

  return {
    success: true,
    message: 'Delivered to internal Cloud Mail mailbox',
    data: { provider: 'cloud-mail-internal', recipient },
  };
}

export async function sendMailketingEmail(
  env: Env,
  params: SendEmailParams,
  db?: D1Database
): Promise<MailketingResponse> {
  if (!params.recipient || !params.subject || !params.content) {
    return { success: false, error: 'recipient, subject, and content are required' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(params.recipient)) {
    return { success: false, error: 'Invalid recipient email address' };
  }

  if (!env.MAIL_HUB_API_KEY) {
    console.warn('[mail-hub] MAIL_HUB_API_KEY not set');
    return { success: false, error: 'MAIL_HUB_API_KEY not configured' };
  }

  const unsubUrl = `https://api.pejuangyen.com/api/unsubscribe?email=${encodeURIComponent(params.recipient)}`;
  const finalContent = params.content.replace(/\{\{unsubscribe_url\}\}/g, unsubUrl);

  const internalDelivery = await deliverToInternalCloudMail(env, params, finalContent);
  if (internalDelivery) {
    return internalDelivery;
  }

  // Kirim via Mail Hub terpusat. Andalkan field `status` di body respons,
  // BUKAN HTTP status code (hub bisa balas 200/4xx/5xx untuk semua kasus).
  let result: MailketingResponse;
  try {
    const res = await fetch(`${MAIL_HUB_BASE}/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.MAIL_HUB_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: params.recipient,
        subject: params.subject,
        html: finalContent,
        ...(params.emailType ? { email_type: params.emailType } : {}),
        from_email: params.fromEmail || DEFAULT_FROM_EMAIL,
        from_name: params.fromName || DEFAULT_FROM_NAME,
      }),
    });

    const text = await res.text();
    let hub: Record<string, unknown>;
    try { hub = JSON.parse(text) as Record<string, unknown>; } catch { hub = { error: text }; }

    if (hub.status === 'sent') {
      result = { success: true, data: hub };
    } else if (hub.status === 'suppressed') {
      result = { success: false, error: `suppressed: ${String(hub.reason || 'unknown')}`, data: hub };
    } else {
      result = {
        success: false,
        error: String(hub.error || hub.status || `HTTP ${res.status}`),
        data: hub,
      };
    }
  } catch (err) {
    result = { success: false, error: err instanceof Error ? err.message : String(err) };
  }

  if (!result.success && db) {
    const now = new Date().toISOString();
    await db.prepare(
      `INSERT INTO email_events (id, email, event_type, campaign_id, sequence_id, email_subject, reason, provider, created_at)
       VALUES (?, ?, 'failed', ?, ?, ?, ?, 'mailketing', ?)`
    ).bind(
      crypto.randomUUID(),
      params.recipient,
      params.campaignId || null,
      params.sequenceId || null,
      params.subject,
      result.error || 'unknown',
      now
    ).run().catch(console.error);
  }

  return result;
}

export async function addSubscriberToList(
  env: Env,
  params: AddSubscriberParams
): Promise<MailketingResponse> {
  if (!params.listId || !params.email) {
    return { success: false, error: 'listId and email are required' };
  }

  if (!env.MAILKETING_API_TOKEN) {
    return { success: false, error: 'API token not configured' };
  }

  return callMailketing('addsubtolist', {
    api_token: env.MAILKETING_API_TOKEN,
    list_id: params.listId,
    email: params.email,
    first_name: params.firstName || undefined,
    last_name: params.lastName || undefined,
    phone: params.phone || undefined,
    company: params.role || undefined,
  });
}

export async function getAllLists(env: Env): Promise<MailketingList[]> {
  if (!env.MAILKETING_API_TOKEN) return [];

  const result = await callMailketing('viewlist', {
    api_token: env.MAILKETING_API_TOKEN,
  });

  if (!result.success) return [];

  const data = result.data as Record<string, unknown> | unknown[] | null;
  if (Array.isArray(data)) {
    return data.map((item: unknown) => {
      const i = item as Record<string, unknown>;
      return { id: String(i.id || i.list_id || ''), name: String(i.name || i.list_name || ''), count: Number(i.count || 0) };
    });
  }

  return [];
}

export async function checkCredits(env: Env): Promise<CreditInfo> {
  if (!env.MAILKETING_API_TOKEN) {
    return { balance: 0, isWarning: true, isCritical: true, isEmpty: true };
  }

  const result = await callMailketing('ceksaldo', {
    api_token: env.MAILKETING_API_TOKEN,
  });

  const raw = result.data as Record<string, unknown> | null;
  const balance = Number(raw?.saldo ?? raw?.balance ?? raw?.credit ?? 0);

  return {
    balance,
    isWarning: balance < 1000,
    isCritical: balance < 300,
    isEmpty: balance <= 0,
  };
}
