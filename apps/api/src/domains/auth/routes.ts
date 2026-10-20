import { Hono } from 'hono';
import type { Env } from '../../env';
import { validate } from '../../middleware/validate';
import { authMiddleware } from '../../middleware/auth';
import { rateLimit } from '../../middleware/rate-limit';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, verifyEmailSchema, resendVerificationSchema } from '@growwithai/shared';
import { success, error } from '../../lib/response';
import { AuthService } from './service';
import { verifyTurnstile } from '../../lib/turnstile';
import { hasMxRecords } from '../../lib/mx-check';
import { hashToken, invalidateCachedSession, getSessionCookie } from '../../lib/session-cache';

const auth = new Hono<{ Bindings: Env }>();

// ─── POST /register ──────────────────────────────
auth.post(
  '/register',
  validate(registerSchema),
  rateLimit({ max: 5, windowSec: 60, keyFn: (c) => `reg:${c.req.header('cf-connecting-ip') || 'unknown'}`, binding: 'RL_5_PER_MIN' }),
  async (c) => {
    const body = c.get('validatedBody' as never) as any;

    // 1. Honeypot check
    if (body._hp_website) {
      return error(c, 'Pendaftaran ditolak oleh sistem keamanan.', 400);
    }

    // 2. Turnstile check
    if (c.env.TURNSTILE_SECRET_KEY) {
      if (!body.cfTurnstileResponse) {
        return error(c, 'Harap selesaikan validasi keamanan (CAPTCHA)', 400);
      }
      const ip = c.req.header('cf-connecting-ip') || '';
      const isValid = await verifyTurnstile(body.cfTurnstileResponse, c.env.TURNSTILE_SECRET_KEY, ip);
      if (!isValid) {
        return error(c, 'Validasi keamanan gagal. Silakan coba lagi.', 400);
      }
    }

    // 3. MX Record check
    const domain = body.email.split('@')[1];
    if (domain) {
      const validMx = await hasMxRecords(domain);
      if (!validMx) {
        return error(c, 'Domain email tidak valid atau tidak dapat menerima pesan.', 400);
      }
    }

    const service = new AuthService(c.env);
    const result = await service.register(c, body);

    if (result.error) return error(c, result.error, result.status || 400);
    return success(c, result.data, 201);
  }
);

// ─── POST /login ─────────────────────────────────
auth.post(
  '/login',
  validate(loginSchema),
  rateLimit({ max: 5, windowSec: 60, keyFn: (c) => `login:${c.req.header('cf-connecting-ip') || 'unknown'}`, binding: 'RL_5_PER_MIN' }),
  async (c) => {
    const service = new AuthService(c.env);
    const body = c.get('validatedBody' as never) as any;
    const result = await service.login(c, body);

    if (result.error) return error(c, result.error, result.status || 400, result.errorType);
    return success(c, result.data);
  }
);

// ─── POST /verify-email ──────────────────────────────
auth.post(
  '/verify-email',
  validate(verifyEmailSchema),
  rateLimit({ max: 5, windowSec: 60, keyFn: (c) => `verify:${c.req.header('cf-connecting-ip') || 'unknown'}`, binding: 'RL_5_PER_MIN' }),
  async (c) => {
    const service = new AuthService(c.env);
    const body = c.get('validatedBody' as never) as any;
    const result = await service.verifyEmail(c, body);

    if (result.error) return error(c, result.error, result.status || 400);
    return success(c, result.data);
  }
);

// ─── POST /resend-verification ──────────────────────────────
auth.post(
  '/resend-verification',
  validate(resendVerificationSchema),
  rateLimit({ max: 6, windowSec: 60, keyFn: (c) => `resend:${c.req.header('cf-connecting-ip') || 'unknown'}`, binding: 'RL_5_PER_MIN' }),
  async (c) => {
    const service = new AuthService(c.env);
    const body = c.get('validatedBody' as never) as any;
    const result = await service.resendVerification(body);

    if (result.error) return error(c, result.error, result.status || 400);
    return success(c, result.data);
  }
);

// ─── POST /logout ────────────────────────────────
auth.post('/logout', authMiddleware(), async (c) => {
  const service = new AuthService(c.env);
  const sessionId = c.get('sessionId');

  // Invalidate cached session di KV (kita punya token dari cookie) agar revoke
  // efektif seketika, tidak menunggu TTL.
  const token = getSessionCookie(c);
  if (token) {
    c.executionCtx.waitUntil(hashToken(token).then((h) => invalidateCachedSession(c.env, h)));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await service.logout(c, sessionId) as any;

  if (result.error) return error(c, result.error, result.status || 400);
  return success(c, result.data);
});

// ─── GET /me ─────────────────────────────────────
auth.get('/me', authMiddleware(), async (c) => {
  const service = new AuthService(c.env);
  const user = c.get('user');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await service.getMe(user.id, user) as any;

  if (result.error) return error(c, result.error, result.status || 400);
  return success(c, result.data);
});

// ─── POST /forgot-password ──────────────────────
auth.post(
  '/forgot-password',
  validate(forgotPasswordSchema),
  rateLimit({ max: 3, windowSec: 3600, keyFn: (c) => `forgot:${c.req.header('cf-connecting-ip') || 'unknown'}`, binding: 'RL_3_PER_HOUR' }),
  async (c) => {
    const service = new AuthService(c.env);
    const body = c.get('validatedBody' as never) as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await service.forgotPassword(body) as any;

    if (result.error) return error(c, result.error, result.status || 400);
    return success(c, result.data);
  }
);

// ─── POST /reset-password ───────────────────────
auth.post(
  '/reset-password',
  validate(resetPasswordSchema),
  rateLimit({ max: 10, windowSec: 3600, keyFn: (c) => `reset:${c.req.header('cf-connecting-ip') || 'unknown'}`, binding: 'RL_10_PER_HOUR' }),
  async (c) => {
    const service = new AuthService(c.env);
    const body = c.get('validatedBody' as never) as any;
    const result = await service.resetPassword(body);

    if (result.error) return error(c, result.error, result.status || 400);
    return success(c, result.data);
  }
);

export default auth;
