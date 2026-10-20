import type { Context, Next } from 'hono';
import type { Env } from '../env';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function originGuard() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    if (SAFE_METHODS.has(c.req.method) || c.req.path.startsWith('/api/analytics')) {
      await next();
      return;
    }

    const origin = c.req.header('Origin');
    if (!origin) {
      await next();
      return;
    }

    const configuredOrigin = c.env.CORS_ORIGIN || '';
    const allowedOrigins = configuredOrigin
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (configuredOrigin !== '*' && !allowedOrigins.includes(origin)) {
      return c.json({ success: false, error: 'Forbidden origin' }, 403);
    }

    await next();
  };
}
