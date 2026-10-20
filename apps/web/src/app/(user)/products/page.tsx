"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, ArrowRight } from "lucide-react";
import { api } from "@/lib/api-client";
import { PageHeader } from "@/components/ui/dashboard-chrome";

interface OwnedProduct {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  thumbnail_url?: string | null;
  delivery_type: "files" | "external_url" | "service";
  granted_at: string;
}

const DELIVERY_BADGE: Record<string, string> = {
  files: "Download",
  external_url: "Link Akses",
  service: "Layanan",
};

export default function MyProductsPage() {
  const [products, setProducts] = useState<OwnedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<OwnedProduct[]>("/api/user/digital-products", { cacheTtl: 0 }).then((res) => {
      if (res.success && res.data) setProducts(res.data);
      setLoading(false);
    });
  }, []);

  return (
    <>
      <PageHeader
        title="Produk Saya"
        description="Produk digital yang sudah kamu beli — ebook, template, dan lainnya."
      />

      {loading ? (
        <p className="py-10 text-center text-sm text-gray-500">Memuat...</p>
      ) : products.length === 0 ? (
        <div className="py-14 text-center">
          <Package className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-semibold text-warm-black">Belum ada produk digital</p>
          <p className="mt-1 text-xs text-gray-500">Produk yang kamu beli akan muncul di sini.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/products/${p.slug}`}
              className="group rounded-xl border border-[rgba(0,0,0,0.07)] bg-white p-4 transition-shadow hover:shadow-md"
            >
              {p.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.thumbnail_url} alt={p.name} className="mb-3 h-32 w-full rounded-lg object-cover" />
              ) : (
                <div className="mb-3 flex h-32 w-full items-center justify-center rounded-lg bg-warm-cream">
                  <Package className="h-8 w-8 text-gray-300" />
                </div>
              )}
              <span className="inline-block rounded-md bg-[#F7E8E8] border border-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                {DELIVERY_BADGE[p.delivery_type] || p.delivery_type}
              </span>
              <p className="mt-2 text-sm font-semibold text-warm-black leading-snug">{p.name}</p>
              <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary">
                Buka <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
