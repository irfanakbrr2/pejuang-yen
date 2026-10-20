import { Users, TrendingUp, Clock, BadgeCheck } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { BentoStatCard } from "@/components/ui/bento-stat-card";

interface Stats {
  total_referrals: number;
  total_commissions: number;
  unpaid_commissions: number;
  paid_commissions: number;
}

export function AffiliateStats({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <BentoStatCard title="Total Referrals" value={stats.total_referrals} icon={Users} accentColor="blue" />
      <BentoStatCard title="Total Komisi" value={formatRupiah(stats.total_commissions)} icon={TrendingUp} accentColor="purple" />
      <BentoStatCard title="Belum Dibayar" value={formatRupiah(stats.unpaid_commissions)} icon={Clock} accentColor="orange" />
      <BentoStatCard title="Komisi Dibayar" value={formatRupiah(stats.paid_commissions)} icon={BadgeCheck} accentColor="green" />
    </div>
  );
}
