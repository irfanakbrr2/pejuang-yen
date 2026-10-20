import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error } from '../../lib/response';
import { syncContentItem, invalidateDiscoveryCache } from '../../lib/content-sync';
import { setContentCategories, VALID_ASSET_TYPES } from '../../lib/categories';

const adminBonusesRoutes = new Hono<{ Bindings: Env }>();
adminBonusesRoutes.use('*', authMiddleware());
adminBonusesRoutes.use('*', requireRole('admin', 'super_admin'));

adminBonusesRoutes.get('/', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM bonuses ORDER BY created_at DESC').all();
  return success(c, rows.results);
});

adminBonusesRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  // Guard taxonomy: bonus aktif (published) wajib punya kategori + jenis aset
  if (body.status === 'active') {
    if (!body.primary_category_id) return error(c, 'Bonus tidak bisa diaktifkan tanpa primary category', 400);
    if (!body.asset_type) return error(c, 'Bonus tidak bisa diaktifkan tanpa jenis aset (Bonus Type)', 400);
  }
  if (body.asset_type && !VALID_ASSET_TYPES.has(body.asset_type)) {
    return error(c, 'Jenis aset tidak valid', 400);
  }
  if (body.related_course_id) {
    const course = await c.env.DB.prepare('SELECT id FROM courses WHERE id = ?').bind(body.related_course_id).first();
    if (!course) return error(c, 'Kelas terkait tidak ditemukan', 404);
  }

  const titleSlug = (body.title as string | undefined)?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || id;
  await c.env.DB.prepare(
    `INSERT INTO bonuses (id, slug, title, description, bonus_type, asset_type, primary_category_id, recommended_for, related_course_id,
       thumbnail_url, r2_key, external_url, required_plan_ids, access_type, status, sort_order, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    body.slug || titleSlug,
    body.title,
    body.description || null,
    body.bonus_type || 'content',
    body.asset_type || null,
    body.primary_category_id || null,
    body.recommended_for || null,
    body.related_course_id || null,
    body.thumbnail_url || null,
    body.r2_key || null,
    body.external_url || null,
    body.required_plan_ids && Array.isArray(body.required_plan_ids) ? JSON.stringify(body.required_plan_ids) : null,
    body.access_type || 'membership_only',
    body.status || 'draft',
    body.sort_order || 0,
    body.status === 'active' ? now : null,
    now, now
  ).run();

  if (body.primary_category_id || (Array.isArray(body.secondary_category_ids) && body.secondary_category_ids.length > 0)) {
    const catError = await setContentCategories(c.env.DB, 'bonus', id, {
      primaryCategoryId: body.primary_category_id || null,
      secondaryCategoryIds: body.secondary_category_ids || [],
    });
    if (catError) return error(c, catError, 400);
  }

  await syncContentItem(c.env.DB, 'bonus', id);
  await invalidateDiscoveryCache(c.env);

  return success(c, { id }, 201);
});

adminBonusesRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const now = new Date().toISOString();

  const existing = await c.env.DB.prepare('SELECT * FROM bonuses WHERE id = ?').bind(id).first();
  if (!existing) return error(c, 'Bonus tidak ditemukan', 404);

  // secondary_category_ids bukan kolom bonuses — diproses terpisah
  const secondaryCategoryIds = Array.isArray(body.secondary_category_ids)
    ? (body.secondary_category_ids as string[])
    : undefined;

  // Guard taxonomy: hasil akhir status 'active' wajib punya kategori + jenis aset
  const resultingStatus = (body.status as string) ?? (existing.status as string);
  const resultingPrimary = 'primary_category_id' in body
    ? (body.primary_category_id as string | null)
    : (existing.primary_category_id as string | null);
  const resultingAssetType = 'asset_type' in body
    ? (body.asset_type as string | null)
    : (existing.asset_type as string | null);
  if (resultingStatus === 'active') {
    if (!resultingPrimary) return error(c, 'Bonus tidak bisa diaktifkan tanpa primary category', 400);
    if (!resultingAssetType) return error(c, 'Bonus tidak bisa diaktifkan tanpa jenis aset (Bonus Type)', 400);
  }
  if (body.asset_type && !VALID_ASSET_TYPES.has(body.asset_type)) {
    return error(c, 'Jenis aset tidak valid', 400);
  }
  if (body.related_course_id) {
    const course = await c.env.DB.prepare('SELECT id FROM courses WHERE id = ?').bind(body.related_course_id).first();
    if (!course) return error(c, 'Kelas terkait tidak ditemukan', 404);
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(body)) {
    if (key === 'required_plan_ids' && Array.isArray(value)) {
      fields.push(`${key} = ?`);
      values.push(JSON.stringify(value));
    } else if (key !== 'id' && key !== 'created_at' && key !== 'required_plan_id' && key !== 'required_plan_ids' && key !== 'secondary_category_ids') {
      fields.push(`${key} = ?`);
      values.push(value ?? null);
    }
  }
  fields.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await c.env.DB.prepare(`UPDATE bonuses SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();

  if ('primary_category_id' in body || secondaryCategoryIds !== undefined) {
    const currentSecondary = secondaryCategoryIds !== undefined
      ? secondaryCategoryIds
      : ((await c.env.DB.prepare(
          `SELECT category_id FROM content_categories WHERE content_type = 'bonus' AND ref_id = ? AND is_primary = 0`
        ).bind(id).all()).results.map((r) => r.category_id as string));
    const catError = await setContentCategories(c.env.DB, 'bonus', id, {
      primaryCategoryId: resultingPrimary,
      secondaryCategoryIds: currentSecondary,
    });
    if (catError) return error(c, catError, 400);
  }

  await syncContentItem(c.env.DB, 'bonus', id);
  await invalidateDiscoveryCache(c.env);

  return success(c, { id });
});

adminBonusesRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM bonuses WHERE id = ?').bind(id).run();

  await syncContentItem(c.env.DB, 'bonus', id);
  await invalidateDiscoveryCache(c.env);

  return success(c, { message: 'Bonus deleted' });
});

// --- Bonus Files ---

adminBonusesRoutes.get('/:bonusId/files', async (c) => {
  const bonusId = c.req.param('bonusId');
  const rows = await c.env.DB.prepare('SELECT * FROM bonus_files WHERE bonus_id = ? ORDER BY sort_order ASC, created_at ASC').bind(bonusId).all();
  return success(c, rows.results);
});

adminBonusesRoutes.post('/:bonusId/files', async (c) => {
  const bonusId = c.req.param('bonusId');
  const body = await c.req.json();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await c.env.DB.prepare(
    `INSERT INTO bonus_files (id, bonus_id, title, file_type, file_url, r2_key, thumbnail_url, r2_thumbnail_key, sort_order, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    bonusId,
    body.title,
    body.file_type || 'file',
    body.file_url || null,
    body.r2_key || null,
    body.thumbnail_url || null,
    body.r2_thumbnail_key || null,
    body.sort_order || 0,
    now
  ).run();

  return success(c, { id }, 201);
});

adminBonusesRoutes.delete('/:bonusId/files/:fileId', async (c) => {
  const fileId = c.req.param('fileId');
  
  const fileRow = await c.env.DB.prepare('SELECT r2_key, r2_thumbnail_key FROM bonus_files WHERE id = ?').bind(fileId).first<{ r2_key: string | null, r2_thumbnail_key: string | null }>();
  if (fileRow) {
    if (fileRow.r2_key) {
      try {
        await c.env.R2.delete(fileRow.r2_key);
      } catch (e) {
        console.error('Failed to delete file from R2', e);
      }
    }
    if (fileRow.r2_thumbnail_key) {
      try {
        await c.env.R2.delete(fileRow.r2_thumbnail_key);
      } catch (e) {
        console.error('Failed to delete thumbnail from R2', e);
      }
    }
  }

  await c.env.DB.prepare('DELETE FROM bonus_files WHERE id = ?').bind(fileId).run();
  return success(c, { message: 'Bonus file deleted' });
});

export default adminBonusesRoutes;
