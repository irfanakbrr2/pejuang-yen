import type { Env } from '../../env';

export class AuthRepository {
  constructor(private env: Env) {}

  async findUserByEmail(email: string) {
    return await this.env.DB.prepare(
      'SELECT id, email, password_hash, name, phone, avatar_url, role, status, email_verified_at FROM users WHERE email = ? COLLATE NOCASE'
    ).bind(email).first();
  }

  async findUserByPhone(phone: string) {
    return await this.env.DB.prepare(
      'SELECT id FROM users WHERE phone = ?'
    ).bind(phone).first();
  }

  async createUser(userId: string, email: string, passwordHash: string, name: string, phone: string | null, now: string) {
    return await this.env.DB.prepare(
      `INSERT INTO users (id, email, password_hash, name, phone, role, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'user', 'active', ?, ?)`
    ).bind(userId, email, passwordHash, name, phone, now, now).run();
  }

  async createSession(sessionId: string, userId: string, tokenHash: string, expiresAt: string, now: string) {
    return await this.env.DB.prepare(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(sessionId, userId, tokenHash, expiresAt, now).run();
  }

  async updateLastLogin(userId: string, now: string) {
    return await this.env.DB.prepare(
      'UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?'
    ).bind(now, now, userId).run();
  }

  async revokeSession(sessionId: string, now: string) {
    return await this.env.DB.prepare(
      'UPDATE sessions SET revoked_at = ? WHERE id = ?'
    ).bind(now, sessionId).run();
  }

  async revokeAllUserSessions(userId: string, now: string) {
    return await this.env.DB.prepare(
      'UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL'
    ).bind(now, userId).run();
  }

  async getActiveMembership(userId: string) {
    return await this.env.DB.prepare(
      `SELECT m.*, mp.name as plan_name, mp.duration_type
       FROM memberships m
       JOIN membership_plans mp ON mp.id = m.plan_id
       WHERE m.user_id = ? AND m.status = 'active'
       ORDER BY m.created_at DESC LIMIT 1`
    ).bind(userId).first();
  }

  async createPasswordResetToken(id: string, userId: string, tokenHash: string, expiresAt: string, now: string) {
    return await this.env.DB.prepare(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(id, userId, tokenHash, expiresAt, now).run();
  }

  async getValidResetToken(tokenHash: string, now: string) {
    return await this.env.DB.prepare(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash = ? AND expires_at > ? AND used_at IS NULL
       LIMIT 1`
    ).bind(tokenHash, now).first();
  }

  async updatePassword(userId: string, newPasswordHash: string, now: string) {
    return await this.env.DB.prepare(
      'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?'
    ).bind(newPasswordHash, now, userId).run();
  }

  async markResetTokenAsUsed(tokenId: string, now: string) {
    return await this.env.DB.prepare(
      'UPDATE password_reset_tokens SET used_at = ? WHERE id = ?'
    ).bind(now, tokenId).run();
  }

  async resetPasswordBatch(userId: string, newPasswordHash: string, tokenId: string, now: string) {
    return await this.env.DB.batch([
      this.env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').bind(newPasswordHash, now, userId),
      this.env.DB.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?').bind(now, tokenId),
      this.env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL').bind(now, userId),
    ]);
  }
}
