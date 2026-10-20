import { Hono } from 'hono';
import type { Env } from '../../env';
import { success } from '../../lib/response';
import { kvGetOrSet } from '../../lib/cache';

const membershipRoutes = new Hono<{ Bindings: Env }>();

// GET /api/membership/plans — Public plans
membershipRoutes.get('/plans', async (c) => {
  const rows = await kvGetOrSet(c.env, 'membership:plans:v1', 300, async () => {
    const result = await c.env.DB.prepare(
      `SELECT id, slug, name, description, duration_type, duration_days, price, compare_at_price, features_json
       FROM membership_plans WHERE status = 'active' ORDER BY sort_order ASC`
    ).all();
    return result.results;
  });

  c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
  return success(c, rows);
});

export default membershipRoutes;
