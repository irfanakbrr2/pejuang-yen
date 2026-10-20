"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { publicProductAffiliateLink } from "@/lib/affiliate-links";

interface Product {
  slug: string;
  label: string;
  price: number;
  type: "course" | "membership";
}

export function ProductLinks({ products, affiliateCode, publicRefCode }: { products: Product[]; affiliateCode: string; publicRefCode?: string | null }) {
  const [copied, setCopied] = useState<string | null>(null);

  if (products.length === 0) return null;

  const copyLink = (link: string, key: string) => {
    navigator.clipboard.writeText(link);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-[15px] font-semibold text-[#0D0D0D] dark:text-white heading-tight">Link Order Per Produk</h2>
          <p className="text-xs text-[#9CA3AF] dark:text-slate-400 mt-0.5">Share link ini langsung ke calon pembeli — komisi otomatis terlacak</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {products.map((p) => {
          const productLink = publicRefCode
            ? publicProductAffiliateLink(publicRefCode, p.slug)
            : `https://app.pejuangyen.com/order/${p.slug}?ref=${affiliateCode}`;
          return (
            <div key={p.slug} className="card-sharp p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-[#0D0D0D] dark:text-white truncate heading-tight">{p.label}</span>
                  <span className="text-xs font-semibold text-[#8B1414] dark:text-[#C0392B] shrink-0">{formatRupiah(p.price)}</span>
                </div>
                <p className="text-xs text-[#9CA3AF] dark:text-slate-500 font-mono truncate">{productLink}</p>
              </div>
              <button
                onClick={() => copyLink(productLink, p.slug)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#8B1414] dark:text-[#34D399] bg-[#F7E8E8] dark:bg-[#C0392B]/10 rounded-lg hover:bg-[#d0ede4] dark:hover:bg-[#C0392B]/20 transition-colors duration-150 active:scale-[0.97] shrink-0"
              >
                {copied === p.slug ? <Check size={11} /> : <Copy size={11} />}
                {copied === p.slug ? "Tersalin!" : "Salin"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
