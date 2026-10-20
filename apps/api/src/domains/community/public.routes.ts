import { Hono } from 'hono';
import type { Env } from '../../env';
import { success, error } from '../../lib/response';
import { htmlToText } from './utils';

const publicCommunityBlogRoutes = new Hono<{ Bindings: Env }>();

publicCommunityBlogRoutes.get('/', async (c) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') || 50)));
    const rows = await c.env.DB.prepare(
      `SELECT cp.id, cp.slug, cp.title, cp.body_html, cp.body_text, cp.image_url,
              cp.published_at, cp.updated_at, u.name as author_name
       FROM community_posts cp
       JOIN users u ON u.id = cp.author_user_id
       WHERE cp.status = 'published'
         AND cp.source_role IN ('admin', 'super_admin')
         AND cp.slug IS NOT NULL
       ORDER BY COALESCE(cp.is_pinned, 0) DESC, cp.pinned_at DESC, cp.published_at DESC, cp.created_at DESC
       LIMIT ?`
    ).bind(limit).all();

    const appUrl = c.env.APP_URL || 'https://app.pejuangyen.com';
    const posts = (rows.results as any[]).map((post) => {
      const plainText = post.body_text || htmlToText(post.body_html || '');
      return {
        id: post.id,
        slug: post.slug,
        title: post.title,
        description: plainText.slice(0, 160),
        body_html: post.body_html,
        body_text: plainText,
        image_url: post.image_url || null,
        author: post.author_name || 'PejuangYen',
        category: 'Komunitas',
        tags: ['Komunitas', 'AI', 'PejuangYen'],
        published_at: post.published_at,
        updated_at: post.updated_at,
        community_url: `${appUrl}/community/${post.slug}`,
      };
    });

    return success(c, { posts, generated_at: new Date().toISOString() });
  } catch (err) {
    console.error('[public:community-blog]', err);
    return error(c, 'Gagal memuat community blog feed', 500);
  }
});

export default publicCommunityBlogRoutes;
