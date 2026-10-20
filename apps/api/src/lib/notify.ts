import type { Env } from '../env';
import { sendWebPush, type PushSubscriptionRecord } from './web-push';

export interface NotifyOptions {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  type?: string; // notifications.type (default 'system')
  data?: Record<string, unknown>;
  /** false → lewati insert ke tabel notifications (mis. sudah di-insert caller) */
  inApp?: boolean;
  /** false → lewati web push */
  push?: boolean;
}

/**
 * Kirim notifikasi kompetitif ke user: tulis ke tabel notifications (in-app)
 * dan kirim web push ke semua langganan device. Langganan yang sudah mati
 * (404/410) dibersihkan. Dirancang untuk executionCtx.waitUntil — never throws.
 */
export async function notifyUser(env: Env, userId: string, opts: NotifyOptions): Promise<void> {
  const now = new Date().toISOString();
  const url = opts.url || '/dashboard';

  try {
    if (opts.inApp !== false) {
      await env.DB.prepare(
        `INSERT INTO notifications (id, user_id, type, title, body, data_json, status, sent_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'sent', ?, ?)`
      ).bind(
        crypto.randomUUID(), userId, opts.type || 'system', opts.title, opts.body,
        JSON.stringify({ url, ...(opts.data || {}) }), now, now
      ).run();
    }
  } catch (err) {
    console.error('[notify] in-app insert failed:', userId, err);
  }

  if (opts.push === false) return;

  try {
    const subs = await env.DB.prepare(
      `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?`
    ).bind(userId).all();

    for (const s of (subs.results || []) as any[]) {
      const record: PushSubscriptionRecord = { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth };
      const res = await sendWebPush(env, record, { title: opts.title, body: opts.body, url, tag: opts.tag });
      if (res.gone) {
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(s.id).run().catch(() => {});
      } else if (res.ok) {
        await env.DB.prepare('UPDATE push_subscriptions SET last_used_at = ? WHERE id = ?')
          .bind(now, s.id).run().catch(() => {});
      }
    }
  } catch (err) {
    console.error('[notify] push send failed:', userId, err);
  }
}
