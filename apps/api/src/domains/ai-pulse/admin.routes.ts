// AI Pulse — route admin (review queue, publish, sumber, ingest manual).
import { Hono } from 'hono';
import type { Env } from '../../env';
import { success, error, paginated } from '../../lib/response';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { AiPulseRepository } from './repository';
import { toAdminItem } from './mapper';
import { runAiPulseIngestion, regenerateDraft } from './service';
import type { ImpactLevel, ItemStatus } from './types';

const adminAiPulseRoutes = new Hono<{ Bindings: Env }>();
adminAiPulseRoutes.use('*', authMiddleware(), requireRole('admin', 'super_admin'));

function clampInt(v: string | undefined, def: number, min: number, max: number): number {
  const n = Number.parseInt(v ?? '', 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(n, min), max);
}

// ─── Sources CRUD ───────────────────────────────────────────────────
adminAiPulseRoutes.get('/sources', async (c) => {
  const repo = new AiPulseRepository(c.env.DB);
  return success(c, await repo.listAllSources());
});

adminAiPulseRoutes.post('/sources', async (c) => {
  let body: { name?: string; url?: string; type?: string; category?: string };
  try { body = await c.req.json(); } catch { return error(c, 'Invalid JSON', 400); }
  if (!body.name || !body.url) return error(c, 'name dan url wajib diisi', 400);
  const repo = new AiPulseRepository(c.env.DB);
  const id = `src_${crypto.randomUUID().slice(0, 8)}`;
  await repo.createSource({
    id, name: body.name, url: body.url, type: body.type === 'api' ? 'api' : 'rss',
    category: body.category ?? null, now: new Date().toISOString(),
  });
  return success(c, { id }, 201);
});

adminAiPulseRoutes.patch('/sources/:id', async (c) => {
  let body: Record<string, unknown>;
  try { body = await c.req.json(); } catch { return error(c, 'Invalid JSON', 400); }
  const patch: Record<string, unknown> = {};
  if (typeof body.name === 'string') patch.name = body.name;
  if (typeof body.url === 'string') patch.url = body.url;
  if (typeof body.type === 'string') patch.type = body.type === 'api' ? 'api' : 'rss';
  if (typeof body.category === 'string') patch.category = body.category;
  if (typeof body.enabled === 'boolean') patch.enabled = body.enabled ? 1 : 0;
  const repo = new AiPulseRepository(c.env.DB);
  await repo.updateSource(c.req.param('id'), patch, new Date().toISOString());
  return success(c, { ok: true });
});

adminAiPulseRoutes.delete('/sources/:id', async (c) => {
  const repo = new AiPulseRepository(c.env.DB);
  await repo.deleteSource(c.req.param('id'));
  return success(c, { ok: true });
});

// ─── Ingest manual (trigger cron secara manual untuk uji/curate) ────
adminAiPulseRoutes.post('/ingest', async (c) => {
  try {
    const summary = await runAiPulseIngestion(c.env);
    return success(c, summary);
  } catch (err) {
    console.error('[ai-pulse:admin:ingest]', err);
    return error(c, 'Ingestion gagal', 500);
  }
});

// ─── List untuk review queue ────────────────────────────────────────
adminAiPulseRoutes.get('/', async (c) => {
  const repo = new AiPulseRepository(c.env.DB);
  const statusParam = c.req.query('status') as ItemStatus | undefined;
  const status = statusParam === 'draft' || statusParam === 'published' || statusParam === 'archived' ? statusParam : undefined;
  const page = clampInt(c.req.query('page'), 1, 1, 1000);
  const limit = clampInt(c.req.query('limit'), 20, 1, 100);
  const { rows, total } = await repo.listForAdmin({ status, page, limit });
  return paginated(c, rows.map(toAdminItem), { page, limit, total });
});

// ─── Get satu item (admin) ──────────────────────────────────────────
adminAiPulseRoutes.get('/:id', async (c) => {
  const repo = new AiPulseRepository(c.env.DB);
  const row = await repo.getById(c.req.param('id'));
  if (!row) return error(c, 'Item tidak ditemukan', 404);
  return success(c, toAdminItem(row));
});

// ─── Edit field hasil AI + links + taxonomy ─────────────────────────
const STRING_FIELDS = ['title', 'summary', 'why_it_matters', 'who_should_use', 'business_insight', 'primary_category_id', 'thumbnail_url'] as const;
const ARRAY_JSON_FIELDS: Record<string, string> = {
  use_cases: 'use_cases_json',
  tags: 'tags_json',
  related_course_ids: 'related_course_ids_json',
  related_bonus_ids: 'related_bonus_ids_json',
  related_automation_template_keys: 'related_automation_template_keys_json',
};

adminAiPulseRoutes.patch('/:id', async (c) => {
  let body: Record<string, unknown>;
  try { body = await c.req.json(); } catch { return error(c, 'Invalid JSON', 400); }

  const patch: Record<string, unknown> = {};
  for (const f of STRING_FIELDS) {
    if (f in body) patch[f] = body[f] === null ? null : String(body[f]);
  }
  for (const [src, col] of Object.entries(ARRAY_JSON_FIELDS)) {
    if (src in body && Array.isArray(body[src])) {
      patch[col] = JSON.stringify((body[src] as unknown[]).map(String));
    }
  }
  if ('faq' in body && Array.isArray(body.faq)) {
    patch.faq_json = JSON.stringify(
      (body.faq as Record<string, unknown>[])
        .filter((f) => f && typeof f.q === 'string' && typeof f.a === 'string')
        .map((f) => ({ q: String(f.q), a: String(f.a) }))
    );
  }
  if (typeof body.impact_level === 'string') {
    const lv = body.impact_level as ImpactLevel;
    if (lv === 'major' || lv === 'update' || lv === 'breaking') patch.impact_level = lv;
  }
  if (typeof body.featured === 'boolean') patch.featured = body.featured ? 1 : 0;

  if (Object.keys(patch).length === 0) return error(c, 'Tidak ada field yang diubah', 400);

  const repo = new AiPulseRepository(c.env.DB);
  const existing = await repo.getById(c.req.param('id'));
  if (!existing) return error(c, 'Item tidak ditemukan', 404);
  await repo.updateItem(c.req.param('id'), patch, new Date().toISOString());
  const updated = await repo.getById(c.req.param('id'));
  return success(c, updated ? toAdminItem(updated) : null);
});

// ─── Publish / Archive ──────────────────────────────────────────────
adminAiPulseRoutes.post('/:id/publish', async (c) => {
  const repo = new AiPulseRepository(c.env.DB);
  const row = await repo.getById(c.req.param('id'));
  if (!row) return error(c, 'Item tidak ditemukan', 404);
  if (!row.summary) return error(c, 'Lengkapi ringkasan sebelum publish', 400);
  const now = new Date().toISOString();
  await repo.updateItem(c.req.param('id'), { status: 'published', published_at_internal: row.published_at_internal ?? now }, now);
  return success(c, { ok: true, status: 'published' });
});

adminAiPulseRoutes.post('/:id/archive', async (c) => {
  const repo = new AiPulseRepository(c.env.DB);
  const row = await repo.getById(c.req.param('id'));
  if (!row) return error(c, 'Item tidak ditemukan', 404);
  await repo.updateItem(c.req.param('id'), { status: 'archived' }, new Date().toISOString());
  return success(c, { ok: true, status: 'archived' });
});

// ─── Regenerate learning package via AI ─────────────────────────────
adminAiPulseRoutes.post('/:id/regenerate', async (c) => {
  try {
    const ok = await regenerateDraft(c.env, c.req.param('id'));
    if (!ok) return error(c, 'Regenerasi gagal', 400);
    const repo = new AiPulseRepository(c.env.DB);
    const row = await repo.getById(c.req.param('id'));
    return success(c, row ? toAdminItem(row) : null);
  } catch (err) {
    console.error('[ai-pulse:admin:regenerate]', err);
    return error(c, 'Regenerasi gagal', 500);
  }
});

export default adminAiPulseRoutes;
