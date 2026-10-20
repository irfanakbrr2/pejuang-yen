import type { Context, Next } from 'hono';
import type { Env } from '../env';

/**
 * CORS middleware — restricts to configured origin
 */
export function corsMiddleware() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    if (c.req.path.startsWith('/api/analytics')) {
      await next();
      return;
    }

    const configuredOrigin = c.env.CORS_ORIGIN || '*';
    const requestOrigin = c.req.header('Origin') || '';
    const allowedOrigins = configuredOrigin
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    const wildcard = configuredOrigin === '*';
    const allowed = !requestOrigin || wildcard || allowedOrigins.includes(requestOrigin);

    if (!allowed) {
      if (c.req.method === 'OPTIONS') return c.text('Forbidden origin', 403 as never);
      await next();
      return;
    }

    if (requestOrigin) {
      c.header('Access-Control-Allow-Origin', wildcard ? requestOrigin : requestOrigin);
    }
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (!wildcard) c.header('Access-Control-Allow-Credentials', 'true');
    c.header('Access-Control-Max-Age', '86400');

    if (c.req.method === 'OPTIONS') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return c.text('', 204 as any);
    }

    await next();
  };
}
