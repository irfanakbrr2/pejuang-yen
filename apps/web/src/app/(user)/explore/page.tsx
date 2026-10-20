"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Zap,
  PenTool,
  Megaphone,
  Workflow,
  Briefcase,
  Code2,
  TrendingUp,
  Calculator,
  Users,
  Headphones,
  Award,
  Compass,
  Route,
  ArrowRight,
  Languages,
  GraduationCap,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import { skillsApi, pathsApi, userApi } from "@/lib/api-client";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { StatCardSkeleton } from "@/components/ui/Skeleton";
import { ContentCard, type ContentItem } from "@/components/content/ContentCard";
import { GlobalSearchTrigger } from "@/components/search/GlobalSearch";

const SKILL_ICONS: Record<string, LucideIcon> = {
  Sparkles, Zap, PenTool, Megaphone, Workflow, Briefcase,
  Code2, TrendingUp, Calculator, Users, Headphones, Award,
  Languages, GraduationCap, MapPin,
};

interface Skill {
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  content_count: number;
}

interface PathCard {
  slug: string;
  title: string;
  subtitle: string | null;
  thumbnail_url: string | null;
  level: string | null;
  item_count: number;
  progress?: { percent: number } | null;
}

interface Recommendations {
  profile_context: { interests?: string[] } | null;
  recommended_course: ContentItem | null;
  supporting_courses: ContentItem[];
  recommended_bonuses: ContentItem[];
  recommended_others?: ContentItem[];
}

export default function ExplorePage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [paths, setPaths] = useState<PathCard[]>([]);
  const [recs, setRecs] = useState<Recommendations | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([skillsApi.list(), pathsApi.list(), userApi.recommendations()])
      .then(([skillsRes, pathsRes, recsRes]) => {
        if (skillsRes.success) setSkills((skillsRes.data as Skill[]) || []);
        if (pathsRes.success) setPaths(((pathsRes.data as PathCard[]) || []).slice(0, 6));
        if (recsRes.success) setRecs(recsRes.data as Recommendations);
      })
      .finally(() => setLoading(false));
  }, []);

  const hasInterests = (recs?.profile_context?.interests?.length || 0) > 0;
  // Kelas dan bonus dipisah — tidak dicampur dalam satu grid
  const recCourses: ContentItem[] = recs
    ? [...(recs.recommended_course ? [recs.recommended_course] : []), ...(recs.supporting_courses || [])].slice(0, 3)
    : [];
  const recBonuses: ContentItem[] = recs ? (recs.recommended_bonuses || []).slice(0, 3) : [];
  const hasRecommendations = recCourses.length > 0 || recBonuses.length > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Jelajahi"
        description="Temukan kelas, rekaman, template, dan tools berdasarkan skill yang ingin kamu kuasai."
      />

      <GlobalSearchTrigger />

      {/* Skill grid */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
          <Compass className="h-5 w-5 text-[#8B1414] dark:text-[#C0392B]" />
          Belajar Berdasarkan Skill
        </h2>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <StatCardSkeleton key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {skills.map((s, idx) => {
              const Icon = SKILL_ICONS[s.icon || ""] || Sparkles;
              return (
                <Link
                  key={s.slug}
                  href={`/skills/${s.slug}`}
                  style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}
                  className="glass-card glass-card-hover group flex flex-col gap-3 p-4 animate-fade-in-up focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1414] focus-visible:ring-offset-2 dark:focus-visible:ring-[#C0392B]"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8B1414]/10 text-[#8B1414] dark:bg-[#C0392B]/10 dark:text-[#C0392B]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block font-bold text-gray-900 transition-colors group-hover:text-[#8B1414] dark:text-white dark:group-hover:text-[#C0392B]">
                      {s.name}
                    </span>
                    <span className="block text-xs text-gray-400">
                      {s.content_count} konten
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Learning paths */}
      {paths.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
              <Route className="h-5 w-5 text-[#8B1414] dark:text-[#C0392B]" />
              Learning Path Pilihan
            </h2>
            <Link href="/paths" className="flex items-center gap-1 text-sm font-medium text-[#8B1414] hover:underline dark:text-[#C0392B]">
              Lihat semua <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {paths.map((p) => (
              <Link key={p.slug} href={`/paths/${p.slug}`} className="glass-card glass-card-hover flex flex-col gap-2 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1414] focus-visible:ring-offset-2 dark:focus-visible:ring-[#C0392B]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B1414] dark:text-[#C0392B]">
                  {p.item_count} langkah{p.level ? ` · ${p.level}` : ""}
                </span>
                <span className="font-bold leading-tight text-gray-900 dark:text-white">{p.title}</span>
                {p.subtitle && (
                  <span className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{p.subtitle}</span>
                )}
                {p.progress && p.progress.percent > 0 && (
                  <span className="mt-2 block">
                    <span className="mb-1 block text-[10px] font-medium text-gray-400">
                      {p.progress.percent}% selesai
                    </span>
                    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
                      <span
                        className="block h-full rounded-full bg-[#8B1414] dark:bg-[#C0392B]"
                        style={{ width: `${p.progress.percent}%` }}
                      />
                    </span>
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recommendations */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
          <Sparkles className="h-5 w-5 text-[#8B1414] dark:text-[#C0392B]" />
          Rekomendasi Untukmu
        </h2>
        {!loading && !hasInterests ? (
          <div className="glass-card flex flex-col items-center gap-3 p-8 text-center">
            <p className="font-bold text-gray-900 dark:text-white">Belum ada rekomendasi</p>
            <p className="max-w-md text-sm text-gray-500 dark:text-gray-400">
              Mulai belajar dari kelas mana pun — rekomendasi akan muncul di sini seiring aktivitasmu.
            </p>
            <Link
              href="/my-classes"
              className="mt-2 rounded-xl bg-[#8B1414] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#6E0F0F]"
            >
              Lihat Kelas Saya
            </Link>
          </div>
        ) : hasRecommendations ? (
          <div className="space-y-6">
            {recCourses.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-400">Kelas untukmu</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {recCourses.map((item) => (
                    <ContentCard key={`${item.type || item.content_type}:${item.id || item.ref_id}`} item={item} />
                  ))}
                </div>
              </div>
            )}
            {recBonuses.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-400">Bonus & Template untukmu</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {recBonuses.map((item) => (
                    <ContentCard key={`${item.type || item.content_type}:${item.id || item.ref_id}`} item={item} />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((i) => <StatCardSkeleton key={i} />)}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Belum ada rekomendasi. Jelajahi skill di atas dulu, ya.</p>
        )}
      </section>
    </div>
  );
}
