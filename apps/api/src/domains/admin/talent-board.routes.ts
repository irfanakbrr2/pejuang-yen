import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error, paginated } from '../../lib/response';
import { writeAuditLog } from '../../lib/audit';

const adminTalentBoardRoutes = new Hono<{ Bindings: Env }>();
adminTalentBoardRoutes.use('*', authMiddleware());
adminTalentBoardRoutes.use('*', requireRole('admin', 'super_admin'));

const VALID_STATUSES = new Set(['hidden', 'pending', 'visible', 'featured']);
const SETTINGS_KEY = 'talent_board_settings';

interface TalentBoardSettings {
  min_progress: number;
  min_courses_completed: number;
  min_webinar_attendance: number;
  public_enabled: boolean; // halaman user tetap coming soon selama false
}

const DEFAULT_SETTINGS: TalentBoardSettings = {
  min_progress: 70,
  min_courses_completed: 1,
  min_webinar_attendance: 0,
  public_enabled: false,
};

async function getSettings(env: Env): Promise<TalentBoardSettings> {
  try {
    const row = await env.DB.prepare('SELECT value_json FROM app_settings WHERE key = ?').bind(SETTINGS_KEY).first();
    if (!row?.value_json) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(row.value_json as string) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function sanitizeTags(input: unknown): string | null {
  if (!Array.isArray(input)) return null;
  const tags = input
    .filter((t): t is string => typeof t === 'string' && !!t.trim())
    .map((t) => t.trim().slice(0, 50))
    .slice(0, 15);
  return tags.length > 0 ? JSON.stringify(tags) : null;
}

// Statistik belajar per kandidat (progress, kelas selesai, webinar, aktivitas)
const CANDIDATE_STATS_SELECT = `
  (SELECT ROUND(AVG(e.progress_percent), 0) FROM enrollments e WHERE e.user_id = u.id) as avg_progress,
  (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id AND e.progress_percent = 100) as courses_completed,
  (SELECT COUNT(*) FROM webinar_registrations wr WHERE wr.user_id = u.id AND wr.status != 'cancelled') as webinar_count,
  (SELECT COUNT(*) FROM user_activity_days uad WHERE uad.user_id = u.id AND uad.activity_date >= date('now', '-30 days')) as active_days_30,
  (SELECT COUNT(*) FROM certificates ce WHERE ce.user_id = u.id AND ce.revoked_at IS NULL) as certificates`;

// ─── GET /api/admin/talent-board ───────────
adminTalentBoardRoutes.get('/', async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const limit = Math.min(100, parseInt(c.req.query('limit') || '50', 10));
  const offset = (page - 1) * limit;
  const status = c.req.query('status');
  const search = c.req.query('search');

  let where = 'WHERE 1=1';
  const params: unknown[] = [];
  if (status && VALID_STATUSES.has(status)) { where += ' AND tbc.status = ?'; params.push(status); }
  if (search) { where += ' AND (u.name LIKE ? OR u.email LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

  const total = ((await c.env.DB.prepare(
    `SELECT COUNT(*) as n FROM talent_board_candidates tbc JOIN users u ON u.id = tbc.user_id ${where}`
  ).bind(...params).first())?.n as number) || 0;

  const rows = await c.env.DB.prepare(
    `SELECT tbc.*, u.name, u.email, u.avatar_url, ${CANDIDATE_STATS_SELECT}
     FROM talent_board_candidates tbc
     JOIN users u ON u.id = tbc.user_id
     ${where}
     ORDER BY tbc.sort_order ASC, tbc.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return paginated(c, rows.results, { page, limit, total });
});

// ─── GET /api/admin/talent-board/settings ───────────
adminTalentBoardRoutes.get('/settings', async (c) => {
  return success(c, await getSettings(c.env));
});

// ─── PUT /api/admin/talent-board/settings ───────────
adminTalentBoardRoutes.put('/settings', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const current = await getSettings(c.env);
  const next: TalentBoardSettings = {
    min_progress: Number.isFinite(Number(body.min_progress)) ? Math.min(100, Math.max(0, Math.floor(Number(body.min_progress)))) : current.min_progress,
    min_courses_completed: Number.isFinite(Number(body.min_courses_completed)) ? Math.max(0, Math.floor(Number(body.min_courses_completed))) : current.min_courses_completed,
    min_webinar_attendance: Number.isFinite(Number(body.min_webinar_attendance)) ? Math.max(0, Math.floor(Number(body.min_webinar_attendance))) : current.min_webinar_attendance,
    public_enabled: typeof body.public_enabled === 'boolean' ? body.public_enabled : current.public_enabled,
  };

  const actor = c.get('user');
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO app_settings (key, value_json, updated_at, updated_by) VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at, updated_by = excluded.updated_by`
  ).bind(SETTINGS_KEY, JSON.stringify(next), now, actor.id).run();

  await writeAuditLog(c.env, {
    actorUserId: actor.id,
    action: 'update_talent_board_settings',
    entityType: 'app_settings',
    entityId: SETTINGS_KEY,
    before: current,
    after: next,
  });

  return success(c, next);
});

// ─── GET /api/admin/talent-board/eligible ───────────
// Saran member yang memenuhi syarat minimal tapi belum jadi kandidat.
adminTalentBoardRoutes.get('/eligible', async (c) => {
  const settings = await getSettings(c.env);
  const limit = Math.min(50, parseInt(c.req.query('limit') || '20', 10));

  const rows = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.avatar_url, ${CANDIDATE_STATS_SELECT}
     FROM users u
     WHERE u.status = 'active' AND u.role = 'user'
       AND u.id NOT IN (SELECT user_id FROM talent_board_candidates)
       AND (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id AND e.progress_percent = 100) >= ?
       AND COALESCE((SELECT AVG(e.progress_percent) FROM enrollments e WHERE e.user_id = u.id), 0) >= ?
       AND (SELECT COUNT(*) FROM webinar_registrations wr WHERE wr.user_id = u.id AND wr.status != 'cancelled') >= ?
     ORDER BY (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id AND e.progress_percent = 100) DESC
     LIMIT ?`
  ).bind(settings.min_courses_completed, settings.min_progress, settings.min_webinar_attendance, limit).all();

  return success(c, { settings, eligible: rows.results });
});

// ─── POST /api/admin/talent-board ───────────
// Tambah kandidat via user_id atau email.
adminTalentBoardRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const actor = c.get('user');

  let userId = typeof body.user_id === 'string' ? body.user_id.trim() : '';
  if (!userId && typeof body.email === 'string' && body.email.trim()) {
    const userRow = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(body.email.trim().toLowerCase()).first();
    if (!userRow) return error(c, 'User dengan email tersebut tidak ditemukan', 404);
    userId = userRow.id as string;
  }
  if (!userId) return error(c, 'user_id atau email wajib diisi', 400);

  const user = await c.env.DB.prepare('SELECT id, name FROM users WHERE id = ?').bind(userId).first();
  if (!user) return error(c, 'User tidak ditemukan', 404);

  const existing = await c.env.DB.prepare('SELECT id FROM talent_board_candidates WHERE user_id = ?').bind(userId).first();
  if (existing) return error(c, 'User sudah ada di Talent Board', 409);

  const status = VALID_STATUSES.has(body.status) ? body.status : 'pending';
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  await c.env.DB.prepare(
    `INSERT INTO talent_board_candidates (id, user_id, status, skill_tags_json, portfolio_url, admin_notes, sort_order, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, userId, status,
    sanitizeTags(body.skill_tags),
    typeof body.portfolio_url === 'string' ? body.portfolio_url.trim().slice(0, 500) || null : null,
    typeof body.admin_notes === 'string' ? body.admin_notes.trim().slice(0, 2000) || null : null,
    Number.isFinite(Number(body.sort_order)) ? Math.floor(Number(body.sort_order)) : 0,
    actor.id, now, now
  ).run();

  await writeAuditLog(c.env, {
    actorUserId: actor.id,
    action: 'create_talent_board_candidate',
    entityType: 'talent_board_candidate',
    entityId: id,
    after: { user_id: userId, status },
  });

  return success(c, { id }, 201);
});

// ─── PUT /api/admin/talent-board/:id ───────────
adminTalentBoardRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const actor = c.get('user');

  const existing = await c.env.DB.prepare('SELECT * FROM talent_board_candidates WHERE id = ?').bind(id).first();
  if (!existing) return error(c, 'Kandidat tidak ditemukan', 404);

  const fields: string[] = [];
  const values: unknown[] = [];

  if (typeof body.status === 'string' && VALID_STATUSES.has(body.status)) { fields.push('status = ?'); values.push(body.status); }
  if ('skill_tags' in body) { fields.push('skill_tags_json = ?'); values.push(sanitizeTags(body.skill_tags)); }
  if ('portfolio_url' in body) { fields.push('portfolio_url = ?'); values.push(typeof body.portfolio_url === 'string' ? body.portfolio_url.trim().slice(0, 500) || null : null); }
  if ('admin_notes' in body) { fields.push('admin_notes = ?'); values.push(typeof body.admin_notes === 'string' ? body.admin_notes.trim().slice(0, 2000) || null : null); }
  if ('sort_order' in body && Number.isFinite(Number(body.sort_order))) { fields.push('sort_order = ?'); values.push(Math.floor(Number(body.sort_order))); }

  if (fields.length === 0) return error(c, 'Tidak ada perubahan', 400);

  fields.push('updated_at = ?');
  values.push(new Date().toISOString(), id);

  await c.env.DB.prepare(`UPDATE talent_board_candidates SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();

  await writeAuditLog(c.env, {
    actorUserId: actor.id,
    action: 'update_talent_board_candidate',
    entityType: 'talent_board_candidate',
    entityId: id,
    before: existing,
    after: body,
  });

  return success(c, { message: 'Kandidat diperbarui' });
});

// ─── DELETE /api/admin/talent-board/:id ───────────
adminTalentBoardRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const actor = c.get('user');

  const existing = await c.env.DB.prepare('SELECT * FROM talent_board_candidates WHERE id = ?').bind(id).first();
  if (!existing) return error(c, 'Kandidat tidak ditemukan', 404);

  await c.env.DB.prepare('DELETE FROM talent_board_candidates WHERE id = ?').bind(id).run();

  await writeAuditLog(c.env, {
    actorUserId: actor.id,
    action: 'delete_talent_board_candidate',
    entityType: 'talent_board_candidate',
    entityId: id,
    before: existing,
  });

  return success(c, { message: 'Kandidat dihapus' });
});

// ─── GET /api/admin/talent-board/export ───────────
adminTalentBoardRoutes.get('/export', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT u.name, u.email, tbc.status, tbc.skill_tags_json, tbc.portfolio_url, tbc.admin_notes, tbc.created_at, ${CANDIDATE_STATS_SELECT}
     FROM talent_board_candidates tbc
     JOIN users u ON u.id = tbc.user_id
     ORDER BY tbc.sort_order ASC, tbc.created_at DESC
     LIMIT 5000`
  ).all();

  const header = ['name', 'email', 'status', 'skill_tags', 'portfolio_url', 'avg_progress', 'courses_completed', 'webinar_count', 'active_days_30', 'certificates', 'admin_notes', 'created_at'];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [
    header.join(','),
    ...rows.results.map((r) => {
      const row = r as Record<string, unknown>;
      let tags = '';
      try { tags = (JSON.parse((row.skill_tags_json as string) || '[]') as string[]).join('; '); } catch { /* ignore */ }
      return [row.name, row.email, row.status, tags, row.portfolio_url, row.avg_progress, row.courses_completed, row.webinar_count, row.active_days_30, row.certificates, row.admin_notes, row.created_at].map(esc).join(',');
    }),
  ].join('\n');

  return c.body(csv, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="talent-board-candidates.csv"',
  });
});

export default adminTalentBoardRoutes;
