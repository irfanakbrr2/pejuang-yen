import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error, paginated } from '../../lib/response';
import { deleteCommunityImage, broadcastCommunityPost } from '../community/utils';

const adminCommunityRoutes = new Hono<{ Bindings: Env }>();

adminCommunityRoutes.use('*', authMiddleware());
adminCommunityRoutes.use('*', requireRole('admin', 'super_admin'));

adminCommunityRoutes.get('/posts', async (c) => {
  try {
    const page = Math.max(1, Number(c.req.query('page') || 1));
    const limit = Math.min(20, Math.max(1, Number(c.req.query('limit') || 10)));
    const offset = (page - 1) * limit;
    const requestedStatus = String(c.req.query('status') || 'pending');
    const status = requestedStatus === 'published' ? 'published' : 'pending';
    const q = String(c.req.query('q') || '').trim().slice(0, 80);
    const categoryFilter = String(c.req.query('category') || '').trim();

    let where = `WHERE cp.status = ?`;
    const params: unknown[] = [status];
    if (categoryFilter) {
      where += ` AND cp.category = ?`;
      params.push(categoryFilter);
    }
    if (q) {
      where += ` AND (cp.title LIKE ? OR cp.body_text LIKE ? OR u.name LIKE ? OR u.email LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    const totalRow = await c.env.DB.prepare(
      `SELECT COUNT(*) as total
       FROM community_posts cp
       JOIN users u ON u.id = cp.author_user_id
       ${where}`
    ).bind(...params).first() as { total?: number } | null;

    const rows = await c.env.DB.prepare(
      `SELECT cp.*, u.name as author_name, u.email as author_email, u.avatar_url as author_avatar_url, u.role as author_role,
              approver.name as approved_by_name,
              (SELECT COUNT(*) FROM community_post_likes l WHERE l.post_id = cp.id) as like_count,
              (SELECT COUNT(*) FROM community_comments cc WHERE cc.post_id = cp.id AND cc.status = 'published' AND COALESCE(cc.moderation_status, 'approved') = 'approved') as comment_count
       FROM community_posts cp
       JOIN users u ON u.id = cp.author_user_id
       LEFT JOIN users approver ON approver.id = cp.approved_by_user_id
       ${where}
       ORDER BY
         CASE WHEN cp.status = 'published' THEN COALESCE(cp.is_pinned, 0) ELSE 0 END DESC,
         cp.pinned_at DESC,
         CASE WHEN cp.status = 'pending' THEN cp.created_at ELSE cp.published_at END DESC
       LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    return paginated(c, rows.results as any[], {
      page,
      limit,
      total: Number(totalRow?.total || 0),
    });
  } catch (err) {
    console.error('[admin:community:list]', err);
    return error(c, 'Gagal memuat postingan komunitas', 500);
  }
});

adminCommunityRoutes.post('/posts/:id/approve', async (c) => {
  try {
    const admin = c.get('user');
    const id = c.req.param('id');
    const now = new Date().toISOString();

    const post = await c.env.DB.prepare(
      `SELECT id, status FROM community_posts WHERE id = ? LIMIT 1`
    ).bind(id).first() as { id: string; status: string } | null;
    if (!post) return error(c, 'Postingan tidak ditemukan', 404);
    if (post.status === 'published') return success(c, { message: 'Postingan sudah published' });

    await c.env.DB.prepare(
      `UPDATE community_posts
       SET status = 'published', approved_by_user_id = ?, approved_at = ?, published_at = ?, updated_at = ?
       WHERE id = ?`
    ).bind(admin.id, now, now, now, id).run();

    return success(c, { message: 'Postingan berhasil disetujui' });
  } catch (err) {
    console.error('[admin:community:approve]', err);
    return error(c, 'Gagal menyetujui postingan', 500);
  }
});

// Re-send the email broadcast for an already-published post (e.g. one whose
// original broadcast silently failed). Skips in-app notifications to avoid
// duplicating them, and goes through the (now size-aware) email queue.
adminCommunityRoutes.post('/posts/:id/rebroadcast', async (c) => {
  try {
    const id = c.req.param('id');
    const post = await c.env.DB.prepare(
      `SELECT id, slug, title, body_html, image_url, author_user_id, status
       FROM community_posts WHERE id = ? LIMIT 1`
    ).bind(id).first() as {
      id: string;
      slug: string | null;
      title: string;
      body_html: string;
      image_url: string | null;
      author_user_id: string;
      status: string;
    } | null;

    if (!post) return error(c, 'Postingan tidak ditemukan', 404);
    if (post.status !== 'published') {
      return error(c, 'Hanya postingan published yang bisa dibroadcast ulang', 400);
    }

    c.executionCtx.waitUntil((async () => {
      const queued = await broadcastCommunityPost(
        c.env,
        {
          id: post.id,
          slug: post.slug,
          title: post.title,
          body_html: post.body_html,
          image_url: post.image_url,
          author_user_id: post.author_user_id,
        },
        { skipNotifications: true }
      );
      await c.env.DB.prepare(
        `UPDATE community_posts SET broadcast_queued_at = ?, updated_at = ? WHERE id = ?`
      ).bind(new Date().toISOString(), new Date().toISOString(), id).run();
      console.log(`[community] re-broadcast queued for ${queued} recipients (post ${id})`);
    })());

    return success(c, { message: 'Broadcast email sedang dikirim ulang ke semua member.' });
  } catch (err) {
    console.error('[admin:community:rebroadcast]', err);
    return error(c, 'Gagal mengirim ulang broadcast', 500);
  }
});

adminCommunityRoutes.delete('/posts/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const post = await c.env.DB.prepare(
      `SELECT id, image_r2_key FROM community_posts WHERE id = ? LIMIT 1`
    ).bind(id).first() as { id: string; image_r2_key?: string | null } | null;
    if (!post) return error(c, 'Postingan tidak ditemukan', 404);

    await deleteCommunityImage(c.env, post.image_r2_key);
    await c.env.DB.prepare(`DELETE FROM community_posts WHERE id = ?`).bind(id).run();

    return success(c, { message: 'Postingan dihapus' });
  } catch (err) {
    console.error('[admin:community:delete]', err);
    return error(c, 'Gagal menghapus postingan', 500);
  }
});

adminCommunityRoutes.post('/posts/:id/pin', async (c) => {
  try {
    const admin = c.get('user');
    const id = c.req.param('id');
    const now = new Date().toISOString();

    const post = await c.env.DB.prepare(
      `SELECT id, status FROM community_posts WHERE id = ? LIMIT 1`
    ).bind(id).first() as { id: string; status: string } | null;
    if (!post) return error(c, 'Postingan tidak ditemukan', 404);
    if (post.status !== 'published') return error(c, 'Hanya postingan published yang bisa dipin', 400);

    await c.env.DB.prepare(
      `UPDATE community_posts
       SET is_pinned = 1, pinned_at = ?, pinned_by_user_id = ?, updated_at = ?
       WHERE id = ?`
    ).bind(now, admin.id, now, id).run();

    return success(c, { message: 'Postingan dipin' });
  } catch (err) {
    console.error('[admin:community:pin]', err);
    return error(c, 'Gagal pin postingan', 500);
  }
});

adminCommunityRoutes.post('/posts/:id/unpin', async (c) => {
  try {
    const id = c.req.param('id');
    const now = new Date().toISOString();
    const result = await c.env.DB.prepare(
      `UPDATE community_posts
       SET is_pinned = 0, pinned_at = NULL, pinned_by_user_id = NULL, updated_at = ?
       WHERE id = ?`
    ).bind(now, id).run();

    if (result.meta.changes === 0) return error(c, 'Postingan tidak ditemukan', 404);
    return success(c, { message: 'Pin postingan dilepas' });
  } catch (err) {
    console.error('[admin:community:unpin]', err);
    return error(c, 'Gagal melepas pin postingan', 500);
  }
});

adminCommunityRoutes.get('/comments', async (c) => {
  try {
    const requestedStatus = String(c.req.query('status') || 'blocked');
    const moderationStatus = requestedStatus === 'approved' ? 'approved' : 'blocked';
    const page = Math.max(1, Number(c.req.query('page') || 1));
    const limit = Math.min(20, Math.max(1, Number(c.req.query('limit') || 10)));
    const offset = (page - 1) * limit;
    const q = String(c.req.query('q') || '').trim().slice(0, 80);

    let where = `WHERE COALESCE(cc.moderation_status, 'approved') = ?`;
    const params: unknown[] = [moderationStatus];
    if (q) {
      where += ` AND (cc.body_text LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR cp.title LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }

    const totalRow = await c.env.DB.prepare(
      `SELECT COUNT(*) as total
       FROM community_comments cc
       JOIN users u ON u.id = cc.author_user_id
       JOIN community_posts cp ON cp.id = cc.post_id
       ${where}`
    ).bind(...params).first() as { total?: number } | null;

    const rows = await c.env.DB.prepare(
      `SELECT cc.*, u.name as author_name, u.email as author_email, u.role as author_role,
              cp.title as post_title, cp.slug as post_slug
       FROM community_comments cc
       JOIN users u ON u.id = cc.author_user_id
       JOIN community_posts cp ON cp.id = cc.post_id
       ${where}
       ORDER BY cc.created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    return paginated(c, rows.results as any[], {
      page,
      limit,
      total: Number(totalRow?.total || 0),
    });
  } catch (err) {
    console.error('[admin:community:comments:list]', err);
    return error(c, 'Gagal memuat komentar komunitas', 500);
  }
});

adminCommunityRoutes.post('/comments/:id/approve', async (c) => {
  try {
    const id = c.req.param('id');
    const now = new Date().toISOString();
    const result = await c.env.DB.prepare(
      `UPDATE community_comments
       SET moderation_status = 'approved', moderation_reason = NULL, moderated_at = ?, updated_at = ?
       WHERE id = ?`
    ).bind(now, now, id).run();

    if (result.meta.changes === 0) return error(c, 'Komentar tidak ditemukan', 404);
    return success(c, { message: 'Komentar disetujui' });
  } catch (err) {
    console.error('[admin:community:comments:approve]', err);
    return error(c, 'Gagal menyetujui komentar', 500);
  }
});

adminCommunityRoutes.delete('/comments/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const result = await c.env.DB.prepare(`DELETE FROM community_comments WHERE id = ?`).bind(id).run();
    if (result.meta.changes === 0) return error(c, 'Komentar tidak ditemukan', 404);
    return success(c, { message: 'Komentar dihapus' });
  } catch (err) {
    console.error('[admin:community:comments:delete]', err);
    return error(c, 'Gagal menghapus komentar', 500);
  }
});

export default adminCommunityRoutes;
