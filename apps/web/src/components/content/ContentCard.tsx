"use client";

import Link from "next/link";
import NextImage from "next/image";
import { BookOpen, Gift, PlayCircle, Wand2, FileText, Star } from "lucide-react";

export interface ContentItem {
  content_type?: string;
  type?: string;
  ref_id?: string;
  id?: string;
  slug: string;
  title: string;
  description?: string | null;
  thumbnail_url?: string | null;
  format?: string;
  level?: string | null;
  access_type?: string | null;
  is_featured?: number;
  skills?: { slug: string; name: string }[];
}

const FORMAT_LABEL: Record<string, string> = {
  kelas: "Kelas",
  rekaman: "Rekaman",
  ai_tool: "AI Tool",
  ebook: "Ebook",
  template: "Template",
  prompt_pack: "Prompt Pack",
  workflow: "Workflow",
  tool: "Tool",
  file: "File",
  link: "Link",
  content: "Bonus",
};

export function contentHref(item: ContentItem): string {
  const type = item.content_type || item.type || "course";
  switch (type) {
    case "course":
      return `/learn/${item.slug}/start`;
    case "recording":
      return `/rekaman-zoom/${item.slug}`;
    case "tool":
      return `/tools/${item.slug}`;
    default:
      // bonus punya halaman detail sendiri di /bonuses/[slug]
      return item.slug ? `/bonuses/${item.slug}` : "/bonuses";
  }
}

export function contentIcon(type: string) {
  switch (type) {
    case "course":
      return BookOpen;
    case "recording":
      return PlayCircle;
    case "tool":
      return Wand2;
    case "bonus":
      return Gift;
    default:
      return FileText;
  }
}

export function ContentCard({ item, hrefSuffix = "" }: { item: ContentItem; hrefSuffix?: string }) {
  const type = item.content_type || item.type || "course";
  const Icon = contentIcon(type);
  const formatLabel = FORMAT_LABEL[item.format || ""] || FORMAT_LABEL[type] || type;

  return (
    <Link
      href={`${contentHref(item)}${hrefSuffix}`}
      className="glass-card glass-card-hover group flex flex-col overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1414] focus-visible:ring-offset-2 dark:focus-visible:ring-[#C0392B]"
    >
      <div className="relative h-40 w-full bg-gray-100 dark:bg-slate-800">
        {item.thumbnail_url ? (
          <NextImage src={item.thumbnail_url} alt={item.title} fill className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">
            <Icon className="h-8 w-8" />
          </div>
        )}
        {item.is_featured === 1 && (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-amber-400 px-2 py-1 text-[10px] font-bold text-amber-900">
            <Star className="h-3 w-3 fill-amber-900" /> Featured
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#8B1414] dark:text-[#C0392B]">
            {formatLabel}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              item.access_type === "free"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            }`}
          >
            {item.access_type === "free" ? "Gratis" : "Premium"}
          </span>
        </div>
        <h3 className="mb-2 line-clamp-2 font-bold leading-tight text-gray-900 transition-colors group-hover:text-[#8B1414] dark:text-white dark:group-hover:text-[#C0392B]">
          {item.title}
        </h3>
        <p className="mt-auto line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
          {item.description || "Tidak ada deskripsi."}
        </p>
        {item.skills && item.skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {item.skills.slice(0, 3).map((s) => (
              <span
                key={s.slug}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-slate-800 dark:text-gray-400"
              >
                {s.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
