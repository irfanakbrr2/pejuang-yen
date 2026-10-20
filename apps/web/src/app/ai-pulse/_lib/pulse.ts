// AI Pulse — tipe & konstanta bersama untuk UI terminal.

export interface PulseListItem {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  thumbnail_url: string | null;
  source_name: string | null;
  published_at: string | null;
  impact_level: "major" | "update" | "breaking";
  primary_category_id: string | null;
  tags: string[];
  view_count: number;
  featured: boolean;
  bookmarked?: boolean;
}

export interface RelatedCourse { id: string; slug: string; title: string; thumbnail_url: string | null; level: string | null; }
export interface RelatedBonus { id: string; slug: string; title: string; thumbnail_url: string | null; }
export interface RelatedAutomation { key: string; name: string; }

export interface PulseDetail extends PulseListItem {
  source_url: string | null;
  deep_dive: string | null;
  key_points: string[];
  why_it_matters: string | null;
  who_should_use: string | null;
  use_cases: string[];
  how_to_start: string[];
  prompt_example: string | null;
  faq: { q: string; a: string }[];
  business_insight: string | null;
  related_course_ids: string[];
  related_bonus_ids: string[];
  related_automation_template_keys: string[];
  related: { courses: RelatedCourse[]; bonuses: RelatedBonus[]; automations: RelatedAutomation[] };
  related_posts: PulseListItem[];
  bookmarked: boolean;
}

export interface PulseOverview {
  kpi: { today: number; this_week: number; active_sources: number };
  daily_activity: { day: string; count: number }[];
  top_categories: { category_id: string; count: number }[];
  featured: PulseListItem[];
  latest: PulseListItem[];
}

// Kategori stabil (cat_01..cat_09) — selaras dengan migration 0052.
export const CATEGORY_LABELS: Record<string, string> = {
  cat_01: "AI Fundamentals & Prompting",
  cat_02: "Vibecoding & Web Dev",
  cat_03: "Vibe Design & Visual",
  cat_04: "Marketing, Sales & Growth",
  cat_05: "AI Automation & Workflow",
  cat_06: "Content & Personal Branding",
  cat_07: "Business & Monetization",
  cat_08: "Career, Freelance & Portfolio",
  cat_09: "Productivity & Learning",
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([id, label]) => ({ id, label }));

// Impact level: label Bahasa Indonesia + warna status (color-not-only: selalu ada teks).
export const IMPACT_CONFIG: Record<
  PulseListItem["impact_level"],
  { label: string; dot: string; chip: string }
> = {
  major: {
    label: "Rilis Besar",
    dot: "bg-emerald-500",
    chip: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  update: {
    label: "Update",
    dot: "bg-amber-500",
    chip: "border border-amber-200 bg-amber-50 text-amber-700",
  },
  breaking: {
    label: "Penting",
    dot: "bg-rose-500",
    chip: "border border-rose-200 bg-rose-50 text-rose-700",
  },
};

export const IMPACT_OPTIONS = (Object.keys(IMPACT_CONFIG) as PulseListItem["impact_level"][]).map((k) => ({
  id: k,
  label: IMPACT_CONFIG[k].label,
}));

// Gradient placeholder per kategori (saat item tak punya thumbnail). Selaras bento app.
const CATEGORY_GRADIENTS: Record<string, string> = {
  cat_01: "from-[#F7E8E8] to-[#DCFCE7]",
  cat_02: "from-[#EFF6FF] to-[#DBEAFE]",
  cat_03: "from-[#F5F3FF] to-[#EDE9FE]",
  cat_04: "from-[#FFF7ED] to-[#FFEDD5]",
  cat_05: "from-[#F0FDF4] to-[#D1FAE5]",
  cat_06: "from-[#FFF1F2] to-[#FFE4E6]",
  cat_07: "from-[#F7E8E8] to-[#CCFBF1]",
  cat_08: "from-[#EFF6FF] to-[#E0F2FE]",
  cat_09: "from-[#F5F3FF] to-[#F3E8FF]",
};

export function categoryGradient(categoryId: string | null): string {
  return (categoryId && CATEGORY_GRADIENTS[categoryId]) || "from-[#F7E8E8] to-[#DCFCE7]";
}

/** Format waktu relatif ringkas (mis. "3j", "2h"). */
export function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}j`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}h`;
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}
