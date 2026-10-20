import type { Env } from '../env';

export interface WhatsAppResult {
  success: boolean;
  skipped?: boolean;
  error?: string;
  data?: unknown;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return digits;
}

export async function sendWhatsAppMessage(env: Env, phone: string | null | undefined, message: string): Promise<WhatsAppResult> {
  const to = normalizePhone(phone || '');
  if (!to || !message.trim()) return { success: false, skipped: true, error: 'phone or message missing' };

  if (!env.WHATSAPP_API_URL || !env.WHATSAPP_API_TOKEN) {
    console.warn('[whatsapp] provider not configured; skipping message');
    return { success: false, skipped: true, error: 'provider not configured' };
  }

  try {
    const authScheme = env.WHATSAPP_API_AUTH_SCHEME || (env.WHATSAPP_API_URL.includes('fonnte.com') ? 'token' : 'bearer');
    const authorization = authScheme === 'token' ? env.WHATSAPP_API_TOKEN : `Bearer ${env.WHATSAPP_API_TOKEN}`;

    const res = await fetch(env.WHATSAPP_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      body: JSON.stringify({
        phone: to,
        to,
        target: to,
        message,
      }),
    });

    const text = await res.text();
    let data: unknown = text;
    try { data = text ? JSON.parse(text) : {}; } catch { /* keep text */ }

    if (!res.ok) return { success: false, error: `HTTP ${res.status}`, data };
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'unknown error' };
  }
}
