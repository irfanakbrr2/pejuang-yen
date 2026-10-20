import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createCourseSchema, updateCourseSchema, createModuleSchema, updateModuleSchema, createLessonSchema, updateLessonSchema } from '@growwithai/shared';
import { success, error, paginated } from '../../lib/response';
import { invalidateCourseListCache, invalidateCourseDetailCache } from '../../lib/cache';
import { syncContentItem, invalidateDiscoveryCache } from '../../lib/content-sync';
import { setContentCategories } from '../../lib/categories';
import { normalizeLessonPayload, validatePublishedLesson } from './lesson-utils';

const adminCourses = new Hono<{ Bindings: Env }>();

// All admin routes require auth + admin role
adminCourses.use('*', authMiddleware());
adminCourses.use('*', requireRole('admin', 'super_admin'));

// ─────────────────────────────────────────────────
// COURSES
// ─────────────────────────────────────────────────

// GET /api/admin/courses — List all courses (including drafts)
adminCourses.get('/', async (c) => {
  const url = new URL(c.req.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');
  const offset = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const params: unknown[] = [];

  if (status) { where += ` AND status = ?`; params.push(status); }
  if (search) { where += ` AND title LIKE ?`; params.push(`%${search}%`); }

  const countResult = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM courses ${where}`)
    .bind(...params).first();
  const total = (countResult?.total as number) || 0;

  const rows = await c.env.DB.prepare(
    `SELECT courses.*,
            (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = courses.id AND e.status = 'active') as enrolled_count,
            (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = courses.id AND e.completed_at IS NOT NULL) as completed_count
     FROM courses ${where}
     ORDER BY sort_order ASC, created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return paginated(c, rows.results, { page, limit, total });
});

// GET /api/admin/courses/:id/enrollments — Paginated course participants
adminCourses.get('/:id/enrollments', async (c) => {
  const id = c.req.param('id');
  const url = new URL(c.req.url);
  const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '25', 10), 1), 100);
  const search = (url.searchParams.get('search') || '').trim();
  const offset = (page - 1) * limit;

  const course = await c.env.DB.prepare('SELECT id FROM courses WHERE id = ?').bind(id).first();
  if (!course) return error(c, 'Course not found', 404);

  let where = 'WHERE e.course_id = ?';
  const params: unknown[] = [id];
  if (search) {
    where += ' AND (u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const totalRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total
     FROM enrollments e
     JOIN users u ON u.id = e.user_id
     ${where}`
  ).bind(...params).first() as { total?: number } | null;

  const rows = await c.env.DB.prepare(
    `SELECT e.id, e.status, e.enrolled_at, e.progress_percent, e.completed_at,
            u.id as user_id, u.name, u.email, u.phone
     FROM enrollments e
     JOIN users u ON u.id = e.user_id
     ${where}
     ORDER BY e.enrolled_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return paginated(c, rows.results, { page, limit, total: Number(totalRow?.total || 0) });
});

// GET /api/admin/courses/:id — Get single course with modules & lessons
adminCourses.get('/:id', async (c) => {
  const id = c.req.param('id');
  const course = await c.env.DB.prepare(
    `SELECT courses.*,
            (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = courses.id AND e.status = 'active') as enrolled_count,
            (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = courses.id AND e.completed_at IS NOT NULL) as completed_count
     FROM courses WHERE id = ?`
  ).bind(id).first();
  if (!course) return error(c, 'Course not found', 404);

  const modules = await c.env.DB.prepare(
    'SELECT * FROM course_modules WHERE course_id = ? ORDER BY sort_order ASC'
  ).bind(id).all();

  const lessons = await c.env.DB.prepare(
    'SELECT * FROM lessons WHERE course_id = ? ORDER BY sort_order ASC'
  ).bind(id).all();

  const modulesWithLessons = modules.results.map((mod) => ({
    ...mod,
    lessons: lessons.results.filter((l) => l.module_id === mod.id),
  }));

  const secondaryCategories = await c.env.DB.prepare(
    `SELECT category_id FROM content_categories WHERE content_type = 'course' AND ref_id = ? AND is_primary = 0`
  ).bind(id).all();

  return success(c, {
    course: { ...course, secondary_category_ids: secondaryCategories.results.map((r) => r.category_id) },
    modules: modulesWithLessons,
  });
});

// POST /api/admin/courses — Create course
adminCourses.post('/', validate(createCourseSchema), async (c) => {
  const body = c.get('validatedBody' as never) as Record<string, unknown>;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  // Guard taxonomy: konten published wajib punya primary category
  if (body.status === 'published' && !body.primary_category_id) {
    return error(c, 'Kelas tidak bisa dipublish tanpa primary category', 400);
  }

  await c.env.DB.prepare(
    `INSERT INTO courses (id, slug, title, subtitle, description, short_description, thumbnail_url,
     level, category, primary_category_id, learning_outcome, recommended_for, duration_minutes,
     instructor_name, access_type, price, compare_at_price, status, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, body.slug, body.title, body.subtitle || null, body.description || null,
    body.short_description || null, body.thumbnail_url || null, body.level || null,
    body.category || null, body.primary_category_id || null, body.learning_outcome || null,
    body.recommended_for || null, body.duration_minutes ?? null,
    body.instructor_name || null, body.access_type || 'paid',
    body.price || 0, body.compare_at_price || null, body.status || 'draft',
    body.sort_order || 0, now, now
  ).run();

  if (body.primary_category_id || (Array.isArray(body.secondary_category_ids) && body.secondary_category_ids.length > 0)) {
    const catError = await setContentCategories(c.env.DB, 'course', id, {
      primaryCategoryId: (body.primary_category_id as string) || null,
      secondaryCategoryIds: (body.secondary_category_ids as string[]) || [],
    });
    if (catError) return error(c, catError, 400);
  }

  // Audit log
  const user = c.get('user');
  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, after_data_json, created_at)
     VALUES (?, ?, 'create', 'course', ?, ?, ?)`
  ).bind(crypto.randomUUID(), user.id, id, JSON.stringify(body), now).run();

  await syncContentItem(c.env.DB, 'course', id);
  await invalidateDiscoveryCache(c.env);

  return success(c, { id, slug: body.slug }, 201);
});

// PUT /api/admin/courses/:id — Update course
adminCourses.put('/:id', validate(updateCourseSchema), async (c) => {
  const id = c.req.param('id');
  const body = c.get('validatedBody' as never) as Record<string, unknown>;
  const now = new Date().toISOString();

  const existing = await c.env.DB.prepare('SELECT * FROM courses WHERE id = ?').bind(id).first();
  if (!existing) return error(c, 'Course not found', 404);

  // secondary_category_ids bukan kolom courses — diproses terpisah
  const { secondary_category_ids: secondaryCategoryIds, ...columns } = body as Record<string, unknown> & {
    secondary_category_ids?: string[];
  };

  // Guard taxonomy: hasil akhir published wajib punya primary category
  const resultingStatus = (columns.status as string) ?? (existing.status as string);
  const resultingPrimary = 'primary_category_id' in columns
    ? (columns.primary_category_id as string | null)
    : (existing.primary_category_id as string | null);
  if (resultingStatus === 'published' && !resultingPrimary) {
    return error(c, 'Kelas tidak bisa dipublish tanpa primary category', 400);
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(columns)) {
    fields.push(`${key} = ?`);
    values.push(value ?? null);
  }
  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await c.env.DB.prepare(
    `UPDATE courses SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  if ('primary_category_id' in columns || secondaryCategoryIds !== undefined) {
    const currentSecondary = secondaryCategoryIds !== undefined
      ? secondaryCategoryIds
      : ((await c.env.DB.prepare(
          `SELECT category_id FROM content_categories WHERE content_type = 'course' AND ref_id = ? AND is_primary = 0`
        ).bind(id).all()).results.map((r) => r.category_id as string));
    const catError = await setContentCategories(c.env.DB, 'course', String(id), {
      primaryCategoryId: resultingPrimary,
      secondaryCategoryIds: currentSecondary,
    });
    if (catError) return error(c, catError, 400);
  }

  // Audit log
  const user = c.get('user');
  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, before_data_json, after_data_json, created_at)
     VALUES (?, ?, 'update', 'course', ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), user.id, id, JSON.stringify(existing), JSON.stringify(body), now).run();

  await syncContentItem(c.env.DB, 'course', String(id));
  await Promise.all([
    invalidateCourseListCache(c.env),
    invalidateCourseDetailCache(c.env, existing.slug as string),
    invalidateDiscoveryCache(c.env),
  ]);

  return success(c, { id });
});

// DELETE /api/admin/courses/:id
adminCourses.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT id, title FROM courses WHERE id = ?').bind(id).first();
  if (!existing) return error(c, 'Course not found', 404);

  const now = new Date().toISOString();

  // Soft delete: set to archived
  await c.env.DB.prepare(
    `UPDATE courses SET status = 'archived', updated_at = ? WHERE id = ?`
  ).bind(now, id).run();

  const user = c.get('user');
  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, before_data_json, created_at)
     VALUES (?, ?, 'archive', 'course', ?, ?, ?)`
  ).bind(crypto.randomUUID(), user.id, id, JSON.stringify(existing), now).run();

  await syncContentItem(c.env.DB, 'course', id);
  await Promise.all([
    invalidateCourseListCache(c.env),
    invalidateCourseDetailCache(c.env, existing.slug as string),
    invalidateDiscoveryCache(c.env),
  ]);

  return success(c, { message: 'Course archived' });
});

// DELETE /api/admin/courses/:id/hard — Permanent delete (only for archived courses)
adminCourses.delete('/:id/hard', async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT id, title, slug, status FROM courses WHERE id = ?').bind(id).first();
  if (!existing) return error(c, 'Course not found', 404);
  if (existing.status !== 'archived') return error(c, 'Hanya kelas yang sudah diarsipkan yang bisa dihapus permanen', 400);

  const now = new Date().toISOString();

  // Delete all related data first
  await c.env.DB.prepare(`DELETE FROM lesson_progress WHERE enrollment_id IN (SELECT id FROM enrollments WHERE course_id = ?)`).bind(id).run();
  await c.env.DB.prepare(`DELETE FROM enrollments WHERE course_id = ?`).bind(id).run();
  await c.env.DB.prepare(`DELETE FROM lessons WHERE course_id = ?`).bind(id).run();
  await c.env.DB.prepare(`DELETE FROM course_modules WHERE course_id = ?`).bind(id).run();
  await c.env.DB.prepare(`DELETE FROM courses WHERE id = ?`).bind(id).run();

  const user = c.get('user');
  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, before_data_json, created_at)
     VALUES (?, ?, 'hard_delete', 'course', ?, ?, ?)`
  ).bind(crypto.randomUUID(), user.id, id, JSON.stringify(existing), now).run();

  await syncContentItem(c.env.DB, 'course', id);
  await Promise.all([
    invalidateCourseListCache(c.env),
    invalidateCourseDetailCache(c.env, existing.slug as string),
    invalidateDiscoveryCache(c.env),
  ]);

  return success(c, { message: 'Course permanently deleted' });
});

// POST /api/admin/courses/:id/publish
adminCourses.post('/:id/publish', async (c) => {
  const id = c.req.param('id');
  const now = new Date().toISOString();

  const courseToPublish = await c.env.DB.prepare('SELECT slug FROM courses WHERE id = ?').bind(id).first();

  await c.env.DB.prepare(
    `UPDATE courses SET status = 'published', published_at = COALESCE(published_at, ?), updated_at = ? WHERE id = ?`
  ).bind(now, now, id).run();

  const user = c.get('user');
  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, created_at)
     VALUES (?, ?, 'publish', 'course', ?, ?)`
  ).bind(crypto.randomUUID(), user.id, id, now).run();

  await syncContentItem(c.env.DB, 'course', id);
  await Promise.all([
    invalidateCourseListCache(c.env),
    ...(courseToPublish?.slug ? [invalidateCourseDetailCache(c.env, courseToPublish.slug as string)] : []),
    invalidateDiscoveryCache(c.env),
  ]);

  return success(c, { message: 'Course published' });
});

// POST /api/admin/courses/:id/unpublish
adminCourses.post('/:id/unpublish', async (c) => {
  const id = c.req.param('id');
  const now = new Date().toISOString();

  const courseToUnpublish = await c.env.DB.prepare('SELECT slug FROM courses WHERE id = ?').bind(id).first();

  await c.env.DB.prepare(
    `UPDATE courses SET status = 'draft', updated_at = ? WHERE id = ?`
  ).bind(now, id).run();

  await syncContentItem(c.env.DB, 'course', id);
  await Promise.all([
    invalidateCourseListCache(c.env),
    ...(courseToUnpublish?.slug ? [invalidateCourseDetailCache(c.env, courseToUnpublish.slug as string)] : []),
    invalidateDiscoveryCache(c.env),
  ]);

  return success(c, { message: 'Course unpublished' });
});

// ─────────────────────────────────────────────────
// MODULES
// ─────────────────────────────────────────────────

// POST /api/admin/courses/:courseId/modules
adminCourses.post('/:courseId/modules', validate(createModuleSchema), async (c) => {
  const courseId = c.req.param('courseId');
  const body = c.get('validatedBody' as never) as Record<string, unknown>;
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await c.env.DB.prepare(
    `INSERT INTO course_modules (id, course_id, title, description, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, courseId, body.title, body.description || null, body.sort_order || 0, now, now).run();

  return success(c, { id }, 201);
});

// PUT /api/admin/modules/:id
adminCourses.put('/modules/:id', validate(updateModuleSchema), async (c) => {
  const id = c.req.param('id');
  const body = c.get('validatedBody' as never) as Record<string, unknown>;
  const now = new Date().toISOString();

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(body)) {
    fields.push(`${key} = ?`);
    values.push(value ?? null);
  }
  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await c.env.DB.prepare(
    `UPDATE course_modules SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  return success(c, { id });
});

// DELETE /api/admin/modules/:id
adminCourses.delete('/modules/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare(
    `DELETE FROM lesson_progress WHERE lesson_id IN (SELECT id FROM lessons WHERE module_id = ?)`
  ).bind(id).run();
  await c.env.DB.prepare('DELETE FROM lessons WHERE module_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM course_modules WHERE id = ?').bind(id).run();
  return success(c, { message: 'Module deleted' });
});

// ─────────────────────────────────────────────────
// LESSONS
// ─────────────────────────────────────────────────

// POST /api/admin/lessons
adminCourses.post('/lessons', validate(createLessonSchema), async (c) => {
  const body = normalizeLessonPayload(c.get('validatedBody' as never) as Record<string, unknown>);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const publishError = validatePublishedLesson(body);
  if (publishError) return error(c, publishError, 400);

  await c.env.DB.prepare(
    `INSERT INTO lessons (id, course_id, module_id, title, slug, lesson_type, video_provider, video_url,
     content_markdown, content_html, content_format, description, resources_json, is_preview, sort_order, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, body.course_id, body.module_id, body.title, body.slug,
    body.lesson_type || 'video', body.video_provider || null, body.video_url || null,
    body.content_markdown || null, body.content_html || null, body.content_format || 'html',
    body.description || null, body.resources_json || null, body.is_preview || 0,
    body.sort_order || 0, body.status || 'draft', now, now
  ).run();

  return success(c, { id }, 201);
});

// PUT /api/admin/lessons/:id
adminCourses.put('/lessons/:id', validate(updateLessonSchema), async (c) => {
  const id = c.req.param('id');
  const body = normalizeLessonPayload(c.get('validatedBody' as never) as Record<string, unknown>);
  const now = new Date().toISOString();

  const existing = await c.env.DB.prepare('SELECT * FROM lessons WHERE id = ?').bind(id).first();
  if (!existing) return error(c, 'Lesson not found', 404);

  const publishError = validatePublishedLesson({ ...existing, ...body });
  if (publishError) return error(c, publishError, 400);

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(body)) {
    fields.push(`${key} = ?`);
    values.push(value ?? null);
  }
  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await c.env.DB.prepare(
    `UPDATE lessons SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  return success(c, { id });
});

// DELETE /api/admin/lessons/:id
adminCourses.delete('/lessons/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM lesson_progress WHERE lesson_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM lessons WHERE id = ?').bind(id).run();
  return success(c, { message: 'Lesson deleted' });
});

export default adminCourses;
