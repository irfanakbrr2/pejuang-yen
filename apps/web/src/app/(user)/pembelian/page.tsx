"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { Download, ExternalLink, ShoppingBag, Store } from "lucide-react";
import { purchasesApi } from "@/lib/api-client";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { formatDate } from "@/lib/utils";

interface Purchase {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  thumbnail_url?: string | null;
  delivery_type: "file" | "link";
  external_url?: string | null;
  store_name: string;
  store_slug: string;
  purchased_at: string;
}

export default function PembelianPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    purchasesApi.list().then((res) => {
      if (res.success && res.data) setPurchases(res.data as Purchase[]);
      setLoading(false);
    });
  }, []);

  return (
    <>
      <PageHeader
        title="Pembelian"
        description="Produk dari toko creator yang sudah kamu beli."
      />

      {loading ? (
        <p className="py-10 text-center text-sm text-gray-500">Memuat...</p>
      ) : purchases.length === 0 ? (
        <div className="py-14 text-center">
          <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-semibold text-warm-black">Belum ada pembelian</p>
          <p className="mt-1 text-xs text-gray-500">Produk dari toko creator akan muncul di sini setelah dibeli.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {purchases.map((p) => (
            <div key={p.id} className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white p-4">
              {p.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.thumbnail_url} alt={p.title} className="mb-3 h-28 w-full rounded-lg object-cover" />
              ) : (
                <div className="mb-3 flex h-28 w-full items-center justify-center rounded-lg bg-warm-cream">
                  <ShoppingBag className="h-7 w-7 text-gray-300" />
                </div>
              )}
              <p className="text-sm font-bold text-warm-black leading-snug">{p.title}</p>
              <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                <Store className="h-3 w-3" /> {p.store_name} · {formatDate(p.purchased_at)}
              </p>
              {p.delivery_type === "file" ? (
                <a
                  href={`/api/purchases/download/${p.id}`}
                  className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-semibold text-white hover:bg-primary-hover transition-colors"
                >
                  <Download className="h-3.5 w-3.5" /> Unduh File
                </a>
              ) : p.external_url ? (
                <a
                  href={p.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-semibold text-white hover:bg-primary-hover transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Buka Akses
                </a>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
