"use client";

import { Sparkles } from "lucide-react";
import { formatRupiah } from "@/lib/utils";

export interface BumpOffer {
  step_id: string;
  headline: string | null;
  description: string | null;
  badge_text: string | null;
  image_url: string | null;
  label: string;
  amount: number;
  compare_at_price: number | null;
}

interface FunnelBumpCardProps {
  bump: BumpOffer;
  selected: boolean;
  onChange: (selected: boolean) => void;
}

/** Kartu order bump funnel — dipakai halaman order & modal webinar. */
export function FunnelBumpCard({ bump, selected, onChange }: FunnelBumpCardProps) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-4 w-4 shrink-0 text-amber-700" aria-hidden />
          <p className="text-[10px] font-semibold tracking-widest uppercase text-amber-800">
            Penawaran Spesial
          </p>
        </div>
        {bump.badge_text && (
          <span className="shrink-0 rounded-md bg-white px-2 py-1 text-[10px] font-bold text-amber-800 border border-amber-200">
            {bump.badge_text}
          </span>
        )}
      </div>

      {bump.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bump.image_url} alt={bump.label} loading="lazy" className="mb-2 h-28 w-full rounded-lg object-cover" />
      )}

      {/* Headline dari admin = pesan utama (judul); label produk jadi baris pendukung */}
      <p className="text-sm font-bold leading-snug text-warm-black">{bump.headline || bump.label}</p>
      {bump.headline && (
        <p className="mt-0.5 text-xs font-medium" style={{ color: "rgba(12,12,10,0.55)" }}>{bump.label}</p>
      )}
      <p className="mt-1 text-sm font-bold text-primary tabular-nums">
        Tambah {formatRupiah(bump.amount)}
        {bump.compare_at_price && (
          <span className="ml-2 text-xs font-medium line-through" style={{ color: "rgba(12,12,10,0.35)" }}>
            {formatRupiah(bump.compare_at_price)}
          </span>
        )}
      </p>
      {bump.description && (
        <p className="mt-2 text-xs leading-relaxed text-[rgba(12,12,10,0.62)]">{bump.description}</p>
      )}

      <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-amber-200 bg-white p-3 transition-colors hover:border-amber-400">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-amber-300 text-primary focus:ring-primary"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold text-warm-black">
            Ya, tambahkan {bump.label} ke pesanan saya
          </span>
        </span>
        <span className="shrink-0 text-xs font-bold text-primary">+ {formatRupiah(bump.amount)}</span>
      </label>
    </div>
  );
}
