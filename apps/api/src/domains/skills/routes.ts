import { Hono } from 'hono';
import type { Env } from '../../env';
import { success, error } from '../../lib/response';
import { kvGetOrSet } from '../../lib/cache';

const skillsRoutes = new Hono<{ Bindings: Env }>();

// ─── GET /api/skills ───────────
// Active skills + published content counts (untuk skill grid di /explore)
skillsRoutes.get('/', async (c) => {
  try {
    const data = await kvGetOrSet(c.env, 'skills:list', 600, async () => {
      const rows = await c.env.DB.prepare(
        `SELECT s.id, s.slug, s.name, s.description, s.icon, s.sort_order,
                (SELECT COUNT(*) FROM content_skills cs
                 JOIN content_items ci ON ci.id = cs.content_id AND ci.status = 'published'
                 WHERE cs.skill_id = s.id) AS content_count
         FROM skills s
         WHERE s.is_active = 1
         ORDER BY s.sort_order ASC, s.name ASC`
      ).all();
      return rows.results;
    });
    return success(c, data);
  } catch (err) {
    console.error('[skills:list]', err);
    return error(c, 'Gagal memuat daftar skill', 500);
  }
});

// ─── GET /api/skills/:slug ───────────
// Skill landing: detail + konten (optional ?format=) + featured paths
skillsRoutes.get('/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');
    const format = c.req.query('format');

    const cacheKey = `skills:detail:${slug}:${format || 'all'}`;
    const data = await kvGetOrSet(c.env, cacheKey, 600, async () => {
      const skill = await c.env.DB.prepare(
        'SELECT id, slug, name, description, icon FROM skills WHERE slug = ? AND is_active = 1'
      ).bind(slug).first();
      if (!skill) return null;

      let itemsQuery = `
        SELECT ci.id, ci.content_type, ci.ref_id, ci.slug, ci.title, ci.description,
               ci.thumbnail_url, ci.format, ci.level, ci.access_type, ci.price,
               ci.is_featured, cs.is_primary
        FROM content_skills cs
        JOIN content_items ci ON ci.id = cs.content_id
        WHERE cs.skill_id = ? AND ci.status = 'published'`;
      const params: unknown[] = [skill.id];
      if (format) {
        itemsQuery += ' AND ci.format = ?';
        params.push(format);
      }
      itemsQuery += ' ORDER BY cs.is_primary DESC, ci.priority_score DESC, ci.published_at DESC';

      const items = await c.env.DB.prepare(itemsQuery).bind(...params).all();

      const paths = await c.env.DB.prepare(
        `SELECT lp.id, lp.slug, lp.title, lp.subtitle, lp.thumbnail_url, lp.level, lp.is_featured,
                (SELECT COUNT(*) FROM learning_path_items lpi WHERE lpi.path_id = lp.id) AS item_count
         FROM learning_path_skills lps
         JOIN learning_paths lp ON lp.id = lps.path_id AND lp.status = 'published'
         WHERE lps.skill_id = ?
         ORDER BY lp.is_featured DESC, lp.sort_order ASC`
      ).bind(skill.id).all();

      return { skill, items: items.results, featured_paths: paths.results };
    });

    if (!data) return error(c, 'Skill tidak ditemukan', 404);
    return success(c, data);
  } catch (err) {
    console.error('[skills:detail]', err);
    return error(c, 'Gagal memuat detail skill', 500);
  }
});

export default skillsRoutes;
