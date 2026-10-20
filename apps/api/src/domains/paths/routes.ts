import { Hono } from 'hono';
import type { Env } from '../../env';
import { optionalAuthMiddleware } from '../../middleware/auth';
import { success, error } from '../../lib/response';
import { kvGetOrSet } from '../../lib/cache';

const pathsRoutes = new Hono<{ Bindings: Env }>();

interface PathItemRow {
  id: string;
  content_id: string;
  section_label: string | null;
  sort_order: number;
  note: string | null;
  content_type: string;
  ref_id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  format: string;
  level: string | null;
  access_type: string | null;
}

// ─── GET /api/paths ───────────
// Daftar learning path published (?featured=1 untuk rail di /explore)
pathsRoutes.get('/', optionalAuthMiddleware(), async (c) => {
  try {
    const featuredOnly = c.req.query('featured') === '1';
    const cacheKey = `paths:list:${featuredOnly ? 'featured' : 'all'}`;

    const paths = await kvGetOrSet(c.env, cacheKey, 600, async () => {
      const rows = await c.env.DB.prepare(
        `SELECT lp.id, lp.slug, lp.title, lp.subtitle, lp.thumbnail_url, lp.level,
                lp.is_featured, lp.sort_order,
                (SELECT COUNT(*) FROM learning_path_items lpi
                 JOIN content_items ci ON ci.id = lpi.content_id AND ci.status = 'published'
                 WHERE lpi.path_id = lp.id) AS item_count,
                (SELECT json_group_array(json_object('slug', s.slug, 'name', s.name))
                 FROM learning_path_skills lps JOIN skills s ON s.id = lps.skill_id
                 WHERE lps.path_id = lp.id) AS skills_json
         FROM learning_paths lp
         WHERE lp.status = 'published' ${featuredOnly ? 'AND lp.is_featured = 1' : ''}
         ORDER BY lp.is_featured DESC, lp.sort_order ASC, lp.created_at DESC`
      ).all();
      return rows.results.map((p: Record<string, unknown>) => {
        let skills = [];
        try { skills = JSON.parse(String(p.skills_json || '[]')); } catch { /* noop */ }
        const { skills_json: _skills, ...rest } = p;
        return { ...rest, skills };
      });
    });

    // Annotate progress for logged-in users (not cached — per user)
    const user = c.get('user');
    if (user && (paths as Record<string, unknown>[]).length > 0) {
      const progress = await getUserPathProgress(c.env.DB, user.id);
      return success(c, (paths as Record<string, unknown>[]).map((p) => ({
        ...p,
        progress: progress.get(String(p.id)) || null,
      })));
    }

    return success(c, paths);
  } catch (err) {
    console.error('[paths:list]', err);
    return error(c, 'Gagal memuat learning path', 500);
  }
});

// ─── GET /api/paths/:slug ───────────
// Detail path + ordered items; saat login: status per item + progress
pathsRoutes.get('/:slug', optionalAuthMiddleware(), async (c) => {
  try {
    const slug = c.req.param('slug');

    const path = await c.env.DB.prepare(
      `SELECT id, slug, title, subtitle, description, thumbnail_url, level, is_featured
       FROM learning_paths WHERE slug = ? AND status = 'published'`
    ).bind(slug).first();
    if (!path) return error(c, 'Learning path tidak ditemukan', 404);

    const itemRows = await c.env.DB.prepare(
      `SELECT lpi.id, lpi.content_id, lpi.section_label, lpi.sort_order, lpi.note,
              ci.content_type, ci.ref_id, ci.slug, ci.title, ci.description,
              ci.thumbnail_url, ci.format, ci.level, ci.access_type
       FROM learning_path_items lpi
       JOIN content_items ci ON ci.id = lpi.content_id AND ci.status = 'published'
       WHERE lpi.path_id = ?
       ORDER BY lpi.sort_order ASC`
    ).bind(path.id).all<PathItemRow>();

    const skills = await c.env.DB.prepare(
      `SELECT s.slug, s.name, s.icon FROM learning_path_skills lps
       JOIN skills s ON s.id = lps.skill_id WHERE lps.path_id = ?`
    ).bind(path.id).all();

    const user = c.get('user');
    let items = itemRows.results.map((it) => ({ ...it, user_state: 'none' as string }));
    let progressPercent = 0;
    let nextItemId: string | null = items.length > 0 ? items[0].id : null;

    if (user) {
      const state = await getUserContentState(c.env.DB, user.id);
      items = itemRows.results.map((it) => {
        let userState = 'none';
        if (it.content_type === 'course') {
          const enr = state.enrollments.get(it.ref_id);
          if (enr === 'completed') userState = 'completed';
          else if (enr) userState = 'enrolled';
        } else if (state.access.has(`${it.content_type}:${it.ref_id}`)) {
          userState = 'completed';
        }
        return { ...it, user_state: userState };
      });
      const done = items.filter((it) => it.user_state === 'completed').length;
      progressPercent = items.length > 0 ? Math.round((done / items.length) * 100) : 0;
      nextItemId = items.find((it) => it.user_state !== 'completed')?.id || null;
    }

    return success(c, {
      path: { ...path, skills: skills.results },
      items,
      progress_percent: progressPercent,
      next_item_id: nextItemId,
    });
  } catch (err) {
    console.error('[paths:detail]', err);
    return error(c, 'Gagal memuat detail learning path', 500);
  }
});

// User enrollment + access state, keyed for path annotation
async function getUserContentState(db: D1Database, userId: string) {
  const [enrRows, accessRows] = await Promise.all([
    db.prepare(
      `SELECT course_id, CASE WHEN completed_at IS NOT NULL OR progress_percent >= 100
              THEN 'completed' ELSE 'enrolled' END AS state
       FROM enrollments WHERE user_id = ?`
    ).bind(userId).all<{ course_id: string; state: string }>(),
    db.prepare(
      `SELECT resource_type, resource_id FROM user_access
       WHERE user_id = ? AND status = 'active'`
    ).bind(userId).all<{ resource_type: string; resource_id: string }>(),
  ]);

  const enrollments = new Map<string, string>();
  for (const r of enrRows.results) enrollments.set(r.course_id, r.state);
  const access = new Set<string>();
  for (const r of accessRows.results) access.add(`${r.resource_type}:${r.resource_id}`);
  return { enrollments, access };
}

// Progress per path for list annotation
async function getUserPathProgress(db: D1Database, userId: string) {
  const rows = await db.prepare(
    `SELECT lpi.path_id,
            COUNT(*) AS total,
            SUM(CASE
              WHEN ci.content_type = 'course' AND e.course_id IS NOT NULL
                   AND (e.completed_at IS NOT NULL OR e.progress_percent >= 100) THEN 1
              WHEN ci.content_type != 'course' AND ua.resource_id IS NOT NULL THEN 1
              ELSE 0 END) AS done
     FROM learning_path_items lpi
     JOIN content_items ci ON ci.id = lpi.content_id AND ci.status = 'published'
     LEFT JOIN enrollments e ON ci.content_type = 'course' AND e.course_id = ci.ref_id AND e.user_id = ?
     LEFT JOIN user_access ua ON ci.content_type != 'course' AND ua.resource_type = ci.content_type
            AND ua.resource_id = ci.ref_id AND ua.user_id = ? AND ua.status = 'active'
     GROUP BY lpi.path_id`
  ).bind(userId, userId).all<{ path_id: string; total: number; done: number }>();

  const map = new Map<string, { total: number; done: number; percent: number }>();
  for (const r of rows.results) {
    map.set(r.path_id, {
      total: r.total,
      done: r.done,
      percent: r.total > 0 ? Math.round((r.done / r.total) * 100) : 0,
    });
  }
  return map;
}

export default pathsRoutes;
