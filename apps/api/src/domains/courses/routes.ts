import { Hono } from 'hono';
import type { Env } from '../../env';
import { success, error, paginated } from '../../lib/response';
import { kvGetOrSet } from '../../lib/cache';

const courses = new Hono<{ Bindings: Env }>();

// ─── GET /api/courses — Public catalog ───────────
courses.get('/', async (c) => {
  try {
    const url = new URL(c.req.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '12', 10), 50);
    const category = url.searchParams.get('category') || '';
    const level = url.searchParams.get('level') || '';
    const access_type = url.searchParams.get('access_type') || '';
    const search = url.searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    const useCache = !search;
    const cacheKey = `courses:list:v3:${page}:${limit}:${category}:${level}:${access_type}`;

    const fetchData = async () => {
      let where = `WHERE status = 'published'`;
      const params: unknown[] = [];
      // category = slug kategori taxonomy; match primary ATAU secondary
      if (category) {
        where += ` AND EXISTS (
          SELECT 1 FROM content_categories cc JOIN categories cat ON cat.id = cc.category_id
          WHERE cc.content_type = 'course' AND cc.ref_id = courses.id AND cat.slug = ?
        )`;
        params.push(category);
      }
      if (level) { where += ` AND level = ?`; params.push(level); }
      if (access_type) { where += ` AND access_type = ?`; params.push(access_type); }
      if (search) { where += ` AND (title LIKE ? OR short_description LIKE ?)`; params.push(`%${search}%`, `%${search}%`); }

      const countResult = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM courses ${where}`)
        .bind(...params).first();
      const total = (countResult?.total as number) || 0;

      const rows = await c.env.DB.prepare(
        `SELECT id, slug, title, subtitle, short_description, thumbnail_url, level, category,
                primary_category_id, learning_outcome, recommended_for, duration_minutes,
                (SELECT cat.name FROM categories cat WHERE cat.id = courses.primary_category_id) as category_name,
                (SELECT cat.slug FROM categories cat WHERE cat.id = courses.primary_category_id) as category_slug,
                instructor_name, access_type, price, compare_at_price, sort_order, published_at,
                (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = courses.id AND e.status = 'active') as enrolled_count,
                (SELECT json_group_array(json_object('avatar_url', u.avatar_url, 'badges_json', u.badges_json, 'seed', u.id))
                 FROM (
                   SELECT us.avatar_url, us.badges_json, us.id
                   FROM enrollments en
                   JOIN users us ON en.user_id = us.id
                   WHERE en.course_id = courses.id AND en.status = 'active'
                   ORDER BY en.enrolled_at DESC LIMIT 3
                 ) u) as participants_preview
         FROM courses ${where}
         ORDER BY sort_order ASC, published_at DESC
         LIMIT ? OFFSET ?`
      ).bind(...params, limit, offset).all();

      // Parse JSON from SQLite for participants_preview
      const formattedResults = rows.results.map((row: any) => ({
        ...row,
        participants_preview: JSON.parse(row.participants_preview || '[]')
      }));

      return { results: formattedResults, meta: { page, limit, total } };
    };

    const { results, meta } = useCache
      ? await kvGetOrSet(c.env, cacheKey, 600, fetchData)
      : await fetchData();

    return paginated(c, results, meta);
  } catch (err) {
    console.error('[courses:list]', err);
    return error(c, 'Gagal memuat daftar kursus', 500);
  }
});

// ─── GET /api/courses/:slug — Public detail ──────
courses.get('/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');

    const data = await kvGetOrSet(c.env, `courses:detail:v2:${slug}`, 600, async () => {
      const course = await c.env.DB.prepare(
        `SELECT * FROM courses WHERE slug = ? AND status = 'published'`
      ).bind(slug).first();

      if (!course) return null;

      const modules = await c.env.DB.prepare(
        `SELECT * FROM course_modules WHERE course_id = ? ORDER BY sort_order ASC`
      ).bind(course.id).all();

      const lessons = await c.env.DB.prepare(
        `SELECT id, course_id, module_id, title, slug, lesson_type, is_preview, sort_order, status
         FROM lessons WHERE course_id = ? AND status = 'published' ORDER BY sort_order ASC`
      ).bind(course.id).all();

      const modulesWithLessons = modules.results.map((mod) => ({
        ...mod,
        lessons: lessons.results.filter((l) => l.module_id === mod.id),
      }));

      const totalLessons = lessons.results.length;
      const videoCount = lessons.results.filter((l) => l.lesson_type === 'video').length;

      const statsQuery = await c.env.DB.prepare(
        `SELECT 
          (SELECT COUNT(*) FROM enrollments WHERE course_id = ? AND status = 'active') as count,
          (SELECT json_group_array(json_object('avatar_url', u.avatar_url, 'badges_json', u.badges_json, 'seed', u.id))
           FROM (
             SELECT us.avatar_url, us.badges_json, us.id
             FROM enrollments en
             JOIN users us ON en.user_id = us.id
             WHERE en.course_id = ? AND en.status = 'active'
             ORDER BY en.enrolled_at DESC LIMIT 3
           ) u) as participants_preview`
      ).bind(course.id, course.id).first() as { count?: number, participants_preview?: string } | null;

      return {
        course,
        modules: modulesWithLessons,
        stats: {
          totalLessons,
          videoCount,
          enrolledCount: Number(statsQuery?.count || 0),
          participants_preview: JSON.parse(statsQuery?.participants_preview || '[]')
        },
      };
    });

    if (!data) return error(c, 'Kelas tidak ditemukan', 404);
    return success(c, data);
  } catch (err) {
    console.error('[courses:detail]', err);
    return error(c, 'Gagal memuat detail kursus', 500);
  }
});

// ─── GET /api/courses/:courseId/modules ───────────
courses.get('/:courseId/modules', async (c) => {
  try {
    const courseId = c.req.param('courseId');

    const modules = await c.env.DB.prepare(
      `SELECT * FROM course_modules WHERE course_id = ? ORDER BY sort_order ASC`
    ).bind(courseId).all();

    const lessons = await c.env.DB.prepare(
      `SELECT * FROM lessons WHERE course_id = ? ORDER BY sort_order ASC`
    ).bind(courseId).all();

    const modulesWithLessons = modules.results.map((mod) => ({
      ...mod,
      lessons: lessons.results.filter((l) => l.module_id === mod.id),
    }));

    return success(c, modulesWithLessons);
  } catch (err) {
    console.error('[courses:modules]', err);
    return error(c, 'Gagal memuat modul kursus', 500);
  }
});

export default courses;
