import type { Context, Next } from 'hono';
import type { Env } from '../env';

type RateLimitBinding = 'RL_5_PER_MIN' | 'RL_3_PER_HOUR' | 'RL_10_PER_HOUR' | 'RL_60_PER_MIN';

interface RateLimitOpts {
  max: number;
  windowSec: number;
  keyFn: (c: Context) => string;
  binding?: RateLimitBinding;
}

/**
 * Rate limiter — uses Cloudflare Workers Rate Limiting (0 KV cost) when available,
 * falls back to KV-based rate limiting for local dev.
 */
export function rateLimit(opts: RateLimitOpts) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const ip = c.req.header('cf-connecting-ip') || 'unknown';
    const key = opts.keyFn(c);

    const limiter = opts.binding ? c.env[opts.binding] : undefined;

    if (limiter) {
      // Workers Rate Limiting — no KV reads, platform-level enforcement
      try {
        const { success } = await limiter.limit({ key });
        if (!success) {
          return c.json(
            { success: false, error: 'Terlalu banyak percobaan. Silakan coba lagi nanti.' },
            429
          );
        }
      } catch (err) {
        console.error('[rate-limit] Workers RL error, skipping:', err);
      }
    } else {
      // KV fallback (local dev only)
      try {
        const kvKey = `rate:${key}`;
        const current = await c.env.KV.get(kvKey);
        const count = current ? parseInt(current, 10) : 0;

        if (count >= opts.max) {
          return c.json(
            { success: false, error: 'Terlalu banyak percobaan. Silakan coba lagi nanti.' },
            429
          );
        }

        c.executionCtx.waitUntil(
          c.env.KV.put(kvKey, String(count + 1), { expirationTtl: opts.windowSec }).catch(
            (err) => console.error('[rate-limit] KV put failed:', err)
          )
        );
      } catch (err) {
        console.error('[rate-limit] KV error, skipping rate check:', err);
      }
    }

    await next();
  };
}

export async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + '_growwithai_salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}
