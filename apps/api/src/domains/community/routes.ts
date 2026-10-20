import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware } from '../../middleware/auth';
import { rateLimit } from '../../middleware/rate-limit';
import { success, error, paginated } from '../../lib/response';
import { awardPoints } from '../../lib/gamification';
import {
  COMMUNITY_BODY_TEXT_MAX,
  COMMUNITY_COMMENT_TEXT_MAX,
  COMMUNITY_TITLE_MAX,
  CommunityValidationError,
  broadcastCommunityPost,
  createUniqueCommunitySlug,
  hasCommunityAccess,
  isAdminUser,
  moderateCommunityComment,
  normalizeCommunityContent,
  normalizeCommentText,
  triggerLandingBlogDeploy,
  uploadCommunityImage,
} from './utils';

const communityRoutes = new Hono<{ Bindings: Env }>();

async function resolvePublishedCommunityPost(db: D1Database, slugOrId: string) {
  return await db.prepare(
    `SELECT id, slug, author_user_id, title
     FROM community_posts
     WHERE (id = ? OR slug = ?) AND status = 'published'
     LIMIT 1`
  ).bind(slugOrId, slugOrId).first() as {
    id: string;
    slug?: string | null;
    author_user_id: string;
    title: string;
  } | null;
}

communityRoutes.use('*', authMiddleware());

communityRoutes.get('/posts', async (c) => {
  try {
    const user = c.get('user');
    const page = Math.max(1, Number(c.req.query('page') || 1));
    const limit = Math.min(20, Math.max(1, Number(c.req.query('limit') || 10)));
    const offset = (page - 1) * limit;
    const q = String(c.req.query('q') || '').trim().slice(0, 80);
    const categoryFilter = String(c.req.query('category') || '').trim();

    let where = `WHERE cp.status = 'published'`;
    const params: unknown[] = [];
    if (categoryFilter) {
      where += ` AND cp.category = ?`;
      params.push(categoryFilter);
    }
    if (q) {
      where += ` AND (cp.title LIKE ? OR cp.body_text LIKE ? OR u.name LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }

    const totalRow = await c.env.DB.prepare(
      `SELECT COUNT(*) as total
       FROM community_posts cp
       JOIN users u ON u.id = cp.author_user_id
       ${where}`
    ).bind(...params).first() as { total?: number } | null;

    const rows = await c.env.DB.prepare(
      `SELECT cp.*, u.name as author_name, u.avatar_url as author_avatar_url, u.role as author_role,
              (SELECT COUNT(*) FROM community_post_likes l WHERE l.post_id = cp.id) as like_count,
              (SELECT COUNT(*) FROM community_comments cc WHERE cc.post_id = cp.id AND cc.status = 'published' AND COALESCE(cc.moderation_status, 'approved') = 'approved') as comment_count,
              EXISTS(SELECT 1 FROM community_post_likes ml WHERE ml.post_id = cp.id AND ml.user_id = ?) as liked_by_me
       FROM community_posts cp
       JOIN users u ON u.id = cp.author_user_id
       ${where}
       ORDER BY COALESCE(cp.is_pinned, 0) DESC, cp.pinned_at DESC, cp.published_at DESC, cp.created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(user.id, ...params, limit, offset).all();

    return paginated(c, rows.results as any[], {
      page,
      limit,
      total: Number(totalRow?.total || 0),
    });
  } catch (err) {
    console.error('[community:list]', err);
    return error(c, 'Gagal memuat komunitas', 500);
  }
});

communityRoutes.get('/posts/:slugOrId', async (c) => {
  try {
    const user = c.get('user');
    const slugOrId = c.req.param('slugOrId');
    const post = await c.env.DB.prepare(
      `SELECT cp.*, u.name as author_name, u.avatar_url as author_avatar_url, u.role as author_role,
              (SELECT COUNT(*) FROM community_post_likes l WHERE l.post_id = cp.id) as like_count,
              (SELECT COUNT(*) FROM community_comments cc WHERE cc.post_id = cp.id AND cc.status = 'published' AND COALESCE(cc.moderation_status, 'approved') = 'approved') as comment_count,
              EXISTS(SELECT 1 FROM community_post_likes ml WHERE ml.post_id = cp.id AND ml.user_id = ?) as liked_by_me
       FROM community_posts cp
       JOIN users u ON u.id = cp.author_user_id
       WHERE (cp.id = ? OR cp.slug = ?) AND cp.status = 'published'
       LIMIT 1`
    ).bind(user.id, slugOrId, slugOrId).first();

    if (!post) return error(c, 'Postingan tidak ditemukan', 404);
    return success(c, post);
  } catch (err) {
    console.error('[community:detail]', err);
    return error(c, 'Gagal memuat postingan', 500);
  }
});

communityRoutes.post(
  '/posts/:slugOrId/like',
  rateLimit({
    max: 10,
    windowSec: 3600,
    binding: 'RL_10_PER_HOUR',
    keyFn: (c) => {
      const user = c.get('user');
      const ip = c.req.header('cf-connecting-ip') || 'unknown';
      return `community:like:${user?.id || 'anon'}:${ip}`;
    },
  }),
  async (c) => {
    try {
      const user = c.get('user');
      const post = await resolvePublishedCommunityPost(c.env.DB, c.req.param('slugOrId') || '');
      if (!post) return error(c, 'Postingan tidak ditemukan', 404);
      const postId = post.id;

      const existing = await c.env.DB.prepare(
        `SELECT id FROM community_post_likes WHERE post_id = ? AND user_id = ? LIMIT 1`
      ).bind(postId, user.id).first() as { id: string } | null;

      let liked = false;
      if (existing) {
        await c.env.DB.prepare(
          `DELETE FROM community_post_likes WHERE id = ?`
        ).bind(existing.id).run();
      } else {
        await c.env.DB.prepare(
          `INSERT INTO community_post_likes (id, post_id, user_id, created_at)
           VALUES (?, ?, ?, ?)`
        ).bind(crypto.randomUUID(), postId, user.id, new Date().toISOString()).run();
        liked = true;
      }

      const count = await c.env.DB.prepare(
        `SELECT COUNT(*) as total FROM community_post_likes WHERE post_id = ?`
      ).bind(postId).first() as { total?: number } | null;

      return success(c, { liked, like_count: Number(count?.total || 0) });
    } catch (err) {
      console.error('[community:like]', err);
      return error(c, 'Gagal memperbarui like', 500);
    }
  }
);

communityRoutes.get('/posts/:slugOrId/comments', async (c) => {
  try {
    const post = await resolvePublishedCommunityPost(c.env.DB, c.req.param('slugOrId') || '');
    if (!post) return error(c, 'Postingan tidak ditemukan', 404);
    const postId = post.id;
    const page = Math.max(1, Number(c.req.query('page') || 1));
    const limit = Math.min(20, Math.max(1, Number(c.req.query('limit') || 20)));
    const offset = (page - 1) * limit;

    const totalRow = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM community_comments WHERE post_id = ? AND status = 'published' AND COALESCE(moderation_status, 'approved') = 'approved'`
    ).bind(postId).first() as { total?: number } | null;

    const rows = await c.env.DB.prepare(
      `SELECT cc.*, u.name as author_name, u.avatar_url as author_avatar_url, u.role as author_role
       FROM community_comments cc
       JOIN users u ON u.id = cc.author_user_id
       WHERE cc.post_id = ? AND cc.status = 'published' AND COALESCE(cc.moderation_status, 'approved') = 'approved'
       ORDER BY cc.created_at ASC
       LIMIT ? OFFSET ?`
    ).bind(postId, limit, offset).all();

    return paginated(c, rows.results as any[], {
      page,
      limit,
      total: Number(totalRow?.total || 0),
    });
  } catch (err) {
    console.error('[community:comments:list]', err);
    return error(c, 'Gagal memuat komentar', 500);
  }
});

communityRoutes.post(
  '/posts/:slugOrId/comments',
  rateLimit({
    max: 10,
    windowSec: 3600,
    binding: 'RL_10_PER_HOUR',
    keyFn: (c) => {
      const user = c.get('user');
      const ip = c.req.header('cf-connecting-ip') || 'unknown';
      return `community:comment:${user?.id || 'anon'}:${ip}`;
    },
  }),
  async (c) => {
    try {
      const user = c.get('user');
      const post = await resolvePublishedCommunityPost(c.env.DB, c.req.param('slugOrId') || '');
      if (!post) return error(c, 'Postingan tidak ditemukan', 404);
      const postId = post.id;
      const body = await c.req.json().catch(() => ({})) as { body_text?: string };
      const bodyText = normalizeCommentText(body.body_text);

      if (!bodyText) return error(c, 'Komentar wajib diisi', 400);
      if (bodyText.length > COMMUNITY_COMMENT_TEXT_MAX) return error(c, 'Komentar maksimal 2.000 karakter', 400);

      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      const moderation = moderateCommunityComment(bodyText);
      await c.env.DB.prepare(
        `INSERT INTO community_comments
         (id, post_id, author_user_id, body_text, status, moderation_status, moderation_reason, moderated_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'published', ?, ?, ?, ?, ?)`
      ).bind(
        id,
        postId,
        user.id,
        bodyText,
        moderation.status,
        moderation.reason,
        moderation.status === 'blocked' ? now : null,
        now,
        now
      ).run();

      if (moderation.status === 'blocked') {
        return success(c, {
          id,
          post_id: postId,
          moderation_status: 'blocked',
          moderation_reason: moderation.reason,
          message: 'Komentar masuk moderasi dan tidak ditampilkan ke umum.',
        }, 201);
      }

      c.executionCtx.waitUntil(awardPoints(c.env, user.id, 'community_comment', id).then(() => {}));

      if (post.author_user_id !== user.id) {
        await c.env.DB.prepare(
          `INSERT INTO notifications (id, user_id, type, title, body, data_json, status, sent_at, created_at)
           VALUES (?, ?, 'community_comment', ?, ?, ?, 'sent', ?, ?)`
        ).bind(
          crypto.randomUUID(),
          post.author_user_id,
          'Komentar baru di postingan kamu',
          `${user.name}: ${bodyText.slice(0, 160)}`,
          JSON.stringify({ url: `/community/${post.slug || postId}`, post_id: postId, slug: post.slug || null, comment_id: id }),
          now,
          now
        ).run().catch((err) => console.error('[community] comment notification failed:', err));
      }

      return success(c, {
        id,
        post_id: postId,
        author_user_id: user.id,
        author_name: user.name,
        author_avatar_url: user.avatar_url || null,
        author_role: user.role,
        body_text: bodyText,
        status: 'published',
        created_at: now,
        updated_at: now,
      }, 201);
    } catch (err) {
      console.error('[community:comments:create]', err);
      return error(c, 'Gagal membuat komentar', 500);
    }
  }
);

communityRoutes.delete('/posts/:slugOrId/comments/:commentId', async (c) => {
  try {
    const user = c.get('user');
    const post = await resolvePublishedCommunityPost(c.env.DB, c.req.param('slugOrId') || '');
    if (!post) return error(c, 'Postingan tidak ditemukan', 404);
    const postId = post.id;
    const commentId = c.req.param('commentId');
    const comment = await c.env.DB.prepare(
      `SELECT cc.id, cc.author_user_id
       FROM community_comments cc
       JOIN community_posts cp ON cp.id = cc.post_id AND cp.status = 'published'
       WHERE cc.id = ? AND cc.post_id = ?
       LIMIT 1`
    ).bind(commentId, postId).first() as { id: string; author_user_id: string } | null;

    if (!comment) return error(c, 'Komentar tidak ditemukan', 404);
    if (comment.author_user_id !== user.id && !isAdminUser(user)) {
      return error(c, 'Tidak boleh menghapus komentar ini', 403);
    }

    await c.env.DB.prepare(`DELETE FROM community_comments WHERE id = ?`).bind(commentId).run();
    return success(c, { message: 'Komentar dihapus' });
  } catch (err) {
    console.error('[community:comments:delete]', err);
    return error(c, 'Gagal menghapus komentar', 500);
  }
});

communityRoutes.post(
  '/posts',
  rateLimit({
    max: 10,
    windowSec: 3600,
    binding: 'RL_10_PER_HOUR',
    keyFn: (c) => {
      const user = c.get('user');
      const ip = c.req.header('cf-connecting-ip') || 'unknown';
      return `community:create:${user?.id || 'anon'}:${ip}`;
    },
  }),
  async (c) => {
    let imageKey: string | null = null;

    try {
      const user = c.get('user');
      if (!(await hasCommunityAccess(c.env, user))) {
        return error(c, 'Hanya member premium yang bisa membuat postingan', 403);
      }

      const formData = await c.req.formData().catch(() => null);
      if (!formData) return error(c, 'multipart/form-data required', 400);

      const { title, bodyHtml, bodyText } = normalizeCommunityContent(
        formData.get('title'),
        formData.get('body_html')
      );

      if (!title) return error(c, 'Judul wajib diisi', 400);
      if (title.length > COMMUNITY_TITLE_MAX) return error(c, 'Judul maksimal 120 karakter', 400);
      if (!bodyText) return error(c, 'Isi postingan wajib diisi', 400);
      if (bodyText.length > COMMUNITY_BODY_TEXT_MAX) return error(c, 'Isi postingan maksimal 8.000 karakter', 400);

      const VALID_CATEGORIES = ['pengumuman', 'pertanyaan', 'wins', 'perkenalan', 'share-build', 'tools-ai'] as const;
      const rawCategory = String(formData.get('category') || '').trim().toLowerCase();
      const category = VALID_CATEGORIES.includes(rawCategory as typeof VALID_CATEGORIES[number]) ? rawCategory : 'perkenalan';

      const imageEntry = formData.get('image');
      const file = typeof imageEntry === 'object' && imageEntry !== null && 'arrayBuffer' in imageEntry
        ? imageEntry as File
        : null;
      const image = await uploadCommunityImage(c.env, user.id, file);
      imageKey = image?.key || null;

      const admin = isAdminUser(user);
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      const slug = await createUniqueCommunitySlug(c.env.DB, title);
      const status = admin ? 'published' : 'pending';

      await c.env.DB.prepare(
        `INSERT INTO community_posts
         (id, slug, author_user_id, title, body_html, body_text, image_r2_key, image_url, image_content_type, image_size,
          category, status, source_role, approved_by_user_id, approved_at, published_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        slug,
        user.id,
        title,
        bodyHtml,
        bodyText,
        image?.key || null,
        image?.url || null,
        image?.contentType || null,
        image?.size || null,
        category,
        status,
        user.role,
        admin ? user.id : null,
        admin ? now : null,
        admin ? now : null,
        now,
        now
      ).run();

      if (admin) {
        c.executionCtx.waitUntil((async () => {
          const queued = await broadcastCommunityPost(c.env, {
            id,
            slug,
            title,
            body_html: bodyHtml,
            image_url: image?.url || null,
            author_user_id: user.id,
          });
          await c.env.DB.prepare(
            `UPDATE community_posts SET broadcast_queued_at = ?, updated_at = ? WHERE id = ?`
          ).bind(new Date().toISOString(), new Date().toISOString(), id).run();
          console.log(`[community] broadcast queued for ${queued} recipients`);
          await triggerLandingBlogDeploy(c.env, slug);
        })());
      }

      return success(c, {
        id,
        slug,
        status,
        message: admin ? 'Postingan dipublikasikan' : 'Postingan menunggu persetujuan admin',
      }, 201);
    } catch (err) {
      if (imageKey) await c.env.R2.delete(imageKey).catch(console.error);
      if (err instanceof CommunityValidationError) {
        return error(c, err.message, err.status);
      }
      console.error('[community:create]', err);
      return error(c, 'Gagal membuat postingan', 500);
    }
  }
);

export default communityRoutes;
