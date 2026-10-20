import type { Env } from '../env';
import { TOOLS_CATALOG } from '../domains/tools/tools.routes';

// Keeps the content_items registry (discovery mirror) in sync with the
// per-type source-of-truth tables. Called from admin CRUD handlers after
// every successful mutation; resyncAll() is the full-rebuild safety hatch.

export type RegistryContentType = 'course' | 'bonus' | 'recording' | 'tool';

interface RegistryRow {
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
}

async function fetchSource(
  db: D1Database,
  type: RegistryContentType,
  refId: string
): Promise<RegistryRow | null> {
  if (type === 'course') {
    return await db.prepare(
      `SELECT slug, title, COALESCE(short_description, description) AS description,
              thumbnail_url, 'kelas' AS format, level, access_type, price,
              COALESCE(priority_score, 0) AS priority_score, COALESCE(is_featured, 0) AS is_featured,
              status, published_at, created_at
       FROM courses WHERE id = ?`
    ).bind(refId).first<RegistryRow>();
  }
  if (type === 'bonus') {
    // bonuses memakai status 'active' sebagai padanan 'published';
    // thumbnail fallback ke file pertama yang punya thumbnail
    return await db.prepare(
      `SELECT slug, title, description,
              COALESCE(NULLIF(thumbnail_url, ''),
                (SELECT bf.thumbnail_url FROM bonus_files bf
                 WHERE bf.bonus_id = bonuses.id AND bf.thumbnail_url IS NOT NULL AND bf.thumbnail_url != ''
                 ORDER BY bf.sort_order ASC, bf.created_at ASC LIMIT 1)) AS thumbnail_url,
              COALESCE(bonus_type, 'file') AS format, NULL AS level, access_type, NULL AS price,
              COALESCE(priority_score, 0) AS priority_score, COALESCE(is_featured, 0) AS is_featured,
              CASE status WHEN 'active' THEN 'published' ELSE status END AS status,
              published_at, created_at
       FROM bonuses WHERE id = ?`
    ).bind(refId).first<RegistryRow>();
  }
  if (type === 'recording') {
    return await db.prepare(
      `SELECT slug, title, subtitle AS description, thumbnail_url,
              'rekaman' AS format, NULL AS level,
              CASE status WHEN 'membership_only' THEN 'membership_only' ELSE 'free' END AS access_type,
              NULL AS price, COALESCE(sort_order, 0) AS priority_score, 0 AS is_featured,
              CASE status WHEN 'hidden' THEN 'draft' ELSE 'published' END AS status,
              recorded_at AS published_at, created_at
       FROM webinar_recordings WHERE id = ?`
    ).bind(refId).first<RegistryRow>();
  }
  // tool: source of truth is the in-code catalog
  const tool = TOOLS_CATALOG.find((t) => t.id === refId);
  if (!tool) return null;
  const now = new Date().toISOString();
  return {
    slug: tool.id.replace(/_/g, '-'),
    title: tool.name,
    description: tool.description,
    thumbnail_url: null,
    format: 'ai_tool',
    level: null,
    access_type: 'free',
    price: null,
    priority_score: 0,
    is_featured: 0,
    status: tool.status === 'active' ? 'published' : 'draft',
    published_at: null,
    created_at: now,
  };
}

function buildSearchText(title: string, description: string | null, names: string[]): string {
  return [title, description || '', ...names].join(' ').toLowerCase();
}

async function fetchSkillTagNames(db: D1Database, contentId: string): Promise<string[]> {
  const rows = await db.prepare(
    `SELECT s.name FROM content_skills cs JOIN skills s ON s.id = cs.skill_id WHERE cs.content_id = ?
     UNION ALL
     SELECT t.name FROM content_tags ct JOIN tags t ON t.id = ct.tag_id WHERE ct.content_id = ?`
  ).bind(contentId, contentId).all<{ name: string }>();
  return rows.results.map((r) => r.name);
}

export async function syncContentItem(
  db: D1Database,
  type: RegistryContentType,
  refId: string
): Promise<void> {
  const contentId = `${type}:${refId}`;
  const src = await fetchSource(db, type, refId);
  const now = new Date().toISOString();

  if (!src) {
    // Source deleted: remove registry row + taxonomy joins. Path items are
    // left in place and filtered out by the registry JOIN at read time.
    await db.batch([
      db.prepare('DELETE FROM content_skills WHERE content_id = ?').bind(contentId),
      db.prepare('DELETE FROM content_tags WHERE content_id = ?').bind(contentId),
      db.prepare('DELETE FROM content_items WHERE id = ?').bind(contentId),
    ]);
    return;
  }

  const names = await fetchSkillTagNames(db, contentId);
  await db.prepare(
    `INSERT INTO content_items (
       id, content_type, ref_id, slug, title, description, thumbnail_url,
       format, level, access_type, price, priority_score, is_featured, status,
       search_text, published_at, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(content_type, ref_id) DO UPDATE SET
       slug = excluded.slug, title = excluded.title, description = excluded.description,
       thumbnail_url = excluded.thumbnail_url, format = excluded.format, level = excluded.level,
       access_type = excluded.access_type, price = excluded.price,
       priority_score = excluded.priority_score, is_featured = excluded.is_featured,
       status = excluded.status, search_text = excluded.search_text,
       published_at = excluded.published_at, updated_at = excluded.updated_at`
  ).bind(
    contentId, type, refId, src.slug, src.title, src.description, src.thumbnail_url,
    src.format, src.level, src.access_type, src.price, src.priority_score, src.is_featured,
    src.status, buildSearchText(src.title, src.description, names),
    src.published_at, src.created_at, now
  ).run();
}

// Rebuild search_text only (after skill/tag assignment changes)
export async function rebuildSearchText(db: D1Database, contentId: string): Promise<void> {
  await db.prepare(
    `UPDATE content_items SET search_text = lower(
       title || ' ' || COALESCE(description, '')
       || ' ' || COALESCE((SELECT group_concat(s.name, ' ') FROM content_skills cs
                           JOIN skills s ON s.id = cs.skill_id WHERE cs.content_id = content_items.id), '')
       || ' ' || COALESCE((SELECT group_concat(t.name, ' ') FROM content_tags ct
                           JOIN tags t ON t.id = ct.tag_id WHERE ct.content_id = content_items.id), '')
     ), updated_at = ?
     WHERE id = ?`
  ).bind(new Date().toISOString(), contentId).run();
}

// Full rebuild: upsert every source row, remove orphans, refresh search_text.
export async function resyncAll(db: D1Database): Promise<{ synced: number }> {
  const now = new Date().toISOString();

  const upserts: D1PreparedStatement[] = [
    db.prepare(
      `INSERT INTO content_items (id, content_type, ref_id, slug, title, description, thumbnail_url,
         format, level, access_type, price, priority_score, is_featured, status, search_text,
         published_at, created_at, updated_at)
       SELECT 'course:' || id, 'course', id, slug, title, COALESCE(short_description, description),
         thumbnail_url, 'kelas', level, access_type, price, COALESCE(priority_score, 0),
         COALESCE(is_featured, 0), status, lower(title || ' ' || COALESCE(short_description, '')),
         published_at, created_at, ?
       FROM courses WHERE 1
       ON CONFLICT(content_type, ref_id) DO UPDATE SET
         slug = excluded.slug, title = excluded.title, description = excluded.description,
         thumbnail_url = excluded.thumbnail_url, level = excluded.level,
         access_type = excluded.access_type, price = excluded.price,
         priority_score = excluded.priority_score, is_featured = excluded.is_featured,
         status = excluded.status, published_at = excluded.published_at, updated_at = excluded.updated_at`
    ).bind(now),
    db.prepare(
      `INSERT INTO content_items (id, content_type, ref_id, slug, title, description, thumbnail_url,
         format, level, access_type, price, priority_score, is_featured, status, search_text,
         published_at, created_at, updated_at)
       SELECT 'bonus:' || id, 'bonus', id, slug, title, description,
         COALESCE(NULLIF(thumbnail_url, ''),
           (SELECT bf.thumbnail_url FROM bonus_files bf
            WHERE bf.bonus_id = bonuses.id AND bf.thumbnail_url IS NOT NULL AND bf.thumbnail_url != ''
            ORDER BY bf.sort_order ASC, bf.created_at ASC LIMIT 1)),
         COALESCE(bonus_type, 'file'), NULL, access_type, NULL, COALESCE(priority_score, 0),
         COALESCE(is_featured, 0),
         CASE status WHEN 'active' THEN 'published' ELSE status END,
         lower(title || ' ' || COALESCE(description, '')),
         published_at, created_at, ?
       FROM bonuses WHERE 1
       ON CONFLICT(content_type, ref_id) DO UPDATE SET
         slug = excluded.slug, title = excluded.title, description = excluded.description,
         thumbnail_url = excluded.thumbnail_url, format = excluded.format,
         access_type = excluded.access_type, priority_score = excluded.priority_score,
         is_featured = excluded.is_featured, status = excluded.status,
         published_at = excluded.published_at, updated_at = excluded.updated_at`
    ).bind(now),
    db.prepare(
      `INSERT INTO content_items (id, content_type, ref_id, slug, title, description, thumbnail_url,
         format, level, access_type, price, priority_score, is_featured, status, search_text,
         published_at, created_at, updated_at)
       SELECT 'recording:' || id, 'recording', id, slug, title, subtitle, thumbnail_url,
         'rekaman', NULL,
         CASE status WHEN 'membership_only' THEN 'membership_only' ELSE 'free' END,
         NULL, COALESCE(sort_order, 0), 0,
         CASE status WHEN 'hidden' THEN 'draft' ELSE 'published' END,
         lower(title || ' ' || COALESCE(subtitle, '')),
         recorded_at, created_at, ?
       FROM webinar_recordings WHERE 1
       ON CONFLICT(content_type, ref_id) DO UPDATE SET
         slug = excluded.slug, title = excluded.title, description = excluded.description,
         thumbnail_url = excluded.thumbnail_url, access_type = excluded.access_type,
         priority_score = excluded.priority_score, status = excluded.status,
         published_at = excluded.published_at, updated_at = excluded.updated_at`
    ).bind(now),
    // Orphan cleanup (source row gone)
    db.prepare(`DELETE FROM content_items WHERE content_type = 'course' AND ref_id NOT IN (SELECT id FROM courses)`),
    db.prepare(`DELETE FROM content_items WHERE content_type = 'bonus' AND ref_id NOT IN (SELECT id FROM bonuses)`),
    db.prepare(`DELETE FROM content_items WHERE content_type = 'recording' AND ref_id NOT IN (SELECT id FROM webinar_recordings)`),
    db.prepare(`DELETE FROM content_skills WHERE content_id NOT IN (SELECT id FROM content_items)`),
    db.prepare(`DELETE FROM content_tags WHERE content_id NOT IN (SELECT id FROM content_items)`),
  ];
  await db.batch(upserts);

  // Tools reconcile against the in-code catalog
  for (const tool of TOOLS_CATALOG) {
    await syncContentItem(db, 'tool', tool.id);
  }
  const toolIds = TOOLS_CATALOG.map((t) => t.id);
  const placeholders = toolIds.map(() => '?').join(', ');
  await db.prepare(
    `DELETE FROM content_items WHERE content_type = 'tool'${toolIds.length ? ` AND ref_id NOT IN (${placeholders})` : ''}`
  ).bind(...toolIds).run();

  // Refresh search_text with skill/tag names in one pass
  await db.prepare(
    `UPDATE content_items SET search_text = lower(
       title || ' ' || COALESCE(description, '')
       || ' ' || COALESCE((SELECT group_concat(s.name, ' ') FROM content_skills cs
                           JOIN skills s ON s.id = cs.skill_id WHERE cs.content_id = content_items.id), '')
       || ' ' || COALESCE((SELECT group_concat(t.name, ' ') FROM content_tags ct
                           JOIN tags t ON t.id = ct.tag_id WHERE ct.content_id = content_items.id), '')
     )`
  ).run();

  const count = await db.prepare('SELECT COUNT(*) AS n FROM content_items').first<{ n: number }>();
  return { synced: count?.n ?? 0 };
}

// Invalidate KV caches for discovery surfaces after content/taxonomy changes
export async function invalidateDiscoveryCache(env: Env): Promise<void> {
  for (const prefix of ['skills:', 'paths:', 'resources:', 'search:']) {
    const listed = await env.KV.list({ prefix });
    await Promise.all(listed.keys.map(({ name }) => env.KV.delete(name)));
  }
}
