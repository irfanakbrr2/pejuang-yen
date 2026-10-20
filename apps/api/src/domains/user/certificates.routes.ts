import { Hono, type Context } from 'hono';
import type { Env } from '../../env';
import { authMiddleware } from '../../middleware/auth';
import { success, error } from '../../lib/response';
import { trackServerEvent } from '../../lib/tracking';

const certificatesRoutes = new Hono<{ Bindings: Env }>();
certificatesRoutes.use('*', authMiddleware());

const MEMBERSHIP_CERTIFICATE_MESSAGE =
  'E-sertifikat hanya bisa didapatkan oleh user yang berlangganan membership aktif';

async function hasCertificateMembership(c: Context<{ Bindings: Env }>, user: { id: string; role?: string }) {
  if (user.role === 'admin' || user.role === 'super_admin') return true;

  const now = new Date().toISOString();
  const membership = await c.env.DB.prepare(
    `SELECT id FROM memberships
     WHERE user_id = ? AND status = 'active'
       AND starts_at <= ?
       AND (expires_at IS NULL OR expires_at > ?)
     LIMIT 1`
  ).bind(user.id, now, now).first();

  return !!membership;
}

// GET /api/user/certificates — Issued certs
certificatesRoutes.get('/', async (c) => {
  const user = c.get('user');
  const hasActiveMembership = await hasCertificateMembership(c, user);
  if (!hasActiveMembership) return success(c, []);

  const rows = await c.env.DB.prepare(
    `SELECT c.*, co.title as course_title, co.thumbnail_url
     FROM certificates c
     JOIN courses co ON c.course_id = co.id
     WHERE c.user_id = ? AND c.revoked_at IS NULL
       AND co.access_type != 'free'
     ORDER BY c.issued_at DESC`
  ).bind(user.id).all();
  return success(c, rows.results);
});

// GET /api/user/certificates/eligible — 100% complete membership-eligible courses without cert
certificatesRoutes.get('/eligible', async (c) => {
  const user = c.get('user');
  const hasActiveMembership = await hasCertificateMembership(c, user);

  const completedNonFreeCourses = await c.env.DB.prepare(
    `SELECT e.id as enrollment_id, e.course_id, co.title as course_title,
            co.thumbnail_url, co.access_type
     FROM enrollments e
     JOIN courses co ON e.course_id = co.id
     WHERE e.user_id = ?
       AND co.access_type != 'free'
       AND NOT EXISTS (
         SELECT 1 FROM certificates cert
         WHERE cert.user_id = e.user_id AND cert.course_id = e.course_id AND cert.revoked_at IS NULL
       )
       AND (SELECT COUNT(*) FROM lessons l WHERE l.course_id = e.course_id AND l.status = 'published') > 0
       AND (SELECT COUNT(*) FROM lessons l WHERE l.course_id = e.course_id AND l.status = 'published')
         = (SELECT COUNT(*) FROM lesson_progress lp WHERE lp.enrollment_id = e.id AND lp.status = 'completed')`
  ).bind(user.id).all();

  const completedFreeCourses = await c.env.DB.prepare(
    `SELECT e.id as enrollment_id, e.course_id, co.title as course_title,
            co.thumbnail_url, co.access_type
     FROM enrollments e
     JOIN courses co ON e.course_id = co.id
     WHERE e.user_id = ?
       AND co.access_type = 'free'
       AND (SELECT COUNT(*) FROM lessons l WHERE l.course_id = e.course_id AND l.status = 'published') > 0
       AND (SELECT COUNT(*) FROM lessons l WHERE l.course_id = e.course_id AND l.status = 'published')
         = (SELECT COUNT(*) FROM lesson_progress lp WHERE lp.enrollment_id = e.id AND lp.status = 'completed')`
  ).bind(user.id).all();

  return success(c, {
    eligible: hasActiveMembership ? completedNonFreeCourses.results : [],
    membership_required: hasActiveMembership ? [] : completedNonFreeCourses.results,
    completed_free_courses: completedFreeCourses.results,
    has_active_membership: hasActiveMembership,
    certificate_message: MEMBERSHIP_CERTIFICATE_MESSAGE,
  });
});

// GET /api/user/certificates/:id
certificatesRoutes.get('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const hasActiveMembership = await hasCertificateMembership(c, user);
  if (!hasActiveMembership) return error(c, MEMBERSHIP_CERTIFICATE_MESSAGE, 403);

  const cert = await c.env.DB.prepare(
    `SELECT c.*, co.title as course_title, co.thumbnail_url, u.name as user_name
     FROM certificates c
     JOIN courses co ON c.course_id = co.id
     JOIN users u ON c.user_id = u.id
     WHERE c.id = ? AND c.user_id = ? AND c.revoked_at IS NULL
       AND co.access_type != 'free'`
  ).bind(id, user.id).first();
  if (!cert) return error(c, 'Certificate not found', 404);
  return success(c, cert);
});

// POST /api/user/certificates/generate
certificatesRoutes.post('/generate', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();
  const { course_id } = body;

  if (!course_id) return error(c, 'Course ID required', 400);

  // Check course exists and is not free
  const course = await c.env.DB.prepare(
    'SELECT id, access_type FROM courses WHERE id = ? AND status = ?'
  ).bind(course_id, 'published').first();

  if (!course) return error(c, 'Kelas tidak ditemukan', 404);
  if (course.access_type === 'free') {
    return error(c, 'Kelas gratis tidak menerbitkan e-sertifikat. Sertifikat hanya bisa didapatkan oleh user yang berlangganan membership.', 403);
  }

  const hasActiveMembership = await hasCertificateMembership(c, user);
  if (!hasActiveMembership) {
    return error(c, MEMBERSHIP_CERTIFICATE_MESSAGE, 403);
  }

  // Check if already generated
  const existing = await c.env.DB.prepare(
    'SELECT id, certificate_number FROM certificates WHERE user_id = ? AND course_id = ? AND revoked_at IS NULL'
  ).bind(user.id, course_id).first();
  if (existing) return success(c, { certificate_number: existing.certificate_number });

  // Verify enrollment
  const enrollment = await c.env.DB.prepare(
    'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? AND status = ?'
  ).bind(user.id, course_id, 'active').first();
  if (!enrollment) return error(c, 'Kamu belum terdaftar di kelas ini', 403);

  // Verify 100% completion
  const totalLessons = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM lessons WHERE course_id = ? AND status = 'published'"
  ).bind(course_id).first();
  const completedLessons = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM lesson_progress WHERE enrollment_id = ? AND status = 'completed'"
  ).bind(enrollment.id).first();

  if (!totalLessons || (totalLessons.count as number) === 0 || completedLessons?.count !== totalLessons.count) {
    return error(c, 'Selesaikan 100% materi kelas terlebih dahulu', 400);
  }

  const certNumber = `PY-${new Date().getFullYear()}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO certificates (id, user_id, course_id, enrollment_id, certificate_number, issued_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), user.id, course_id, enrollment.id, certNumber, now).run();

  await c.env.DB.prepare(
    `INSERT INTO notifications (id, user_id, type, title, body, data_json, status, sent_at, created_at)
     VALUES (?, ?, 'certificate', ?, ?, ?, 'sent', ?, ?)`
  ).bind(
    crypto.randomUUID(),
    user.id,
    'Sertifikat Baru',
    `Sertifikat baru berhasil diterbitkan untuk kelas ini.`,
    JSON.stringify({ url: '/certificates' }),
    now,
    now
  ).run();

  c.executionCtx.waitUntil(trackServerEvent(c.env, {
    event_name: 'certificate_generated',
    event_category: 'learning',
    user_id: user.id,
    course_id,
    metadata: { certificate_number: certNumber },
  }));

  return success(c, { certificate_number: certNumber }, 201);
});

export default certificatesRoutes;
