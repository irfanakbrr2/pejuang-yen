import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../../env';
import { success, error } from '../../lib/response';

const publicWebinarsRoutes = new Hono<{ Bindings: Env }>();

/**
 * Edge cache untuk GET publik via Cache API (per data center). Saat ribuan user
 * membuka link webinar serentak, hanya request pertama di tiap colo yang
 * menyentuh D1; sisanya dilayani dari cache. Social-proof (registered_count)
 * boleh tertinggal beberapa detik — itu trade-off yang disengaja.
 *
 * Mengembalikan respons cache bila hit; jika miss, jalankan `build()` lalu
 * simpan hasilnya ke cache. `build()` mengembalikan Response (mis. dari success()).
 */
async function withEdgeCache(
  c: Context<{ Bindings: Env }>,
  build: () => Promise<Response>
): Promise<Response> {
  const cache = caches.default;
  const cacheKey = new Request(new URL(c.req.url).toString(), { method: 'GET' });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const res = await build();
  // Hanya cache respons sukses (200). Cache API menghormati Cache-Control max-age.
  if (res.status === 200) {
    c.executionCtx.waitUntil(cache.put(cacheKey, res.clone()));
  }
  return res;
}

const publicColumns = `
  id, slug, title, subtitle, body_html, thumbnail_url, host_name,
  starts_at, ends_at, timezone, capacity,
  (SELECT COUNT(*) FROM webinar_registrations wr WHERE wr.webinar_id = webinars.id AND wr.status = 'registered') as registered_count,
  (SELECT json_group_array(json_object('avatar_url', u.avatar_url, 'badges_json', u.badges_json, 'seed', u.id))
   FROM (
     SELECT us.avatar_url, us.badges_json, us.id
     FROM webinar_registrations wr
     JOIN users us ON wr.user_id = us.id
     WHERE wr.webinar_id = webinars.id AND wr.status = 'registered'
     ORDER BY wr.registered_at DESC LIMIT 3
   ) u) as participants_preview,
  CASE WHEN replay_status = 'public' THEN recording_url ELSE NULL END as recording_url,
  CASE WHEN replay_status = 'public' THEN recording_embed_url ELSE NULL END as recording_embed_url,
  CASE WHEN replay_status = 'public' THEN replay_body_html ELSE NULL END as replay_body_html,
  replay_status, form_template_key, seo_title, seo_description,
  status, sort_order, published_at, created_at, updated_at
`;

publicWebinarsRoutes.get('/', async (c) => {
  return withEdgeCache(c, async () => {
    try {
      const rows = await c.env.DB.prepare(
        `SELECT ${publicColumns}
         FROM webinars
         WHERE status = 'published'
         ORDER BY sort_order ASC, starts_at DESC`
      ).all();

      const formattedResults = rows.results.map((row: any) => ({
        ...row,
        participants_preview: JSON.parse(row.participants_preview || '[]')
      }));

      c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return success(c, formattedResults);
    } catch (err) {
      console.error('[public:webinars:list]', err);
      return error(c, 'Gagal memuat webinar', 500);
    }
  });
});

publicWebinarsRoutes.get('/:slug', async (c) => {
  return withEdgeCache(c, async () => {
    try {
      const slug = c.req.param('slug');
      const webinar = await c.env.DB.prepare(
        `SELECT ${publicColumns}
         FROM webinars
         WHERE slug = ? AND status = 'published'
         LIMIT 1`
      ).bind(slug).first() as any;

      if (!webinar) return error(c, 'Webinar not found', 404);

      webinar.participants_preview = JSON.parse(webinar.participants_preview || '[]');

      c.header('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
      return success(c, webinar);
    } catch (err) {
      console.error('[public:webinars:detail]', err);
      return error(c, 'Gagal memuat webinar', 500);
    }
  });
});

export default publicWebinarsRoutes;
