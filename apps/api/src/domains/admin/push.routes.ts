import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error } from '../../lib/response';
import { sendWebPush, type PushSubscriptionRecord } from '../../lib/web-push';

const adminPushRoutes = new Hono<{ Bindings: Env }>();
adminPushRoutes.use('*', authMiddleware());
adminPushRoutes.use('*', requireRole('admin', 'super_admin'));

// Batas push per broadcast — Workers membatasi subrequest per invocation.
// Untuk audiens lebih besar, perlu fan-out via queue (TODO bila skala bertambah).
const PUSH_CAP = 800;

type Segment = 'all' | 'paid' | 'free';

function segmentClause(segment: Segment): string {
  const activeMembership =
    `EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = u.id AND m.status = 'active' ` +
    `AND (m.expires_at IS NULL OR m.expires_at > datetime('now')))`;
  if (segment === 'paid') return `u.status = 'active' AND ${activeMembership}`;
  if (segment === 'free') return `u.status = 'active' AND NOT ${activeMembership}`;
  return `u.status = 'active'`;
}

// ─── GET /api/admin/push/stats ──────────────────────────────────────────────
adminPushRoutes.get('/stats', async (c) => {
  try {
    const row = await c.env.DB.prepare(
      `SELECT COUNT(*) as subs, COUNT(DISTINCT user_id) as users FROM push_subscriptions`
    ).first();
    return success(c, {
      subscriptions: Number(row?.subs || 0),
      users: Number(row?.users || 0),
      push_enabled: !!c.env.VAPID_PUBLIC_KEY,
      push_cap: PUSH_CAP,
    });
  } catch (err) {
    console.error('[admin:push/stats]', err);
    return error(c, 'Gagal memuat statistik push', 500);
  }
});

// ─── POST /api/admin/push/broadcast ─────────────────────────────────────────
// Tulis notifikasi in-app ke semua user di segmen (1 statement) + kirim web push
// ke subscriber di segmen (dibatasi PUSH_CAP). Push diproses di background.
adminPushRoutes.post('/broadcast', async (c) => {
  try {
    const body = await c.req.json().catch(() => null) as {
      title?: string; body?: string; url?: string; segment?: Segment;
    } | null;

    const title = (body?.title || '').trim();
    const text = (body?.body || '').trim();
    const url = (body?.url || '/dashboard').trim();
    const segment: Segment = (['all', 'paid', 'free'].includes(body?.segment as string) ? body!.segment : 'all') as Segment;
    if (!title || !text) return error(c, 'Judul dan isi wajib diisi', 400);

    const where = segmentClause(segment);
    const now = new Date().toISOString();
    const dataJson = JSON.stringify({ url, broadcast: true });

    // In-app untuk SEMUA user di segmen (termasuk yang belum aktifkan push).
    const inApp = await c.env.DB.prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, data_json, status, sent_at, created_at)
       SELECT lower(hex(randomblob(16))), u.id, 'broadcast', ?, ?, ?, 'sent', ?, ?
       FROM users u WHERE ${where}`
    ).bind(title, text, dataJson, now, now).run();
    const inAppCount = inApp.meta?.changes || 0;

    // Audiens push: subscriber di segmen (dibatasi).
    const subs = await c.env.DB.prepare(
      `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth
       FROM push_subscriptions ps JOIN users u ON u.id = ps.user_id
       WHERE ${where}
       LIMIT ${PUSH_CAP + 1}`
    ).bind().all();
    const subRows = (subs.results || []) as any[];
    const capHit = subRows.length > PUSH_CAP;
    const toSend = subRows.slice(0, PUSH_CAP);

    // Kirim push di background agar respons admin cepat.
    c.executionCtx.waitUntil((async () => {
      for (const s of toSend) {
        const rec: PushSubscriptionRecord = { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth };
        const res = await sendWebPush(c.env, rec, { title, body: text, url, tag: 'broadcast' });
        if (res.gone) {
          await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(s.id).run().catch(() => {});
        }
      }
      console.log(`[admin:push/broadcast] sent ${toSend.length} push (segment=${segment}, capHit=${capHit})`);
    })());

    return success(c, {
      in_app_notified: inAppCount,
      push_audience: toSend.length,
      cap_hit: capHit,
      segment,
    });
  } catch (err) {
    console.error('[admin:push/broadcast]', err);
    return error(c, 'Gagal mengirim broadcast', 500);
  }
});

export default adminPushRoutes;
