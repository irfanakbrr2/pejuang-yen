import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error } from '../../lib/response';

const adminModulesRoutes = new Hono<{ Bindings: Env }>();
adminModulesRoutes.use('*', authMiddleware());
adminModulesRoutes.use('*', requireRole('admin', 'super_admin'));

// GET /api/admin/modules?course_id=xxx
adminModulesRoutes.get('/', async (c) => {
  const courseId = c.req.query('course_id');
  if (!courseId) return error(c, 'course_id is required', 400);

  const rows = await c.env.DB.prepare(
    'SELECT * FROM course_modules WHERE course_id = ? ORDER BY sort_order ASC'
  ).bind(courseId).all();

  return success(c, rows.results);
});

// POST /api/admin/modules
adminModulesRoutes.post('/', async (c) => {
  const body = await c.req.json() as { course_id: string; title: string; description?: string; sort_order?: number };
  const { course_id, title, description, sort_order = 0 } = body;

  if (!course_id || !title) return error(c, 'course_id and title are required', 400);

  const course = await c.env.DB.prepare('SELECT id FROM courses WHERE id = ?').bind(course_id).first();
  if (!course) return error(c, 'Course not found', 404);

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await c.env.DB.prepare(
    `INSERT INTO course_modules (id, course_id, title, description, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, course_id, title, description || null, sort_order, now, now).run();

  return success(c, { id, course_id, title, description, sort_order }, 201);
});

// PUT /api/admin/modules/:id
adminModulesRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json() as { title?: string; description?: string; sort_order?: number };

  const existing = await c.env.DB.prepare('SELECT id FROM course_modules WHERE id = ?').bind(id).first();
  if (!existing) return error(c, 'Module not found', 404);

  const now = new Date().toISOString();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (body.title !== undefined) { fields.push('title = ?'); values.push(body.title); }
  if (body.description !== undefined) { fields.push('description = ?'); values.push(body.description); }
  if (body.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(body.sort_order); }

  if (fields.length === 0) return error(c, 'No fields to update', 400);

  fields.push('updated_at = ?');
  values.push(now, id);

  await c.env.DB.prepare(`UPDATE course_modules SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();

  return success(c, { message: 'Module updated' });
});

// DELETE /api/admin/modules/:id
adminModulesRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');

  const existing = await c.env.DB.prepare('SELECT id FROM course_modules WHERE id = ?').bind(id).first();
  if (!existing) return error(c, 'Module not found', 404);

  await c.env.DB.prepare(
    `DELETE FROM lesson_progress WHERE lesson_id IN (SELECT id FROM lessons WHERE module_id = ?)`
  ).bind(id).run();
  await c.env.DB.prepare('DELETE FROM lessons WHERE module_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM course_modules WHERE id = ?').bind(id).run();

  return success(c, { message: 'Module deleted' });
});

export default adminModulesRoutes;
