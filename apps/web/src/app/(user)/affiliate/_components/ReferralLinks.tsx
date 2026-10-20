"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { publicAffiliateLink } from "@/lib/affiliate-links";

export function ReferralLinks({ affiliateCode, publicRefCode, publicAffiliateLink: apiPublicLink }: { affiliateCode: string; publicRefCode?: string | null; publicAffiliateLink?: string | null }) {
  const [copied, setCopied] = useState(false);
  const link = apiPublicLink || (publicRefCode ? publicAffiliateLink(publicRefCode) : `https://pejuangyen.com/?ref=${affiliateCode}`);

  const copyLink = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-card p-5 mb-6">
      <p className="label-uppercase mb-3">Link Affiliate Anda</p>
      <div className="flex gap-2">
        <input
          readOnly
          value={link}
          className="flex-1 px-3 py-2 text-sm rounded-xl border border-black/[0.06] dark:border-white/[0.05] text-[#0D0D0D] dark:text-slate-300 font-mono outline-none bg-transparent"
        />
        <button
          onClick={copyLink}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#8B1414] dark:bg-[#C0392B] text-white dark:text-black text-xs font-semibold rounded-lg hover:bg-[#6E0F0F] dark:hover:bg-[#A93226] transition-colors duration-150 active:scale-[0.97]"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Tersalin!" : "Salin"}
        </button>
      </div>
    </div>
  );
}
