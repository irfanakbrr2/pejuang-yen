// AI Pulse — route publik (gratis, tanpa login) + overview terminal.
import { Hono } from 'hono';
import type { Env } from '../../env';
import { success, error, paginated } from '../../lib/response';
import { optionalAuthMiddleware } from '../../middleware/auth';
import { AiPulseRepository } from './repository';
import { toDetail, toListItem } from './mapper';
import { AutomationService } from '../automations/service';

const aiPulseRoutes = new Hono<{ Bindings: Env }>();

const DAY_MS = 24 * 3600 * 1000;

function clampInt(v: string | undefined, def: number, min: number, max: number): number {
  const n = Number.parseInt(v ?? '', 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(n, min), max);
}

/** Ambil detail ringkas course/bonus terkait untuk blok CTA. */
async function enrichRelated(db: D1Database, env: Env, ids: {
  courses: string[]; bonuses: string[]; templates: string[];
}) {
  const out: {
    courses: Array<Record<string, unknown>>;
    bonuses: Array<Record<string, unknown>>;
    automations: Array<{ key: string; name: string }>;
  } = { courses: [], bonuses: [], automations: [] };

  if (ids.courses.length) {
    const ph = ids.courses.map(() => '?').join(',');
    const res = await db
      .prepare(`SELECT id, slug, title, thumbnail_url, level FROM courses WHERE id IN (${ph}) AND status = 'published'`)
      .bind(...ids.courses)
      .all();
    out.courses = res.results ?? [];
  }
  if (ids.bonuses.length) {
    const ph = ids.bonuses.map(() => '?').join(',');
    const res = await db
      .prepare(`SELECT id, slug, title, thumbnail_url FROM bonuses WHERE id IN (${ph}) AND status = 'published'`)
      .bind(...ids.bonuses)
      .all();
    out.bonuses = res.results ?? [];
  }
  if (ids.templates.length) {
    try {
      const templates = new AutomationService(env).listTemplates() as Array<{ key: string; name: string }>;
      out.automations = templates.filter((t) => ids.templates.includes(t.key)).map((t) => ({ key: t.key, name: t.name }));
    } catch {
      out.automations = ids.templates.map((key) => ({ key, name: key }));
    }
  }
  return out;
}

// ─── Feed publik ────────────────────────────────────────────────────
aiPulseRoutes.get('/', async (c) => {
  try {
    const repo = new AiPulseRepository(c.env.DB);
    const page = clampInt(c.req.query('page'), 1, 1, 1000);
    const limit = clampInt(c.req.query('limit'), 12, 1, 48);
    const categoryId = c.req.query('category') || undefined;
    const impact = c.req.query('impact') || undefined;

    const { rows, total } = await repo.listPublished({ page, limit, categoryId, impact });
    c.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return paginated(c, rows.map(toListItem), { page, limit, total });
  } catch (err) {
    console.error('[ai-pulse:list]', err);
    return error(c, 'Gagal memuat AI Pulse', 500);
  }
});

// ─── Overview terminal (KPI + chart + featured + latest) ────────────
aiPulseRoutes.get('/overview', async (c) => {
  try {
    const repo = new AiPulseRepository(c.env.DB);
    const now = Date.now();
    const since7 = new Date(now - 7 * DAY_MS).toISOString();
    const since14 = new Date(now - 14 * DAY_MS).toISOString();
    const since1 = new Date(now - DAY_MS).toISOString();

    const [thisWeek, today, activeSources, daily, topCategories, latest, featured] = await Promise.all([
      repo.countPublishedSince(since7),
      repo.countPublishedSince(since1),
      repo.countActiveSources(),
      repo.dailyActivitySince(since14),
      repo.topCategoriesSince(since7, 5),
      repo.listLatestPublished(9),
      repo.getFeatured(3),
    ]);

    c.header('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
    return success(c, {
      kpi: { today, this_week: thisWeek, active_sources: activeSources },
      daily_activity: daily,
      top_categories: topCategories,
      featured: featured.map(toListItem),
      latest: latest.map(toListItem),
    });
  } catch (err) {
    console.error('[ai-pulse:overview]', err);
    return error(c, 'Gagal memuat overview', 500);
  }
});

// ─── Detail learning package ────────────────────────────────────────
aiPulseRoutes.get('/:slug', optionalAuthMiddleware(), async (c) => {
  try {
    const repo = new AiPulseRepository(c.env.DB);
    const slug = c.req.param('slug');
    const row = await repo.getPublishedBySlug(slug);
    if (!row) return error(c, 'Item tidak ditemukan', 404);

    // hitung view tanpa blokir response
    c.executionCtx.waitUntil(repo.incrementView(row.id));

    const detail = toDetail(row);
    const related = await enrichRelated(c.env.DB, c.env, {
      courses: detail.related_course_ids,
      bonuses: detail.related_bonus_ids,
      templates: detail.related_automation_template_keys,
    });

    const user = c.get('user');
    const bookmarked = user ? await repo.isBookmarked(user.id, row.id) : false;

    const relatedRows = await repo.listRelatedPublished(row.primary_category_id, row.id, 3);
    const related_posts = relatedRows.map(toListItem);

    return success(c, { ...detail, related, related_posts, bookmarked });
  } catch (err) {
    console.error('[ai-pulse:detail]', err);
    return error(c, 'Gagal memuat item', 500);
  }
});

export default aiPulseRoutes;
