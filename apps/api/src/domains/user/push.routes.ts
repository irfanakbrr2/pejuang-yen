import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware } from '../../middleware/auth';
import { success, error } from '../../lib/response';

const pushRoutes = new Hono<{ Bindings: Env }>();

// ─── GET /api/user/push/public-key ──────────────────────────────────────────
// Kunci publik VAPID untuk klien subscribe (boleh publik). Tanpa auth agar
// service worker bisa ambil sebelum login pun.
pushRoutes.get('/public-key', (c) => {
  const key = c.env.VAPID_PUBLIC_KEY || '';
  return success(c, { public_key: key, enabled: !!key });
});

// ─── POST /api/user/push/subscribe ──────────────────────────────────────────
pushRoutes.post('/subscribe', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null) as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    } | null;

    const endpoint = body?.endpoint;
    const p256dh = body?.keys?.p256dh;
    const auth = body?.keys?.auth;
    if (!endpoint || !p256dh || !auth) return error(c, 'Subscription tidak valid', 400);

    const now = new Date().toISOString();
    const ua = c.req.header('user-agent') || null;

    // Idempotent per endpoint; pindahkan kepemilikan bila device dipakai user lain.
    await c.env.DB.prepare(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at, last_used_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
         user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
         user_agent = excluded.user_agent, last_used_at = excluded.last_used_at`
    ).bind(crypto.randomUUID(), user.id, endpoint, p256dh, auth, ua, now, now).run();

    return success(c, { subscribed: true });
  } catch (err) {
    console.error('[push:subscribe]', err);
    return error(c, 'Gagal subscribe', 500);
  }
});

// ─── POST /api/user/push/unsubscribe ────────────────────────────────────────
pushRoutes.post('/unsubscribe', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json().catch(() => null) as { endpoint?: string } | null;
    if (!body?.endpoint) return error(c, 'Endpoint wajib diisi', 400);
    await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?')
      .bind(body.endpoint, user.id).run();
    return success(c, { unsubscribed: true });
  } catch (err) {
    console.error('[push:unsubscribe]', err);
    return error(c, 'Gagal unsubscribe', 500);
  }
});

export default pushRoutes;
