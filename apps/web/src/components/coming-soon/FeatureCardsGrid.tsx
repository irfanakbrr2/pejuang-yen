"use client";

import { BlurFade } from "@/components/ui/blur-fade";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface FeatureCardItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function FeatureCardsGrid({ items, className }: { items: FeatureCardItem[]; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <BlurFade key={item.title} delay={0.1 + i * 0.05} inView>
            <div className="h-full bg-white dark:bg-white/5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),_0_4px_16px_rgba(0,0,0,0.04)] dark:shadow-none dark:border dark:border-white/[0.05] p-5">
              <div className="rounded-xl bg-[#8B1414]/10 text-[#8B1414] p-2.5 w-fit mb-3">
                <Icon size={18} />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{item.title}</h3>
              <p className="text-[13px] leading-relaxed text-[#71717A] dark:text-slate-400">{item.description}</p>
            </div>
          </BlurFade>
        );
      })}
    </div>
  );
}

export default FeatureCardsGrid;
