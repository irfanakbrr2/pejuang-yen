import { Hono } from 'hono';
import { z } from 'zod';
import { sanitizeLessonHtml } from '@growwithai/shared';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error, paginated } from '../../lib/response';
import { syncContentItem, invalidateDiscoveryCache } from '../../lib/content-sync';

const adminRecordingsRoutes = new Hono<{ Bindings: Env }>();
adminRecordingsRoutes.use('*', authMiddleware());
adminRecordingsRoutes.use('*', requireRole('admin', 'super_admin'));

function trimInput(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function normalizeUrlInput(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const optionalText = (max: number) => z.preprocess(
  trimInput,
  z.string().max(max).optional().or(z.literal(''))
);

const optionalUrl = z.preprocess(
  normalizeUrlInput,
  z.string().url().optional().or(z.literal(''))
);

const createRecordingSchema = z.object({
  webinar_id: z.preprocess(trimInput, z.string().optional().or(z.literal(''))),
  title: z.preprocess(trimInput, z.string().min(3).max(200)),
  slug: z.preprocess(trimInput, z.string().min(3).max(200).regex(/^[a-z0-9-]+$/)),
  subtitle: optionalText(300),
  body_html: z.preprocess(trimInput, z.string().optional()),
  thumbnail_url: optionalUrl,
  recording_url: optionalUrl,
  recording_embed_url: optionalUrl,
  category: optionalText(100),
  format: optionalText(100),
  tags: optionalText(500),
  status: z.enum(['hidden', 'public', 'membership_only']).default('hidden'),
  recorded_at: z.preprocess(trimInput, z.string().min(1)),
  sort_order: z.number().int().default(0),
});
const updateRecordingSchema = createRecordingSchema.partial();

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizePayload(body: Record<string, unknown>) {
  const next = { ...body } as Record<string, unknown>;
  if ('body_html' in next) next.body_html = sanitizeLessonHtml(cleanString(next.body_html));
  for (const key of ['webinar_id', 'subtitle', 'thumbnail_url', 'recording_url', 'recording_embed_url', 'category', 'format', 'tags']) {
    if (key in next) next[key] = cleanString(next[key]);
  }
  return next;
}

adminRecordingsRoutes.get('/', async (c) => {
  const url = new URL(c.req.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');
  const offset = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const params: unknown[] = [];
  if (status) { where += ' AND status = ?'; params.push(status); }
  if (search) {
    where += ' AND (title LIKE ? OR slug LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q);
  }

  const total = ((await c.env.DB.prepare(`SELECT COUNT(*) as total FROM webinar_recordings ${where}`).bind(...params).first()) as any)?.total || 0;
  const rows = await c.env.DB.prepare(
    `SELECT *
     FROM webinar_recordings
     ${where}
     ORDER BY sort_order ASC, recorded_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return paginated(c, rows.results, { page, limit, total });
});

adminRecordingsRoutes.post('/', async (c) => {
  const parsed = createRecordingSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ success: false, error: 'Validation error', details: parsed.error.errors }, 400);

  const body = normalizePayload(parsed.data);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const existing = await c.env.DB.prepare('SELECT id FROM webinar_recordings WHERE slug = ?').bind(body.slug).first();
  if (existing) return error(c, 'Slug already exists', 409);

  await c.env.DB.prepare(
    `INSERT INTO webinar_recordings
     (id, webinar_id, slug, title, subtitle, body_html, thumbnail_url, recording_url, recording_embed_url, 
      category, format, tags, status, recorded_at, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, body.webinar_id || null, body.slug, body.title, body.subtitle || null, body.body_html || null, body.thumbnail_url || null,
    body.recording_url || null, body.recording_embed_url || null, body.category || null, body.format || null, body.tags || null,
    body.status || 'hidden', body.recorded_at, body.sort_order || 0, now, now
  ).run();

  await syncContentItem(c.env.DB, 'recording', id);
  await invalidateDiscoveryCache(c.env);

  return success(c, { id }, 201);
});

adminRecordingsRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const recording = await c.env.DB.prepare(
    `SELECT * FROM webinar_recordings WHERE id = ?`
  ).bind(id).first();
  if (!recording) return error(c, 'Recording not found', 404);
  return success(c, recording);
});

adminRecordingsRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const parsed = updateRecordingSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ success: false, error: 'Validation error', details: parsed.error.errors }, 400);

  const existing = await c.env.DB.prepare('SELECT * FROM webinar_recordings WHERE id = ?').bind(id).first() as any;
  if (!existing) return error(c, 'Recording not found', 404);

  const body = normalizePayload(parsed.data);
  if (body.slug && body.slug !== existing.slug) {
    const conflict = await c.env.DB.prepare('SELECT id FROM webinar_recordings WHERE slug = ? AND id != ?').bind(body.slug, id).first();
    if (conflict) return error(c, 'Slug already exists', 409);
  }

  const allowed = [
    'webinar_id', 'slug', 'title', 'subtitle', 'body_html', 'thumbnail_url', 
    'recording_url', 'recording_embed_url', 'category', 'format', 'tags',
    'status', 'recorded_at', 'sort_order'
  ];
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (key in body) {
      fields.push(`${key} = ?`);
      values.push(body[key]);
    }
  }
  
  if (fields.length === 0) return error(c, 'No fields to update', 400);
  fields.push('updated_at = ?');
  values.push(new Date().toISOString(), id);

  await c.env.DB.prepare(`UPDATE webinar_recordings SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();

  await syncContentItem(c.env.DB, 'recording', id);
  await invalidateDiscoveryCache(c.env);

  return success(c, { message: 'Recording updated' });
});

adminRecordingsRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT id FROM webinar_recordings WHERE id = ?').bind(id).first();
  if (!existing) return error(c, 'Recording not found', 404);

  await c.env.DB.prepare('DELETE FROM webinar_recordings WHERE id = ?').bind(id).run();

  await syncContentItem(c.env.DB, 'recording', id);
  await invalidateDiscoveryCache(c.env);

  return success(c, { message: 'Recording deleted' });
});

export default adminRecordingsRoutes;
