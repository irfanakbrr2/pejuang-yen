import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error } from '../../lib/response';
import { rebuildSearchText, resyncAll, invalidateDiscoveryCache } from '../../lib/content-sync';

const adminContentRoutes = new Hono<{ Bindings: Env }>();
adminContentRoutes.use('*', authMiddleware());
adminContentRoutes.use('*', requireRole('admin', 'super_admin'));

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// GET /api/admin/content?q=&type= — registry search (termasuk draft),
// dipakai content-picker di Learning Path builder
adminContentRoutes.get('/', async (c) => {
  const q = (c.req.query('q') || '').trim().toLowerCase();
  const type = c.req.query('type');
  const limit = Math.min(parseInt(c.req.query('limit') || '30', 10), 100);

  let query = `
    SELECT ci.id, ci.content_type, ci.ref_id, ci.slug, ci.title, ci.thumbnail_url,
           ci.format, ci.level, ci.access_type, ci.status
    FROM content_items ci
    WHERE ci.status != 'archived'`;
  const params: unknown[] = [];
  if (type) {
    query += ' AND ci.content_type = ?';
    params.push(type);
  }
  if (q) {
    query += ' AND (lower(ci.title) LIKE ? OR ci.search_text LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }
  query += ' ORDER BY ci.status ASC, ci.priority_score DESC, ci.created_at DESC LIMIT ?';
  params.push(limit);

  const rows = await c.env.DB.prepare(query).bind(...params).all();
  return success(c, rows.results);
});

// GET /api/admin/content/:contentId/taxonomy — skill + tag assignment saat ini
adminContentRoutes.get('/:contentId/taxonomy', async (c) => {
  const contentId = c.req.param('contentId');
  const [skills, tags] = await Promise.all([
    c.env.DB.prepare(
      `SELECT s.id, s.slug, s.name, cs.is_primary FROM content_skills cs
       JOIN skills s ON s.id = cs.skill_id WHERE cs.content_id = ?`
    ).bind(contentId).all(),
    c.env.DB.prepare(
      `SELECT t.id, t.slug, t.name FROM content_tags ct
       JOIN tags t ON t.id = ct.tag_id WHERE ct.content_id = ?`
    ).bind(contentId).all(),
  ]);
  return success(c, { skills: skills.results, tags: tags.results });
});

// PUT /api/admin/content/:contentId/skills — replace set skill
// body: { skill_ids: string[], primary_skill_id?: string }
adminContentRoutes.put('/:contentId/skills', async (c) => {
  const contentId = c.req.param('contentId');
  const body = await c.req.json();
  const skillIds: string[] = Array.isArray(body.skill_ids) ? body.skill_ids : [];
  const primaryId: string | null = body.primary_skill_id || skillIds[0] || null;

  const item = await c.env.DB.prepare('SELECT id FROM content_items WHERE id = ?').bind(contentId).first();
  if (!item) return error(c, 'Konten tidak ditemukan di registry', 404);

  const now = new Date().toISOString();
  const statements = [
    c.env.DB.prepare('DELETE FROM content_skills WHERE content_id = ?').bind(contentId),
    ...skillIds.map((skillId) =>
      c.env.DB.prepare(
        'INSERT OR IGNORE INTO content_skills (content_id, skill_id, is_primary, created_at) VALUES (?, ?, ?, ?)'
      ).bind(contentId, skillId, skillId === primaryId ? 1 : 0, now)
    ),
  ];
  await c.env.DB.batch(statements);

  await rebuildSearchText(c.env.DB, contentId);
  await invalidateDiscoveryCache(c.env);
  return success(c, { content_id: contentId, skill_ids: skillIds });
});

// PUT /api/admin/content/:contentId/tags — replace set tag
// body: { tag_names: string[] } — tag baru dibuat otomatis
adminContentRoutes.put('/:contentId/tags', async (c) => {
  const contentId = c.req.param('contentId');
  const body = await c.req.json();
  const tagNames: string[] = Array.isArray(body.tag_names) ? body.tag_names : [];

  const item = await c.env.DB.prepare('SELECT id FROM content_items WHERE id = ?').bind(contentId).first();
  if (!item) return error(c, 'Konten tidak ditemukan di registry', 404);

  const now = new Date().toISOString();
  const tagIds: string[] = [];
  for (const rawName of tagNames.slice(0, 20)) {
    const name = String(rawName).trim();
    if (!name) continue;
    const slug = slugify(name);
    const existing = await c.env.DB.prepare('SELECT id FROM tags WHERE slug = ?').bind(slug).first<{ id: string }>();
    if (existing) {
      tagIds.push(existing.id);
    } else {
      const id = crypto.randomUUID();
      await c.env.DB.prepare('INSERT INTO tags (id, slug, name, created_at) VALUES (?, ?, ?, ?)')
        .bind(id, slug, name, now).run();
      tagIds.push(id);
    }
  }

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM content_tags WHERE content_id = ?').bind(contentId),
    ...tagIds.map((tagId) =>
      c.env.DB.prepare(
        'INSERT OR IGNORE INTO content_tags (content_id, tag_id, created_at) VALUES (?, ?, ?)'
      ).bind(contentId, tagId, now)
    ),
  ]);

  await rebuildSearchText(c.env.DB, contentId);
  await invalidateDiscoveryCache(c.env);
  return success(c, { content_id: contentId, tag_ids: tagIds });
});

// POST /api/admin/content/resync — full rebuild registry (safety hatch)
adminContentRoutes.post('/resync', async (c) => {
  const result = await resyncAll(c.env.DB);
  await invalidateDiscoveryCache(c.env);
  return success(c, result);
});

export default adminContentRoutes;
