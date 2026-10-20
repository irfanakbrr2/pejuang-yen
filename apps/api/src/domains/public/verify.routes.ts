import { Hono } from 'hono';
import type { Env } from '../../env';
import { success, error } from '../../lib/response';

const verifyRoutes = new Hono<{ Bindings: Env }>();

// GET /api/verify/:number — Public certificate verification (no auth required)
verifyRoutes.get('/:number', async (c) => {
  const number = c.req.param('number').toUpperCase();

  const cert = await c.env.DB.prepare(
    `SELECT cert.certificate_number, cert.issued_at, cert.revoked_at,
            u.name as user_name,
            co.title as course_title
     FROM certificates cert
     JOIN users u ON cert.user_id = u.id
     JOIN courses co ON cert.course_id = co.id
     WHERE cert.certificate_number = ?`
  ).bind(number).first();

  if (!cert) return error(c, 'Certificate not found', 404);

  return success(c, {
    certificate_number: cert.certificate_number,
    user_name: cert.user_name,
    course_title: cert.course_title,
    issued_at: cert.issued_at,
    is_valid: !cert.revoked_at,
  });
});

export default verifyRoutes;
