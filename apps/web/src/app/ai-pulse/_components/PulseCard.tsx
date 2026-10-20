"use client";

import Link from "next/link";
import NextImage from "next/image";
import { motion } from "framer-motion";
import { Eye, Sparkles, Star } from "lucide-react";
import { CATEGORY_LABELS, IMPACT_CONFIG, categoryGradient, relativeTime, type PulseListItem } from "../_lib/pulse";

export function PulseCard({ item, index = 0 }: { item: PulseListItem; index?: number }) {
  const impact = IMPACT_CONFIG[item.impact_level];
  const category = item.primary_category_id ? CATEGORY_LABELS[item.primary_category_id] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.4) }}
    >
      <Link
        href={`/ai-pulse/${item.slug}`}
        className="glass-card glass-card-hover group flex h-full flex-col overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1414] focus-visible:ring-offset-2"
      >
        {/* Thumbnail: gambar asli atau placeholder gradient kategori */}
        <div className="relative h-40 w-full overflow-hidden">
          {item.thumbnail_url ? (
            <NextImage src={item.thumbnail_url} alt={item.title} fill className="object-cover" sizes="(max-width:768px) 100vw, 33vw" />
          ) : (
            <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${categoryGradient(item.primary_category_id)}`}>
              <Sparkles className="h-7 w-7 text-[#8B1414]/40" />
            </div>
          )}
          {item.featured ? (
            <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-amber-400 px-2 py-1 text-[10px] font-bold text-amber-900">
              <Star className="h-3 w-3 fill-amber-900" /> Featured
            </div>
          ) : null}
        </div>

        <div className="flex flex-1 flex-col p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${impact.chip}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${impact.dot}`} aria-hidden />
              {impact.label}
            </span>
            <span className="ml-auto text-[11px] tabular-nums text-[#A1A1AA]">{relativeTime(item.published_at)}</span>
          </div>

          <h3 className="line-clamp-2 font-bold leading-snug text-[#09090B] transition-colors group-hover:text-[#8B1414]">
            {item.title}
          </h3>
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#71717A]">
            {item.summary || "Tidak ada ringkasan."}
          </p>

          <div className="mt-auto flex items-center gap-2 pt-3">
            {category ? (
              <span className="truncate rounded-full bg-[#F7E8E8] px-2 py-0.5 text-[10px] font-medium text-[#8B1414]">
                {category}
              </span>
            ) : null}
            <span className="ml-auto flex shrink-0 items-center gap-1 text-[11px] tabular-nums text-[#A1A1AA]">
              <Eye className="h-3 w-3" /> {item.view_count}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export function PulseCardSkeleton() {
  return (
    <div className="glass-card flex h-full flex-col overflow-hidden">
      <div className="h-40 w-full animate-pulse bg-gray-100" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="h-3 w-20 animate-pulse rounded bg-gray-100" />
        <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100" />
      </div>
    </div>
  );
}
