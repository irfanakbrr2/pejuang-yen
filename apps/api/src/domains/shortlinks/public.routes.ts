import { Hono } from 'hono';
import type { Env } from '../../env';
import { success, error } from '../../lib/response';
import { normalizeUtmSet } from '@growwithai/shared';

const publicShortlinksRoutes = new Hono<{ Bindings: Env }>();

// GET /api/public/shortlinks/resolve/:slug
// Called by the pejuangyen.link/l/[slug] Pages Function to resolve a shortlink.
// Increments click_count and logs the visit.
publicShortlinksRoutes.get('/resolve/:slug', async (c) => {
  try {
    const slug = (c.req.param('slug') || '').trim().toLowerCase();
    if (!slug) return error(c, 'Slug required', 400);

    const link = await c.env.DB.prepare(
      `SELECT id, destination_url, utm_source, utm_medium, utm_campaign, utm_content
       FROM shortlinks WHERE slug = ? AND is_active = 1 LIMIT 1`
    ).bind(slug).first() as {
      id: string;
      destination_url: string;
      utm_source: string | null;
      utm_medium: string | null;
      utm_campaign: string | null;
      utm_content: string | null;
    } | null;

    if (!link) return error(c, 'Shortlink tidak ditemukan', 404);

    // Append tag promo (utm_*) ke URL tujuan TANPA menimpa param yang sudah ada di
    // destination. utm_content = "Lokasi/Channel promo". utm ikut ke tujuan →
    // tertangkap pipeline atribusi (cookie gwa_utm → user_attribution).
    let destinationUrl: string;
    try {
      const destination = new URL(link.destination_url);
      if (destination.protocol !== 'https:') return error(c, 'Shortlink tidak aktif', 404);
      // Normalisasi UTM tersimpan saat resolve → shortlink LAMA yang masih kotor
      // tetap keluar KANONIK (mis. "Whatsapp komunitas" → whatsapp + community).
      const canon = normalizeUtmSet({
        source: link.utm_source,
        medium: link.utm_medium,
        campaign: link.utm_campaign,
        content: link.utm_content,
      });
      const tags: Record<string, string | null> = {
        utm_source: canon.utm_source,
        utm_medium: canon.utm_medium,
        utm_campaign: canon.utm_campaign,
        utm_content: canon.utm_content,
      };
      for (const [key, value] of Object.entries(tags)) {
        if (value && !destination.searchParams.has(key)) destination.searchParams.set(key, value);
      }
      destinationUrl = destination.toString();
    } catch {
      return error(c, 'Shortlink tidak aktif', 404);
    }

    const now = new Date().toISOString();
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || '';
    const ua = c.req.header('user-agent') || '';
    const referer = c.req.header('referer') || null;

    const encoder = new TextEncoder();
    const ipHash = ip
      ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(ip))))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')
          .slice(0, 16)
      : null;
    const uaHash = ua
      ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(ua))))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')
          .slice(0, 16)
      : null;

    // Fire-and-forget: increment counter + log click (don't block redirect on failure)
    c.executionCtx.waitUntil(
      Promise.all([
        c.env.DB.prepare('UPDATE shortlinks SET click_count = click_count + 1, updated_at = ? WHERE id = ?')
          .bind(now, link.id).run(),
        c.env.DB.prepare(
          `INSERT INTO shortlink_clicks (id, shortlink_id, ip_hash, user_agent_hash, referer_url, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(crypto.randomUUID(), link.id, ipHash, uaHash, referer, now).run(),
      ]).catch(err => console.error('[shortlinks:resolve:click-log]', err))
    );

    return success(c, { destination_url: destinationUrl });
  } catch (err) {
    console.error('[shortlinks:resolve]', err);
    return error(c, 'Gagal resolve shortlink', 500);
  }
});

export default publicShortlinksRoutes;
