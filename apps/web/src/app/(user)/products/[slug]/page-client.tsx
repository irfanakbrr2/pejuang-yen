"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Download, ExternalLink, Lock, Package, Sparkles } from "lucide-react";
import { api } from "@/lib/api-client";

interface ProductFile {
  id: string;
  title: string;
  file_type: string;
  file_url?: string | null;
}

interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  thumbnail_url?: string | null;
  delivery_type: "files" | "external_url" | "service";
  external_url?: string | null;
  has_access: boolean;
  files: ProductFile[];
}

export default function ProductAccessClient() {
  const pathname = usePathname();
  const slug = pathname.split("/").filter(Boolean)[1] ?? "_";

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug || slug === "_") return;
    api<ProductDetail>(`/api/user/digital-products/${slug}`, { cacheTtl: 0 }).then((res) => {
      if (res.success && res.data) setProduct(res.data);
      setLoading(false);
    });
  }, [slug]);

  if (loading) {
    return <p className="py-10 text-center text-sm text-gray-500">Memuat...</p>;
  }

  if (!product) {
    return (
      <div className="py-14 text-center">
        <Package className="mx-auto mb-3 h-10 w-10 text-gray-300" />
        <p className="text-sm font-semibold text-warm-black">Produk tidak ditemukan</p>
        <Link href="/products" className="mt-2 inline-block text-xs text-primary">← Kembali ke Produk Saya</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <Link href="/products" className="text-xs text-gray-500 hover:text-primary">← Produk Saya</Link>
      <div className="mt-3 rounded-2xl border border-[rgba(0,0,0,0.07)] bg-white overflow-hidden">
        {product.thumbnail_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.thumbnail_url} alt={product.name} className="h-48 w-full object-cover" />
        )}
        <div className="p-6">
          <h1 className="text-xl font-bold text-warm-black">{product.name}</h1>
          {product.description && (
            <p className="mt-2 text-sm leading-relaxed text-gray-600">{product.description}</p>
          )}

          {!product.has_access ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
              <Lock className="mx-auto mb-2 h-6 w-6 text-amber-600" />
              <p className="text-sm font-semibold text-amber-800">Kamu belum punya akses produk ini</p>
              <Link
                href={`/order/${product.slug}`}
                className="mt-3 inline-block rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition-colors"
              >
                Beli Sekarang →
              </Link>
            </div>
          ) : product.delivery_type === "service" ? (
            <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                <div>
                  <p className="text-sm font-semibold text-green-800">Pembelian terkonfirmasi</p>
                  <p className="mt-1 text-xs leading-relaxed text-green-700">
                    Tim PejuangYen akan menghubungi kamu via WhatsApp untuk konfirmasi jadwal dan tindak lanjut layanan ini.
                  </p>
                </div>
              </div>
            </div>
          ) : product.delivery_type === "external_url" && product.external_url ? (
            <a
              href={product.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover transition-colors"
            >
              <ExternalLink className="h-4 w-4" /> Buka Akses Produk
            </a>
          ) : (
            <div className="mt-5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Download</p>
              {product.files.length === 0 && (
                <p className="text-sm text-gray-500">File sedang disiapkan — cek lagi sebentar lagi.</p>
              )}
              {product.files.map((f) => (
                <a
                  key={f.id}
                  href={f.file_url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-xl border border-[rgba(0,0,0,0.07)] px-4 py-3 transition-colors hover:border-primary"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-warm-black truncate">{f.title}</p>
                    <p className="text-xs uppercase text-gray-400">{f.file_type}</p>
                  </div>
                  <Download className="h-4 w-4 shrink-0 text-primary" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
