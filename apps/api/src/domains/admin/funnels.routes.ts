import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error, paginated } from '../../lib/response';
import {
  FUNNEL_TRIGGER_TYPES,
  FUNNEL_STEP_TYPES,
  resolveStepProduct,
  validateStepConfig,
} from '../funnels/service';

const adminFunnelsRoutes = new Hono<{ Bindings: Env }>();

adminFunnelsRoutes.use('*', authMiddleware());
adminFunnelsRoutes.use('*', requireRole('admin', 'super_admin'));

const FUNNEL_STATUSES = new Set(['draft', 'active', 'archived']);

async function triggerProductLabel(env: Env, type: string, id: string): Promise<string> {
  if (id === '*') return `Semua ${type}`;
  const product = await resolveStepProduct(env, type, id);
  if (product) return product.name;
  // webinar bukan step product, resolve manual
  if (type === 'webinar_registration') {
    const row = await env.DB.prepare('SELECT title FROM webinars WHERE id = ?').bind(id).first();
    if (row?.title) return row.title as string;
  }
  return id;
}

// GET /api/admin/funnels?page&limit
adminFunnelsRoutes.get('/', async (c) => {
  try {
    const url = new URL(c.req.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)), 100);

    const [rows, totalRow] = await Promise.all([
      c.env.DB.prepare(
        `SELECT f.*,
           (SELECT COUNT(*) FROM funnel_steps s WHERE s.funnel_id = f.id AND s.enabled = 1) as enabled_steps,
           (SELECT COUNT(*) FROM funnel_events e WHERE e.funnel_id = f.id AND e.event_type = 'converted') as conversions,
           (SELECT COALESCE(SUM(amount), 0) FROM funnel_events e WHERE e.funnel_id = f.id AND e.event_type = 'converted') as revenue
         FROM funnels f WHERE f.owner_user_id IS NULL
         ORDER BY f.created_at DESC LIMIT ? OFFSET ?`
      ).bind(limit, (page - 1) * limit).all(),
      c.env.DB.prepare('SELECT COUNT(*) as total FROM funnels WHERE owner_user_id IS NULL').first(),
    ]);

    const withLabels = await Promise.all((rows.results as Record<string, unknown>[]).map(async (f) => ({
      ...f,
      trigger_label: await triggerProductLabel(c.env, f.trigger_product_type as string, f.trigger_product_id as string),
    })));

    return paginated(c, withLabels, { page, limit, total: Number(totalRow?.total || 0) });
  } catch (err) {
    console.error('[admin:funnels:list]', err);
    return error(c, 'Gagal memuat funnels', 500);
  }
});

// POST /api/admin/funnels
adminFunnelsRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const name = String(body.name || '').trim();
    const triggerType = String(body.trigger_product_type || '');
    const triggerId = String(body.trigger_product_id || '').trim();

    if (!name) return error(c, 'Nama funnel wajib diisi', 400);
    if (!(FUNNEL_TRIGGER_TYPES as readonly string[]).includes(triggerType)) {
      return error(c, 'trigger_product_type tidak valid', 400);
    }
    if (!triggerId) return error(c, 'trigger_product_id wajib diisi (atau "*" untuk semua)', 400);

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO funnels (id, owner_user_id, name, trigger_product_type, trigger_product_id, status, offer_window_minutes, exit_url, created_at, updated_at)
       VALUES (?, NULL, ?, ?, ?, 'draft', ?, ?, ?, ?)`
    ).bind(
      id, name, triggerType, triggerId,
      Math.max(1, Number(body.offer_window_minutes) || 15),
      body.exit_url || null, now, now
    ).run();

    return success(c, { id }, 201);
  } catch (err) {
    console.error('[admin:funnels:create]', err);
    return error(c, 'Gagal membuat funnel', 500);
  }
});

// GET /api/admin/funnels/options/:type — daftar produk untuk picker
// (terdaftar SEBELUM /:id supaya tidak tertelan param route)
adminFunnelsRoutes.get('/options/:type', async (c) => {
  try {
    const type = c.req.param('type') || '';
    let rows: { results: unknown[] } = { results: [] };
    if (type === 'course') {
      rows = await c.env.DB.prepare("SELECT id, title as name, price FROM courses WHERE status = 'published' ORDER BY title").all();
    } else if (type === 'membership') {
      rows = await c.env.DB.prepare("SELECT id, name, price FROM membership_plans WHERE status = 'active' ORDER BY sort_order").all();
    } else if (type === 'digital_product') {
      rows = await c.env.DB.prepare("SELECT id, name, price FROM digital_products WHERE status = 'active' ORDER BY name").all();
    } else if (type === 'tool_credits') {
      rows = await c.env.DB.prepare('SELECT id, name, price FROM tool_credit_packages WHERE is_active = 1 ORDER BY price').all();
    } else if (type === 'webinar_registration') {
      rows = await c.env.DB.prepare("SELECT id, title as name, paid_registration_price as price FROM webinars WHERE status = 'published' ORDER BY starts_at DESC").all();
    } else {
      return error(c, 'Tipe tidak valid', 400);
    }
    return success(c, rows.results);
  } catch (err) {
    console.error('[admin:funnels:options]', err);
    return error(c, 'Gagal memuat opsi produk', 500);
  }
});

// GET /api/admin/funnels/:id — detail + steps (dengan label produk)
adminFunnelsRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const funnel = await c.env.DB.prepare('SELECT * FROM funnels WHERE id = ? AND owner_user_id IS NULL').bind(id).first();
    if (!funnel) return error(c, 'Funnel tidak ditemukan', 404);

    const steps = await c.env.DB.prepare('SELECT * FROM funnel_steps WHERE funnel_id = ?').bind(id).all();
    const stepsWithLabels = await Promise.all((steps.results as Record<string, unknown>[]).map(async (s) => {
      const product = await resolveStepProduct(c.env, s.product_type as string, s.product_id as string);
      return { ...s, product_label: product?.name || s.product_id, product_price: product?.price ?? null };
    }));

    return success(c, {
      ...funnel,
      trigger_label: await triggerProductLabel(c.env, funnel.trigger_product_type as string, funnel.trigger_product_id as string),
      steps: stepsWithLabels,
    });
  } catch (err) {
    console.error('[admin:funnels:detail]', err);
    return error(c, 'Gagal memuat funnel', 500);
  }
});

// PUT /api/admin/funnels/:id
adminFunnelsRoutes.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const funnel = await c.env.DB.prepare('SELECT * FROM funnels WHERE id = ? AND owner_user_id IS NULL').bind(id).first();
    if (!funnel) return error(c, 'Funnel tidak ditemukan', 404);

    const name = body.name !== undefined ? String(body.name).trim() : (funnel.name as string);
    const status = body.status !== undefined ? String(body.status) : (funnel.status as string);
    const triggerType = body.trigger_product_type !== undefined ? String(body.trigger_product_type) : (funnel.trigger_product_type as string);
    const triggerId = body.trigger_product_id !== undefined ? String(body.trigger_product_id).trim() : (funnel.trigger_product_id as string);

    if (!name) return error(c, 'Nama funnel wajib diisi', 400);
    if (!FUNNEL_STATUSES.has(status)) return error(c, 'status tidak valid', 400);
    if (!(FUNNEL_TRIGGER_TYPES as readonly string[]).includes(triggerType)) return error(c, 'trigger_product_type tidak valid', 400);
    if (!triggerId) return error(c, 'trigger_product_id wajib diisi', 400);

    const now = new Date().toISOString();
    try {
      await c.env.DB.prepare(
        `UPDATE funnels SET name = ?, status = ?, trigger_product_type = ?, trigger_product_id = ?, offer_window_minutes = ?, exit_url = ?, updated_at = ? WHERE id = ?`
      ).bind(
        name, status, triggerType, triggerId,
        body.offer_window_minutes !== undefined ? Math.max(1, Number(body.offer_window_minutes) || 15) : funnel.offer_window_minutes,
        body.exit_url !== undefined ? (body.exit_url || null) : funnel.exit_url,
        now, id
      ).run();
    } catch (err: unknown) {
      // partial unique index: satu funnel aktif per produk trigger
      const message = err instanceof Error ? err.message : '';
      if (message.includes('UNIQUE')) {
        return error(c, 'Sudah ada funnel aktif untuk produk trigger ini — nonaktifkan dulu yang lama', 409);
      }
      throw err;
    }

    return success(c, { id });
  } catch (err) {
    console.error('[admin:funnels:update]', err);
    return error(c, 'Gagal mengubah funnel', 500);
  }
});

// PUT /api/admin/funnels/:id/steps/:stepType — upsert step
adminFunnelsRoutes.put('/:id/steps/:stepType', async (c) => {
  try {
    const id = c.req.param('id');
    const stepType = c.req.param('stepType') || '';
    const funnel = await c.env.DB.prepare('SELECT * FROM funnels WHERE id = ? AND owner_user_id IS NULL').bind(id).first();
    if (!funnel) return error(c, 'Funnel tidak ditemukan', 404);
    if (!(FUNNEL_STEP_TYPES as readonly string[]).includes(stepType)) return error(c, 'step_type tidak valid', 400);

    const body = await c.req.json();
    const validationError = await validateStepConfig(c.env, funnel as Record<string, unknown>, stepType, body);
    if (validationError) return error(c, validationError, 400);

    const now = new Date().toISOString();
    const existing = await c.env.DB.prepare(
      'SELECT id FROM funnel_steps WHERE funnel_id = ? AND step_type = ?'
    ).bind(id, stepType).first();

    if (existing) {
      await c.env.DB.prepare(
        `UPDATE funnel_steps SET enabled = ?, product_type = ?, product_id = ?, price_override = ?,
           headline = ?, description = ?, badge_text = ?, image_url = ?, countdown_seconds = ?, updated_at = ?
         WHERE id = ?`
      ).bind(
        body.enabled === false ? 0 : 1,
        String(body.product_type), String(body.product_id),
        body.price_override != null && body.price_override !== '' ? Math.floor(Number(body.price_override)) : null,
        body.headline || null, body.description || null, body.badge_text || null, body.image_url || null,
        body.countdown_seconds != null && body.countdown_seconds !== '' ? Math.max(10, Number(body.countdown_seconds)) : null,
        now, existing.id
      ).run();
      return success(c, { id: existing.id });
    }

    const stepId = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO funnel_steps (id, funnel_id, step_type, enabled, product_type, product_id, price_override, headline, description, badge_text, image_url, countdown_seconds, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      stepId, id, stepType,
      body.enabled === false ? 0 : 1,
      String(body.product_type), String(body.product_id),
      body.price_override != null && body.price_override !== '' ? Math.floor(Number(body.price_override)) : null,
      body.headline || null, body.description || null, body.badge_text || null, body.image_url || null,
      body.countdown_seconds != null && body.countdown_seconds !== '' ? Math.max(10, Number(body.countdown_seconds)) : null,
      now, now
    ).run();

    return success(c, { id: stepId }, 201);
  } catch (err) {
    console.error('[admin:funnels:step-upsert]', err);
    return error(c, 'Gagal menyimpan step', 500);
  }
});

// DELETE /api/admin/funnels/:id — hanya bila belum punya offers/events
adminFunnelsRoutes.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const used = await c.env.DB.prepare(
      `SELECT (SELECT COUNT(*) FROM funnel_offers WHERE funnel_id = ?) +
              (SELECT COUNT(*) FROM funnel_events WHERE funnel_id = ?) as total`
    ).bind(id, id).first();
    if (Number(used?.total || 0) > 0) {
      return error(c, 'Funnel sudah punya riwayat — arsipkan saja (status archived)', 400);
    }
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM funnel_steps WHERE funnel_id = ?').bind(id),
      c.env.DB.prepare('DELETE FROM funnels WHERE id = ? AND owner_user_id IS NULL').bind(id),
    ]);
    return success(c, { deleted: true });
  } catch (err) {
    console.error('[admin:funnels:delete]', err);
    return error(c, 'Gagal menghapus funnel', 500);
  }
});

// GET /api/admin/funnels/:id/stats?from&to
adminFunnelsRoutes.get('/:id/stats', async (c) => {
  try {
    const id = c.req.param('id');
    const from = c.req.query('from') || '1970-01-01';
    const to = c.req.query('to') || '2999-12-31';

    const rows = await c.env.DB.prepare(
      `SELECT step_type, event_type, COUNT(*) as count, COALESCE(SUM(amount), 0) as amount
       FROM funnel_events
       WHERE funnel_id = ? AND created_at >= ? AND created_at <= ?
       GROUP BY step_type, event_type`
    ).bind(id, from, `${to}~`).all();

    const stats: Record<string, Record<string, { count: number; amount: number }>> = {};
    for (const row of rows.results as Record<string, unknown>[]) {
      const step = row.step_type as string;
      if (!stats[step]) stats[step] = {};
      stats[step][row.event_type as string] = { count: Number(row.count), amount: Number(row.amount) };
    }

    return success(c, stats);
  } catch (err) {
    console.error('[admin:funnels:stats]', err);
    return error(c, 'Gagal memuat statistik', 500);
  }
});

export default adminFunnelsRoutes;
