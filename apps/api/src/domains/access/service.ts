import { AccessRepository } from './repository';
import type { Env } from '../../env';
import { membershipExpiresAt } from '../../lib/dates';

export class AccessService {
  private repository: AccessRepository;

  constructor(private env: Env) {
    this.repository = new AccessRepository(env);
  }

  async canAccessCourse(userId: string, courseId: string): Promise<boolean> {
    const now = new Date().toISOString();
    
    // 1. Check direct access (e.g. individual paid class or free enrolled class)
    const access = await this.repository.getUserAccess(userId, 'course', courseId, now);
    if (access) return true;

    // 2. Check membership access
    const membership = await this.repository.getActiveMembership(userId, now);
    if (membership) return true;

    return false;
  }

  async canAccessBonus(userId: string, bonusId: string): Promise<boolean> {
    const now = new Date().toISOString();
    
    // 1. Check direct access
    const access = await this.repository.getUserAccess(userId, 'bonus', bonusId, now);
    if (access) return true;

    // 2. Check membership access
    const membership = await this.repository.getActiveMembership(userId, now);
    if (membership) return true;

    return false;
  }

  async canAccessMembershipContent(userId: string): Promise<boolean> {
    const now = new Date().toISOString();
    const membership = await this.repository.getActiveMembership(userId, now);
    return !!membership;
  }

  async grantCourseAccessFromOrder(orderId: string, userId: string, courseId: string) {
    const now = new Date().toISOString();
    await this.repository.grantAccess(userId, 'lifetime', 'course', courseId, 'order', orderId, now, null, now);
  }

  async grantMembershipAccessFromOrder(orderId: string, userId: string, planId: string, durationType: string, durationDays: number | null) {
    const nowIso = new Date().toISOString();

    // If user has an active membership, extend from its expires_at instead of starting from now
    const existing = await this.env.DB.prepare(
      `SELECT expires_at FROM memberships
       WHERE user_id = ? AND status = 'active'
       AND (expires_at IS NULL OR expires_at > ?)
       ORDER BY expires_at DESC LIMIT 1`
    ).bind(userId, nowIso).first();

    const baseDate = (existing?.expires_at as string | null) || nowIso;
    const expiresAt = membershipExpiresAt(baseDate, durationType, durationDays);

    await this.env.DB.prepare(
      `INSERT OR IGNORE INTO memberships (id, user_id, plan_id, status, starts_at, expires_at, source_order_id, created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), userId, planId, baseDate, expiresAt, orderId, nowIso, nowIso).run();
  }
}
