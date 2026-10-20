import type { Env } from '../env';

export async function checkUserAccess(env: Env, userId: string, courseId: string): Promise<{ hasAccess: boolean; accessReason?: string }> {
  // 1. Check if course is free
  const course = await env.DB.prepare('SELECT access_type FROM courses WHERE id = ?').bind(courseId).first();
  if (!course) return { hasAccess: false };

  // If free, they technically have access to view, but they still need an enrollment record for progress tracking.
  // We'll return true here, but the UI should force them to "Enroll for Free" first.
  if (course.access_type === 'free') {
    const enrollment = await env.DB.prepare('SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?').bind(userId, courseId).first();
    if (enrollment) return { hasAccess: true, accessReason: 'free_enrolled' };
    return { hasAccess: true, accessReason: 'free_course' };
  }

  // 2. Check if user is an admin (Admins get all access)
  const user = await env.DB.prepare('SELECT role FROM users WHERE id = ?').bind(userId).first();
  if (user && (user.role === 'admin' || user.role === 'super_admin')) {
    return { hasAccess: true, accessReason: 'admin' };
  }

  // 3. Check specific course purchase via user_access table (created by payment webhook).
  // IMPORTANT: Do NOT use the enrollments table here. Enrollments are auto-created for
  // progress tracking when membership users visit a course, so they persist even after
  // membership expires. Only user_access records tied to paid orders grant permanent access.
  const now = new Date().toISOString();
  const specificAccess = await env.DB.prepare(
    `SELECT id FROM user_access
     WHERE user_id = ? AND resource_type = 'course' AND resource_id = ?
       AND status = 'active'
       AND (expires_at IS NULL OR expires_at > ?)`
  ).bind(userId, courseId, now).first();

  if (specificAccess) {
    return { hasAccess: true, accessReason: 'specific_purchase' };
  }

  // 4. Check active membership (only applies if course is membership_only or paid)
  const membership = await env.DB.prepare(
    `SELECT id FROM memberships WHERE user_id = ? AND status = 'active' AND (expires_at IS NULL OR expires_at > ?)`
  ).bind(userId, now).first();

  if (membership) {
    return { hasAccess: true, accessReason: 'active_membership' };
  }

  return { hasAccess: false };
}
