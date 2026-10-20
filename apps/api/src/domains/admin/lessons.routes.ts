import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { success, error } from '../../lib/response';
import { normalizeLessonPayload, validatePublishedLesson } from './lesson-utils';
import { reorderLessonsSchema } from '@growwithai/shared';

const adminLessonsRoutes = new Hono<{ Bindings: Env }>();
adminLessonsRoutes.use('*', authMiddleware());
adminLessonsRoutes.use('*', requireRole('admin', 'super_admin'));

// GET /api/admin/lessons?course_id=xxx&module_id=xxx
adminLessonsRoutes.get('/', async (c) => {
  const courseId = c.req.query('course_id');
  const moduleId = c.req.query('module_id');

  if (!courseId) return error(c, 'course_id is required', 400);

  let query = 'SELECT * FROM lessons WHERE course_id = ?';
  const params: unknown[] = [courseId];

  if (moduleId) { query += ' AND module_id = ?'; params.push(moduleId); }

  query += ' ORDER BY sort_order ASC';

  const rows = await c.env.DB.prepare(query).bind(...params).all();
  return success(c, rows.results);
});

// POST /api/admin/lessons
adminLessonsRoutes.post('/', async (c) => {
  const body = await c.req.json() as {
    course_id: string;
    module_id: string;
    title: string;
    slug: string;
    lesson_type?: string;
    video_provider?: string;
    video_url?: string;
    content_markdown?: string;
    content_html?: string;
    content_embed?: string;
    content_format?: string;
    description?: string;
    resources_json?: string;
    is_preview?: boolean;
    sort_order?: number;
    status?: string;
  };

  const normalized = normalizeLessonPayload(body);
  const { course_id, module_id, title, slug, lesson_type = 'video', video_provider, video_url, content_markdown, content_html, content_embed, content_format = 'html', description, resources_json, is_preview = false, sort_order = 0, status = 'draft' } = normalized;

  if (!course_id || !module_id || !title || !slug) {
    return error(c, 'course_id, module_id, title, and slug are required', 400);
  }

  const publishError = validatePublishedLesson({ lesson_type, video_url, content_html, resources_json, status });
  if (publishError) return error(c, publishError, 400);

  const slugConflict = await c.env.DB.prepare('SELECT id FROM lessons WHERE slug = ? AND course_id = ?').bind(slug, course_id).first();
  if (slugConflict) return error(c, 'Slug already exists in this course', 409);

  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await c.env.DB.prepare(
    `INSERT INTO lessons (id, course_id, module_id, title, slug, lesson_type, video_provider, video_url,
      content_markdown, content_html, content_embed, content_format, description, resources_json, is_preview, sort_order, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, course_id, module_id, title, slug, lesson_type, video_provider || null, video_url || null,
    content_markdown || null, content_html || null, content_embed || null, content_format || 'html', description || null, resources_json || null,
    is_preview ? 1 : 0, sort_order, status, now, now).run();

  return success(c, { id, course_id, module_id, title, slug, lesson_type, status }, 201);
});

// PUT /api/admin/lessons/reorder — batch sort_order + module_id update
adminLessonsRoutes.put('/reorder', validate(reorderLessonsSchema), async (c) => {
  const body = c.get('validatedBody' as never) as { lessons: Array<{ id: string; module_id: string; sort_order: number }> };
  const { lessons } = body;

  const now = new Date().toISOString();
  const stmts = lessons.map(l =>
    c.env.DB.prepare('UPDATE lessons SET sort_order = ?, module_id = ?, updated_at = ? WHERE id = ?')
      .bind(l.sort_order, l.module_id, now, l.id)
  );
  await c.env.DB.batch(stmts);
  return success(c, { message: 'ok' });
});

// PUT /api/admin/lessons/:id
adminLessonsRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = normalizeLessonPayload(await c.req.json() as Record<string, unknown>);

  const existing = await c.env.DB.prepare('SELECT * FROM lessons WHERE id = ?').bind(id).first();
  if (!existing) return error(c, 'Lesson not found', 404);

  const merged = { ...existing, ...body };
  const publishError = validatePublishedLesson(merged);
  if (publishError) return error(c, publishError, 400);

  const now = new Date().toISOString();
  const allowed = ['title', 'slug', 'lesson_type', 'video_provider', 'video_url', 'content_markdown', 'content_html', 'content_embed', 'content_format', 'description', 'resources_json', 'is_preview', 'sort_order', 'status'];
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const key of allowed) {
    if (key in body) {
      fields.push(`${key} = ?`);
      values.push(key === 'is_preview' ? (body[key] ? 1 : 0) : body[key]);
    }
  }

  if (fields.length === 0) return error(c, 'No fields to update', 400);

  fields.push('updated_at = ?');
  values.push(now, id);

  await c.env.DB.prepare(`UPDATE lessons SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();

  return success(c, { message: 'Lesson updated' });
});

// POST /api/admin/lessons/:id/publish
adminLessonsRoutes.post('/:id/publish', async (c) => {
  const id = c.req.param('id');
  const now = new Date().toISOString();

  const existing = await c.env.DB.prepare(
    'SELECT id, lesson_type, video_url, content_html, resources_json, status FROM lessons WHERE id = ?'
  ).bind(id).first();
  if (!existing) return error(c, 'Lesson not found', 404);

  const publishError = validatePublishedLesson({ ...existing, status: 'published' });
  if (publishError) return error(c, publishError, 400);

  await c.env.DB.prepare("UPDATE lessons SET status = 'published', updated_at = ? WHERE id = ?").bind(now, id).run();
  return success(c, { message: 'Lesson published' });
});

// DELETE /api/admin/lessons/:id
adminLessonsRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');

  const existing = await c.env.DB.prepare('SELECT id FROM lessons WHERE id = ?').bind(id).first();
  if (!existing) return error(c, 'Lesson not found', 404);

  await c.env.DB.prepare('DELETE FROM lesson_progress WHERE lesson_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM lessons WHERE id = ?').bind(id).run();

  return success(c, { message: 'Lesson deleted' });
});

export default adminLessonsRoutes;
