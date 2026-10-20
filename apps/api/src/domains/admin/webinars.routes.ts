import { Hono } from 'hono';
import { z } from 'zod';
import { sanitizeLessonHtml } from '@growwithai/shared';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error, paginated } from '../../lib/response';

const adminWebinarsRoutes = new Hono<{ Bindings: Env }>();
adminWebinarsRoutes.use('*', authMiddleware());
adminWebinarsRoutes.use('*', requireRole('admin', 'super_admin'));

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

const createWebinarSchema = z.object({
  title: z.preprocess(trimInput, z.string().min(3).max(200)),
  slug: z.preprocess(trimInput, z.string().min(3).max(200).regex(/^[a-z0-9-]+$/)),
  subtitle: optionalText(300),
  body_html: z.preprocess(trimInput, z.string().optional()),
  thumbnail_url: optionalUrl,
  host_name: optionalText(120),
  starts_at: z.preprocess(trimInput, z.string().min(1)),
  ends_at: z.preprocess(trimInput, z.string().optional().or(z.literal(''))),
  timezone: z.preprocess(trimInput, z.string().max(80).default('Asia/Jakarta')),
  capacity: z.number().int().min(1).optional().nullable(),
  join_url: optionalUrl,
  calendar_url: optionalUrl,
  recording_url: optionalUrl,
  recording_embed_url: optionalUrl,
  replay_body_html: z.preprocess(trimInput, z.string().optional()),
  replay_status: z.enum(['hidden', 'public', 'membership_only']).default('hidden'),
  form_template_key: z.preprocess(trimInput, z.string().max(80).default('webinar_free_default')),
  seo_title: optionalText(70),
  seo_description: optionalText(170),
  category: optionalText(100),
  format: optionalText(100),
  tags: optionalText(500),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  sort_order: z.number().int().default(0),
});
const updateWebinarSchema = createWebinarSchema.partial();

function cleanString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizePayload(body: Record<string, unknown>) {
  const next = { ...body } as Record<string, unknown>;
  if ('body_html' in next) next.body_html = sanitizeLessonHtml(cleanString(next.body_html));
  if ('replay_body_html' in next) next.replay_body_html = sanitizeLessonHtml(cleanString(next.replay_body_html));
  for (const key of ['subtitle', 'thumbnail_url', 'host_name', 'ends_at', 'join_url', 'calendar_url', 'recording_url', 'recording_embed_url', 'seo_title', 'seo_description', 'share_message_template', 'category', 'format', 'tags']) {
    if (key in next) next[key] = cleanString(next[key]);
  }
  if ('capacity' in next) {
    const capacity = Number(next.capacity || 0);
    next.capacity = capacity > 0 ? capacity : null;
  }
  for (const key of ['free_registration_enabled', 'paid_registration_enabled', 'short_link_enabled']) {
    if (key in next) next[key] = next[key] ? 1 : 0;
  }
  if ('paid_registration_price' in next) {
    const price = Number(next.paid_registration_price || 0);
    next.paid_registration_price = price >= 0 ? price : 99000;
  }
  if ('share_required_count' in next) {
    const count = Number(next.share_required_count || 0);
    next.share_required_count = count > 0 ? count : 2;
  }
  return next;
}

adminWebinarsRoutes.get('/', async (c) => {
  const url = new URL(c.req.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');
  const offset = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const params: unknown[] = [];
  if (status) { where += ' AND status = ?'; params.push(status); }
  const replayStatus = url.searchParams.get('replay_status');
  if (replayStatus) {
    if (replayStatus === 'published_only') {
      where += " AND replay_status IN ('public', 'membership_only')";
    } else {
      where += ' AND replay_status = ?';
      params.push(replayStatus);
    }
  }
  if (search) {
    where += ' AND (title LIKE ? OR slug LIKE ? OR host_name LIKE ?)';
    const q = `%${search}%`;
    params.push(q, q, q);
  }

  const total = ((await c.env.DB.prepare(`SELECT COUNT(*) as total FROM webinars ${where}`).bind(...params).first()) as any)?.total || 0;
  const rows = await c.env.DB.prepare(
    `SELECT w.*,
            (SELECT COUNT(*) FROM webinar_registrations wr WHERE wr.webinar_id = w.id AND wr.status = 'registered') as registered_count
     FROM webinars w
     ${where}
     ORDER BY w.sort_order ASC, w.starts_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return paginated(c, rows.results, { page, limit, total });
});

adminWebinarsRoutes.post('/', async (c) => {
  const parsed = createWebinarSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ success: false, error: 'Validation error', details: parsed.error.errors }, 400);

  const body = normalizePayload(parsed.data);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const publishedAt = body.status === 'published' ? now : null;

  const existing = await c.env.DB.prepare('SELECT id FROM webinars WHERE slug = ?').bind(body.slug).first();
  if (existing) return error(c, 'Slug already exists', 409);

  await c.env.DB.prepare(
    `INSERT INTO webinars
     (id, slug, title, subtitle, body_html, thumbnail_url, host_name, starts_at, ends_at, timezone, capacity,
      join_url, calendar_url, recording_url, recording_embed_url, replay_body_html, replay_status,
      form_template_key, seo_title, seo_description, category, format, tags, status, sort_order,
      free_registration_enabled, paid_registration_enabled, paid_registration_price, share_required_count, share_message_template, short_link_enabled,
      published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, body.slug, body.title, body.subtitle || null, body.body_html || null, body.thumbnail_url || null,
    body.host_name || null, body.starts_at, body.ends_at || null, body.timezone || 'Asia/Jakarta', body.capacity || null,
    body.join_url || null, body.calendar_url || null, body.recording_url || null, body.recording_embed_url || null,
    body.replay_body_html || null, body.replay_status || 'hidden', body.form_template_key || 'webinar_free_default',
    body.seo_title || null, body.seo_description || null, body.category || null, body.format || null, body.tags || null,
    body.status || 'draft', body.sort_order || 0,
    body.free_registration_enabled ?? 1, body.paid_registration_enabled ?? 1, body.paid_registration_price ?? 99000, body.share_required_count ?? 2, body.share_message_template || null, body.short_link_enabled ?? 1,
    publishedAt, now, now
  ).run();

  return success(c, { id }, 201);
});

adminWebinarsRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const webinar = await c.env.DB.prepare(
    `SELECT w.*,
            (SELECT COUNT(*) FROM webinar_registrations wr WHERE wr.webinar_id = w.id AND wr.status = 'registered') as registered_count
     FROM webinars w WHERE w.id = ?`
  ).bind(id).first();
  if (!webinar) return error(c, 'Webinar not found', 404);
  return success(c, webinar);
});

adminWebinarsRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const parsed = updateWebinarSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ success: false, error: 'Validation error', details: parsed.error.errors }, 400);

  const existing = await c.env.DB.prepare('SELECT * FROM webinars WHERE id = ?').bind(id).first() as any;
  if (!existing) return error(c, 'Webinar not found', 404);

  const body = normalizePayload(parsed.data);
  if (body.slug && body.slug !== existing.slug) {
    const conflict = await c.env.DB.prepare('SELECT id FROM webinars WHERE slug = ? AND id != ?').bind(body.slug, id).first();
    if (conflict) return error(c, 'Slug already exists', 409);
  }

  const allowed = [
    'slug', 'title', 'subtitle', 'body_html', 'thumbnail_url', 'host_name', 'starts_at', 'ends_at',
    'timezone', 'capacity', 'join_url', 'calendar_url', 'recording_url', 'recording_embed_url',
    'replay_body_html', 'replay_status', 'form_template_key', 'seo_title', 'seo_description',
    'category', 'format', 'tags',
    'status', 'sort_order', 'free_registration_enabled', 'paid_registration_enabled', 'paid_registration_price',
    'share_required_count', 'share_message_template', 'short_link_enabled'
  ];
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const key of allowed) {
    if (key in body) {
      fields.push(`${key} = ?`);
      values.push(body[key]);
    }
  }
  if (body.status === 'published' && !existing.published_at) {
    fields.push('published_at = ?');
    values.push(new Date().toISOString());
  }
  if (fields.length === 0) return error(c, 'No fields to update', 400);
  fields.push('updated_at = ?');
  values.push(new Date().toISOString(), id);

  await c.env.DB.prepare(`UPDATE webinars SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
  return success(c, { message: 'Webinar updated' });
});

adminWebinarsRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT id FROM webinars WHERE id = ?').bind(id).first();
  if (!existing) return error(c, 'Webinar not found', 404);

  const regs = await c.env.DB.prepare('SELECT COUNT(*) as count FROM webinar_registrations WHERE webinar_id = ?').bind(id).first() as any;
  if (Number(regs?.count || 0) > 0) {
    await c.env.DB.prepare("UPDATE webinars SET status = 'archived', updated_at = ? WHERE id = ?").bind(new Date().toISOString(), id).run();
    return success(c, { message: 'Webinar archived' });
  }

  await c.env.DB.prepare('DELETE FROM webinars WHERE id = ?').bind(id).run();
  return success(c, { message: 'Webinar deleted' });
});

adminWebinarsRoutes.get('/:id/registrations', async (c) => {
  const id = c.req.param('id');
  const url = new URL(c.req.url);
  const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '25', 10), 1), 100);
  const search = (url.searchParams.get('search') || '').trim();
  const offset = (page - 1) * limit;

  const webinar = await c.env.DB.prepare('SELECT id FROM webinars WHERE id = ?').bind(id).first();
  if (!webinar) return error(c, 'Webinar not found', 404);

  let where = 'WHERE wr.webinar_id = ?';
  const params: unknown[] = [id];
  if (search) {
    where += ' AND (wr.name LIKE ? OR wr.email LIKE ? OR wr.phone LIKE ? OR wr.affiliate_code LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  const totalRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total
     FROM webinar_registrations wr
     ${where}`
  ).bind(...params).first() as { total?: number } | null;

  const rows = await c.env.DB.prepare(
    `SELECT wr.*, u.name as user_name, u.email as user_email
     FROM webinar_registrations wr
     JOIN users u ON u.id = wr.user_id
     ${where}
     ORDER BY wr.registered_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return paginated(c, rows.results, { page, limit, total: Number(totalRow?.total || 0) });
});

adminWebinarsRoutes.get('/:id/analytics', async (c) => {
  const id = c.req.param('id');
  const webinar = await c.env.DB.prepare('SELECT id, starts_at, ends_at FROM webinars WHERE id = ?').bind(id).first() as any;
  if (!webinar) return error(c, 'Webinar not found', 404);

  const stats = await c.env.DB.prepare(`
    SELECT
      COUNT(wr.id) as total_registered,
      SUM(CASE WHEN wr.membership_status_at_registration IS NULL OR wr.membership_status_at_registration IN ('free', 'expired', 'cancelled') THEN 1 ELSE 0 END) as free_before,
      SUM(CASE WHEN wr.membership_status_at_registration = 'active' THEN 1 ELSE 0 END) as paid_before
    FROM webinar_registrations wr
    WHERE wr.webinar_id = ? AND wr.status IN ('registered', 'registered_free', 'registered_paid')
  `).bind(id).first() as any;

  // Converted: free before, and paid within 3 days
  const converted = await c.env.DB.prepare(`
    SELECT COUNT(DISTINCT wr.user_id) as converted_to_paid
    FROM webinar_registrations wr
    JOIN webinars w ON w.id = wr.webinar_id
    JOIN orders o ON o.user_id = wr.user_id
    WHERE wr.webinar_id = ? 
      AND wr.status IN ('registered', 'registered_free', 'registered_paid')
      AND (wr.membership_status_at_registration IS NULL OR wr.membership_status_at_registration IN ('free', 'expired', 'cancelled'))
      AND o.status = 'paid'
      AND o.order_type = 'membership'
      AND o.created_at >= wr.registered_at
      AND o.created_at <= datetime(COALESCE(w.ends_at, w.starts_at), '+3 days')
  `).bind(id).first() as any;

  const gateStats = await c.env.DB.prepare(`
    SELECT
      SUM(CASE WHEN registration_type = 'free_share' THEN 1 ELSE 0 END) as free_selected_count,
      SUM(CASE WHEN status = 'registered_free' THEN 1 ELSE 0 END) as free_confirmed_count,
      SUM(CASE WHEN registration_type = 'paid' THEN 1 ELSE 0 END) as paid_selected_count,
      SUM(CASE WHEN status = 'registered_paid' THEN 1 ELSE 0 END) as paid_confirmed_count,
      SUM(CASE WHEN short_link_id IS NOT NULL OR referral_click_id IS NOT NULL THEN 1 ELSE 0 END) as short_link_registration_count,
      SUM(CASE WHEN status = 'registered_paid' AND (short_link_id IS NOT NULL OR referral_click_id IS NOT NULL) THEN 1 ELSE 0 END) as short_link_paid_registration_count
    FROM webinar_registrations
    WHERE webinar_id = ?
  `).bind(id).first() as any;

  const shortLinkStats = await c.env.DB.prepare(`
    SELECT SUM(click_count) as total_clicks
    FROM shortlinks
    WHERE destination_type = 'webinar' AND destination_id = ?
  `).bind(id).first() as any;

  const revenueStats = await c.env.DB.prepare(`
    SELECT SUM(o.amount) as paid_registration_revenue
    FROM orders o
    JOIN webinar_registrations wr ON wr.payment_order_id = o.id
    WHERE wr.webinar_id = ? AND o.status = 'paid' AND o.order_type = 'webinar_registration'
  `).bind(id).first() as any;

  const free_selected = Number(gateStats?.free_selected_count || 0);
  const free_confirmed = Number(gateStats?.free_confirmed_count || 0);
  const paid_selected = Number(gateStats?.paid_selected_count || 0);
  const paid_confirmed = Number(gateStats?.paid_confirmed_count || 0);

  return success(c, {
    total_registered: stats?.total_registered || 0,
    free_before: stats?.free_before || 0,
    paid_before: stats?.paid_before || 0,
    converted_to_paid: converted?.converted_to_paid || 0,
    gate: {
      free_selected_count: free_selected,
      free_confirmed_count: free_confirmed,
      paid_selected_count: paid_selected,
      paid_confirmed_count: paid_confirmed,
      free_completion_rate: free_selected > 0 ? free_confirmed / free_selected : 0,
      paid_completion_rate: paid_selected > 0 ? paid_confirmed / paid_selected : 0,
      dropoff_free_count: free_selected - free_confirmed,
      dropoff_paid_count: paid_selected - paid_confirmed,
      paid_registration_revenue: Number(revenueStats?.paid_registration_revenue || 0),
      short_link_registration_count: Number(gateStats?.short_link_registration_count || 0),
      short_link_paid_registration_count: Number(gateStats?.short_link_paid_registration_count || 0),
      total_short_link_clicks: Number(shortLinkStats?.total_clicks || 0),
    }
  });
});

adminWebinarsRoutes.get('/:id/analytics/registrants', async (c) => {
  const id = c.req.param('id');
  const url = new URL(c.req.url);
  const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '25', 10), 1), 100);
  const search = (url.searchParams.get('search') || '').trim();
  const offset = (page - 1) * limit;

  const webinar = await c.env.DB.prepare('SELECT id FROM webinars WHERE id = ?').bind(id).first();
  if (!webinar) return error(c, 'Webinar not found', 404);

  let where = 'WHERE wr.webinar_id = ?';
  const params: unknown[] = [id];
  if (search) {
    where += ' AND (wr.name LIKE ? OR wr.email LIKE ? OR wr.phone LIKE ? OR wr.affiliate_code LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  const totalRow = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM webinar_registrations wr ${where}`).bind(...params).first() as any;

  const rows = await c.env.DB.prepare(`
    SELECT wr.*, 
      u.name as user_name, u.email as user_email,
      (SELECT o.status 
       FROM orders o 
       WHERE o.user_id = wr.user_id 
         AND o.status = 'paid' 
         AND o.order_type = 'membership' 
         AND o.created_at >= wr.registered_at 
         AND o.created_at <= datetime((SELECT COALESCE(ends_at, starts_at) FROM webinars WHERE id = wr.webinar_id), '+3 days')
       LIMIT 1) as after_conversion_status
    FROM webinar_registrations wr
    JOIN users u ON u.id = wr.user_id
    ${where}
    ORDER BY wr.registered_at DESC
    LIMIT ? OFFSET ?
  `).bind(...params, limit, offset).all();

  return paginated(c, rows.results, { page, limit, total: Number(totalRow?.total || 0) });
});

export default adminWebinarsRoutes;
