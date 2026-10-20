"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface IntegrationItem {
  name: string;
  description: string;
  icon: LucideIcon;
  iconColor?: string;
}

export interface IntegrationShowcaseProps {
  title: string;
  subtitle?: string;
  integrations: IntegrationItem[];
  className?: string;
}

export function IntegrationShowcase({
  title,
  subtitle,
  integrations,
  className,
}: IntegrationShowcaseProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [inView, setInView] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className={cn("w-full", className)}>
      <div className="mb-6">
        <h2 className="text-base font-semibold text-warm-black dark:text-white">{title}</h2>
        {subtitle && (
          <p className="text-sm text-[rgba(12,12,10,0.55)] dark:text-slate-400 mt-0.5">{subtitle}</p>
        )}
      </div>

      <div
        ref={ref}
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
      >
        {integrations.map((item, i) => {
          const Icon = item.icon;
          return (
            <div
              key={item.name}
              className={cn(
                "flex items-start gap-3 bg-white dark:bg-white/5 rounded-xl border border-[rgba(0,0,0,0.08)] dark:border-white/10 p-4 hover:shadow-sm transition-shadow",
                inView ? "animate-fade-in-up" : "opacity-0"
              )}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="p-2 bg-[rgba(0,0,0,0.06)] dark:bg-white/10 rounded-lg flex-shrink-0">
                <Icon
                  size={16}
                  className={cn("text-warm-black dark:text-white", item.iconColor)}
                />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-warm-black dark:text-white leading-snug">{item.name}</h3>
                <p className="text-xs text-[rgba(12,12,10,0.55)] dark:text-slate-400 mt-0.5 leading-relaxed line-clamp-2">
                  {item.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
