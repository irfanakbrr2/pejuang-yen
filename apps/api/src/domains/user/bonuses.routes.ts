import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware } from '../../middleware/auth';
import { success, error } from '../../lib/response';

const userBonusesRoutes = new Hono<{ Bindings: Env }>();
userBonusesRoutes.use('*', authMiddleware());

userBonusesRoutes.get('/', async (c) => {
  const user = c.get('user');
  const now = new Date().toISOString();

  const isAdmin = user.role === 'admin' || user.role === 'super_admin';

  // Query params for filtering & pagination
  const searchQuery = c.req.query('search') || '';
  const categoryFilter = c.req.query('category') || '';
  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query('limit') || '12')));
  const offset = (page - 1) * limit;

  // Premium = punya membership aktif apa pun (bulanan/yearly/lifetime). Free = tanpa membership.
  const activeMembership = await c.env.DB.prepare(
    `SELECT 1 FROM memberships
     WHERE user_id = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > ?) LIMIT 1`
  ).bind(user.id, now).first();
  const hasActiveMembership = !!activeMembership;

  // Build WHERE clauses
  const conditions = [`b.status = 'active'`];
  const bindings: unknown[] = [];

  if (searchQuery) {
    conditions.push(`b.title LIKE ?`);
    bindings.push(`%${searchQuery}%`);
  }

  if (categoryFilter) {
    // Kategori = taxonomy 9 kategori utama (slug); match primary ATAU secondary
    conditions.push(`EXISTS (
      SELECT 1 FROM content_categories cc JOIN categories cat ON cat.id = cc.category_id
      WHERE cc.content_type = 'bonus' AND cc.ref_id = b.id AND cat.slug = ?
    )`);
    bindings.push(categoryFilter);
  }

  const whereClause = conditions.join(' AND ');

  // Get total count
  const countResult = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM bonuses b WHERE ${whereClause}`
  ).bind(...bindings).first<{ total: number }>();
  const total = countResult?.total || 0;

  // Get paginated bonuses
  const bonuses = await c.env.DB.prepare(
    `SELECT b.*,
     (SELECT cat.name FROM categories cat WHERE cat.id = b.primary_category_id) as category_name,
     (SELECT cat.slug FROM categories cat WHERE cat.id = b.primary_category_id) as category_slug,
     (SELECT json_group_array(bf.thumbnail_url)
      FROM bonus_files bf
      WHERE bf.bonus_id = b.id AND bf.thumbnail_url IS NOT NULL
      ORDER BY bf.sort_order ASC, bf.created_at ASC) as file_thumbnails,
     (SELECT COUNT(*) FROM bonus_files bf WHERE bf.bonus_id = b.id) as file_count
     FROM bonuses b
     WHERE ${whereClause}
     ORDER BY b.sort_order ASC, b.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...bindings, limit, offset).all();

  // Get tags for all bonuses in this page
  const bonusIds = bonuses.results.map((b: any) => b.id);
  let tagsMap: Record<string, { tag_type: string; tag_value: string }[]> = {};
  
  if (bonusIds.length > 0) {
    const placeholders = bonusIds.map(() => '?').join(',');
    const tagsResult = await c.env.DB.prepare(
      `SELECT resource_id, tag_type, tag_value FROM resource_tags 
       WHERE resource_type = 'bonus' AND resource_id IN (${placeholders})
       ORDER BY tag_type, tag_value`
    ).bind(...bonusIds).all();

    for (const tag of tagsResult.results as any[]) {
      if (!tagsMap[tag.resource_id]) tagsMap[tag.resource_id] = [];
      tagsMap[tag.resource_id].push({ tag_type: tag.tag_type, tag_value: tag.tag_value });
    }
  }

  // Daftar 9 kategori utama untuk chip filter; bonus_count = jumlah bonus
  // aktif per kategori (0 = chip tampil "Coming Soon")
  const categoriesResult = await c.env.DB.prepare(
    `SELECT slug, name,
       (SELECT COUNT(DISTINCT cc.ref_id) FROM content_categories cc
        JOIN bonuses b2 ON b2.id = cc.ref_id
        WHERE cc.content_type = 'bonus' AND cc.category_id = categories.id AND b2.status = 'active') as bonus_count
     FROM categories WHERE is_active = 1 ORDER BY sort_order ASC`
  ).all();
  const categories = categoriesResult.results as { slug: string; name: string; bonus_count: number }[];

  const results = bonuses.results.map((b: any) => {
    let isLocked = false;
    if (!isAdmin && b.access_type !== 'free') {
      isLocked = !hasActiveMembership;
    }

    let fileThumbnails = [];
    if (b.file_thumbnails) {
      try {
        fileThumbnails = JSON.parse(b.file_thumbnails);
      } catch (e) {
        fileThumbnails = [];
      }
    }

    const tags = tagsMap[b.id] || [];

    if (isLocked) {
      return { ...b, external_url: null, is_locked: true, file_thumbnails: fileThumbnails, tags, file_count: b.file_count || 0 };
    }
    return { ...b, is_locked: false, file_thumbnails: fileThumbnails, tags, file_count: b.file_count || 0 };
  });

  return success(c, {
    bonuses: results,
    categories,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    }
  });
});

userBonusesRoutes.get('/:bonusId', async (c) => {
  const user = c.get('user');
  const bonusId = c.req.param('bonusId');
  const now = new Date().toISOString();

  const isAdmin = user.role === 'admin' || user.role === 'super_admin';

  // Premium = punya membership aktif apa pun (bulanan/yearly/lifetime). Free = tanpa membership.
  const activeMembership = await c.env.DB.prepare(
    `SELECT 1 FROM memberships
     WHERE user_id = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > ?) LIMIT 1`
  ).bind(user.id, now).first();
  const hasActiveMembership = !!activeMembership;

  // Support both ID and slug lookup
  const bonus = await c.env.DB.prepare(
    `SELECT * FROM bonuses WHERE (id = ? OR slug = ?) AND status = 'active'`
  ).bind(bonusId, bonusId).first();

  if (!bonus) {
    return error(c, 'Bonus not found', 404);
  }

  let isLocked = false;
  if (!isAdmin && (bonus as any).access_type !== 'free') {
    isLocked = !hasActiveMembership;
  }

  const files = await c.env.DB.prepare(
    `SELECT * FROM bonus_files WHERE bonus_id = ? ORDER BY sort_order ASC, created_at ASC`
  ).bind((bonus as any).id).all();

  const scrubbedFiles = files.results.map((f: any) => {
    if (isLocked) {
      return { ...f, file_url: null };
    }
    return f;
  });

  return success(c, {
    ...(bonus as any),
    external_url: isLocked ? null : (bonus as any).external_url,
    is_locked: isLocked,
    required_plan_names: ['Premium'],
    files: scrubbedFiles
  });
});

export default userBonusesRoutes;
