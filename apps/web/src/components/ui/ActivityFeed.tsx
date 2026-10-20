"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle,
  Award,
  DollarSign,
  CreditCard,
} from "lucide-react";

export type ActivityType =
  | "enrollment"
  | "completion"
  | "certificate"
  | "commission"
  | "payment";

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  timestamp: Date | string;
  href?: string;
}

interface ActivityFeedProps {
  activities: Activity[];
  className?: string;
}

const TYPE_CONFIG: Record<
  ActivityType,
  { icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>; dot: string; iconClass: string; bg: string }
> = {
  enrollment:  { icon: BookOpen,     dot: "bg-[#8B1414]",  iconClass: "text-[#8B1414] dark:text-[#C0392B]",  bg: "bg-[#F7E8E8] dark:bg-[#8B1414]/20" },
  completion:  { icon: CheckCircle,  dot: "bg-[#22C55E]",  iconClass: "text-[#22C55E] dark:text-[#34D399]",  bg: "bg-[#F0FDF4] dark:bg-[#C0392B]/20" },
  certificate: { icon: Award,        dot: "bg-[#8B5CF6]",  iconClass: "text-[#8B5CF6] dark:text-[#A78BFA]",  bg: "bg-[#F5F3FF] dark:bg-[#8B5CF6]/20" },
  commission:  { icon: DollarSign,   dot: "bg-[#8B1414]",  iconClass: "text-[#8B1414] dark:text-[#C0392B]",  bg: "bg-[#F7E8E8] dark:bg-[#8B1414]/20" },
  payment:     { icon: CreditCard,   dot: "bg-[#F97316]",  iconClass: "text-[#F97316] dark:text-[#FB923C]",  bg: "bg-[#FFF7ED] dark:bg-[#F97316]/20" },
};

function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} jam lalu`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} hari lalu`;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function ActivityFeed({ activities, className = "" }: ActivityFeedProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const shown = activities.slice(0, 8);

  return (
    <div ref={ref} className={`card-sharp p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[15px] font-semibold text-[#0D0D0D] dark:text-white heading-tight">
          Aktivitas
        </h3>
        {activities.length > 8 && (
          <Link
            href="/transactions"
            className="text-xs font-medium text-[#8B1414] dark:text-[#C0392B] hover:text-[#6E0F0F] dark:hover:text-[#34D399] transition-colors duration-150"
          >
            Lihat semua
          </Link>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-[#9CA3AF] dark:text-slate-400 text-center py-6">Belum ada aktivitas.</p>
      ) : (
        <ol className="relative">
          {shown.map((activity, i) => {
            const cfg = TYPE_CONFIG[activity.type];
            const Icon = cfg.icon;
            const iconCls = cfg.iconClass;
            const isLast = i === shown.length - 1;

            return (
              <li
                key={activity.id}
                className={inView ? "animate-fade-in-up" : "opacity-0"}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="relative flex gap-3 pb-4">
                  {/* Timeline connector */}
                  {!isLast && (
                    <div
                      className="absolute left-[15px] top-8 w-px bg-black/[0.06] dark:bg-white/[0.06]"
                      style={{ height: "calc(100% - 8px)" }}
                    />
                  )}

                  {/* Icon dot */}
                  <div
                    className={`w-8 h-8 rounded-full ${cfg.bg} flex items-center justify-center shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_0_0_1px_rgba(0,0,0,0.05)] dark:shadow-none backdrop-blur-md`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${iconCls}`} strokeWidth={2} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    {activity.href ? (
                      <Link
                        href={activity.href}
                        className="text-sm font-medium text-[#0D0D0D] dark:text-white hover:text-[#8B1414] dark:hover:text-[#C0392B] transition-colors duration-150 leading-snug line-clamp-1"
                      >
                        {activity.title}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium text-[#0D0D0D] dark:text-white leading-snug line-clamp-1">
                        {activity.title}
                      </p>
                    )}
                    {activity.description && (
                      <p className="text-xs text-[#9CA3AF] dark:text-slate-400 mt-0.5 line-clamp-1">
                        {activity.description}
                      </p>
                    )}
                    <p className="label-uppercase mt-1 text-[#9CA3AF] dark:text-slate-500" style={{ fontSize: "10px" }}>
                      {relativeTime(activity.timestamp)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
