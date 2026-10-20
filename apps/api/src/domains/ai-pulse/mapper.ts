// AI Pulse — mapping row D1 -> DTO publik (parse field JSON dengan aman).
import type { AiPulseItemRow, FaqEntry } from './types';

function parseStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function parseFaq(raw: string | null): FaqEntry[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter((x) => x && typeof x.q === 'string' && typeof x.a === 'string')
      .map((x) => ({ q: x.q as string, a: x.a as string }));
  } catch {
    return [];
  }
}

/** Kartu untuk feed/overview — ringan, tanpa field panjang. */
export function toListItem(row: AiPulseItemRow) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    thumbnail_url: row.thumbnail_url,
    source_name: row.source_name,
    published_at: row.published_at,
    impact_level: row.impact_level,
    primary_category_id: row.primary_category_id,
    tags: parseStringArray(row.tags_json),
    view_count: row.view_count,
    featured: row.featured === 1,
  };
}

/** Detail penuh — learning package + id terkait (mentah, enrichment di routes). */
export function toDetail(row: AiPulseItemRow) {
  return {
    ...toListItem(row),
    source_url: row.source_url,
    deep_dive: row.deep_dive,
    key_points: parseStringArray(row.key_points_json),
    why_it_matters: row.why_it_matters,
    who_should_use: row.who_should_use,
    use_cases: parseStringArray(row.use_cases_json),
    how_to_start: parseStringArray(row.how_to_start_json),
    prompt_example: row.prompt_example,
    faq: parseFaq(row.faq_json),
    business_insight: row.business_insight,
    related_course_ids: parseStringArray(row.related_course_ids_json),
    related_bonus_ids: parseStringArray(row.related_bonus_ids_json),
    related_automation_template_keys: parseStringArray(row.related_automation_template_keys_json),
  };
}

/** Versi admin — sertakan status & field lifecycle. */
export function toAdminItem(row: AiPulseItemRow) {
  return {
    ...toDetail(row),
    status: row.status,
    original_title: row.original_title,
    dedup_hash: row.dedup_hash,
    ai_model: row.ai_model,
    created_at: row.created_at,
    updated_at: row.updated_at,
    published_at_internal: row.published_at_internal,
  };
}

export { parseStringArray, parseFaq };
