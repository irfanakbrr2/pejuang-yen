import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error } from '../../lib/response';
import { invalidateDiscoveryCache } from '../../lib/content-sync';

const adminTagsRoutes = new Hono<{ Bindings: Env }>();
adminTagsRoutes.use('*', authMiddleware());
adminTagsRoutes.use('*', requireRole('admin', 'super_admin'));

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// GET /api/admin/tags — vocabulary + usage count (?q= untuk autocomplete)
adminTagsRoutes.get('/', async (c) => {
  const q = (c.req.query('q') || '').trim().toLowerCase();
  let query = `
    SELECT t.*, (SELECT COUNT(*) FROM content_tags ct WHERE ct.tag_id = t.id) AS usage_count
    FROM tags t`;
  const params: unknown[] = [];
  if (q) {
    query += ' WHERE lower(t.name) LIKE ?';
    params.push(`%${q}%`);
  }
  query += ' ORDER BY usage_count DESC, t.name ASC LIMIT 200';
  const rows = await c.env.DB.prepare(query).bind(...params).all();
  return success(c, rows.results);
});

// POST /api/admin/tags
adminTagsRoutes.post('/', async (c) => {
  const body = await c.req.json();
  if (!body.name || typeof body.name !== 'string') return error(c, 'Nama tag wajib diisi', 400);

  const name = body.name.trim();
  const slug = slugify(name);
  const existing = await c.env.DB.prepare('SELECT id FROM tags WHERE slug = ?').bind(slug).first();
  if (existing) return success(c, { id: existing.id, slug, existed: true });

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO tags (id, slug, name, created_at) VALUES (?, ?, ?, ?)'
  ).bind(id, slug, name, new Date().toISOString()).run();

  return success(c, { id, slug }, 201);
});

// PATCH /api/admin/tags/:id — rename
adminTagsRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  if (!body.name || typeof body.name !== 'string') return error(c, 'Nama tag wajib diisi', 400);

  const name = body.name.trim();
  const slug = slugify(name);
  const conflict = await c.env.DB.prepare('SELECT id FROM tags WHERE slug = ? AND id != ?').bind(slug, id).first();
  if (conflict) return error(c, 'Tag dengan nama ini sudah ada. Gunakan merge.', 409);

  await c.env.DB.prepare('UPDATE tags SET name = ?, slug = ? WHERE id = ?').bind(name, slug, id).run();
  await invalidateDiscoveryCache(c.env);
  return success(c, { id, slug });
});

// POST /api/admin/tags/:id/merge — gabungkan tag ini ke target lalu hapus
adminTagsRoutes.post('/:id/merge', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const targetId = body.target_tag_id;
  if (!targetId || targetId === id) return error(c, 'Target merge tidak valid', 400);

  const target = await c.env.DB.prepare('SELECT id FROM tags WHERE id = ?').bind(targetId).first();
  if (!target) return error(c, 'Tag target tidak ditemukan', 404);

  await c.env.DB.batch([
    // pindahkan assignment yang belum ada di target
    c.env.DB.prepare(
      `INSERT OR IGNORE INTO content_tags (content_id, tag_id, created_at)
       SELECT content_id, ?, created_at FROM content_tags WHERE tag_id = ?`
    ).bind(targetId, id),
    c.env.DB.prepare('DELETE FROM content_tags WHERE tag_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM tags WHERE id = ?').bind(id),
  ]);

  await invalidateDiscoveryCache(c.env);
  return success(c, { merged_into: targetId });
});

// DELETE /api/admin/tags/:id
adminTagsRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM content_tags WHERE tag_id = ?').bind(id),
    c.env.DB.prepare('DELETE FROM tags WHERE id = ?').bind(id),
  ]);
  await invalidateDiscoveryCache(c.env);
  return success(c, { message: 'Tag dihapus' });
});

export default adminTagsRoutes;
