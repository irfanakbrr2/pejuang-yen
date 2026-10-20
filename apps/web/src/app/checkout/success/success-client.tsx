"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { checkoutApi, funnelsApi } from "@/lib/api-client";
import { formatRupiah } from "@/lib/utils";
import { UpsellOffer, type ActiveOffer } from "@/components/funnels/UpsellOffer";

interface SuccessData {
  order_id: string;
  order_number: string;
  order_type: string;
  product_name: string;
  amount: number;
  payment_status: string;
  paid_at: string | null;
}

const CTA_BY_TYPE: Record<string, { href: string; label: string }> = {
  course: { href: "/my-classes", label: "Buka Kelas Saya →" },
  membership: { href: "/dashboard", label: "Buka Dashboard →" },
  webinar_registration: { href: "/dashboard", label: "Buka Dashboard →" },
  tool_credits: { href: "/tools/credits", label: "Lihat Kredit Tools →" },
  digital_product: { href: "/products", label: "Buka Produk Saya →" },
  creator_product: { href: "/pembelian", label: "Buka Pembelian →" },
};

export default function CheckoutSuccessClient() {
  const router = useRouter();
  const [orderId, setOrderId] = useState("");
  const [data, setData] = useState<SuccessData | null>(null);
  const [loading, setLoading] = useState(true);

  // Funnel offer (upsell/downsell pasca-bayar)
  const [offer, setOffer] = useState<ActiveOffer | null>(null);
  const [exitUrl, setExitUrl] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("order_id") || "";
    setOrderId(id);
    if (!id) {
      setLoading(false);
      return;
    }
    checkoutApi.get(id).then(async (res) => {
      if (res.success && res.data) {
        const d = res.data as SuccessData;
        setData(d);
        // Cek penawaran funnel hanya untuk order yang sudah lunas
        if (d.payment_status === "paid") {
          const offerRes = await funnelsApi.getOffer(id).catch(() => ({ success: false, data: null }));
          const offerData = (offerRes as { success: boolean; data?: { step?: string | null; exit_url?: string | null } }).data;
          if (offerData?.exit_url) setExitUrl(offerData.exit_url);
          if (offerRes.success && offerData?.step) setOffer(offerData as unknown as ActiveOffer);
        }
      }
      setLoading(false);
    });
  }, []);

  const finishOffer = useCallback((finalExitUrl?: string | null) => {
    setOffer(null);
    const dest = finalExitUrl || exitUrl;
    if (dest) router.replace(dest);
  }, [exitUrl, router]);

  const handleAccept = async () => {
    if (!offer) return;
    setAccepting(true);
    const res = await funnelsApi.accept(orderId, offer.step);
    const newOrderId = (res.data as { order_id?: string } | undefined)?.order_id;
    if (res.success && newOrderId) {
      router.push(`/checkout/${newOrderId}`);
      return;
    }
    setAccepting(false);
    // Penawaran tidak bisa diproses → lanjutkan ke success biasa
    finishOffer();
  };

  const handleDecline = async () => {
    if (!offer) return;
    const currentStep = offer.step;
    setOffer(null);
    const res = await funnelsApi.decline(orderId, currentStep).catch(() => ({ success: false, data: null }));
    const next = (res as { success: boolean; data?: { step?: string | null; exit_url?: string | null } }).data;
    if (res.success && next?.step) {
      // Downsell ditawarkan sekali
      setOffer(next as unknown as ActiveOffer);
      if (next.exit_url) setExitUrl(next.exit_url);
      return;
    }
    finishOffer(next?.exit_url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-warm-cream flex items-center justify-center">
        <div className="text-sm text-[rgba(12,12,10,0.45)]">Memuat...</div>
      </div>
    );
  }

  // Order belum lunas (halaman dibuka manual) → arahkan balik ke checkout
  if (data && data.payment_status !== "paid") {
    return (
      <div className="min-h-screen bg-warm-cream flex items-center justify-center p-4">
        <div className="text-center">
          <p className="font-semibold text-warm-black mb-2">Pembayaran belum selesai</p>
          <Link href={`/checkout/${orderId}`} className="text-sm text-primary">
            Lanjutkan pembayaran →
          </Link>
        </div>
      </div>
    );
  }

  const defaultCta = (data && CTA_BY_TYPE[data.order_type]) || { href: "/dashboard", label: "Buka Dashboard →" };
  const cta = exitUrl ? { href: exitUrl, label: "Lanjutkan →" } : defaultCta;

  return (
    <div
      className="min-h-screen bg-warm-cream flex items-center justify-center p-4"
      style={{
        backgroundImage: `linear-gradient(to right, rgba(12,12,10,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(12,12,10,0.04) 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
      }}
    >
      <div className="w-full max-w-md space-y-3 py-6">
        {offer ? (
          <>
            <div className="flex items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <p className="text-xs font-semibold text-green-700">Pembayaran berhasil — satu langkah lagi sebelum lanjut</p>
            </div>
            <UpsellOffer offer={offer} accepting={accepting} onAccept={handleAccept} onDecline={handleDecline} />
          </>
        ) : (
          <div className="bg-white rounded-2xl border border-[rgba(12,12,10,0.08)] shadow-sm overflow-hidden">
            <div className="h-1 bg-primary w-full" />

            <div className="flex justify-center px-6 pt-6 pb-2">
              <Image src="/logo.png" alt="PejuangYen" width={128} height={32} priority className="h-8 w-auto" />
            </div>

            <div className="px-6 py-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 border border-green-200">
                <CheckCircle2 className="h-9 w-9 text-green-600" />
              </div>
              <h1 className="text-xl font-bold text-warm-black mb-1">Pembayaran Berhasil!</h1>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(12,12,10,0.55)" }}>
                Terima kasih! Pembayaran kamu sudah kami terima dan akses sedang diproses ke akun kamu.
              </p>

              {data && (
                <div className="mt-5 rounded-xl bg-warm-cream border border-[rgba(12,12,10,0.08)] px-4 py-3 text-left space-y-1.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <span style={{ color: "rgba(12,12,10,0.5)" }}>Produk</span>
                    <span className="font-semibold text-warm-black text-right">{data.product_name}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span style={{ color: "rgba(12,12,10,0.5)" }}>No. Order</span>
                    <span className="font-mono text-xs text-warm-black self-center">{data.order_number}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span style={{ color: "rgba(12,12,10,0.5)" }}>Total</span>
                    <span className="font-bold text-primary">{formatRupiah(data.amount)}</span>
                  </div>
                </div>
              )}

              <Link
                href={cta.href}
                className="mt-6 block w-full py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-hover transition-colors"
              >
                {cta.label}
              </Link>
              <p className="text-xs mt-3" style={{ color: "rgba(12,12,10,0.45)" }}>
                Detail pembelian juga dikirim ke email kamu.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
