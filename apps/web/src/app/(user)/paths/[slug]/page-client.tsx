"use client";

import { useEffect, useState, Fragment } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Circle, PlayCircle, ArrowRight } from "lucide-react";
import { pathsApi } from "@/lib/api-client";
import { StatCardSkeleton } from "@/components/ui/Skeleton";
import { contentHref, contentIcon, type ContentItem } from "@/components/content/ContentCard";

interface PathItem extends ContentItem {
  id: string;
  content_id: string;
  section_label: string | null;
  note: string | null;
  user_state: "completed" | "enrolled" | "none" | string;
}

interface PathDetail {
  path: {
    slug: string;
    title: string;
    subtitle: string | null;
    description: string | null;
    level: string | null;
    skills: { slug: string; name: string }[];
  };
  items: PathItem[];
  progress_percent: number;
  next_item_id: string | null;
}

const FORMAT_LABEL: Record<string, string> = {
  kelas: "Kelas",
  rekaman: "Rekaman",
  ai_tool: "AI Tool",
  ebook: "Ebook",
  template: "Template",
  prompt_pack: "Prompt Pack",
  workflow: "Workflow",
};

export default function PathDetailClient() {
  const params = useParams();
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [data, setData] = useState<PathDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Static export menyajikan placeholder /paths/_/ — slug asli dibaca dari URL browser
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
    pathsApi.detail(slug).then((res: { success: boolean; data?: PathDetail }) => {
      if (res.success && res.data) setData(res.data);
    }).finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="glass-card flex flex-col items-center gap-3 p-10 text-center">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Learning path tidak ditemukan</h2>
        <Link href="/paths" className="text-sm font-medium text-[#8B1414] hover:underline dark:text-[#C0392B]">
          Lihat semua learning path
        </Link>
      </div>
    );
  }

  const { path, items, progress_percent, next_item_id } = data;
  const nextItem = items.find((it) => it.id === next_item_id) || null;

  const stepHref = (item: PathItem, index: number) =>
    `${contentHref(item)}${contentHref(item).includes("?") ? "&" : "?"}path=${path.slug}&step=${index + 1}`;

  return (
    <div className="space-y-6 pb-6">
      <Link
        href="/paths"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-[#8B1414] dark:text-gray-400 dark:hover:text-[#C0392B]"
      >
        <ArrowLeft className="h-4 w-4" /> Learning Path
      </Link>

      {/* Hero */}
      <div className="glass-card p-6">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#8B1414] dark:text-[#C0392B]">
          <span>{items.length} langkah</span>
          {path.skills.map((s) => (
            <Link key={s.slug} href={`/skills/${s.slug}`} className="rounded-full bg-gray-100 px-2 py-0.5 normal-case text-gray-500 hover:text-[#8B1414] dark:bg-slate-800 dark:text-gray-400">
              {s.name}
            </Link>
          ))}
        </div>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{path.title}</h1>
        {path.subtitle && <p className="mt-1 text-gray-500 dark:text-gray-400">{path.subtitle}</p>}
        {path.description && (
          <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{path.description}</p>
        )}

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs font-medium text-gray-400">
            <span>Progress</span>
            <span>{progress_percent}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-[#8B1414] transition-all dark:bg-[#C0392B]"
              style={{ width: `${progress_percent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Timeline */}
      <ol className="space-y-3">
        {items.map((item, index) => {
          const Icon = contentIcon(item.content_type || "course");
          const isCompleted = item.user_state === "completed";
          const isNext = item.id === next_item_id;
          const showSection = item.section_label && (index === 0 || items[index - 1].section_label !== item.section_label);

          return (
            <Fragment key={item.id}>
              {showSection && (
                <li className="pt-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                  {item.section_label}
                </li>
              )}
              <li>
                <Link
                  href={stepHref(item, index)}
                  className={`glass-card glass-card-hover flex items-center gap-4 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1414] focus-visible:ring-offset-2 dark:focus-visible:ring-[#C0392B] ${
                    isNext ? "ring-2 ring-[#8B1414]/40 dark:ring-[#C0392B]/40" : ""
                  }`}
                >
                  <span className="shrink-0">
                    {isCompleted ? (
                      <CheckCircle2 className="h-6 w-6 text-[#8B1414] dark:text-[#C0392B]" />
                    ) : isNext ? (
                      <PlayCircle className="h-6 w-6 text-[#8B1414] dark:text-[#C0392B]" />
                    ) : (
                      <Circle className="h-6 w-6 text-gray-300 dark:text-slate-700" />
                    )}
                  </span>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#8B1414]/10 text-[#8B1414] dark:bg-[#C0392B]/10 dark:text-[#C0392B]">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                        Langkah {index + 1} · {FORMAT_LABEL[item.format || ""] || item.format}
                      </span>
                    </span>
                    <span className={`block truncate font-semibold ${isCompleted ? "text-gray-400 line-through" : "text-gray-900 dark:text-white"}`}>
                      {item.title}
                    </span>
                    {item.note && (
                      <span className="mt-0.5 block truncate text-xs text-gray-400">💡 {item.note}</span>
                    )}
                  </span>
                  {isNext && (
                    <span className="hidden shrink-0 items-center gap-1 text-xs font-semibold text-[#8B1414] dark:text-[#C0392B] md:flex">
                      Lanjutkan <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  )}
                </Link>
              </li>
            </Fragment>
          );
        })}
      </ol>

      {/* Sticky CTA — sticky di dalam alur konten, tidak hardcode lebar sidebar */}
      {nextItem && (
        <div className="sticky bottom-4 z-40 animate-fade-in-up">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Langkah berikutnya</p>
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{nextItem.title}</p>
            </div>
            <button
              onClick={() => router.push(stepHref(nextItem, items.indexOf(nextItem)))}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-[#8B1414] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0c5a46] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1414] focus-visible:ring-offset-2"
            >
              Lanjutkan <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
