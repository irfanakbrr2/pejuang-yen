import { AuthRepository } from './repository';
import type { Env } from '../../env';
import { hashPassword, verifyPassword } from '../../lib/password';
import { sha256 } from '../../lib/utils';
import type { Context } from 'hono';
import { setSessionCookie, clearSessionCookie } from '../../lib/cookies';
import { resetPasswordEmailHtml } from '../../lib/email';
import { sendMailketingEmail } from '../../services/mailketing';
import { updateEmailMarketingProfile } from '../../lib/email-suppression';
import { startSequence } from '../email/sequence-engine';
import { emailVerificationTemplate, registrationAffiliateLeadEmailHtml } from '../../lib/email-templates';
import { notifyAdminNewRegistration } from '../../lib/admin-notifications';
import { trackServerEvent, upsertUserAttribution, deviceTypeFromUA, type AttributionPatch } from '../../lib/tracking';

type AttributionTouch = {
  source?: string; medium?: string; campaign?: string; landing_page?: string;
  referrer?: string; affiliate_code?: string; referral_code?: string; webinar_id?: string; ts?: string;
};
type AttributionBody = { first?: AttributionTouch; last?: AttributionTouch };

function attributionPatchFromTouches(attribution: AttributionBody | undefined, referralSource?: string): AttributionPatch {
  const patch: AttributionPatch = {};
  for (const touch of ['first', 'last'] as const) {
    const raw = attribution?.[touch];
    if (!raw) continue;
    if (raw.source) patch[`${touch}_source`] = raw.source;
    if (raw.medium) patch[`${touch}_medium`] = raw.medium;
    if (raw.campaign) patch[`${touch}_campaign`] = raw.campaign;
    if (raw.landing_page) patch[`${touch}_landing_page`] = raw.landing_page;
    if (raw.referrer) patch[`${touch}_referrer`] = raw.referrer;
    if (raw.affiliate_code) patch[`${touch}_affiliate_code`] = raw.affiliate_code;
    if (raw.referral_code) patch[`${touch}_referral_code`] = raw.referral_code;
    if (raw.webinar_id) patch[`${touch}_webinar_id`] = raw.webinar_id;
    if (raw.ts) patch[`${touch}_touch_at`] = raw.ts;
  }
  if (referralSource) patch.signup_source = referralSource;
  return patch;
}

export class AuthService {
  private repository: AuthRepository;

  constructor(private env: Env) {
    this.repository = new AuthRepository(env);
  }

  private async sendVerificationOtp(email: string, otp: string, logLabel: string): Promise<{ error: string; status: number } | null> {
    const sendResult = await sendMailketingEmail(this.env, {
      recipient: email,
      subject: 'Kode Verifikasi PejuangYen',
      content: emailVerificationTemplate(otp),
      emailType: 'transactional',
    }, this.env.DB).catch(err => {
      console.error(`[auth] ${logLabel} verification email error:`, err);
      return { success: false, error: err instanceof Error ? err.message : 'unknown_error' };
    });

    if (!sendResult.success) {
      const failureDetail = 'error' in sendResult
        ? sendResult.error
        : 'message' in sendResult
          ? sendResult.message
          : 'unknown_error';
      console.error(`[auth] ${logLabel} verification email failed:`, failureDetail);
      return {
        error: 'Kode OTP berhasil dibuat, tetapi email verifikasi gagal dikirim. Silakan klik kirim ulang OTP.',
        status: 502,
      };
    }

    return null;
  }

  async register(c: Context, body: { email: string; password: string; name: string; phone?: string; referral_source?: string; affiliate_code?: string; attribution?: AttributionBody }): Promise<any> {
    const existing = await this.repository.findUserByEmail(body.email);
    if (existing) {
      return { error: 'Email sudah terdaftar', status: 409 };
    }

    if (body.phone) {
      const existingPhone = await this.repository.findUserByPhone(body.phone);
      if (existingPhone) {
        return { error: 'Nomor WhatsApp sudah terdaftar', status: 409 };
      }
    }

    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(body.password);

    await this.repository.createUser(userId, body.email, passwordHash, body.name, body.phone || null, now);

    // Affiliate attribution for regular registration
    if (body.affiliate_code) {
      void (async () => {
        try {
          const affiliateAccount = await this.env.DB.prepare(
            `SELECT aa.user_id, aa.affiliate_code, u.name, u.email
             FROM affiliate_accounts aa
             JOIN users u ON u.id = aa.user_id
             WHERE aa.affiliate_code = ? AND aa.status = 'active'
             LIMIT 1`
          ).bind(body.affiliate_code).first() as any;

          if (affiliateAccount && affiliateAccount.user_id !== userId) {
            await this.env.DB.prepare(
              `INSERT INTO affiliate_attributions (id, affiliate_code, user_id, attribution_type, created_at)
               VALUES (?, ?, ?, 'registration', ?)`
            ).bind(crypto.randomUUID(), affiliateAccount.affiliate_code, userId, now).run();

            await sendMailketingEmail(this.env, {
              recipient: affiliateAccount.email,
              subject: `Akun baru dari link affiliate kamu: ${body.name.split(' ')[0]}`,
              content: registrationAffiliateLeadEmailHtml({
                affiliateName: ((affiliateAccount.name as string) || 'Kamu').split(' ')[0],
                registrantName: body.name,
                dashboardUrl: 'https://app.pejuangyen.com/affiliate',
              }),
              emailType: 'transactional',
            }, this.env.DB).catch(err => console.error('[auth] affiliate registration email failed:', err));
          }
        } catch (err) {
          console.error('[auth] affiliate attribution failed:', err);
        }
      })();
    }

    void notifyAdminNewRegistration(this.env, {
      userId,
      name: body.name,
      email: body.email,
      phone: body.phone || null,
      referralSource: body.referral_source || null,
      registeredAt: now,
    }).catch(err => console.error('[auth] admin registration notification failed:', err));

    // First-party tracking: signup event + first/last-touch attribution.
    // Fire-and-forget — must never block or fail registration.
    const attrPatch = attributionPatchFromTouches(body.attribution, body.referral_source);
    const lastTouch = body.attribution?.last;
    c.executionCtx.waitUntil((async () => {
      await upsertUserAttribution(this.env, userId, attrPatch);
      await trackServerEvent(this.env, {
        event_name: 'signup_completed',
        event_category: 'auth',
        user_id: userId,
        landing_page: body.attribution?.first?.landing_page || null,
        referrer_url: lastTouch?.referrer || null,
        utm_source: lastTouch?.source || null,
        utm_medium: lastTouch?.medium || null,
        utm_campaign: lastTouch?.campaign || null,
        affiliate_code: body.affiliate_code || lastTouch?.affiliate_code || null,
        referral_code: lastTouch?.referral_code || null,
        webinar_id: lastTouch?.webinar_id || null,
        device_type: deviceTypeFromUA(c.req.header('user-agent')),
        country: ((c.req.raw as { cf?: { country?: string } }).cf?.country) || null,
        metadata: body.referral_source ? { referral_source: body.referral_source } : undefined,
      });
    })());

    // Create email marketing profile
    await updateEmailMarketingProfile(userId, body.email, {
      email_status: 'subscribed',
      marketing_consent: 1,
      engagement_score: 5,
      ...(body.referral_source ? { source: body.referral_source } : {}),
    }, this.env.DB).catch(err => console.error('[auth] profile create failed:', err));

    // Auto-verify + auto-login: di dev, ATAU saat verifikasi email dimatikan sementara
    // (DISABLE_EMAIL_VERIFICATION="true") sampai Mailketing dikonfigurasi.
    if (this.env.APP_ENV === 'development' || this.env.DISABLE_EMAIL_VERIFICATION === 'true') {
      await this.env.DB.prepare(
        `UPDATE users SET email_verified_at = ?, updated_at = ? WHERE id = ?`
      ).bind(now, now, userId).run();

      const token = crypto.randomUUID();
      const tokenHash = await sha256(token);
      const sessionId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

      await this.repository.createSession(sessionId, userId, tokenHash, expiresAt, now);
      await this.repository.updateLastLogin(userId, now);

      setSessionCookie(c, token, this.env.COOKIE_DOMAIN || 'localhost');
      await startSequence(userId, 'welcome_free_user', this.env.DB, this.env).catch(err => console.error('[auth] welcome sequence error:', err));

      return {
        success: true,
        autoVerified: true,
        data: { user: { id: userId, email: body.email, name: body.name, role: 'user' }, message: 'Registrasi berhasil.' }
      };
    }

    // Generate + store the 6-digit OTP. The OTP *email* is sent when the user
    // lands on the verification page (auto-send on mount), NOT here — so a slow
    // or failing Mailketing call can never block registration or leave the user
    // stranded with a 502 before reaching the verify step.
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await this.env.KV.put(`otp:email:${body.email}`, otp, { expirationTtl: 86400 }).catch(err => {
      console.error('[auth] KV put OTP failed:', err);
      throw new Error('Gagal menyimpan kode verifikasi. Silakan coba lagi.');
    });

    // Welcome sequence is started in verifyEmail() AFTER the email is verified —
    // not here — so lifecycle email never goes to unverified/mistyped/disposable
    // addresses that abandon at OTP. This keeps the bounce rate down.

    return {
      success: true,
      data: { user: { id: userId, email: body.email, name: body.name, role: 'user' }, message: 'Registrasi berhasil. Silakan cek email untuk verifikasi.' }
    };
  }

  async login(c: Context, body: { email: string; password: string }) {
    const user = await this.repository.findUserByEmail(body.email);

    if (!user || !user.password_hash) {
      return { error: 'Email atau password salah', status: 401 };
    }

    if (user.status !== 'active') {
      return { error: 'Akun Anda dinonaktifkan', status: 403 };
    }

    const skipVerification = this.env.APP_ENV === 'development' || this.env.DISABLE_EMAIL_VERIFICATION === 'true';
    if (!user.email_verified_at && !skipVerification) {
      return { error: 'Akun belum diverifikasi. Silakan cek email Anda.', status: 403, errorType: 'ERROR_UNVERIFIED' };
    }

    const valid = await verifyPassword(body.password, user.password_hash as string);
    if (!valid) {
      return { error: 'Email atau password salah', status: 401 };
    }

    const now = new Date().toISOString();
    const token = crypto.randomUUID();
    const tokenHash = await sha256(token);
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

    await this.repository.createSession(sessionId, user.id as string, tokenHash, expiresAt, now);
    await this.repository.updateLastLogin(user.id as string, now);

    setSessionCookie(c, token, this.env.COOKIE_DOMAIN || 'localhost');

    c.executionCtx.waitUntil(trackServerEvent(this.env, {
      event_name: 'login',
      event_category: 'auth',
      user_id: user.id as string,
      device_type: deviceTypeFromUA(c.req.header('user-agent')),
      country: ((c.req.raw as { cf?: { country?: string } }).cf?.country) || null,
    }));

    return {
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatar_url: user.avatar_url,
        }
      }
    };
  }

  async verifyEmail(c: Context, body: { email: string; otp: string }) {
    const user = await this.repository.findUserByEmail(body.email);
    if (!user) {
      return { error: 'Email tidak terdaftar', status: 404 };
    }

    if (user.email_verified_at) {
      return { error: 'Email sudah terverifikasi', status: 400 };
    }

    const storedOtp = await this.env.KV.get(`otp:email:${body.email}`);
    if (this.env.APP_ENV !== 'development') {
      if (!storedOtp || storedOtp !== body.otp) {
        return { error: 'Kode OTP tidak valid atau sudah kadaluarsa', status: 400 };
      }
    }

    const now = new Date().toISOString();
    
    // Update verification status
    await this.env.DB.prepare(
      `UPDATE users SET email_verified_at = ?, updated_at = ? WHERE id = ?`
    ).bind(now, now, user.id).run();

    // Delete OTP from KV
    await this.env.KV.delete(`otp:email:${body.email}`);

    // Grant 3 free credits to new user
    try {
      await this.env.DB.prepare(
        `INSERT INTO user_tool_credits (id, user_id, balance, total_purchased, total_used, created_at, updated_at)
         VALUES (?, ?, 3, 0, 0, ?, ?)`
      ).bind(crypto.randomUUID(), user.id, now, now).run();

      await this.env.DB.prepare(
        `INSERT INTO tool_credit_transactions (id, user_id, type, amount, balance_after, description, created_at)
         VALUES (?, ?, 'bonus', 3, 3, 'Kredit selamat datang - gratis 3 kredit', ?)`
      ).bind(crypto.randomUUID(), user.id, now).run();
    } catch (creditErr) {
      console.error('[auth] WARNING: failed to grant welcome credits for user', user.id, creditErr);
    }

    // Start nurturing sequence
    await startSequence(user.id as string, 'welcome_free_user', this.env.DB, this.env).catch(err => console.error('[auth] welcome sequence error:', err));

    // Create session
    const token = crypto.randomUUID();
    const tokenHash = await sha256(token);
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

    await this.repository.createSession(sessionId, user.id as string, tokenHash, expiresAt, now);
    await this.repository.updateLastLogin(user.id as string, now);

    setSessionCookie(c, token, this.env.COOKIE_DOMAIN || 'localhost');

    return {
      success: true,
      data: {
        message: 'Verifikasi berhasil',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      }
    };
  }

  async resendVerification(body: { email: string }): Promise<any> {
    const user = await this.repository.findUserByEmail(body.email);
    if (!user) {
      return { error: 'Email tidak terdaftar', status: 404 };
    }

    if (user.email_verified_at) {
      return { error: 'Email sudah terverifikasi', status: 400 };
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    if (this.env.APP_ENV === 'development') {
      console.log(`\n================================`);
      console.log(`[LOCAL DEV] KODE OTP (RESEND) UNTUK ${body.email}: ${otp}`);
      console.log(`================================\n`);
    }
    await this.env.KV.put(`otp:email:${body.email}`, otp, { expirationTtl: 86400 }).catch(err => {
      console.error('[auth] KV put OTP (resend) failed:', err);
      throw new Error('Gagal menyimpan kode verifikasi. Silakan coba lagi.');
    });

    // Send OTP email
    const sendError = await this.sendVerificationOtp(body.email, otp, 'resend');
    if (sendError) return sendError;

    return {
      success: true,
      data: { message: 'Kode OTP baru telah dikirim ke email Anda.' }
    };
  }

  async logout(c: Context, sessionId: string) {
    const now = new Date().toISOString();
    await this.repository.revokeSession(sessionId, now);
    clearSessionCookie(c, this.env.COOKIE_DOMAIN || 'localhost');
    return { success: true, data: { message: 'Logged out' } };
  }

  async getMe(userId: string, user: any) {
    const membership = await this.repository.getActiveMembership(userId);
    return {
      success: true,
      data: {
        user,
        membership: membership || null,
      }
    };
  }

  async forgotPassword(body: { email: string }) {
    const now = new Date().toISOString();
    const user = await this.repository.findUserByEmail(body.email);

    if (!user) {
      // Always return success to prevent email enumeration
      return { success: true, data: { message: 'Jika email terdaftar, link reset telah dikirim' } };
    }

    const token = crypto.randomUUID();
    const tokenHash = await sha256(token);
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString(); // 1 hour

    await this.repository.createPasswordResetToken(crypto.randomUUID(), user.id as string, tokenHash, expiresAt, now);

    const resetUrl = `${this.env.APP_URL}/reset-password?token=${token}`;
    await sendMailketingEmail(this.env, {
      recipient: user.email as string,
      subject: 'Reset Password PejuangYen',
      content: resetPasswordEmailHtml(resetUrl),
      emailType: 'transactional',
    }, this.env.DB).catch(err => console.error('[auth] Email send failed:', err));

    return { success: true, data: { message: 'Jika email terdaftar, link reset telah dikirim' } };
  }

  async resetPassword(body: { token: string; password: string }) {
    const now = new Date().toISOString();
    const tokenHash = await sha256(body.token);

    const resetToken = await this.repository.getValidResetToken(tokenHash, now);

    if (!resetToken) {
      return { error: 'Token tidak valid atau sudah kadaluarsa', status: 400 };
    }

    const newPasswordHash = await hashPassword(body.password);
    await this.repository.resetPasswordBatch(resetToken.user_id as string, newPasswordHash, resetToken.id as string, now);

    return { success: true, data: { message: 'Password berhasil direset' } };
  }
}
