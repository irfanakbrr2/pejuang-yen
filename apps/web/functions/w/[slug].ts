import { safeParam } from "../_affiliate-redirect";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function onRequest(context: any) {
  const shortCode = safeParam(context.params.slug);
  if (!shortCode) return new Response('Not Found', { status: 404 });

  try {
    const db = context.env.DB;
    const shortlink = await db.prepare(
      `SELECT id, destination_url FROM shortlinks WHERE slug = ? AND is_active = 1 LIMIT 1`
    ).bind(shortCode).first();

    if (!shortlink) {
      return new Response('Link not found', { status: 404 });
    }

    const clickId = crypto.randomUUID();
    const now = new Date().toISOString();
    const headers = context.request.headers;
    const ip = headers.get('cf-connecting-ip') || headers.get('x-forwarded-for') || '';
    const userAgent = headers.get('user-agent') || '';
    const referer = headers.get('referer') || '';

    // Record click async via context.waitUntil
    context.waitUntil(
      db.batch([
        db.prepare(
          `INSERT INTO shortlink_clicks (id, shortlink_id, click_id, ip_address, user_agent, referer, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(crypto.randomUUID(), shortlink.id, clickId, ip, userAgent, referer, now),
        db.prepare(
          `UPDATE shortlinks SET click_count = click_count + 1, updated_at = ? WHERE id = ?`
        ).bind(now, shortlink.id)
      ]).catch((err: any) => console.error('[shortlinks] click tracking failed:', err))
    );

    const baseUrl = shortlink.destination_url;
    const urlObj = new URL(baseUrl);
    urlObj.searchParams.set('click_id', clickId);
    const redirectUrl = urlObj.toString();
    const response = Response.redirect(redirectUrl, 302);
    
    // We still set it here just in case, but cross-domain might ignore it.
    response.headers.set(
      'Set-Cookie', 
      `webinar_click_id=${clickId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000` // 30 days
    );

    return response;
  } catch (err) {
    console.error('[shortlinks] error:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
