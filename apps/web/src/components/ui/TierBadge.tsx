"use client";

import { Award } from "lucide-react";

export type Tier = "bronze" | "silver" | "gold" | "platinum";

const TIER_STYLE: Record<Tier, { label: string; text: string; bg: string; ring: string }> = {
  bronze: { label: "Bronze", text: "text-[#B45309]", bg: "bg-[#FEF3E2]", ring: "ring-[#F5D9B0]" },
  silver: { label: "Silver", text: "text-slate-600", bg: "bg-slate-100", ring: "ring-slate-300" },
  gold: { label: "Gold", text: "text-[#B7791F]", bg: "bg-[#FEF9C3]", ring: "ring-[#F2D680]" },
  platinum: { label: "Platinum", text: "text-[#8B1414]", bg: "bg-[#F7E8E8]", ring: "ring-[#9FD8C6]" },
};

interface TierBadgeProps {
  tier: Tier | string;
  size?: "sm" | "md";
  className?: string;
}

/** Lencana tier affiliate (Bronze/Silver/Gold/Platinum). */
export default function TierBadge({ tier, size = "sm", className = "" }: TierBadgeProps) {
  const t = (["bronze", "silver", "gold", "platinum"].includes(tier as string) ? tier : "bronze") as Tier;
  const s = TIER_STYLE[t];
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  const icon = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ring-1 ${s.bg} ${s.text} ${s.ring} ${pad} ${className}`}
    >
      <Award className={icon} aria-hidden />
      {s.label}
    </span>
  );
}
