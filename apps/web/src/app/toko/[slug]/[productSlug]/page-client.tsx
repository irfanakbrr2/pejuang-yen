"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Package, ShieldCheck, Store } from "lucide-react";
import { checkoutApi, tokoPublicApi } from "@/lib/api-client";
import { formatRupiah } from "@/lib/utils";
import { SandboxedHtml, looksLikeHtml } from "@/components/toko/SandboxedHtml";

interface ProductData {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  thumbnail_url?: string | null;
  price: number;
  compare_at_price?: number | null;
  delivery_type: "file" | "link";
  sales_count: number;
  store_name: string;
  store_slug: string;
  store_logo_url?: string | null;
  accent_color?: string | null;
}

export default function StoreProductClient() {
  const pathname = usePathname();
  const router = useRouter();
  const parts = pathname.split("/").filter(Boolean);
  const storeSlug = parts[1] ?? "_";
  const productSlug = parts[2] ?? "_";

  const [product, setProduct] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!storeSlug || storeSlug === "_" || !productSlug || productSlug === "_") return;
    tokoPublicApi.product(storeSlug, productSlug).then((res) => {
      if (res.success && res.data) setProduct(res.data as ProductData);
      setLoading(false);
    });
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setIsLoggedIn(!!d.success))
      .catch(() => setIsLoggedIn(false));
  }, [storeSlug, productSlug]);

  const buy = async () => {
    if (!product) return;
    if (!isLoggedIn) {
      router.push(`/login?redirect=/toko/${storeSlug}/${productSlug}`);
      return;
    }
    setBuying(true);
    setError("");
    const res = await checkoutApi.createPayment({
      order_type: "creator_product",
      product_id: product.id,
      payment_method: "qris",
    });
    const d = res.data as { order_id?: string } | undefined;
    if (res.success && d?.order_id) {
      router.push(`/checkout/${d.order_id}`);
    } else {
      setError(res.error || "Gagal membuat pesanan. Coba lagi.");
      setBuying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-warm-cream flex items-center justify-center">
        <div className="text-sm text-[rgba(12,12,10,0.45)]">Memuat produk...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-warm-cream flex items-center justify-center p-4">
        <div className="text-center">
          <Package className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="font-semibold text-warm-black">Produk tidak ditemukan</p>
          <Link href={`/toko/${storeSlug}`} className="mt-2 inline-block text-sm text-primary">← Kembali ke toko</Link>
        </div>
      </div>
    );
  }

  const accent = product.accent_color || "#8B1414";
  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;

  return (
    <div className="min-h-screen bg-warm-cream">
      <div className="h-1.5 w-full" style={{ backgroundColor: accent }} />
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <Link href={`/toko/${product.store_slug}`} className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary">
          <Store className="h-3.5 w-3.5" /> {product.store_name}
        </Link>

        <div className="mt-3 rounded-2xl border border-[rgba(12,12,10,0.08)] bg-white overflow-hidden">
          {product.thumbnail_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.thumbnail_url} alt={product.title} className="h-56 w-full object-cover" />
          )}
          <div className="p-6">
            <h1 className="text-xl md:text-2xl font-bold text-warm-black leading-snug">{product.title}</h1>

            <div className="mt-3 flex items-baseline gap-2">
              <p className="text-2xl font-bold" style={{ color: accent }}>{formatRupiah(product.price)}</p>
              {hasDiscount && (
                <p className="text-sm line-through" style={{ color: "rgba(12,12,10,0.35)" }}>
                  {formatRupiah(product.compare_at_price!)}
                </p>
              )}
            </div>
            {product.sales_count > 0 && (
              <p className="mt-1 text-xs" style={{ color: "rgba(12,12,10,0.4)" }}>{product.sales_count} orang sudah membeli</p>
            )}

            {product.description && (
              looksLikeHtml(product.description) ? (
                <div className="mt-4">
                  <SandboxedHtml html={product.description} minHeight={200} className="w-full rounded-xl border-0 bg-transparent" />
                </div>
              ) : (
                <p className="mt-4 text-sm leading-relaxed whitespace-pre-line" style={{ color: "rgba(12,12,10,0.62)" }}>
                  {product.description}
                </p>
              )
            )}

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>
            )}

            <button
              onClick={buy}
              disabled={buying}
              className="mt-5 w-full rounded-xl py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: accent }}
            >
              {buying ? "Menyiapkan pembayaran..." : isLoggedIn === false ? "Masuk & Beli →" : "Beli Sekarang →"}
            </button>

            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs" style={{ color: "rgba(12,12,10,0.45)" }}>
              <ShieldCheck className="h-3.5 w-3.5" />
              Pembayaran aman via QRIS & VA — {product.delivery_type === "file" ? "file langsung bisa diunduh setelah bayar" : "akses langsung terbuka setelah bayar"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
