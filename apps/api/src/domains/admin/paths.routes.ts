import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error } from '../../lib/response';
import { invalidateDiscoveryCache } from '../../lib/content-sync';

const adminPathsRoutes = new Hono<{ Bindings: Env }>();
adminPathsRoutes.use('*', authMiddleware());
adminPathsRoutes.use('*', requireRole('admin', 'super_admin'));

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// GET /api/admin/paths
adminPathsRoutes.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT lp.*,
            (SELECT COUNT(*) FROM learning_path_items lpi WHERE lpi.path_id = lp.id) AS item_count
     FROM learning_paths lp
     ORDER BY lp.sort_order ASC, lp.created_at DESC`
  ).all();
  return success(c, rows.results);
});

// GET /api/admin/paths/:id — detail + items (termasuk konten draft/terhapus)
adminPathsRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const path = await c.env.DB.prepare('SELECT * FROM learning_paths WHERE id = ?').bind(id).first();
  if (!path) return error(c, 'Learning path tidak ditemukan', 404);

  const items = await c.env.DB.prepare(
    `SELECT lpi.id, lpi.content_id, lpi.section_label, lpi.sort_order, lpi.note,
            ci.content_type, ci.ref_id, ci.slug, ci.title, ci.thumbnail_url, ci.format,
            ci.status AS content_status,
            CASE WHEN ci.id IS NULL THEN 1 ELSE 0 END AS content_missing
     FROM learning_path_items lpi
     LEFT JOIN content_items ci ON ci.id = lpi.content_id
     WHERE lpi.path_id = ?
     ORDER BY lpi.sort_order ASC`
  ).bind(id).all();

  const skills = await c.env.DB.prepare(
    `SELECT s.id, s.slug, s.name FROM learning_path_skills lps
     JOIN skills s ON s.id = lps.skill_id WHERE lps.path_id = ?`
  ).bind(id).all();

  return success(c, { path, items: items.results, skills: skills.results });
});

// POST /api/admin/paths
adminPathsRoutes.post('/', async (c) => {
  const body = await c.req.json();
  if (!body.title || typeof body.title !== 'string') return error(c, 'Judul wajib diisi', 400);

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const slug = body.slug ? slugify(body.slug) : slugify(body.title);

  const existing = await c.env.DB.prepare('SELECT id FROM learning_paths WHERE slug = ?').bind(slug).first();
  if (existing) return error(c, 'Slug sudah dipakai', 409);

  await c.env.DB.prepare(
    `INSERT INTO learning_paths (id, slug, title, subtitle, description, thumbnail_url, level,
       status, is_featured, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, slug, body.title.trim(), body.subtitle || null, body.description || null,
    body.thumbnail_url || null, body.level || null, body.status || 'draft',
    body.is_featured ? 1 : 0, body.sort_order ?? 0, now, now
  ).run();

  await invalidateDiscoveryCache(c.env);
  return success(c, { id, slug }, 201);
});

// PUT /api/admin/paths/:id
adminPathsRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  const existing = await c.env.DB.prepare('SELECT id, slug FROM learning_paths WHERE id = ?').bind(id).first();
  if (!existing) return error(c, 'Learning path tidak ditemukan', 404);

  const allowed = ['slug', 'title', 'subtitle', 'description', 'thumbnail_url', 'level', 'status', 'is_featured', 'sort_order'];
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (key in body) {
      fields.push(`${key} = ?`);
      values.push(key === 'slug' ? slugify(String(body[key])) : body[key] ?? null);
    }
  }
  if (fields.length === 0) return error(c, 'Tidak ada field untuk diupdate', 400);
  fields.push('updated_at = ?');
  values.push(new Date().toISOString(), id);

  await c.env.DB.prepare(`UPDATE learning_paths SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
  await invalidateDiscoveryCache(c.env);
  return success(c, { id });
});

// DELETE /api/admin/paths/:id
adminPathsRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM learning_path_items WHERE path_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM learning_path_skills WHERE path_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM learning_paths WHERE id = ?').bind(id),
  ]);
  await invalidateDiscoveryCache(c.env);
  return success(c, { message: 'Learning path dihapus' });
});

// PUT /api/admin/paths/:id/skills — replace set skill
adminPathsRoutes.put('/:id/skills', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const skillIds: string[] = Array.isArray(body.skill_ids) ? body.skill_ids : [];

  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM learning_path_skills WHERE path_id = ?').bind(id),
    ...skillIds.map((skillId) =>
      c.env.DB.prepare('INSERT OR IGNORE INTO learning_path_skills (path_id, skill_id) VALUES (?, ?)').bind(id, skillId)
    ),
  ]);
  await invalidateDiscoveryCache(c.env);
  return success(c, { id, skill_ids: skillIds });
});

// POST /api/admin/paths/:id/items — append konten ke path
adminPathsRoutes.post('/:id/items', async (c) => {
  const pathId = c.req.param('id');
  const body = await c.req.json();
  if (!body.content_id) return error(c, 'content_id wajib diisi', 400);

  const content = await c.env.DB.prepare('SELECT id FROM content_items WHERE id = ?').bind(body.content_id).first();
  if (!content) return error(c, 'Konten tidak ditemukan di registry', 404);

  const dup = await c.env.DB.prepare(
    'SELECT id FROM learning_path_items WHERE path_id = ? AND content_id = ?'
  ).bind(pathId, body.content_id).first();
  if (dup) return error(c, 'Konten sudah ada di path ini', 409);

  const maxRow = await c.env.DB.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM learning_path_items WHERE path_id = ?'
  ).bind(pathId).first<{ max_order: number }>();

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO learning_path_items (id, path_id, content_id, section_label, sort_order, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, pathId, body.content_id, body.section_label || null,
    (maxRow?.max_order ?? -1) + 1, body.note || null, new Date().toISOString()
  ).run();

  await invalidateDiscoveryCache(c.env);
  return success(c, { id }, 201);
});

// PATCH /api/admin/paths/:id/items/reorder — body: { item_ids: string[] }
adminPathsRoutes.patch('/:id/items/reorder', async (c) => {
  const pathId = c.req.param('id');
  const body = await c.req.json();
  const itemIds: string[] = Array.isArray(body.item_ids) ? body.item_ids : [];
  if (itemIds.length === 0) return error(c, 'item_ids wajib diisi', 400);

  await c.env.DB.batch(
    itemIds.map((itemId, index) =>
      c.env.DB.prepare(
        'UPDATE learning_path_items SET sort_order = ? WHERE id = ? AND path_id = ?'
      ).bind(index, itemId, pathId)
    )
  );
  await invalidateDiscoveryCache(c.env);
  return success(c, { message: 'Urutan disimpan' });
});

// PATCH /api/admin/paths/:id/items/:itemId — edit section_label / note
adminPathsRoutes.patch('/:id/items/:itemId', async (c) => {
  const pathId = c.req.param('id');
  const itemId = c.req.param('itemId');
  const body = await c.req.json();

  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key of ['section_label', 'note']) {
    if (key in body) {
      fields.push(`${key} = ?`);
      values.push(body[key] ?? null);
    }
  }
  if (fields.length === 0) return error(c, 'Tidak ada field untuk diupdate', 400);
  values.push(itemId, pathId);

  await c.env.DB.prepare(
    `UPDATE learning_path_items SET ${fields.join(', ')} WHERE id = ? AND path_id = ?`
  ).bind(...values).run();
  await invalidateDiscoveryCache(c.env);
  return success(c, { id: itemId });
});

// DELETE /api/admin/paths/:id/items/:itemId
adminPathsRoutes.delete('/:id/items/:itemId', async (c) => {
  const pathId = c.req.param('id');
  const itemId = c.req.param('itemId');
  await c.env.DB.prepare(
    'DELETE FROM learning_path_items WHERE id = ? AND path_id = ?'
  ).bind(itemId, pathId).run();
  await invalidateDiscoveryCache(c.env);
  return success(c, { message: 'Item dihapus' });
});

export default adminPathsRoutes;
