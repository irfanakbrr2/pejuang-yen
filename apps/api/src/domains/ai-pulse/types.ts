// AI Pulse — shared types untuk domain intelligence terminal.

export type ImpactLevel = 'major' | 'update' | 'breaking';
export type ItemStatus = 'draft' | 'published' | 'archived';

export interface FaqEntry {
  q: string;
  a: string;
}

/** Bentuk JSON yang diminta dari LLM saat membuat learning package. */
export interface AiDraft {
  is_worthy: boolean;
  worthiness_reason: string;
  title_id: string;
  summary: string;
  deep_dive: string;
  key_points: string[];
  why_it_matters: string;
  who_should_use: string;
  use_cases: string[];
  how_to_start: string[];
  prompt_example: string;
  faq: FaqEntry[];
  business_insight: string;
  tags: string[];
  suggested_category_id: string | null;
  impact_level: ImpactLevel;
}

/** Item mentah hasil parse RSS/Atom sebelum diproses AI. */
export interface RawFeedItem {
  title: string;
  link: string;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  contentText: string;
}

export interface AiPulseSourceRow {
  id: string;
  name: string;
  type: string;
  url: string;
  category: string | null;
  enabled: number;
  last_fetched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiPulseItemRow {
  id: string;
  slug: string;
  title: string;
  original_title: string | null;
  source_id: string | null;
  source_name: string | null;
  source_url: string | null;
  thumbnail_url: string | null;
  published_at: string | null;
  dedup_hash: string;
  summary: string | null;
  deep_dive: string | null;
  key_points_json: string | null;
  why_it_matters: string | null;
  who_should_use: string | null;
  use_cases_json: string | null;
  how_to_start_json: string | null;
  prompt_example: string | null;
  faq_json: string | null;
  business_insight: string | null;
  primary_category_id: string | null;
  tags_json: string | null;
  impact_level: ImpactLevel;
  related_course_ids_json: string | null;
  related_bonus_ids_json: string | null;
  related_automation_template_keys_json: string | null;
  status: ItemStatus;
  featured: number;
  view_count: number;
  ai_model: string | null;
  published_at_internal: string | null;
  created_at: string;
  updated_at: string;
}
