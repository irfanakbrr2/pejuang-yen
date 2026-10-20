import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error, paginated } from '../../lib/response';
import { writeAuditLog } from '../../lib/audit';

const adminSuccessStoriesRoutes = new Hono<{ Bindings: Env }>();
adminSuccessStoriesRoutes.use('*', authMiddleware());
adminSuccessStoriesRoutes.use('*', requireRole('admin', 'super_admin'));

const VALID_APPROVAL = new Set(['pending', 'approved', 'rejected']);

function sanitizeTags(input: unknown): string | null {
  if (!Array.isArray(input)) return null;
  const tags = input
    .filter((t): t is string => typeof t === 'string' && !!t.trim())
    .map((t) => t.trim().slice(0, 50))
    .slice(0, 10);
  return tags.length > 0 ? JSON.stringify(tags) : null;
}

function str(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}

// ─── GET /api/admin/success-stories ───────────
adminSuccessStoriesRoutes.get('/', async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const limit = Math.min(100, parseInt(c.req.query('limit') || '50', 10));
  const offset = (page - 1) * limit;
  const approval = c.req.query('approval');
  const published = c.req.query('published');
  const search = c.req.query('search');

  let where = 'WHERE 1=1';
  const params: unknown[] = [];
  if (approval && VALID_APPROVAL.has(approval)) { where += ' AND ss.approval_status = ?'; params.push(approval); }
  if (published === '1' || published === '0') { where += ' AND ss.is_published = ?'; params.push(Number(published)); }
  if (search) { where += ' AND (ss.title LIKE ? OR ss.member_name LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

  const total = ((await c.env.DB.prepare(`SELECT COUNT(*) as n FROM success_stories ss ${where}`).bind(...params).first())?.n as number) || 0;

  const rows = await c.env.DB.prepare(
    `SELECT ss.*, c2.title as course_title, u.email as member_email
     FROM success_stories ss
     LEFT JOIN courses c2 ON c2.id = ss.course_id
     LEFT JOIN users u ON u.id = ss.member_user_id
     ${where}
     ORDER BY ss.sort_order ASC, ss.created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return paginated(c, rows.results, { page, limit, total });
});

// ─── POST /api/admin/success-stories ───────────
adminSuccessStoriesRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const actor = c.get('user');

  const title = str(body.title, 200);
  const memberName = str(body.member_name, 100);
  if (!title || !memberName) return error(c, 'Judul dan nama member wajib diisi', 400);

  // Optional: link ke akun member via email
  let memberUserId: string | null = null;
  if (typeof body.member_email === 'string' && body.member_email.trim()) {
    const userRow = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(body.member_email.trim().toLowerCase()).first();
    if (userRow) memberUserId = userRow.id as string;
  }

  if (body.course_id) {
    const course = await c.env.DB.prepare('SELECT id FROM courses WHERE id = ?').bind(body.course_id).first();
    if (!course) return error(c, 'Kelas terkait tidak ditemukan', 404);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const approvalStatus = VALID_APPROVAL.has(body.approval_status) ? body.approval_status : 'pending';
  const isPublished = approvalStatus === 'approved' && body.is_published ? 1 : 0;

  await c.env.DB.prepare(
    `INSERT INTO success_stories (
       id, title, member_name, member_role, member_user_id, avatar_url,
       before_text, after_text, result_text, course_id, tags_json, quote, link_url,
       approval_status, is_featured, is_published, sort_order, created_by, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, title, memberName,
    str(body.member_role, 100),
    memberUserId,
    str(body.avatar_url, 500),
    str(body.before_text, 2000),
    str(body.after_text, 2000),
    str(body.result_text, 2000),
    str(body.course_id, 100),
    sanitizeTags(body.tags),
    str(body.quote, 1000),
    str(body.link_url, 500),
    approvalStatus,
    body.is_featured ? 1 : 0,
    isPublished,
    Number.isFinite(Number(body.sort_order)) ? Math.floor(Number(body.sort_order)) : 0,
    actor.id, now, now
  ).run();

  await writeAuditLog(c.env, {
    actorUserId: actor.id,
    action: 'create_success_story',
    entityType: 'success_story',
    entityId: id,
    after: { title, member_name: memberName, approval_status: approvalStatus },
  });

  return success(c, { id }, 201);
});

// ─── PUT /api/admin/success-stories/:id ───────────
adminSuccessStoriesRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const actor = c.get('user');

  const existing = await c.env.DB.prepare('SELECT * FROM success_stories WHERE id = ?').bind(id).first();
  if (!existing) return error(c, 'Cerita tidak ditemukan', 404);

  const fields: string[] = [];
  const values: unknown[] = [];
  const setStr = (column: string, value: unknown, max: number) => { fields.push(`${column} = ?`); values.push(str(value, max)); };

  if ('title' in body) {
    const title = str(body.title, 200);
    if (!title) return error(c, 'Judul tidak boleh kosong', 400);
    fields.push('title = ?'); values.push(title);
  }
  if ('member_name' in body) {
    const name = str(body.member_name, 100);
    if (!name) return error(c, 'Nama member tidak boleh kosong', 400);
    fields.push('member_name = ?'); values.push(name);
  }
  if ('member_role' in body) setStr('member_role', body.member_role, 100);
  if ('avatar_url' in body) setStr('avatar_url', body.avatar_url, 500);
  if ('before_text' in body) setStr('before_text', body.before_text, 2000);
  if ('after_text' in body) setStr('after_text', body.after_text, 2000);
  if ('result_text' in body) setStr('result_text', body.result_text, 2000);
  if ('quote' in body) setStr('quote', body.quote, 1000);
  if ('link_url' in body) setStr('link_url', body.link_url, 500);
  if ('course_id' in body) {
    if (body.course_id) {
      const course = await c.env.DB.prepare('SELECT id FROM courses WHERE id = ?').bind(body.course_id).first();
      if (!course) return error(c, 'Kelas terkait tidak ditemukan', 404);
    }
    setStr('course_id', body.course_id, 100);
  }
  if ('member_email' in body) {
    let memberUserId: string | null = null;
    if (typeof body.member_email === 'string' && body.member_email.trim()) {
      const userRow = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(body.member_email.trim().toLowerCase()).first();
      if (!userRow) return error(c, 'User dengan email tersebut tidak ditemukan', 404);
      memberUserId = userRow.id as string;
    }
    fields.push('member_user_id = ?'); values.push(memberUserId);
  }
  if ('tags' in body) { fields.push('tags_json = ?'); values.push(sanitizeTags(body.tags)); }
  if ('approval_status' in body && VALID_APPROVAL.has(body.approval_status)) { fields.push('approval_status = ?'); values.push(body.approval_status); }
  if ('is_featured' in body) { fields.push('is_featured = ?'); values.push(body.is_featured ? 1 : 0); }
  if ('is_published' in body) { fields.push('is_published = ?'); values.push(body.is_published ? 1 : 0); }
  if ('sort_order' in body && Number.isFinite(Number(body.sort_order))) { fields.push('sort_order = ?'); values.push(Math.floor(Number(body.sort_order))); }

  if (fields.length === 0) return error(c, 'Tidak ada perubahan', 400);

  fields.push('updated_at = ?');
  values.push(new Date().toISOString(), id);
  await c.env.DB.prepare(`UPDATE success_stories SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();

  // Guard: cerita tidak boleh published tanpa approval (consent member)
  await c.env.DB.prepare(
    `UPDATE success_stories SET is_published = 0 WHERE id = ? AND approval_status != 'approved'`
  ).bind(id).run();

  await writeAuditLog(c.env, {
    actorUserId: actor.id,
    action: 'update_success_story',
    entityType: 'success_story',
    entityId: id,
    before: existing,
    after: body,
  });

  return success(c, { message: 'Cerita diperbarui' });
});

// ─── DELETE /api/admin/success-stories/:id ───────────
adminSuccessStoriesRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const actor = c.get('user');

  const existing = await c.env.DB.prepare('SELECT * FROM success_stories WHERE id = ?').bind(id).first();
  if (!existing) return error(c, 'Cerita tidak ditemukan', 404);

  await c.env.DB.prepare('DELETE FROM success_stories WHERE id = ?').bind(id).run();

  await writeAuditLog(c.env, {
    actorUserId: actor.id,
    action: 'delete_success_story',
    entityType: 'success_story',
    entityId: id,
    before: existing,
  });

  return success(c, { message: 'Cerita dihapus' });
});

export default adminSuccessStoriesRoutes;
