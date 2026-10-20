import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware } from '../../middleware/auth';
import { rateLimit } from '../../middleware/rate-limit';
import { success, error } from '../../lib/response';
import { randomAffiliateToken } from '../../lib/affiliate-links';
import { normalizeUtmSet } from '@growwithai/shared';

const shortlinksRoutes = new Hono<{ Bindings: Env }>();

shortlinksRoutes.use('*', authMiddleware());

const SLUG_RE = /^[a-z0-9-]{3,50}$/;
const RESERVED_SLUGS = new Set(['api', 'l', 'w', 'p', 's', 'admin', 'app', 'www']);
const MAX_PER_USER = 20;

function isValidUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

async function generateUniqueSlug(db: D1Database): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const slug = randomAffiliateToken(8);
    const existing = await db
      .prepare('SELECT id FROM shortlinks WHERE slug = ? LIMIT 1')
      .bind(slug)
      .first();
    if (!existing) return slug;
  }
  throw new Error('Unable to generate unique slug');
}

// GET /api/shortlinks — list user's links
shortlinksRoutes.get('/', async (c) => {
  try {
    const user = c.get('user');
    const rows = await c.env.DB.prepare(
      `SELECT id, slug, destination_url, title, click_count, is_active, created_at,
              utm_source, utm_medium, utm_campaign, utm_content
       FROM shortlinks
       WHERE user_id = ?
       ORDER BY created_at DESC`
    ).bind(user.id).all();
    return success(c, rows.results);
  } catch (err) {
    console.error('[shortlinks:list]', err);
    return error(c, 'Gagal memuat shortlinks', 500);
  }
});

// POST /api/shortlinks — create new shortlink
shortlinksRoutes.post('/', rateLimit({
  max: 20,
  windowSec: 3600,
  keyFn: (c) => `shortlink:${c.get('user')?.id || c.req.header('cf-connecting-ip') || 'unknown'}`,
}), async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({})) as {
      slug?: string;
      destination_url?: string;
      title?: string;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
      promo_location?: string;
    };

    const destinationUrl = (body.destination_url || '').trim();
    if (!destinationUrl) return error(c, 'destination_url wajib diisi', 422);
    if (!isValidUrl(destinationUrl)) return error(c, 'URL tidak valid. Harus diawali https://', 422);

    // Tag promo dinormalkan ke bentuk KANONIK via normalizer shared (sumber kebenaran).
    // "Whatsapp komunitas" → source=whatsapp, medium=community (info medium yang
    // nyangkut di source dipindahkan otomatis). "Lokasi/Channel promo" → utm_content.
    const utm = normalizeUtmSet({
      source: body.utm_source,
      medium: body.utm_medium,
      campaign: body.utm_campaign,
      content: body.promo_location,
    });
    const utmSource = utm.utm_source;
    const utmMedium = utm.utm_medium;
    const utmCampaign = utm.utm_campaign;
    const utmContent = utm.utm_content;

    // Enforce per-user limit
    const countRow = await c.env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM shortlinks WHERE user_id = ?'
    ).bind(user.id).first() as { cnt: number };
    if ((countRow?.cnt ?? 0) >= MAX_PER_USER) {
      return error(c, `Batas maksimal ${MAX_PER_USER} shortlink per akun sudah tercapai`, 429);
    }

    // Resolve slug
    let slug: string;
    if (body.slug) {
      slug = body.slug.trim().toLowerCase();
      if (!SLUG_RE.test(slug)) return error(c, 'Slug hanya boleh huruf kecil, angka, dan tanda (-), panjang 3–50 karakter', 422);
      if (RESERVED_SLUGS.has(slug)) return error(c, 'Slug ini tidak bisa digunakan', 422);

      const taken = await c.env.DB
        .prepare('SELECT id FROM shortlinks WHERE slug = ? LIMIT 1')
        .bind(slug)
        .first();
      if (taken) return error(c, 'Slug sudah dipakai, coba yang lain', 409);
    } else {
      slug = await generateUniqueSlug(c.env.DB);
    }

    const title = body.title ? body.title.trim().slice(0, 100) : null;
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    try {
      await c.env.DB.prepare(
        `INSERT INTO shortlinks (id, user_id, slug, destination_url, title, click_count, is_active, created_at, updated_at,
                                 utm_source, utm_medium, utm_campaign, utm_content)
         VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?, ?, ?, ?, ?)`
      ).bind(id, user.id, slug, destinationUrl, title, now, now, utmSource, utmMedium, utmCampaign, utmContent).run();
    } catch (dbErr: any) {
      // UNIQUE constraint violation — race condition between check and insert
      if (String(dbErr?.message).includes('UNIQUE')) {
        return error(c, 'Slug sudah dipakai, coba yang lain', 409);
      }
      throw dbErr;
    }

    return success(c, {
      id, slug, destination_url: destinationUrl, title, click_count: 0, is_active: 1, created_at: now,
      utm_source: utmSource, utm_medium: utmMedium, utm_campaign: utmCampaign, utm_content: utmContent,
    }, 201);
  } catch (err) {
    console.error('[shortlinks:create]', err);
    return error(c, 'Gagal membuat shortlink', 500);
  }
});

// PATCH /api/shortlinks/:id — update title / destination_url / is_active
shortlinksRoutes.patch('/:id', async (c) => {
  try {
    const user = c.get('user');
    const { id } = c.req.param();

    const link = await c.env.DB.prepare(
      'SELECT id, user_id, utm_source, utm_medium, utm_campaign, utm_content FROM shortlinks WHERE id = ? LIMIT 1'
    ).bind(id).first() as {
      id: string; user_id: string;
      utm_source: string | null; utm_medium: string | null;
      utm_campaign: string | null; utm_content: string | null;
    } | null;

    if (!link) return error(c, 'Shortlink tidak ditemukan', 404);
    if (link.user_id !== user.id) return error(c, 'Shortlink tidak ditemukan', 404);

    const body = await c.req.json().catch(() => ({})) as {
      title?: string | null;
      destination_url?: string;
      is_active?: boolean;
      utm_source?: string | null;
      utm_medium?: string | null;
      utm_campaign?: string | null;
      promo_location?: string | null;
    };

    const updates: string[] = [];
    const binds: unknown[] = [];

    if ('title' in body) {
      updates.push('title = ?');
      binds.push(body.title ? body.title.trim().slice(0, 100) : null);
    }
    if ('destination_url' in body) {
      const url = (body.destination_url || '').trim();
      if (!isValidUrl(url)) return error(c, 'URL tidak valid', 422);
      updates.push('destination_url = ?');
      binds.push(url);
    }
    if ('is_active' in body) {
      updates.push('is_active = ?');
      binds.push(body.is_active ? 1 : 0);
    }
    // Tag promo: bila ada field UTM yang diubah, gabung dengan nilai tersimpan lalu
    // normalisasi ULANG seluruh set (agar split source→medium tetap konsisten).
    if ('utm_source' in body || 'utm_medium' in body || 'utm_campaign' in body || 'promo_location' in body) {
      const merged = normalizeUtmSet({
        source: 'utm_source' in body ? body.utm_source : link.utm_source,
        medium: 'utm_medium' in body ? body.utm_medium : link.utm_medium,
        campaign: 'utm_campaign' in body ? body.utm_campaign : link.utm_campaign,
        content: 'promo_location' in body ? body.promo_location : link.utm_content,
      });
      updates.push('utm_source = ?', 'utm_medium = ?', 'utm_campaign = ?', 'utm_content = ?');
      binds.push(merged.utm_source, merged.utm_medium, merged.utm_campaign, merged.utm_content);
    }

    if (updates.length === 0) return error(c, 'Tidak ada field yang diupdate', 422);

    const now = new Date().toISOString();
    updates.push('updated_at = ?');
    binds.push(now, id);

    await c.env.DB.prepare(
      `UPDATE shortlinks SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...binds).run();

    return success(c, { updated: true });
  } catch (err) {
    console.error('[shortlinks:update]', err);
    return error(c, 'Gagal mengupdate shortlink', 500);
  }
});

// DELETE /api/shortlinks/:id
shortlinksRoutes.delete('/:id', async (c) => {
  try {
    const user = c.get('user');
    const { id } = c.req.param();

    const link = await c.env.DB.prepare(
      'SELECT id, user_id FROM shortlinks WHERE id = ? LIMIT 1'
    ).bind(id).first() as { id: string; user_id: string } | null;

    if (!link) return error(c, 'Shortlink tidak ditemukan', 404);
    if (link.user_id !== user.id) return error(c, 'Shortlink tidak ditemukan', 404);

    await c.env.DB.prepare('DELETE FROM shortlinks WHERE id = ?').bind(id).run();

    return success(c, { deleted: true });
  } catch (err) {
    console.error('[shortlinks:delete]', err);
    return error(c, 'Gagal menghapus shortlink', 500);
  }
});

export default shortlinksRoutes;
