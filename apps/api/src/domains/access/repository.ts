import type { Env } from '../../env';

export class AccessRepository {
  constructor(private env: Env) {}

  async getUserAccess(userId: string, resourceType: string, resourceId: string, now: string) {
    return await this.env.DB.prepare(
      `SELECT id FROM user_access 
       WHERE user_id = ? AND resource_type = ? AND resource_id = ? AND status = 'active'
       AND starts_at <= ? AND (expires_at IS NULL OR expires_at > ?)`
    ).bind(userId, resourceType, resourceId, now, now).first();
  }

  async getActiveMembership(userId: string, now: string) {
    return await this.env.DB.prepare(
      `SELECT id FROM memberships 
       WHERE user_id = ? AND status = 'active' 
       AND starts_at <= ? AND (expires_at IS NULL OR expires_at > ?)`
    ).bind(userId, now, now).first();
  }

  async grantAccess(userId: string, accessType: string, resourceType: string, resourceId: string, sourceType: string, sourceId: string | null, startsAt: string, expiresAt: string | null, now: string) {
    const id = crypto.randomUUID();
    return await this.env.DB.prepare(
      `INSERT OR IGNORE INTO user_access (id, user_id, access_type, resource_type, resource_id, source_type, source_id, status, starts_at, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`
    ).bind(id, userId, accessType, resourceType, resourceId, sourceType, sourceId, startsAt, expiresAt, now, now).run();
  }
}
