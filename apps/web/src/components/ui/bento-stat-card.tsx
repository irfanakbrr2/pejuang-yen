"use client";

import * as React from "react";
import Link from "next/link";
import { type LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

type AccentColor = "blue" | "green" | "purple" | "orange" | "rose" | "teal" | "gold" | "amber";

const accentMap: Record<AccentColor, { border: string; iconColor: string; trendBg?: string }> = {
  teal:   { border: "border-l-[#8B1414]",   iconColor: "text-[#8B1414]" },
  blue:   { border: "border-l-blue-500",    iconColor: "text-blue-500" },
  amber:  { border: "border-l-amber-500",   iconColor: "text-amber-500" },
  rose:   { border: "border-l-rose-500",    iconColor: "text-rose-500" },
  purple: { border: "border-l-purple-500",  iconColor: "text-purple-500" },
  // backward compat aliases
  green:  { border: "border-l-[#8B1414]",   iconColor: "text-[#8B1414]" },
  orange: { border: "border-l-amber-500",   iconColor: "text-amber-500" },
  gold:   { border: "border-l-amber-400",   iconColor: "text-amber-500" },
};

export interface BentoStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  accentColor?: AccentColor;
  size?: "normal" | "wide";
  href?: string;
  trend?: { value: number; label: string };
  className?: string;
  children?: React.ReactNode;
}

export function BentoStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accentColor = "teal",
  size = "normal",
  href,
  trend,
  className,
  children,
}: BentoStatCardProps) {
  const { border, iconColor } = accentMap[accentColor] ?? accentMap.teal;

  const isNumeric = typeof value === "number" || /^[\d,.\s]+$/.test(String(value));

  const inner = (
    <div
      className={cn(
        "relative flex flex-col justify-between h-full min-h-[120px] p-5",
        "bg-white rounded-[var(--radius-lg,12px)]",
        "border border-[rgba(0,0,0,0.06)] border-l-[3px]",
        border,
        "shadow-[var(--shadow-card)]",
        href && [
          "cursor-pointer",
          "transition-all duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "hover:-translate-y-[2px] hover:shadow-[var(--shadow-card-hover)]",
        ],
        size === "wide" && "lg:col-span-2",
        className
      )}
    >
      {/* Top: icon + title label */}
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", iconColor)} strokeWidth={2.5} />
        <span className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[#A1A1AA]">
          {title}
        </span>
      </div>

      {/* Bottom: value + trend */}
      {children ? (
        <div className="mt-3">{children}</div>
      ) : (
        <div className="mt-3">
          <div className="flex items-end justify-between gap-2">
            <span
              className={cn(
                "font-black leading-none tracking-[-0.04em] text-[#09090B]",
                isNumeric ? "text-[2.25rem]" : "text-[1.75rem]"
              )}
            >
              {value}
            </span>
            {trend && (
              <span
                className={cn(
                  "mb-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full",
                  "text-[11px] font-semibold",
                  trend.value >= 0
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-600"
                )}
              >
                {trend.value >= 0
                  ? <TrendingUp className="h-3 w-3" />
                  : <TrendingDown className="h-3 w-3" />
                }
                {Math.abs(trend.value)}%
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-1.5 text-[12px] text-[#71717A]">{subtitle}</p>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className={size === "wide" ? "lg:col-span-2" : ""}>
        {inner}
      </Link>
    );
  }

  return size === "wide" ? (
    <div className="lg:col-span-2">{inner}</div>
  ) : (
    inner
  );
}
