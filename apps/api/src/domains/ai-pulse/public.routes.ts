// AI Pulse — feed publik untuk sync blog landing (pejuangyen.com/blog).
// Mengikuti pola domains/community/public.routes.ts.
import { Hono } from 'hono';
import type { Env } from '../../env';
import { success, error } from '../../lib/response';
import { AiPulseRepository } from './repository';
import { toDetail } from './mapper';

const publicAiPulseBlogRoutes = new Hono<{ Bindings: Env }>();

publicAiPulseBlogRoutes.get('/', async (c) => {
  try {
    const limit = Math.min(200, Math.max(1, Number(c.req.query('limit') || 200)));
    const repo = new AiPulseRepository(c.env.DB);
    const rows = await repo.listAllPublishedFull(limit);

    const posts = rows.map((row) => ({
      ...toDetail(row),
      original_title: row.original_title,
      updated_at: row.updated_at,
    }));

    c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=900');
    return success(c, { posts, generated_at: new Date().toISOString() });
  } catch (err) {
    console.error('[public:ai-pulse-blog]', err);
    return error(c, 'Gagal memuat AI Pulse blog feed', 500);
  }
});

export default publicAiPulseBlogRoutes;
