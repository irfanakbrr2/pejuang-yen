"use client";
/* eslint-disable react-hooks/immutability */

import { useState, useEffect } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/toast";
import { AffiliateStats } from "./_components/AffiliateStats";
import { ReferralLinks } from "./_components/ReferralLinks";
import { CommissionHistory } from "./_components/CommissionHistory";
import { LeadsList } from "./_components/LeadsList";
import { TierCard, type TierState } from "./_components/TierCard";
import { PayoutSettings } from "./_components/PayoutSettings";
import { PageHeader } from "@/components/ui/dashboard-chrome";

interface AffiliateData {
  is_affiliate: boolean;
  affiliate?: {
    id: string;
    affiliate_code: string;
    tier?: string;
    public_ref_code?: string | null;
    public_affiliate_link?: string | null;
    payout_name?: string | null;
    payout_bank_name?: string | null;
    payout_bank_account?: string | null;
  };
  stats?: {
    total_referrals: number;
    total_commissions: number;
    unpaid_commissions: number;
    paid_commissions: number;
  };
  tier?: TierState;
}

export default function AffiliateDashboardPage() {
  const [data, setData] = useState<AffiliateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    fetchAffiliateData();
  }, []);

  const fetchAffiliateData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/affiliate/me", { credentials: "include" });
      const d = await res.json();
      if (d.success) {
        setData(d.data);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const registerAffiliate = async () => {
    setRegistering(true);
    const res = await fetch("/api/affiliate/register", { method: "POST", credentials: "include" });
    const d = await res.json();
    if (d.success) fetchAffiliateData();
    else toast.error("Gagal registrasi. Coba lagi.");
    setRegistering(false);
  };

  if (loading) {
    return (
      <div>
        <div className="mb-6">
          <div className="skeleton h-3 w-16 mb-2 rounded" />
          <div className="skeleton h-7 w-48 mb-1 rounded" />
          <div className="skeleton h-3 w-64 rounded" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-card p-5">
              <div className="skeleton h-3 w-20 mb-3 rounded" />
              <div className="skeleton h-7 w-28 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data?.is_affiliate) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Monetisasi"
          title="Program Affiliate"
          description="Dapatkan komisi dari setiap referral Anda"
        />
        <div className="glass-card max-w-md mx-auto p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#F7E8E8] dark:bg-[#C0392B]/10 flex items-center justify-center mb-5 mx-auto">
            <Share2 size={24} className="text-[#8B1414] dark:text-[#C0392B]" />
          </div>
          <h2 className="text-lg font-bold text-[#0D0D0D] dark:text-white heading-tight mb-2">Bergabung Jadi Affiliate</h2>
          <p className="text-sm text-[#6B7280] dark:text-slate-400 leading-relaxed mb-4">
            Dapatkan komisi untuk setiap orang yang bergabung ke PejuangYen melalui link referral Anda.
            Pendaftaran gratis dan terbuka untuk semua member.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#F7E8E8] dark:bg-[#C0392B]/10 text-[#8B1414] dark:text-[#34D399]">Komisi 20% kelas &amp; produk</span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#F7E8E8] dark:bg-[#C0392B]/10 text-[#8B1414] dark:text-[#34D399]">40% membership premium</span>
          </div>
          <Button size="lg" onClick={registerAffiliate} loading={registering}>
            Daftar Jadi Affiliate Sekarang
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <PageHeader
          eyebrow="Monetisasi"
          title="Affiliate Dashboard"
          description="Pantau performa dan komisi referral Anda"
        />
      </div>

      <AffiliateStats stats={data.stats!} />

      {data.tier && <TierCard tier={data.tier} />}

      <div className="glass-card p-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="font-semibold text-[#0D0D0D] dark:text-white">Struktur komisi:</span>
        <span className="font-semibold text-[#8B1414] dark:text-[#34D399]">20%</span>
        <span className="text-[#6B7280] dark:text-slate-400">untuk kelas &amp; produk digital ·</span>
        <span className="font-semibold text-[#8B1414] dark:text-[#34D399]">40%</span>
        <span className="text-[#6B7280] dark:text-slate-400">untuk membership premium</span>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <ReferralLinks
          affiliateCode={data.affiliate!.affiliate_code}
          publicRefCode={data.affiliate!.public_ref_code}
          publicAffiliateLink={data.affiliate!.public_affiliate_link}
        />
        <PayoutSettings
          payoutName={data.affiliate!.payout_name}
          payoutBankName={data.affiliate!.payout_bank_name}
          payoutBankAccount={data.affiliate!.payout_bank_account}
        />
        <LeadsList />
        <CommissionHistory />
      </div>
    </div>
  );
}
