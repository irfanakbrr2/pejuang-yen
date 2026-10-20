"use client";
/* eslint-disable @next/next/no-img-element */

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { PlayCircle, BookOpen } from "lucide-react";

export interface ProgressClass {
  id: string;
  title: string;
  thumbnail?: string;
  progress: number;
  completedLessons: number;
  totalLessons: number;
  href?: string;
}

interface ProgressTrackerProps {
  classes: ProgressClass[];
  className?: string;
}

function ProgressBar({ progress, delay }: { progress: number; delay: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setAnimated(true); observer.disconnect(); } },
      { rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="h-1.5 w-full rounded-full bg-white/58 dark:bg-white/[0.05] overflow-hidden shadow-inner">
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#8B1414] to-[#C0392B] dark:from-[#C0392B] dark:to-[#E57373] transition-[width] ease-[cubic-bezier(0.4,0,0.2,1)]"
        style={{
          width: animated ? `${Math.min(progress, 100)}%` : "0%",
          transitionDuration: animated ? "500ms" : "0ms",
          transitionDelay: animated ? `${delay}ms` : "0ms",
        }}
      />
    </div>
  );
}

export function ProgressTracker({ classes, className = "" }: ProgressTrackerProps) {
  if (classes.length === 0) return null;

  return (
    <div className={`card-sharp p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-semibold text-[#0D0D0D] dark:text-white heading-tight">
          Progress Kelas
        </h3>
        <Link
          href="/my-classes"
          className="text-xs font-medium text-[#8B1414] dark:text-[#C0392B] hover:text-[#6E0F0F] dark:hover:text-[#34D399] transition-colors duration-150"
        >
          Lihat semua
        </Link>
      </div>

      <ul className="space-y-4">
        {classes.map((cls, i) => (
          <li
            key={cls.id}
            className="animate-fade-in-up"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <Link
              href={cls.href ?? `/learn/${cls.id}`}
              className="flex items-start gap-3 group"
            >
              {/* Thumbnail */}
              <div className="w-12 h-12 rounded-2xl bg-white/52 dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.05] flex items-center justify-center shrink-0 overflow-hidden transition-all duration-300 group-hover:shadow-[0_8px_22px_rgba(139,20,20,0.12)] dark:group-hover:shadow-[0_8px_22px_rgba(192,57,43,0.12)]">
                {cls.thumbnail ? (
                  <img
                    src={cls.thumbnail}
                    alt={cls.title}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <BookOpen className="w-5 h-5 text-[#8B1414] dark:text-[#C0392B]" strokeWidth={1.5} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-sm font-medium text-[#0D0D0D] dark:text-white leading-snug line-clamp-1 group-hover:text-[#8B1414] dark:group-hover:text-[#C0392B] transition-colors duration-150">
                    {cls.title}
                  </p>
                  <div className="flex items-center gap-1 shrink-0">
                    <PlayCircle className="w-3.5 h-3.5 text-[#9CA3AF] dark:text-slate-500" />
                    <span className="text-xs text-[#9CA3AF] dark:text-slate-400 tabular-nums">
                      {cls.completedLessons}/{cls.totalLessons}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <ProgressBar progress={cls.progress} delay={i * 80 + 100} />
                  </div>
                  <span
                    className="text-[11px] font-semibold tabular-nums shrink-0 text-[#8B1414] dark:text-[#C0392B]"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    {Math.round(cls.progress)}%
                  </span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
