"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { Clock, Rocket } from "lucide-react";
import { formatRupiah } from "@/lib/utils";

export interface OfferContent {
  step_id: string;
  step_type: "upsell" | "downsell";
  headline: string | null;
  description: string | null;
  badge_text: string | null;
  image_url: string | null;
  product_name: string;
  product_type: string;
  amount: number;
  compare_at_price: number | null;
  countdown_seconds: number | null;
}

export interface ActiveOffer {
  step: "upsell" | "downsell";
  offer_id: string;
  expires_at: string;
  exit_url: string | null;
  content: OfferContent;
}

interface UpsellOfferProps {
  offer: ActiveOffer;
  accepting: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

function formatMmSs(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Penawaran upsell/downsell setelah pembayaran sukses — accept langsung lanjut bayar. */
export function UpsellOffer({ offer, accepting, onAccept, onDecline }: UpsellOfferProps) {
  const { content } = offer;
  const [remaining, setRemaining] = useState<number | null>(null);

  // Countdown: pakai countdown_seconds bila diset, dibatasi expires_at offer
  useEffect(() => {
    const expiresMs = new Date(offer.expires_at).getTime();
    const displayEndMs = content.countdown_seconds
      ? Math.min(Date.now() + content.countdown_seconds * 1000, expiresMs)
      : expiresMs;

    const tick = () => {
      const left = (displayEndMs - Date.now()) / 1000;
      setRemaining(left);
      if (left <= 0) onDecline();
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer.offer_id, content.step_id]);

  const hasDiscount = content.compare_at_price && content.compare_at_price > content.amount;

  return (
    <div className="bg-white rounded-2xl border-2 border-primary shadow-md overflow-hidden">
      <div className="bg-primary px-5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-white" />
          <p className="text-[11px] font-bold uppercase tracking-widest text-white">
            {content.step_type === "downsell" ? "Penawaran Terakhir" : "Penawaran Sekali Lewat"}
          </p>
        </div>
        {remaining !== null && remaining > 0 && (
          <span className="flex items-center gap-1.5 rounded-md bg-white/15 px-2 py-1 text-xs font-bold text-white">
            <Clock className="h-3.5 w-3.5" />
            {formatMmSs(remaining)}
          </span>
        )}
      </div>

      <div className="p-6">
        {content.badge_text && (
          <span className="inline-block rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
            {content.badge_text}
          </span>
        )}
        <h2 className="mt-2 text-lg font-bold leading-snug text-warm-black">
          {content.headline || `Tambahkan ${content.product_name} ke pesanan kamu`}
        </h2>

        {content.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={content.image_url} alt={content.product_name} className="mt-3 h-40 w-full rounded-xl object-cover" />
        )}

        <div className="mt-3">
          {hasDiscount && (
            <p className="text-sm line-through" style={{ color: "rgba(12,12,10,0.35)" }}>
              {formatRupiah(content.compare_at_price!)}
            </p>
          )}
          <p className="text-2xl font-bold text-primary">{formatRupiah(content.amount)}</p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(12,12,10,0.5)" }}>{content.product_name}</p>
        </div>

        {content.description && (
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "rgba(12,12,10,0.62)" }}>
            {content.description}
          </p>
        )}

        <button
          onClick={onAccept}
          disabled={accepting}
          className="mt-5 w-full rounded-xl bg-primary py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {accepting ? "Menyiapkan pembayaran..." : "Ya, tambahkan sekarang →"}
        </button>
        <button
          onClick={onDecline}
          disabled={accepting}
          className="mt-2 w-full py-2 text-xs font-semibold transition-colors hover:text-warm-black"
          style={{ color: "rgba(12,12,10,0.45)" }}
        >
          Tidak, terima kasih — lewati penawaran ini
        </button>
      </div>
    </div>
  );
}
