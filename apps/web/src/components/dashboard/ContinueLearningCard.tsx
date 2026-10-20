"use client";

import Link from "next/link";
import { Play, ArrowRight, Clock } from "lucide-react";

export interface LastWatched {
  lesson_id: string;
  lesson_title: string;
  lesson_slug: string;
  course_id: string;
  course_slug: string;
  course_title: string;
  status: string;
  watch_percent: number;
  last_position_seconds: number;
  updated_at: string;
}

export interface NextLesson {
  id: string;
  title: string;
  slug: string;
}

function formatPosition(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ContinueLearningCard({ lastWatched, nextLesson }: {
  lastWatched: LastWatched | null;
  nextLesson: NextLesson | null;
}) {
  if (!lastWatched) return null;

  const resumeHref = `/learn/${lastWatched.course_slug}/${lastWatched.lesson_slug}`;
  const nextHref = nextLesson ? `/learn/${lastWatched.course_slug}/${nextLesson.slug}` : null;

  return (
    <div className="bg-white dark:bg-white/5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),_0_4px_16px_rgba(0,0,0,0.04)] dark:shadow-none dark:border dark:border-white/[0.05] p-5">
      <p className="text-[10px] font-bold tracking-wider text-[#8B1414] uppercase mb-3">Lanjutkan dari terakhir</p>
      <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-0.5 truncate">{lastWatched.course_title}</p>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">{lastWatched.lesson_title}</h3>

      {lastWatched.watch_percent > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-1.5 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-[#8B1414] rounded-full" style={{ width: `${lastWatched.watch_percent}%` }} />
          </div>
          <span className="text-[11px] text-gray-400 inline-flex items-center gap-1 whitespace-nowrap">
            <Clock size={10} /> {formatPosition(lastWatched.last_position_seconds)}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Link
          href={resumeHref}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#8B1414] text-white text-sm font-semibold px-4 py-2.5 hover:bg-[#0c5a47] transition-colors"
        >
          <Play size={14} /> Lanjutkan Belajar
        </Link>
        {nextHref && nextLesson && nextLesson.id !== lastWatched.lesson_id && (
          <Link
            href={nextHref}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gray-50 dark:bg-white/10 text-gray-700 dark:text-slate-200 text-xs font-medium px-4 py-2 hover:bg-gray-100 transition-colors"
          >
            Lanjut ke: <span className="font-semibold truncate max-w-[180px]">{nextLesson.title}</span>
            <ArrowRight size={12} />
          </Link>
        )}
      </div>
    </div>
  );
}
