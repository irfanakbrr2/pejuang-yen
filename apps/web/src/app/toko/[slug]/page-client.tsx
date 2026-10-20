"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Store, Package, ShieldCheck, Share2, CheckCircle2, Flame } from "lucide-react";
import { tokoPublicApi } from "@/lib/api-client";
import { formatRupiah } from "@/lib/utils";
import { SandboxedHtml } from "@/components/toko/SandboxedHtml";

interface StoreProduct {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  thumbnail_url?: string | null;
  price: number;
  compare_at_price?: number | null;
  sales_count: number;
}

interface StorefrontData {
  slug: string;
  name: string;
  description?: string | null;
  logo_url?: string | null;
  accent_color?: string | null;
  custom_html?: string | null;
  products: StoreProduct[];
}

function StorefrontSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-16">
      <div className="h-36 rounded-b-3xl bg-gray-200 animate-pulse" />
      <div className="relative -mt-10 mx-auto max-w-3xl rounded-2xl border border-[rgba(12,12,10,0.08)] bg-white p-6">
        <div className="h-20 w-20 rounded-2xl bg-gray-100 animate-pulse" />
        <div className="mt-3 h-5 w-48 rounded bg-gray-100 animate-pulse" />
        <div className="mt-2 h-3 w-72 rounded bg-gray-100 animate-pulse" />
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-[rgba(12,12,10,0.08)] bg-white overflow-hidden">
            <div className="aspect-[4/3] bg-gray-100 animate-pulse" />
            <div className="p-4 space-y-2">
              <div className="h-3.5 w-3/4 rounded bg-gray-100 animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-gray-100 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StorefrontClient() {
  const pathname = usePathname();
  const slug = pathname.split("/").filter(Boolean)[1] ?? "_";

  const [store, setStore] = useState<StorefrontData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug || slug === "_") return;
    tokoPublicApi.store(slug).then((res) => {
      if (res.success && res.data) {
        const data = res.data as StorefrontData;
        setStore(data);
        document.title = `${data.name} — Toko di PejuangYen`;
      }
      setLoading(false);
    });
  }, [slug]);

  const shareStore = async () => {
    const url = `https://app.pejuangyen.com/toko/${slug}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: store?.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* user batal share */ }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-warm-cream">
        <StorefrontSkeleton />
      </div>
    );
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-warm-cream flex items-center justify-center p-4">
        <div className="text-center">
          <Store className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="font-semibold text-warm-black">Toko tidak ditemukan</p>
          <Link href="/" className="mt-2 inline-block text-sm text-primary">← Beranda PejuangYen</Link>
        </div>
      </div>
    );
  }

  const accent = store.accent_color || "#8B1414";
  const totalSold = store.products.reduce((s, p) => s + (p.sales_count || 0), 0);
  const bestSellerId = store.products.reduce<StoreProduct | null>(
    (best, p) => (p.sales_count > 0 && p.sales_count > (best?.sales_count || 0) ? p : best),
    null
  )?.id;

  return (
    <div className="min-h-screen bg-warm-cream flex flex-col">
      <div className="mx-auto w-full max-w-4xl px-4 flex-1">
        {/* ── Banner aksen ── */}
        <div
          className="h-36 md:h-44 rounded-b-3xl"
          style={{
            background: `linear-gradient(135deg, ${accent} 0%, color-mix(in srgb, ${accent} 65%, #0c0c0a) 100%)`,
          }}
          aria-hidden
        >
          <div
            className="h-full w-full rounded-b-3xl opacity-20"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)",
              backgroundSize: "22px 22px",
            }}
          />
        </div>

        {/* ── Kartu identitas toko (overlap banner) ── */}
        <div className="relative -mt-12 mx-auto max-w-3xl rounded-2xl border border-[rgba(12,12,10,0.08)] bg-white p-6 shadow-sm">
          <div className="flex flex-col items-start gap-4 sm:flex-row">
            {store.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={store.logo_url}
                alt={`Logo ${store.name}`}
                className="-mt-14 h-20 w-20 shrink-0 rounded-2xl object-cover ring-4 ring-white shadow-md"
              />
            ) : (
              <div
                className="-mt-14 flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl ring-4 ring-white shadow-md"
                style={{ backgroundColor: `color-mix(in srgb, ${accent} 12%, white)` }}
              >
                <Store className="h-9 w-9" style={{ color: accent }} />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-warm-black tracking-tight">{store.name}</h1>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{ backgroundColor: `color-mix(in srgb, ${accent} 10%, white)`, color: accent }}
                >
                  <CheckCircle2 className="h-3 w-3" /> Creator PejuangYen
                </span>
              </div>
              {store.description && (
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "rgba(12,12,10,0.55)" }}>
                  {store.description}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: "rgba(12,12,10,0.5)" }}>
                <span className="font-semibold text-warm-black">{store.products.length}</span> produk
                {totalSold > 0 && (
                  <span><span className="font-semibold text-warm-black">{totalSold}</span> terjual</span>
                )}
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" style={{ color: accent }} /> Pembayaran aman QRIS & VA
                </span>
              </div>
            </div>

            <button
              onClick={shareStore}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-[rgba(12,12,10,0.12)] px-3.5 py-2 text-xs font-semibold text-warm-black transition-colors hover:border-[rgba(12,12,10,0.3)] cursor-pointer"
              aria-label="Bagikan toko"
            >
              {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> : <Share2 className="h-3.5 w-3.5" />}
              {copied ? "Tersalin ✓" : "Bagikan"}
            </button>
          </div>
        </div>

        {/* ── Section custom creator (sandboxed) ── */}
        {store.custom_html && (
          <div className="mx-auto mt-6 max-w-3xl">
            <SandboxedHtml html={store.custom_html} minHeight={160} />
          </div>
        )}

        {/* ── Produk ── */}
        <div className="mt-10">
          {store.products.length === 0 ? (
            <div className="py-14 text-center">
              <Package className="mx-auto mb-3 h-9 w-9 text-gray-300" />
              <p className="text-sm font-semibold text-warm-black">Belum ada produk</p>
              <p className="mt-1 text-xs text-gray-500">Toko ini sedang menyiapkan produk pertamanya.</p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-baseline justify-between">
                <h2 className="text-base font-bold text-warm-black">Semua Produk</h2>
                <p className="text-xs" style={{ color: "rgba(12,12,10,0.45)" }}>{store.products.length} produk</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {store.products.map((p) => {
                  const discountPct = p.compare_at_price && p.compare_at_price > p.price
                    ? Math.round((1 - p.price / p.compare_at_price) * 100)
                    : null;
                  return (
                    <Link
                      key={p.id}
                      href={`/toko/${store.slug}/${p.slug}`}
                      className="group flex flex-col rounded-2xl border border-[rgba(12,12,10,0.08)] bg-white overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{ outlineColor: accent }}
                    >
                      <div className="relative aspect-[4/3] bg-warm-cream overflow-hidden">
                        {p.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.thumbnail_url}
                            alt={p.title}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Package className="h-9 w-9 text-gray-300" />
                          </div>
                        )}
                        {discountPct !== null && (
                          <span className="absolute left-3 top-3 rounded-md bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
                            -{discountPct}%
                          </span>
                        )}
                        {p.id === bestSellerId && (
                          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950 shadow-sm">
                            <Flame className="h-3 w-3" /> Terlaris
                          </span>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col p-4">
                        <p className="text-sm font-bold leading-snug text-warm-black line-clamp-2">{p.title}</p>
                        <div className="mt-auto pt-3">
                          <div className="flex items-baseline gap-2">
                            <p className="text-base font-bold tabular-nums" style={{ color: accent }}>
                              {formatRupiah(p.price)}
                            </p>
                            {p.compare_at_price && p.compare_at_price > p.price && (
                              <p className="text-xs line-through tabular-nums" style={{ color: "rgba(12,12,10,0.35)" }}>
                                {formatRupiah(p.compare_at_price)}
                              </p>
                            )}
                          </div>
                          {p.sales_count > 0 && (
                            <p className="mt-0.5 text-[11px]" style={{ color: "rgba(12,12,10,0.4)" }}>
                              {p.sales_count} terjual
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="mt-14 border-t border-[rgba(12,12,10,0.06)] bg-white/60">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-3 px-4 py-8 text-center">
          <Link href="/" aria-label="PejuangYen">
            <Image src="/logo.png" alt="PejuangYen" width={104} height={26} className="h-6 w-auto opacity-80 transition-opacity hover:opacity-100" />
          </Link>
          <p className="text-xs" style={{ color: "rgba(12,12,10,0.45)" }}>
            Toko ini dibuat dengan PejuangYen — pembayaran aman via QRIS & Virtual Account,
            produk terkirim otomatis setelah bayar.
          </p>
          <Link
            href="/toko-saya"
            className="text-xs font-semibold text-primary hover:underline"
          >
            Buka toko kamu sendiri →
          </Link>
        </div>
      </footer>
    </div>
  );
}
