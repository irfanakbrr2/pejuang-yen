"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { formatRupiah } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from "@/components/ui/card";
import { AdminTable, Tr, Td } from "@/components/ui/AdminTable";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { BarChart3, Users, Activity, UserPlus, DollarSign, HeartPulse, AlertTriangle, Moon } from "lucide-react";
import { StatCard, PillSelect } from "./shared";

interface OverviewData {
  dau: number;
  wau: number;
  mau: number;
  signups_period: number;
  revenue_period: number;
  paid_orders_period: number;
  trend: { event_date: string; event_name: string; count: number; unique_users: number }[];
  today: { event_date: string; event_name: string; count: number; unique_users: number }[];
}

interface MemberHealthEntry {
  id: string;
  name: string;
  email: string;
  plan_name: string;
  active_days_30: number;
  last_active: string | null;
  current_streak: number;
}

interface MemberHealthData {
  total_paid_members: number;
  counts: { active: number; at_risk: number; dormant: number };
  active: MemberHealthEntry[];
  at_risk: MemberHealthEntry[];
  dormant: MemberHealthEntry[];
}

export function OverviewTab({ days }: { days: string }) {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [memberHealth, setMemberHealth] = useState<MemberHealthData | null>(null);
  const [healthTab, setHealthTab] = useState<"dormant" | "at_risk" | "active">("dormant");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api(`/api/admin/analytics/overview?days=${days}`),
      api(`/api/admin/analytics/member-health`),
    ])
      .then(([ovr, health]) => {
        if (ovr.success) setOverview(ovr.data as OverviewData);
        if (health.success) setMemberHealth(health.data as MemberHealthData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  // Merge daily aggregate rows (+ today's live rows) into a per-date series
  const trendRows = [...(overview?.trend || []), ...(overview?.today || [])];
  const byDate = new Map<string, { label: string; page_views: number; signups: number; payments: number }>();
  for (const row of trendRows) {
    const entry = byDate.get(row.event_date) || {
      label: new Date(row.event_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
      page_views: 0,
      signups: 0,
      payments: 0,
    };
    if (row.event_name === "page_view") entry.page_views += row.count;
    if (row.event_name === "signup_completed") entry.signups += row.count;
    if (row.event_name === "payment_success") entry.payments += row.count;
    byDate.set(row.event_date, entry);
  }
  const chartData = [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="DAU" value={String(overview?.dau ?? "—")} hint="Active hari ini" icon={Activity} accent />
        <StatCard label="WAU" value={String(overview?.wau ?? "—")} hint="Active 7 hari" icon={Users} />
        <StatCard label="MAU" value={String(overview?.mau ?? "—")} hint="Active 30 hari" icon={Users} />
        <StatCard label="Signups" value={String(overview?.signups_period ?? "—")} hint={`User baru ${days} hari`} icon={UserPlus} />
        <StatCard label="Paid Orders" value={String(overview?.paid_orders_period ?? "—")} hint={`Order paid ${days} hari`} icon={BarChart3} />
        <StatCard label="Revenue" value={formatRupiah(overview?.revenue_period || 0)} hint={`Pendapatan ${days} hari`} icon={DollarSign} accent />
      </div>

      {/* Trend chart */}
      <Card>
        <CardHeader>
          <CardTitle>Tren Aktivitas</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">
              {loading ? "Memuat data..." : "Belum ada data event. Data muncul setelah tracking berjalan dan rollup harian pertama."}
            </p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="pv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B1414" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#8B1414" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Area type="monotone" dataKey="page_views" name="Page Views" stroke="#8B1414" fill="url(#pv)" strokeWidth={2} />
                  <Area type="monotone" dataKey="signups" name="Signups" stroke="#2563EB" fill="none" strokeWidth={2} />
                  <Area type="monotone" dataKey="payments" name="Payments" stroke="#D97706" fill="none" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Member Health — paid members classified by recent activity */}
      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <HeartPulse size={16} className="text-[#8B1414]" /> Member Health (Paid)
          </CardTitle>
          <CardToolbar>
            <PillSelect
              value={healthTab}
              onChange={setHealthTab}
              options={[
                { label: `Dormant (${memberHealth?.counts.dormant ?? 0})`, value: "dormant" as const },
                { label: `At-Risk (${memberHealth?.counts.at_risk ?? 0})`, value: "at_risk" as const },
                { label: `Active (${memberHealth?.counts.active ?? 0})`, value: "active" as const },
              ]}
            />
          </CardToolbar>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <StatCard label="Active Member" value={String(memberHealth?.counts.active ?? "—")} hint="≥3 hari aktif / 30 hari" icon={Activity} accent />
            <StatCard label="At-Risk" value={String(memberHealth?.counts.at_risk ?? "—")} hint="Aktif tapi jarang (<3 hari/30)" icon={AlertTriangle} />
            <StatCard label="Dormant" value={String(memberHealth?.counts.dormant ?? "—")} hint="Tidak aktif 14+ hari" icon={Moon} />
          </div>
          <AdminTable
            columns={[
              { key: "name", label: "Member" },
              { key: "plan", label: "Plan" },
              { key: "active_days", label: "Hari Aktif (30d)" },
              { key: "streak", label: "Streak" },
              { key: "last_active", label: "Terakhir Aktif" },
            ]}
            loading={loading}
            empty={<p className="text-sm text-gray-400 py-6 text-center">Tidak ada member di kategori ini.</p>}
          >
            {(memberHealth?.[healthTab] || []).map((m) => (
              <Tr key={m.id}>
                <Td>
                  <p className="font-medium text-gray-900">{m.name}</p>
                  <p className="text-xs text-gray-400">{m.email}</p>
                </Td>
                <Td>{m.plan_name}</Td>
                <Td>{m.active_days_30}</Td>
                <Td>{m.current_streak > 0 ? `🔥 ${m.current_streak}` : "—"}</Td>
                <Td className={!m.last_active ? "text-red-500" : ""}>{m.last_active || "Belum pernah"}</Td>
              </Tr>
            ))}
          </AdminTable>
        </CardContent>
      </Card>
    </div>
  );
}
