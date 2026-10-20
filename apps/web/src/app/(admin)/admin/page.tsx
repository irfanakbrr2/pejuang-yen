"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { StatGrid } from "./_components/StatGrid";
import { RevenueChart } from "./_components/RevenueChart";
import { UserGrowthChart, OrderStatusChart } from "./_components/UserGrowthChart";
import { RecentOrdersTable } from "./_components/RecentOrdersTable";
import { QuickActions } from "./_components/QuickActions";
import { PageHeader } from "@/components/ui/dashboard-chrome";

const EMPTY_STATS = {
  totalUsers: 0, activeMembers: 0, totalRevenue: 0,
  pendingOrders: 0, pendingCommissions: 0, totalCourses: 0, totalEnrollments: 0,
};

const EMPTY_REVENUE_STATS = {
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

export default function AdminDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/admin/dashboard/stats")
      .then((res) => { if (res.success) setData(res.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const stats = data?.stats || EMPTY_STATS;
  const revenueStats = data?.revenueStats || EMPTY_REVENUE_STATS;
  const recentOrders: any[] = data?.recentOrders || [];
  const revenueChart: any[] = data?.revenueChart || [];
  const userChart: any[] = data?.userChart || [];
  const ordersByStatus: any[] = data?.ordersByStatus || [];

  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={today}
        title="Dashboard Admin"
        description="Overview platform PejuangYen"
      />

      <StatGrid stats={stats} revenueStats={revenueStats} loading={loading} />

      <RevenueChart
        revenueChart={revenueChart}
        revenueStats={revenueStats}
        stats={stats}
        loading={loading}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <UserGrowthChart userChart={userChart} loading={loading} />
        <OrderStatusChart ordersByStatus={ordersByStatus} loading={loading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <RecentOrdersTable recentOrders={recentOrders} loading={loading} />
        <QuickActions stats={stats} />
      </div>
    </div>
  );
}
