import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, optionalAuthMiddleware } from '../../middleware/auth';
import { success, error } from '../../lib/response';

const resourceRoutes = new Hono<{ Bindings: Env }>();

// ai_level profil (5 nilai) → level konten (3 nilai)
function mapAiLevel(aiLevel: string | null | undefined): string | null {
  if (!aiLevel) return null;
  if (aiLevel === 'beginner' || aiLevel === 'basic_user') return 'beginner';
  if (aiLevel === 'intermediate') return 'intermediate';
  return 'advanced'; // automation_user | business_user
}

interface RegistryRow extends Record<string, unknown> {
  content_id: string;
  content_type: string;
  ref_id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  format: string;
  level: string | null;
  access_type: string | null;
  price: number | null;
  priority_score: number;
  is_featured: number;
  status: string;
  published_at: string | null;
  created_at: string;
  skills_json: string | null;
  persona_tags_json: string | null;
}

const BASE_SELECT = `
  SELECT ci.id AS content_id, ci.content_type, ci.ref_id, ci.slug, ci.title, ci.description,
         ci.thumbnail_url, ci.format, ci.level, ci.access_type, ci.price,
         ci.priority_score, ci.is_featured, ci.status, ci.published_at, ci.created_at,
         (SELECT json_group_array(json_object('id', s.id, 'slug', s.slug, 'name', s.name))
          FROM content_skills cs JOIN skills s ON s.id = cs.skill_id
          WHERE cs.content_id = ci.id) AS skills_json,
         (SELECT json_group_array(json_object('tag_type', rt.tag_type, 'tag_value', rt.tag_value))
          FROM resource_tags rt
          WHERE rt.resource_id = ci.ref_id AND rt.resource_type = ci.content_type) AS persona_tags_json
  FROM content_items ci`;

function hydrateRow(r: RegistryRow) {
  let skills: { id: string; slug: string; name: string }[] = [];
  let tags: { tag_type: string; tag_value: string }[] = [];
  try { skills = JSON.parse(r.skills_json || '[]'); } catch { /* noop */ }
  try { tags = JSON.parse(r.persona_tags_json || '[]'); } catch { /* noop */ }
  const { skills_json: _s, persona_tags_json: _t, content_id, ...rest } = r;
  return {
    // back-compat shape: id = ref id per tipe, type = content_type
    ...rest,
    id: r.ref_id,
    type: r.content_type === 'recording' ? 'recording' : r.content_type,
    content_id,
    category: skills.length > 0 ? skills[0].name : (r.content_type === 'bonus' ? 'Bonus' : null),
    skills,
    tags,
  };
}

// ─── GET /api/resources ───────────
// Katalog terpadu (course/bonus/recording/tool) via registry.
// Back-compat: type, category, role, goal. Baru: skill (slug), q, format.
resourceRoutes.get('/', optionalAuthMiddleware(), async (c) => {
  try {
    const url = new URL(c.req.url);
    const category = url.searchParams.get('category');
    const type = url.searchParams.get('type');
    const format = url.searchParams.get('format');
    const skill = url.searchParams.get('skill');
    const role = url.searchParams.get('role');
    const goal = url.searchParams.get('goal');
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();

    let query = `${BASE_SELECT} WHERE ci.status = 'published'`;
    const params: unknown[] = [];

    if (type) {
      query += ' AND ci.content_type = ?';
      params.push(type);
    }
    if (format) {
      query += ' AND ci.format = ?';
      params.push(format);
    }
    if (skill) {
      query += ` AND ci.id IN (SELECT cs.content_id FROM content_skills cs
                 JOIN skills s ON s.id = cs.skill_id WHERE s.slug = ?)`;
      params.push(skill);
    }
    // Taxonomy 9 kategori utama (slug) — match primary ATAU secondary
    const taxonomyCategory = url.searchParams.get('taxonomy_category');
    if (taxonomyCategory) {
      query += ` AND EXISTS (
        SELECT 1 FROM content_categories cc JOIN categories cat ON cat.id = cc.category_id
        WHERE cc.content_type = ci.content_type AND cc.ref_id = ci.ref_id AND cat.slug = ?
      )`;
      params.push(taxonomyCategory);
    }
    if (category) {
      // back-compat: kategori lama dipetakan ke skill via nama
      query += ` AND (ci.id IN (SELECT cs.content_id FROM content_skills cs
                 JOIN skills s ON s.id = cs.skill_id WHERE s.name = ?)
                 OR (? = 'Bonus' AND ci.content_type = 'bonus'))`;
      params.push(category, category);
    }
    if (q) {
      for (const term of q.split(/\s+/).filter(Boolean).slice(0, 6)) {
        query += ' AND ci.search_text LIKE ?';
        params.push(`%${term}%`);
      }
    }

    query += ' ORDER BY ci.priority_score DESC, ci.created_at DESC';

    const result = await c.env.DB.prepare(query).bind(...params).all<RegistryRow>();
    let resources = result.results.map(hydrateRow);

    if (role) {
      resources = resources.filter((r) =>
        r.tags.some((t) => t.tag_type === 'role' && t.tag_value === role));
    }
    if (goal) {
      resources = resources.filter((r) =>
        r.tags.some((t) => t.tag_type === 'goal' && t.tag_value === goal));
    }

    return success(c, resources);
  } catch (err) {
    console.error('[resources:list]', err);
    return error(c, 'Gagal memuat resource library', 500);
  }
});

// ─── GET /api/resources/recommendations ───────────
// Scorer v2: skill interests + persona + riwayat + path berikutnya.
resourceRoutes.get('/recommendations', authMiddleware(), async (c) => {
  try {
    const user = c.get('user');

    const profile = await c.env.DB.prepare(
      'SELECT role, primary_goal, ai_level, recommended_track, interests_json FROM user_profiles WHERE user_id = ?'
    ).bind(user.id).first<{
      role: string | null; primary_goal: string | null; ai_level: string | null;
      recommended_track: string | null; interests_json: string | null;
    }>();

    let interests: string[] = [];
    try { interests = JSON.parse(profile?.interests_json || '[]'); } catch { /* noop */ }
    if (!Array.isArray(interests)) interests = [];

    const role = profile?.role || null;
    const primaryGoal = profile?.primary_goal || null;
    const mappedLevel = mapAiLevel(profile?.ai_level);

    // Kandidat + state user (3 query, lalu skor di Worker — pola lama dipertahankan)
    const [candidates, enrollments, accessRows] = await Promise.all([
      c.env.DB.prepare(`${BASE_SELECT} WHERE ci.status = 'published'`).all<RegistryRow>(),
      c.env.DB.prepare(
        `SELECT course_id, completed_at, progress_percent FROM enrollments WHERE user_id = ?`
      ).bind(user.id).all<{ course_id: string; completed_at: string | null; progress_percent: number | null }>(),
      c.env.DB.prepare(
        `SELECT resource_type, resource_id FROM user_access WHERE user_id = ? AND status = 'active'`
      ).bind(user.id).all<{ resource_type: string; resource_id: string }>(),
    ]);

    const enrolledCourseIds = new Set(enrollments.results.map((e) => e.course_id));
    const ownedKeys = new Set(accessRows.results.map((a) => `${a.resource_type}:${a.resource_id}`));

    // Skill affinity dari kelas yang sudah diikuti
    const enrolledSkillIds = new Set<string>();
    // Path-next: item belum selesai pertama dari path yang sudah dimulai
    const pathNextContentIds = new Set<string>();

    if (enrolledCourseIds.size > 0) {
      const placeholders = [...enrolledCourseIds].map(() => '?').join(', ');
      const skillRows = await c.env.DB.prepare(
        `SELECT DISTINCT cs.skill_id FROM content_skills cs
         JOIN content_items ci ON ci.id = cs.content_id
         WHERE ci.content_type = 'course' AND ci.ref_id IN (${placeholders})`
      ).bind(...enrolledCourseIds).all<{ skill_id: string }>();
      for (const r of skillRows.results) enrolledSkillIds.add(r.skill_id);

      const pathItems = await c.env.DB.prepare(
        `SELECT lpi.path_id, lpi.content_id, lpi.sort_order, ci.content_type, ci.ref_id
         FROM learning_path_items lpi
         JOIN learning_paths lp ON lp.id = lpi.path_id AND lp.status = 'published'
         JOIN content_items ci ON ci.id = lpi.content_id AND ci.status = 'published'
         ORDER BY lpi.path_id, lpi.sort_order ASC`
      ).all<{ path_id: string; content_id: string; sort_order: number; content_type: string; ref_id: string }>();

      const byPath = new Map<string, typeof pathItems.results>();
      for (const it of pathItems.results) {
        const list = byPath.get(it.path_id) || [];
        list.push(it);
        byPath.set(it.path_id, list);
      }
      const isDone = (it: { content_type: string; ref_id: string }) =>
        it.content_type === 'course'
          ? enrolledCourseIds.has(it.ref_id)
          : ownedKeys.has(`${it.content_type}:${it.ref_id}`);
      for (const [, list] of byPath) {
        const started = list.some(isDone);
        if (!started) continue;
        const next = list.find((it) => !isDone(it));
        if (next) pathNextContentIds.add(next.content_id);
      }
    }

    const now = Date.now();
    const scored = candidates.results.map(hydrateRow).map((r) => {
      const because: string[] = [];
      let score = Number(r.priority_score) || 0;

      const skillIds = r.skills.map((s) => s.id);
      const matched = skillIds.filter((id) => interests.includes(id));
      if (matched.length > 0) {
        score += Math.min(40 + (matched.length - 1) * 10, 60);
        because.push('skill_match');
      }
      if (role && r.tags.some((t) => t.tag_type === 'role' && t.tag_value === role)) {
        score += 25;
        because.push('persona');
      }
      if (primaryGoal && r.tags.some((t) => t.tag_type === 'goal' && t.tag_value === primaryGoal)) {
        score += 20;
        if (!because.includes('persona')) because.push('persona');
      }
      if (!r.level || (mappedLevel && r.level === mappedLevel)) score += 15;
      if (skillIds.some((id) => enrolledSkillIds.has(id))) score += 30;
      if (pathNextContentIds.has(String(r.content_id))) {
        score += 50;
        because.push('path_next');
      }
      if (r.is_featured) score += 10;
      if (r.published_at) {
        const ageDays = (now - new Date(String(r.published_at)).getTime()) / 86400000;
        if (ageDays >= 0 && ageDays < 30) { score += 15; because.push('new'); }
        else if (ageDays >= 0 && ageDays < 90) score += 8;
      }

      return { ...r, match_score: score, because };
    }).filter((r) => {
      // exclude konten yang sudah dimiliki/diikuti
      if (r.type === 'course') return !enrolledCourseIds.has(String(r.id));
      return !ownedKeys.has(`${r.type}:${r.id}`);
    });

    scored.sort((a, b) => b.match_score - a.match_score);

    const courses = scored.filter((r) => r.type === 'course');
    const bonuses = scored.filter((r) => r.type === 'bonus');
    const others = scored.filter((r) => r.type !== 'course' && r.type !== 'bonus');

    // Path rekomendasi: path dengan item "next" berskor tertinggi, atau path featured
    let recommendedPath: Record<string, unknown> | null = null;
    const topPathNext = scored.find((r) => r.because.includes('path_next'));
    const pathRow = topPathNext
      ? await c.env.DB.prepare(
          `SELECT lp.id, lp.slug, lp.title, lp.subtitle, lp.thumbnail_url, lp.level
           FROM learning_paths lp
           JOIN learning_path_items lpi ON lpi.path_id = lp.id AND lpi.content_id = ?
           WHERE lp.status = 'published' LIMIT 1`
        ).bind(topPathNext.content_id).first()
      : await c.env.DB.prepare(
          `SELECT id, slug, title, subtitle, thumbnail_url, level
           FROM learning_paths WHERE status = 'published' AND is_featured = 1
           ORDER BY sort_order ASC LIMIT 1`
        ).first();
    if (pathRow) {
      recommendedPath = { ...pathRow, next_item: topPathNext || null };
    }

    return success(c, {
      profile_context: profile ? {
        role, primary_goal: primaryGoal, ai_level: profile.ai_level,
        recommended_track: profile.recommended_track, interests,
      } : null,
      recommended_path: recommendedPath,
      recommended_course: courses.length > 0 ? courses[0] : null,
      supporting_courses: courses.slice(1, 3),
      recommended_bonuses: bonuses.slice(0, 5),
      recommended_others: others.slice(0, 5),
    });
  } catch (err) {
    console.error('[resources:recommendations]', err);
    return error(c, 'Gagal memuat rekomendasi', 500);
  }
});

export default resourceRoutes;
