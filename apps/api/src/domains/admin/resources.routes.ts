import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error } from '../../lib/response';

const adminResourcesRoutes = new Hono<{ Bindings: Env }>();

adminResourcesRoutes.use('*', authMiddleware());
adminResourcesRoutes.use('*', requireRole('admin', 'super_admin'));

// ─── POST /api/admin/resources/:id/tags ───────────
adminResourcesRoutes.post('/:id/tags', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { resource_type, tags } = body;
    // tags: Array<{ tag_type: string; tag_value: string }>

    if (!resource_type || !tags || !Array.isArray(tags)) {
      return error(c, 'Invalid payload', 400);
    }

    // Delete existing tags for this resource
    await c.env.DB.prepare('DELETE FROM resource_tags WHERE resource_id = ? AND resource_type = ?')
      .bind(id, resource_type)
      .run();

    // Insert new tags
    const now = new Date().toISOString();
    if (tags.length > 0) {
      const placeholders = tags.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
      const values: any[] = [];
      
      for (const tag of tags) {
        values.push(crypto.randomUUID(), id, resource_type, tag.tag_type, tag.tag_value, now);
      }
      
      await c.env.DB.prepare(
        `INSERT INTO resource_tags (id, resource_id, resource_type, tag_type, tag_value, created_at) VALUES ${placeholders}`
      ).bind(...values).run();
    }

    return success(c, { message: 'Tags updated successfully' });
  } catch (err) {
    console.error('[admin:resources:tags]', err);
    return error(c, 'Gagal memperbarui tags', 500);
  }
});

// ─── GET /api/admin/resources/:id/tags ───────────
adminResourcesRoutes.get('/:id/tags', async (c) => {
  try {
    const id = c.req.param('id');
    const resource_type = c.req.query('type');
    
    if (!resource_type) {
      return error(c, 'Missing resource_type query param', 400);
    }
    
    const tags = await c.env.DB.prepare(
      'SELECT tag_type, tag_value FROM resource_tags WHERE resource_id = ? AND resource_type = ?'
    ).bind(id, resource_type).all();
    
    return success(c, tags.results);
  } catch (err) {
    console.error('[admin:resources:tags]', err);
    return error(c, 'Gagal memuat tags', 500);
  }
});

export default adminResourcesRoutes;
