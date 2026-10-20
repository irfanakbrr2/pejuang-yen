"use client";

import { ChevronUp, ChevronDown, Minus } from "lucide-react";

/** Indikator pergerakan peringkat sejak snapshot mingguan (positif = naik). */
export default function RankDelta({ delta, className = "" }: { delta?: number | null; className?: string }) {
  if (delta === null || delta === undefined) return null;
  if (delta === 0) {
    return (
      <span className={`inline-flex items-center text-[10px] font-semibold text-slate-400 ${className}`} aria-label="Peringkat tetap">
        <Minus className="h-3 w-3" />
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-bold tabular-nums ${up ? "text-emerald-500" : "text-rose-400"} ${className}`}
      aria-label={up ? `Naik ${delta} peringkat` : `Turun ${Math.abs(delta)} peringkat`}
    >
      {up ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      {Math.abs(delta)}
    </span>
  );
}
