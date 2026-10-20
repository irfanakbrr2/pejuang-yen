// AI Pulse — route user (perlu login): bookmark.
import { Hono } from 'hono';
import type { Env } from '../../env';
import { success, error } from '../../lib/response';
import { authMiddleware } from '../../middleware/auth';
import { AiPulseRepository } from './repository';
import { toListItem } from './mapper';

const userAiPulseRoutes = new Hono<{ Bindings: Env }>();
userAiPulseRoutes.use('*', authMiddleware());

// Daftar bookmark milik user (static path harus sebelum :id)
userAiPulseRoutes.get('/bookmarks', async (c) => {
  try {
    const repo = new AiPulseRepository(c.env.DB);
    const rows = await repo.listBookmarks(c.get('user').id);
    return success(c, rows.map((r) => ({ ...toListItem(r), bookmarked: true })));
  } catch (err) {
    console.error('[ai-pulse:bookmarks]', err);
    return error(c, 'Gagal memuat bookmark', 500);
  }
});

// Toggle bookmark
userAiPulseRoutes.post('/:id/bookmark', async (c) => {
  try {
    const repo = new AiPulseRepository(c.env.DB);
    const userId = c.get('user').id;
    const itemId = c.req.param('id');

    const item = await repo.getById(itemId);
    if (!item || item.status !== 'published') return error(c, 'Item tidak ditemukan', 404);

    const now = new Date().toISOString();
    const already = await repo.isBookmarked(userId, itemId);
    if (already) {
      await repo.removeBookmark(userId, itemId);
      return success(c, { bookmarked: false });
    }
    await repo.addBookmark(userId, itemId, now);
    return success(c, { bookmarked: true });
  } catch (err) {
    console.error('[ai-pulse:bookmark]', err);
    return error(c, 'Gagal menyimpan bookmark', 500);
  }
});

export default userAiPulseRoutes;
