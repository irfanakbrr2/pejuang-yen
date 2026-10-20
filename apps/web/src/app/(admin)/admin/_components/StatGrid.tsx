"use client";

import { Users, Star, DollarSign, ShoppingCart, BookOpen, TrendingUp, BarChart2, Repeat, CalendarDays } from "lucide-react";
import { StatCardSkeleton } from "@/components/ui/Skeleton";
import { formatRupiah } from "@/lib/utils";
import { BentoStatCard } from "@/components/ui/bento-stat-card";

interface Stats {
  totalUsers: number;
  activeMembers: number;
  totalRevenue: number;
  pendingOrders: number;
  pendingCommissions: number;
  totalCourses: number;
  totalEnrollments: number;
}

interface RevenueStats {
  mrr: number;
  arr: number;
  totalRevenueThisMonth: number;
  membershipRevenueThisMonth: number;
  courseRevenueThisMonth: number;
  toolCreditsRevenueThisMonth: number;
  newMembersThisMonth: number;
  membershipRevenueTotal: number;
  courseRevenueTotal: number;
  toolCreditsRevenueTotal: number;
}

interface StatGridProps {
  stats: Stats;
  revenueStats: RevenueStats;
  loading: boolean;
}

const EMPTY_REVENUE_STATS: RevenueStats = {
  mrr: 0,
  arr: 0,
  totalRevenueThisMonth: 0,
  membershipRevenueThisMonth: 0,
  courseRevenueThisMonth: 0,
  toolCreditsRevenueThisMonth: 0,
  newMembersThisMonth: 0,
  membershipRevenueTotal: 0,
  courseRevenueTotal: 0,
  toolCreditsRevenueTotal: 0,
};

export function StatGrid({ stats, revenueStats = EMPTY_REVENUE_STATS, loading }: StatGridProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Baris 1 — Revenue Metrics utama */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <BentoStatCard
          title="MRR"
          value={formatRupiah(revenueStats.mrr)}
          subtitle={`bulan ini • membership monthly`}
          icon={Repeat}
          accentColor="teal"
        />
        <BentoStatCard
          title="ARR (Proyeksi)"
          value={formatRupiah(revenueStats.arr)}
          subtitle="MRR × 12"
          icon={TrendingUp}
          accentColor="green"
        />
        <BentoStatCard
          title="Revenue Bulan Ini"
          value={formatRupiah(revenueStats.totalRevenueThisMonth)}
          subtitle="membership + kelas"
          icon={CalendarDays}
          accentColor="blue"
        />
      </div>

      {/* Baris 2 — Breakdown & operasional */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <BentoStatCard
          title="Total Revenue"
          value={formatRupiah(stats.totalRevenue)}
          subtitle="semua waktu"
          icon={DollarSign}
          accentColor="purple"
          href="/admin/orders"
        />
        <BentoStatCard
          title="Active Members"
          value={stats.activeMembers.toLocaleString()}
          subtitle={`+${revenueStats.newMembersThisMonth} bulan ini`}
          icon={Star}
          accentColor="orange"
          href="/admin/memberships"
        />
        <BentoStatCard
          title="Total Users"
          value={stats.totalUsers.toLocaleString()}
          subtitle="terdaftar"
          icon={Users}
          accentColor="blue"
          href="/admin/users"
        />
        <BentoStatCard
          title="Pending Orders"
          value={stats.pendingOrders.toLocaleString()}
          subtitle="perlu ditindak"
          icon={ShoppingCart}
          accentColor={stats.pendingOrders > 0 ? "rose" : "green"}
          href="/admin/orders"
        />
      </div>

      {/* Baris 3 — Revenue breakdown satuan */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <BentoStatCard
          title="Membership Revenue"
          value={formatRupiah(revenueStats.membershipRevenueThisMonth)}
          subtitle="bulan ini"
          icon={BarChart2}
          accentColor="teal"
          href="/admin/memberships"
        />
        <BentoStatCard
          title="Course Revenue"
          value={formatRupiah(revenueStats.courseRevenueThisMonth)}
          subtitle="bulan ini"
          icon={BookOpen}
          accentColor="purple"
          href="/admin/orders"
        />
        {/* Disembunyikan untuk PejuangYen (fitur GWA tak dipakai): Tools Revenue / kredit AI Tools.
        <BentoStatCard
          title="Tools Revenue"
          value={formatRupiah(revenueStats.toolCreditsRevenueThisMonth)}
          subtitle="bulan ini"
          icon={Wand2}
          accentColor="blue"
          href="/admin/tools"
        /> */}
        <BentoStatCard
          title="Total Kelas"
          value={stats.totalCourses.toLocaleString()}
          subtitle="kelas aktif"
          icon={BookOpen}
          accentColor="orange"
          href="/admin/courses"
        />
        <BentoStatCard
          title="Enrollments"
          value={stats.totalEnrollments.toLocaleString()}
          subtitle="total pendaftar"
          icon={TrendingUp}
          accentColor="green"
          href="/admin/users"
        />
      </div>
    </div>
  );
}
