import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error, paginated } from '../../lib/response';

const adminCertificatesRoutes = new Hono<{ Bindings: Env }>();
adminCertificatesRoutes.use('*', authMiddleware());
adminCertificatesRoutes.use('*', requireRole('admin', 'super_admin'));

// GET /api/admin/certificates — List all certificates
adminCertificatesRoutes.get('/', async (c) => {
  const url = new URL(c.req.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
  const search = url.searchParams.get('search');
  const offset = (page - 1) * limit;

  let where = 'WHERE 1=1';
  const params: unknown[] = [];

  if (search) {
    where += ` AND (u.name LIKE ? OR u.email LIKE ? OR cert.certificate_number LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const countResult = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM certificates cert
     JOIN users u ON cert.user_id = u.id
     JOIN courses co ON cert.course_id = co.id
     ${where}`
  ).bind(...params).first();
  const total = (countResult?.total as number) || 0;

  const rows = await c.env.DB.prepare(
    `SELECT cert.id, cert.certificate_number, cert.issued_at, cert.revoked_at,
            cert.user_id, u.name as user_name, u.email as user_email,
            cert.course_id, co.title as course_title
     FROM certificates cert
     JOIN users u ON cert.user_id = u.id
     JOIN courses co ON cert.course_id = co.id
     ${where}
     ORDER BY cert.issued_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  return paginated(c, rows.results, { page, limit, total });
});

// POST /api/admin/certificates — Generate certificate for a user
adminCertificatesRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const { user_id, course_id } = body;

  if (!user_id || !course_id) return error(c, 'User ID and Course ID required', 400);

  const existing = await c.env.DB.prepare(
    'SELECT id, certificate_number FROM certificates WHERE user_id = ? AND course_id = ? AND revoked_at IS NULL'
  ).bind(user_id, course_id).first();
  if (existing) return success(c, { certificate_number: existing.certificate_number });

  const enrollment = await c.env.DB.prepare(
    'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?'
  ).bind(user_id, course_id).first();
  if (!enrollment) return error(c, 'User not enrolled in this course', 400);

  const certNumber = `PY-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
  const now = new Date().toISOString();
  const certId = crypto.randomUUID();
  const adminUser = c.get('user');

  await c.env.DB.prepare(
    `INSERT INTO certificates (id, user_id, course_id, enrollment_id, certificate_number, issued_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(certId, user_id, course_id, enrollment.id, certNumber, now).run();

  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, created_at)
     VALUES (?, ?, 'generate_certificate', 'certificate', ?, ?)`
  ).bind(crypto.randomUUID(), adminUser.id, certId, now).run();

  return success(c, { certificate_number: certNumber }, 201);
});

// DELETE /api/admin/certificates/:id — Revoke certificate
adminCertificatesRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const now = new Date().toISOString();
  const user = c.get('user');

  const cert = await c.env.DB.prepare('SELECT id FROM certificates WHERE id = ?').bind(id).first();
  if (!cert) return error(c, 'Certificate not found', 404);

  await c.env.DB.prepare('UPDATE certificates SET revoked_at = ? WHERE id = ?').bind(now, id).run();

  await c.env.DB.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, created_at)
     VALUES (?, ?, 'revoke_certificate', 'certificate', ?, ?)`
  ).bind(crypto.randomUUID(), user.id, id, now).run();

  return success(c, { message: 'Certificate revoked' });
});

export default adminCertificatesRoutes;
