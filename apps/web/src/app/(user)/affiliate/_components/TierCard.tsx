"use client";

import { TrendingUp } from "lucide-react";
import TierBadge, { type Tier } from "@/components/ui/TierBadge";

export interface TierState {
  tier: Tier;
  name: string;
  max_rate: number;
  paid_total: number;
  next_tier: Tier | null;
  next_name: string | null;
  next_at: number | null;
  to_next: number;
  progress_pct: number;
}

function rupiah(n: number) {
  return "Rp " + (n || 0).toLocaleString("id-ID");
}

/** Kartu tier affiliate: tier sekarang, batas rate komisi, dan progress ke tier berikutnya. */
export function TierCard({ tier }: { tier: TierState }) {
  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#F7E8E8] dark:bg-[#C0392B]/10 flex items-center justify-center">
            <TrendingUp size={18} className="text-[#8B1414] dark:text-[#34D399]" />
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Tier Affiliate</p>
            <div className="mt-0.5">
              <TierBadge tier={tier.tier} size="md" />
            </div>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-black tabular-nums text-[#8B1414] dark:text-[#34D399]">{tier.max_rate}%</p>
          <p className="text-[10px] text-gray-400">batas komisi non-membership</p>
        </div>
      </div>

      {tier.next_tier ? (
        <>
          <div className="flex items-center justify-between text-[12px] mb-1.5">
            <span className="font-medium text-gray-500 tabular-nums">
              {rupiah(tier.paid_total)} komisi dibayar
            </span>
            <span className="font-semibold text-[#8B1414] dark:text-[#34D399]">
              {tier.progress_pct}% ke {tier.next_name}
            </span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 dark:bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#8B1414] to-[#C0392B] transition-[width] duration-500"
              style={{ width: `${tier.progress_pct}%` }}
            />
          </div>
          <p className="mt-2 text-[11px] text-gray-400">
            {rupiah(tier.to_next)} komisi lagi untuk naik ke tier {tier.next_name}.
          </p>
        </>
      ) : (
        <p className="text-[12px] font-medium text-[#8B1414] dark:text-[#34D399]">
          🏆 Kamu sudah di tier tertinggi! Nikmati batas komisi maksimal.
        </p>
      )}
    </div>
  );
}
