import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error } from '../../lib/response';
import { invalidateDiscoveryCache } from '../../lib/content-sync';

const adminSkillsRoutes = new Hono<{ Bindings: Env }>();
adminSkillsRoutes.use('*', authMiddleware());
adminSkillsRoutes.use('*', requireRole('admin', 'super_admin'));

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// GET /api/admin/skills — semua skill (termasuk nonaktif) + jumlah konten
adminSkillsRoutes.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT s.*,
            (SELECT COUNT(*) FROM content_skills cs WHERE cs.skill_id = s.id) AS content_count
     FROM skills s
     ORDER BY s.sort_order ASC, s.name ASC`
  ).all();
  return success(c, rows.results);
});

// POST /api/admin/skills
adminSkillsRoutes.post('/', async (c) => {
  const body = await c.req.json();
  if (!body.name || typeof body.name !== 'string') return error(c, 'Nama skill wajib diisi', 400);

  const slug = body.slug ? slugify(body.slug) : slugify(body.name);
  const id = body.id || `skill_${slug.replace(/-/g, '_')}`;

  const existing = await c.env.DB.prepare('SELECT id FROM skills WHERE slug = ? OR id = ?').bind(slug, id).first();
  if (existing) return error(c, 'Skill dengan slug ini sudah ada', 409);

  await c.env.DB.prepare(
    `INSERT INTO skills (id, slug, name, description, icon, sort_order, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
  ).bind(
    id, slug, body.name.trim(), body.description || null, body.icon || null,
    body.sort_order ?? 0, new Date().toISOString()
  ).run();

  await invalidateDiscoveryCache(c.env);
  return success(c, { id, slug }, 201);
});

// PATCH /api/admin/skills/:id
adminSkillsRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  const existing = await c.env.DB.prepare('SELECT id FROM skills WHERE id = ?').bind(id).first();
  if (!existing) return error(c, 'Skill tidak ditemukan', 404);

  const allowed = ['slug', 'name', 'description', 'icon', 'sort_order', 'is_active'];
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (key in body) {
      fields.push(`${key} = ?`);
      values.push(key === 'slug' ? slugify(String(body[key])) : body[key] ?? null);
    }
  }
  if (fields.length === 0) return error(c, 'Tidak ada field untuk diupdate', 400);
  values.push(id);

  await c.env.DB.prepare(`UPDATE skills SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
  await invalidateDiscoveryCache(c.env);
  return success(c, { id });
});

// DELETE /api/admin/skills/:id — diblok kalau masih ada konten yang memakai
adminSkillsRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const used = await c.env.DB.prepare(
    'SELECT COUNT(*) AS n FROM content_skills WHERE skill_id = ?'
  ).bind(id).first<{ n: number }>();
  if ((used?.n ?? 0) > 0) {
    return error(c, 'Masih ada konten dengan skill ini. Pindahkan kontennya dulu.', 400);
  }
  await c.env.DB.prepare('DELETE FROM learning_path_skills WHERE skill_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM skills WHERE id = ?').bind(id).run();
  await invalidateDiscoveryCache(c.env);
  return success(c, { message: 'Skill dihapus' });
});

export default adminSkillsRoutes;
