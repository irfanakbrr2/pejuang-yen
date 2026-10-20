import type { Context, Next } from 'hono';
import { ZodSchema, ZodError } from 'zod';

/**
 * Validation middleware using Zod schemas
 */
export function validate(schema: ZodSchema) {
  return async (c: Context, next: Next) => {
    try {
      const body = await c.req.json();
      const parsed = schema.parse(body);
      c.set('validatedBody' as never, parsed as never);
      await next();
    } catch (err) {
      if (err instanceof ZodError) {
        return c.json({
          success: false,
          error: 'Validation error',
          details: err.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        }, 400);
      }
      return c.json({ success: false, error: 'Invalid request body' }, 400);
    }
  };
}
