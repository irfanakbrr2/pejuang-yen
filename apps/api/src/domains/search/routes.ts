import { Hono } from 'hono';
import type { Env } from '../../env';
import { success, error } from '../../lib/response';

const searchRoutes = new Hono<{ Bindings: Env }>();

// ─── GET /api/search?q=&skill=&type=&limit= ───────────
// Global search across courses/bonuses/recordings/tools via the registry.
// LIKE over search_text (title + description + skill/tag names); ranked
// in-Worker. search_text is the drop-in FTS5 corpus if we upgrade later.
searchRoutes.get('/', async (c) => {
  try {
    const q = (c.req.query('q') || '').trim().toLowerCase();
    const skill = c.req.query('skill');
    const type = c.req.query('type');
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 50);

    if (q.length < 2) return success(c, { results: [], by_type: {} });

    const terms = q.split(/\s+/).filter(Boolean).slice(0, 6);

    let query = `
      SELECT ci.id, ci.content_type, ci.ref_id, ci.slug, ci.title, ci.description,
             ci.thumbnail_url, ci.format, ci.level, ci.access_type, ci.price,
             ci.priority_score, ci.is_featured
      FROM content_items ci
      WHERE ci.status = 'published'`;
    const params: unknown[] = [];

    for (const term of terms) {
      query += ' AND ci.search_text LIKE ?';
      params.push(`%${term}%`);
    }
    if (type) {
      query += ' AND ci.content_type = ?';
      params.push(type);
    }
    if (skill) {
      query += ` AND ci.id IN (
        SELECT cs.content_id FROM content_skills cs
        JOIN skills s ON s.id = cs.skill_id WHERE s.slug = ?)`;
      params.push(skill);
    }

    interface SearchRow extends Record<string, unknown> {
      content_type: string;
      title: string;
      description: string | null;
      priority_score: number;
      is_featured: number;
    }

    const rows = await c.env.DB.prepare(query).bind(...params).all<SearchRow>();

    const ranked = rows.results
      .map((r) => {
        const title = String(r.title || '').toLowerCase();
        const desc = String(r.description || '').toLowerCase();
        let rank = Number(r.priority_score) || 0;
        if (title.startsWith(q)) rank += 30;
        else if (title.includes(q)) rank += 20;
        else if (terms.every((t) => title.includes(t))) rank += 15;
        else if (desc.includes(q)) rank += 10;
        if (r.is_featured) rank += 5;
        return { ...r, rank };
      })
      .sort((a, b) => b.rank - a.rank)
      .slice(0, limit);

    const byType: Record<string, number> = {};
    for (const r of ranked) {
      const t = String(r.content_type);
      byType[t] = (byType[t] || 0) + 1;
    }

    return success(c, { results: ranked, by_type: byType });
  } catch (err) {
    console.error('[search]', err);
    return error(c, 'Gagal melakukan pencarian', 500);
  }
});

export default searchRoutes;
