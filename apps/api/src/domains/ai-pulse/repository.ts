// AI Pulse — akses D1. Query mentah; mapping ke DTO publik ada di mapper.ts.
import type { AiPulseItemRow, AiPulseSourceRow, ItemStatus } from './types';

const ITEM_FIELDS = [
  'id', 'slug', 'title', 'original_title', 'source_id', 'source_name', 'source_url', 'thumbnail_url', 'published_at',
  'dedup_hash', 'summary', 'deep_dive', 'key_points_json', 'why_it_matters', 'who_should_use', 'use_cases_json',
  'how_to_start_json', 'prompt_example', 'faq_json',
  'business_insight', 'primary_category_id', 'tags_json', 'impact_level',
  'related_course_ids_json', 'related_bonus_ids_json', 'related_automation_template_keys_json',
  'status', 'featured', 'view_count', 'ai_model', 'published_at_internal', 'created_at', 'updated_at',
];
const ITEM_COLUMNS = ITEM_FIELDS.join(', ');
const ITEM_COLUMNS_PREFIXED = (alias: string) => ITEM_FIELDS.map((f) => `${alias}.${f}`).join(', ');

export class AiPulseRepository {
  constructor(private db: D1Database) {}

  // ─── Sources ────────────────────────────────────────────────────
  async listEnabledSources(): Promise<AiPulseSourceRow[]> {
    const res = await this.db
      .prepare(`SELECT * FROM ai_pulse_sources WHERE enabled = 1 ORDER BY created_at ASC`)
      .all<AiPulseSourceRow>();
    return res.results ?? [];
  }

  async listAllSources(): Promise<AiPulseSourceRow[]> {
    const res = await this.db
      .prepare(`SELECT * FROM ai_pulse_sources ORDER BY created_at ASC`)
      .all<AiPulseSourceRow>();
    return res.results ?? [];
  }

  async createSource(s: {
    id: string; name: string; type: string; url: string; category: string | null; now: string;
  }): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO ai_pulse_sources (id, name, type, url, category, enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
      )
      .bind(s.id, s.name, s.type, s.url, s.category, s.now, s.now)
      .run();
  }

  async updateSource(id: string, patch: Partial<{ name: string; url: string; type: string; category: string | null; enabled: number }>, now: string): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [k, v] of Object.entries(patch)) {
      sets.push(`${k} = ?`);
      vals.push(v);
    }
    if (sets.length === 0) return;
    sets.push(`updated_at = ?`);
    vals.push(now, id);
    await this.db.prepare(`UPDATE ai_pulse_sources SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  }

  async deleteSource(id: string): Promise<void> {
    await this.db.prepare(`DELETE FROM ai_pulse_sources WHERE id = ?`).bind(id).run();
  }

  async markSourceFetched(id: string, now: string): Promise<void> {
    await this.db
      .prepare(`UPDATE ai_pulse_sources SET last_fetched_at = ?, updated_at = ? WHERE id = ?`)
      .bind(now, now, id)
      .run();
  }

  // ─── Items: ingestion ───────────────────────────────────────────
  async dedupExists(dedupHash: string): Promise<boolean> {
    const row = await this.db
      .prepare(`SELECT 1 FROM ai_pulse_items WHERE dedup_hash = ? LIMIT 1`)
      .bind(dedupHash)
      .first();
    return !!row;
  }

  async slugExists(slug: string): Promise<boolean> {
    const row = await this.db.prepare(`SELECT 1 FROM ai_pulse_items WHERE slug = ? LIMIT 1`).bind(slug).first();
    return !!row;
  }

  async insertDraft(row: AiPulseItemRow): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO ai_pulse_items (${ITEM_COLUMNS})
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        row.id, row.slug, row.title, row.original_title, row.source_id, row.source_name, row.source_url,
        row.thumbnail_url, row.published_at, row.dedup_hash, row.summary, row.deep_dive, row.key_points_json, row.why_it_matters,
        row.who_should_use, row.use_cases_json, row.how_to_start_json, row.prompt_example, row.faq_json,
        row.business_insight, row.primary_category_id, row.tags_json, row.impact_level, row.related_course_ids_json,
        row.related_bonus_ids_json, row.related_automation_template_keys_json, row.status,
        row.featured, row.view_count, row.ai_model, row.published_at_internal,
        row.created_at, row.updated_at
      )
      .run();
  }

  // ─── Items: read ────────────────────────────────────────────────
  async getById(id: string): Promise<AiPulseItemRow | null> {
    return await this.db
      .prepare(`SELECT ${ITEM_COLUMNS} FROM ai_pulse_items WHERE id = ? LIMIT 1`)
      .bind(id)
      .first<AiPulseItemRow>();
  }

  async getPublishedBySlug(slug: string): Promise<AiPulseItemRow | null> {
    return await this.db
      .prepare(`SELECT ${ITEM_COLUMNS} FROM ai_pulse_items WHERE slug = ? AND status = 'published' LIMIT 1`)
      .bind(slug)
      .first<AiPulseItemRow>();
  }

  /** Feed publik. Filter opsional kategori/impact. */
  async listPublished(opts: {
    page: number; limit: number; categoryId?: string; impact?: string;
  }): Promise<{ rows: AiPulseItemRow[]; total: number }> {
    const where: string[] = [`status = 'published'`];
    const vals: unknown[] = [];
    if (opts.categoryId) { where.push(`primary_category_id = ?`); vals.push(opts.categoryId); }
    if (opts.impact) { where.push(`impact_level = ?`); vals.push(opts.impact); }
    const whereSql = where.join(' AND ');

    const totalRow = await this.db
      .prepare(`SELECT COUNT(*) as c FROM ai_pulse_items WHERE ${whereSql}`)
      .bind(...vals)
      .first<{ c: number }>();

    const offset = (opts.page - 1) * opts.limit;
    const res = await this.db
      .prepare(
        `SELECT ${ITEM_COLUMNS} FROM ai_pulse_items
         WHERE ${whereSql}
         ORDER BY featured DESC, published_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...vals, opts.limit, offset)
      .all<AiPulseItemRow>();

    return { rows: res.results ?? [], total: totalRow?.c ?? 0 };
  }

  async incrementView(id: string): Promise<void> {
    await this.db.prepare(`UPDATE ai_pulse_items SET view_count = view_count + 1 WHERE id = ?`).bind(id).run();
  }

  // ─── Overview / terminal ────────────────────────────────────────
  async countPublishedSince(sinceIso: string): Promise<number> {
    const row = await this.db
      .prepare(`SELECT COUNT(*) as c FROM ai_pulse_items WHERE status = 'published' AND published_at >= ?`)
      .bind(sinceIso)
      .first<{ c: number }>();
    return row?.c ?? 0;
  }

  /** Aktivitas harian (jumlah item per hari) untuk chart. */
  async dailyActivitySince(sinceIso: string): Promise<{ day: string; count: number }[]> {
    const res = await this.db
      .prepare(
        `SELECT substr(published_at, 1, 10) as day, COUNT(*) as count
         FROM ai_pulse_items
         WHERE status = 'published' AND published_at >= ?
         GROUP BY day ORDER BY day ASC`
      )
      .bind(sinceIso)
      .all<{ day: string; count: number }>();
    return res.results ?? [];
  }

  async topCategoriesSince(sinceIso: string, limit: number): Promise<{ category_id: string; count: number }[]> {
    const res = await this.db
      .prepare(
        `SELECT primary_category_id as category_id, COUNT(*) as count
         FROM ai_pulse_items
         WHERE status = 'published' AND published_at >= ? AND primary_category_id IS NOT NULL
         GROUP BY primary_category_id ORDER BY count DESC LIMIT ?`
      )
      .bind(sinceIso, limit)
      .all<{ category_id: string; count: number }>();
    return res.results ?? [];
  }

  async countActiveSources(): Promise<number> {
    const row = await this.db.prepare(`SELECT COUNT(*) as c FROM ai_pulse_sources WHERE enabled = 1`).first<{ c: number }>();
    return row?.c ?? 0;
  }

  /** Semua item published (full kolom) untuk sync blog landing. */
  async listAllPublishedFull(limit: number): Promise<AiPulseItemRow[]> {
    const res = await this.db
      .prepare(`SELECT ${ITEM_COLUMNS} FROM ai_pulse_items WHERE status = 'published' ORDER BY published_at DESC LIMIT ?`)
      .bind(limit)
      .all<AiPulseItemRow>();
    return res.results ?? [];
  }

  async listLatestPublished(limit: number): Promise<AiPulseItemRow[]> {
    const res = await this.db
      .prepare(
        `SELECT ${ITEM_COLUMNS} FROM ai_pulse_items
         WHERE status = 'published' ORDER BY published_at DESC LIMIT ?`
      )
      .bind(limit)
      .all<AiPulseItemRow>();
    return res.results ?? [];
  }

  /** Artikel terkait (kategori sama, published, selain dirinya). */
  async listRelatedPublished(categoryId: string | null, excludeId: string, limit: number): Promise<AiPulseItemRow[]> {
    if (categoryId) {
      const res = await this.db
        .prepare(
          `SELECT ${ITEM_COLUMNS} FROM ai_pulse_items
           WHERE status = 'published' AND primary_category_id = ? AND id != ?
           ORDER BY published_at DESC LIMIT ?`
        )
        .bind(categoryId, excludeId, limit)
        .all<AiPulseItemRow>();
      if ((res.results?.length ?? 0) >= limit) return res.results ?? [];
      // lengkapi dari item terbaru lain bila kurang
      const need = limit - (res.results?.length ?? 0);
      const have = new Set((res.results ?? []).map((r) => r.id));
      have.add(excludeId);
      const fill = await this.db
        .prepare(`SELECT ${ITEM_COLUMNS} FROM ai_pulse_items WHERE status = 'published' AND id != ? ORDER BY published_at DESC LIMIT ?`)
        .bind(excludeId, limit + 1)
        .all<AiPulseItemRow>();
      const extra = (fill.results ?? []).filter((r) => !have.has(r.id)).slice(0, need);
      return [...(res.results ?? []), ...extra];
    }
    const res = await this.db
      .prepare(`SELECT ${ITEM_COLUMNS} FROM ai_pulse_items WHERE status = 'published' AND id != ? ORDER BY published_at DESC LIMIT ?`)
      .bind(excludeId, limit)
      .all<AiPulseItemRow>();
    return res.results ?? [];
  }

  async getFeatured(limit: number): Promise<AiPulseItemRow[]> {
    const res = await this.db
      .prepare(
        `SELECT ${ITEM_COLUMNS} FROM ai_pulse_items
         WHERE status = 'published' AND featured = 1 ORDER BY published_at DESC LIMIT ?`
      )
      .bind(limit)
      .all<AiPulseItemRow>();
    return res.results ?? [];
  }

  /** Top item minggu ini untuk weekly digest. */
  async topForDigest(sinceIso: string, limit: number): Promise<AiPulseItemRow[]> {
    const res = await this.db
      .prepare(
        `SELECT ${ITEM_COLUMNS} FROM ai_pulse_items
         WHERE status = 'published' AND published_at_internal >= ?
         ORDER BY featured DESC, view_count DESC, published_at DESC LIMIT ?`
      )
      .bind(sinceIso, limit)
      .all<AiPulseItemRow>();
    return res.results ?? [];
  }

  // ─── Admin: list & mutate ───────────────────────────────────────
  async listForAdmin(opts: { status?: ItemStatus; page: number; limit: number }): Promise<{ rows: AiPulseItemRow[]; total: number }> {
    const where: string[] = [];
    const vals: unknown[] = [];
    if (opts.status) { where.push(`status = ?`); vals.push(opts.status); }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const totalRow = await this.db.prepare(`SELECT COUNT(*) as c FROM ai_pulse_items ${whereSql}`).bind(...vals).first<{ c: number }>();
    const offset = (opts.page - 1) * opts.limit;
    const res = await this.db
      .prepare(`SELECT ${ITEM_COLUMNS} FROM ai_pulse_items ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .bind(...vals, opts.limit, offset)
      .all<AiPulseItemRow>();
    return { rows: res.results ?? [], total: totalRow?.c ?? 0 };
  }

  async updateItem(id: string, patch: Record<string, unknown>, now: string): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [k, v] of Object.entries(patch)) {
      sets.push(`${k} = ?`);
      vals.push(v);
    }
    if (sets.length === 0) return;
    sets.push(`updated_at = ?`);
    vals.push(now, id);
    await this.db.prepare(`UPDATE ai_pulse_items SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  }

  // ─── Bookmarks ──────────────────────────────────────────────────
  async isBookmarked(userId: string, itemId: string): Promise<boolean> {
    const row = await this.db
      .prepare(`SELECT 1 FROM ai_pulse_bookmarks WHERE user_id = ? AND item_id = ? LIMIT 1`)
      .bind(userId, itemId)
      .first();
    return !!row;
  }

  async addBookmark(userId: string, itemId: string, now: string): Promise<void> {
    await this.db
      .prepare(`INSERT OR IGNORE INTO ai_pulse_bookmarks (user_id, item_id, created_at) VALUES (?, ?, ?)`)
      .bind(userId, itemId, now)
      .run();
  }

  async removeBookmark(userId: string, itemId: string): Promise<void> {
    await this.db.prepare(`DELETE FROM ai_pulse_bookmarks WHERE user_id = ? AND item_id = ?`).bind(userId, itemId).run();
  }

  async listBookmarks(userId: string): Promise<AiPulseItemRow[]> {
    const res = await this.db
      .prepare(
        `SELECT ${ITEM_COLUMNS_PREFIXED('i')}
         FROM ai_pulse_bookmarks b
         JOIN ai_pulse_items i ON i.id = b.item_id
         WHERE b.user_id = ? AND i.status = 'published'
         ORDER BY b.created_at DESC`
      )
      .bind(userId)
      .all<AiPulseItemRow>();
    return res.results ?? [];
  }
}
