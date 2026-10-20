import type { Context, Next } from 'hono';
import type { Env } from '../env';

/**
 * Global error handler middleware
 */
export function errorHandler() {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    try {
      await next();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err ?? 'Unknown error'));
      const errorId = crypto.randomUUID();
      console.error(`[ERROR] ${c.req.method} ${c.req.path}:`, error.message);

      c.executionCtx.waitUntil(
        c.env.DB.prepare(
          `INSERT INTO error_logs (id, source, message, stack, metadata_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
          errorId,
          `${c.req.method} ${c.req.path}`,
          error.message || 'Unknown error',
          error.stack || null,
          JSON.stringify({ path: c.req.path }),
          new Date().toISOString()
        ).run().catch(() => {})
      );

      const isProduction = c.env.APP_ENV === 'production';
      return c.json(
        {
          success: false,
          error: isProduction ? 'Internal Server Error' : error.message || 'Internal Server Error',
          error_id: errorId,
        },
        500
      );
    }
  };
}
