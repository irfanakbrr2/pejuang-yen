"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Route, BookOpen, PlayCircle, Gift, Wand2 } from "lucide-react";
import { skillsApi } from "@/lib/api-client";
import { StatCardSkeleton } from "@/components/ui/Skeleton";
import { ContentCard, type ContentItem } from "@/components/content/ContentCard";

interface SkillDetail {
  skill: { slug: string; name: string; description: string | null; icon: string | null };
  items: ContentItem[];
  featured_paths: {
    slug: string;
    title: string;
    subtitle: string | null;
    level: string | null;
    item_count: number;
  }[];
}

// Konten dikelompokkan per tipe — kelas, rekaman, bonus, dan tools tidak dicampur
const CONTENT_GROUPS: {
  key: string;
  label: string;
  icon: typeof BookOpen;
  match: (item: ContentItem) => boolean;
}[] = [
  { key: "kelas", label: "Kelas", icon: BookOpen, match: (i) => i.content_type === "course" },
  { key: "rekaman", label: "Rekaman Webinar", icon: PlayCircle, match: (i) => i.content_type === "recording" },
  { key: "bonus", label: "Bonus & Template", icon: Gift, match: (i) => i.content_type === "bonus" },
  { key: "tools", label: "AI Tools", icon: Wand2, match: (i) => i.content_type === "tool" },
];

export default function SkillDetailClient() {
  const params = useParams();
  const [slug, setSlug] = useState("");
  const [data, setData] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Static export menyajikan placeholder /skills/_/ — slug asli dibaca dari URL browser
  useEffect(() => {
    if (typeof window !== "undefined") {
      const parts = window.location.pathname.split("/").filter(Boolean);
      const pathSlug = parts[parts.length - 1];
      if (pathSlug && pathSlug !== "_") {
        setSlug(pathSlug);
      } else if (params?.slug && params.slug !== "_") {
        setSlug(params.slug as string);
      }
    }
  }, [params?.slug]);

  useEffect(() => {
    if (!slug) return;
    skillsApi.detail(slug).then((res: { success: boolean; data?: SkillDetail }) => {
      if (res.success && res.data) setData(res.data);
      else setNotFound(true);
    }).finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => <StatCardSkeleton key={i} />)}
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="glass-card flex flex-col items-center gap-3 p-10 text-center">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Skill tidak ditemukan</h2>
        <Link href="/explore" className="text-sm font-medium text-[#8B1414] hover:underline dark:text-[#C0392B]">
          Kembali ke Jelajahi
        </Link>
      </div>
    );
  }

  const groups = CONTENT_GROUPS
    .map((g) => ({ ...g, items: data.items.filter(g.match) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/explore"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-[#8B1414] dark:text-gray-400 dark:hover:text-[#C0392B]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Jelajahi
        </Link>

        <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">{data.skill.name}</h1>
        {data.skill.description && (
          <p className="mt-1 text-gray-500 dark:text-gray-400">{data.skill.description}</p>
        )}
        <p className="mt-1 text-sm text-gray-400">{data.items.length} konten tersedia</p>
      </div>

      {data.featured_paths.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
            <Route className="h-4 w-4 text-[#8B1414] dark:text-[#C0392B]" aria-hidden="true" />
            Learning Path untuk skill ini
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.featured_paths.map((p) => (
              <Link key={p.slug} href={`/paths/${p.slug}`} className="glass-card glass-card-hover flex flex-col gap-1.5 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1414] focus-visible:ring-offset-2 dark:focus-visible:ring-[#C0392B]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B1414] dark:text-[#C0392B]">
                  {p.item_count} langkah{p.level ? ` · ${p.level}` : ""}
                </span>
                <span className="font-bold leading-tight text-gray-900 dark:text-white">{p.title}</span>
                {p.subtitle && <span className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{p.subtitle}</span>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {groups.length === 0 ? (
        <div className="glass-card flex flex-col items-center gap-3 p-10 text-center">
          <p className="font-bold text-gray-900 dark:text-white">Belum ada konten untuk skill ini</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Konten baru sedang disiapkan. Cek skill lain dulu, ya.</p>
          <Link href="/explore" className="text-sm font-medium text-[#8B1414] hover:underline dark:text-[#C0392B]">
            Kembali ke Jelajahi
          </Link>
        </div>
      ) : (
        groups.map((group) => {
          const Icon = group.icon;
          return (
            <section key={group.key} aria-label={group.label}>
              <h2 className="mb-3 flex items-center gap-2 border-b border-gray-100 pb-2 text-base font-bold text-gray-900 dark:border-slate-800 dark:text-white">
                <Icon className="h-4 w-4 text-[#8B1414] dark:text-[#C0392B]" aria-hidden="true" />
                {group.label}
                <span className="text-sm font-medium text-gray-400">({group.items.length})</span>
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.items.map((item, idx) => (
                  <div
                    key={`${item.content_type}:${item.ref_id}`}
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}
                  >
                    <ContentCard item={item} />
                  </div>
                ))}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
