import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../../env';
import {
  suppressEmail,
  cancelUserSequences,
  adjustEngagementScore,
  findOrCreateEmailProfile,
  updateEmailMarketingProfile,
} from '../../lib/email-suppression';

const mailketingWebhookRoutes = new Hono<{ Bindings: Env }>();

function validateSecret(secret: string | undefined | null, expected: string): boolean {
  if (!secret || !expected) return false;
  const maxLength = Math.max(secret.length, expected.length);
  let diff = secret.length ^ expected.length;
  for (let i = 0; i < maxLength; i++) {
    diff |= (secret.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
  }
  return diff === 0;
}

async function logEmailEvent(
  db: D1Database,
  data: {
    userId?: string;
    email: string;
    eventType: string;
    campaignId?: string;
    sequenceId?: string;
    subject?: string;
    linkClicked?: string;
    reason?: string;
    rawPayload?: string;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO email_events (id, user_id, email, event_type, campaign_id, sequence_id, email_subject, link_clicked, reason, provider, raw_payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'mailketing', ?, ?)`
  ).bind(
    crypto.randomUUID(),
    data.userId || null,
    data.email.toLowerCase(),
    data.eventType,
    data.campaignId || null,
    data.sequenceId || null,
    data.subject || null,
    data.linkClicked || null,
    data.reason || null,
    data.rawPayload || null,
    now
  ).run();
}

async function isDuplicateEvent(
  db: D1Database,
  email: string,
  eventType: string,
  date: string
): Promise<boolean> {
  const cutoff = new Date(date);
  cutoff.setDate(cutoff.getDate() + 1);
  const row = await db.prepare(
    `SELECT id FROM email_events WHERE email = ? AND event_type = ? AND created_at >= ? AND created_at < ? LIMIT 1`
  ).bind(email.toLowerCase(), eventType, date, cutoff.toISOString()).first();
  return row !== null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core processors — logika tiap event. Dipakai OLEH dispatcher terpadu (POST /)
// dan route per-path lama. Menerima (env, body); dijalankan dalam waitUntil.
// ─────────────────────────────────────────────────────────────────────────────

async function processNewSub(env: Env, body: Record<string, unknown>): Promise<void> {
  const email = String(body.email || '').toLowerCase();
  if (!email) return;
  const date = String(body.date || new Date().toISOString().slice(0, 10));
  const raw = JSON.stringify(body);

  const dup = await isDuplicateEvent(env.DB, email, 'new_subscriber', date);
  if (dup) return;

  const { userId } = await findOrCreateEmailProfile(email, env.DB);
  const now = new Date().toISOString();

  await updateEmailMarketingProfile(userId, email, {
    email_status: 'subscribed',
    marketing_consent: 1,
  }, env.DB);

  await adjustEngagementScore(userId, email, 5, env.DB);

  await logEmailEvent(env.DB, { userId, email, eventType: 'new_subscriber', rawPayload: raw });

  // Sync name if provided
  const firstName = String(body.first_name || '');
  const lastName = String(body.last_name || '');
  if (firstName) {
    await env.DB.prepare(
      `UPDATE users SET name = ?, updated_at = ? WHERE id = ? AND (name = ? OR name IS NULL OR name = '')`
    ).bind(`${firstName} ${lastName}`.trim(), now, userId, email.split('@')[0]).run();
  }
}

async function processOpen(env: Env, body: Record<string, unknown>): Promise<void> {
  const email = String(body.email || '').toLowerCase();
  if (!email) return;
  const date = String(body.date || new Date().toISOString().slice(0, 10));
  const raw = JSON.stringify(body);

  const dup = await isDuplicateEvent(env.DB, email, 'opened', date);
  if (dup) return;

  const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  const userId = user?.id as string | undefined;
  const now = new Date().toISOString();

  if (userId) {
    await updateEmailMarketingProfile(userId, email, { last_email_open_at: now }, env.DB);
    await adjustEngagementScore(userId, email, 1, env.DB);
  }

  await logEmailEvent(env.DB, { userId, email, eventType: 'opened', rawPayload: raw });
}

async function processClick(env: Env, body: Record<string, unknown>): Promise<void> {
  const email = String(body.email || '').toLowerCase();
  if (!email) return;
  const linkClicked = String(body.link_clicked || '');
  const date = String(body.date || new Date().toISOString().slice(0, 10));
  const raw = JSON.stringify(body);

  const dup = await isDuplicateEvent(env.DB, email, 'clicked', date);
  if (dup) return;

  const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  const userId = user?.id as string | undefined;
  const now = new Date().toISOString();

  const scoreBonus = linkClicked.includes('/checkout') ? 15 : 5;

  if (userId) {
    await updateEmailMarketingProfile(userId, email, { last_email_click_at: now }, env.DB);
    await adjustEngagementScore(userId, email, scoreBonus, env.DB);

    // If checkout link clicked, upsert checkout_events
    if (linkClicked.includes('/checkout')) {
      const urlParams = new URLSearchParams(linkClicked.split('?')[1] || '');
      const productId = linkClicked.split('/checkout/')[1]?.split('?')[0] || null;
      const existingCheckout = await env.DB.prepare(
        `SELECT id FROM checkout_events WHERE user_id = ? AND status = 'started' LIMIT 1`
      ).bind(userId).first();

      if (!existingCheckout) {
        await env.DB.prepare(
          `INSERT INTO checkout_events (id, user_id, email, product_id, checkout_url, status, utm_source, utm_medium, utm_campaign, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'started', ?, ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(), userId, email, productId, linkClicked,
          urlParams.get('utm_source'), urlParams.get('utm_medium'), urlParams.get('utm_campaign'),
          now, now
        ).run();
      }
    }
  }

  await logEmailEvent(env.DB, { userId, email, eventType: 'clicked', linkClicked, rawPayload: raw });
}

async function processBounce(env: Env, body: Record<string, unknown>): Promise<void> {
  const email = String(body.email || '').toLowerCase();
  if (!email) return;
  const reason = String(body.reason || 'bounce');
  const raw = JSON.stringify(body);

  const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  const userId = user?.id as string | undefined;

  await suppressEmail(email, 'bounce', 'mailketing_webhook', env.DB, raw);

  if (userId) {
    await updateEmailMarketingProfile(userId, email, {
      email_status: 'bounced',
      marketing_consent: 0,
      engagement_score: -100,
    }, env.DB);
    await cancelUserSequences(userId, env.DB);
  }

  await logEmailEvent(env.DB, { userId, email, eventType: 'bounced', reason, rawPayload: raw });
}

async function processUnsub(env: Env, body: Record<string, unknown>): Promise<void> {
  const email = String(body.email || '').toLowerCase();
  if (!email) return;
  const raw = JSON.stringify(body);

  const user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  const userId = user?.id as string | undefined;

  await suppressEmail(email, 'unsubscribe', 'mailketing_webhook', env.DB, raw);

  if (userId) {
    await updateEmailMarketingProfile(userId, email, {
      email_status: 'unsubscribed',
      marketing_consent: 0,
      engagement_score: -100,
    }, env.DB);
    await cancelUserSequences(userId, env.DB);
  }

  await logEmailEvent(env.DB, { userId, email, eventType: 'unsubscribed', rawPayload: raw });
}

// Peta tipe event Mailketing → processor. Toleran beberapa ejaan/format karena
// nama field/nilai persis dari Mailketing dikonfirmasi dari payload asli (dilog).
const EVENT_HANDLERS: Record<string, (env: Env, body: Record<string, unknown>) => Promise<void>> = {
  new_subscriber: processNewSub, newsub: processNewSub, subscribe: processNewSub, subscriber: processNewSub, subscription: processNewSub,
  open: processOpen, opened: processOpen, email_open: processOpen, emailopen: processOpen,
  click: processClick, clicked: processClick, link_click: processClick, linkclick: processClick,
  bounce: processBounce, bounced: processBounce, email_bounce: processBounce, emailbounce: processBounce, hardbounce: processBounce, softbounce: processBounce,
  unsub: processUnsub, unsubscribe: processUnsub, unsubscribed: processUnsub, unsubscription: processUnsub,
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/webhooks/mailketing  → DISPATCHER TERPADU (1 URL untuk semua event)
// Mailketing hanya support 1 webhook URL/akun → daftarkan URL ini saja, centang
// semua event. Dispatcher membaca tipe event dari payload lalu memanggil handler.
// ─────────────────────────────────────────────────────────────────────────────
mailketingWebhookRoutes.post('/', async (c) => {
  const secret = c.req.query('secret');
  if (!validateSecret(secret, c.env.MAILKETING_WEBHOOK_SECRET)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  let body: Record<string, unknown>;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const rawType = String(
    body.event ?? body.type ?? body.event_type ?? body.action ?? body.status ?? ''
  ).toLowerCase().trim();
  const handler = EVENT_HANDLERS[rawType];

  if (!handler) {
    // Tipe tak dikenal → log payload mentah supaya kita tahu field/nilai asli
    // dari Mailketing, lalu tinggal tambahkan ke EVENT_HANDLERS. Balas 200 agar
    // Mailketing tidak retry-storm.
    console.log('MAILKETING_WEBHOOK_UNKNOWN', JSON.stringify({ rawType, body }));
    return c.json({ success: true, note: 'event type unrecognized, logged for mapping' });
  }

  const email = String(body.email || '').toLowerCase();
  if (!email) return c.json({ error: 'Missing email' }, 400);

  c.executionCtx.waitUntil(
    handler(c.env, body).catch((err) => console.error('[mailketing-webhook]', rawType, err))
  );
  return c.json({ success: true, event: rawType });
});

// ─────────────────────────────────────────────────────────────────────────────
// Route per-path lama (backward-compat). Tetap dipertahankan supaya integrasi
// yang sudah terlanjur diset per-event di Mailketing tidak putus.
// ─────────────────────────────────────────────────────────────────────────────
function makePathRoute(processor: (env: Env, body: Record<string, unknown>) => Promise<void>) {
  return async (c: Context<{ Bindings: Env }>) => {
    const secret = c.req.query('secret');
    if (!validateSecret(secret, c.env.MAILKETING_WEBHOOK_SECRET)) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    let body: Record<string, unknown>;
    try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }
    if (!String(body.email || '')) return c.json({ error: 'Missing email' }, 400);
    c.executionCtx.waitUntil(
      processor(c.env, body).catch((err) => console.error('[mailketing-webhook:path]', err))
    );
    return c.json({ success: true });
  };
}

mailketingWebhookRoutes.post('/newsub', makePathRoute(processNewSub));
mailketingWebhookRoutes.post('/open', makePathRoute(processOpen));
mailketingWebhookRoutes.post('/click', makePathRoute(processClick));
mailketingWebhookRoutes.post('/bounce', makePathRoute(processBounce));
mailketingWebhookRoutes.post('/unsub', makePathRoute(processUnsub));

export default mailketingWebhookRoutes;
