import { Hono } from 'hono';
import type { Env } from '../../env';
import { success } from '../../lib/response';

// 9 kategori utama (taxonomy topik) — publik, dipakai chip filter di
// halaman Kelas & Bonus serta dropdown di form admin.
const categoriesRoutes = new Hono<{ Bindings: Env }>();

categoriesRoutes.get('/', async (c) => {
  // course_count/bonus_count dipakai UI untuk menandai kategori kosong
  // sebagai "Coming Soon" (match primary ATAU secondary).
  const rows = await c.env.DB.prepare(
    `SELECT id, slug, name, description, icon, sort_order,
       (SELECT COUNT(DISTINCT cc.ref_id) FROM content_categories cc
        JOIN courses co ON co.id = cc.ref_id
        WHERE cc.content_type = 'course' AND cc.category_id = categories.id AND co.status = 'published') as course_count,
       (SELECT COUNT(DISTINCT cc.ref_id) FROM content_categories cc
        JOIN bonuses b ON b.id = cc.ref_id
        WHERE cc.content_type = 'bonus' AND cc.category_id = categories.id AND b.status = 'active') as bonus_count
     FROM categories
     WHERE is_active = 1 ORDER BY sort_order ASC`
  ).all();
  return success(c, rows.results);
});

export default categoriesRoutes;
