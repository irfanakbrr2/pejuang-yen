"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { formatRupiah } from "@/lib/utils";
import { EmptyState } from "@/components/ui/lottie/EmptyState";
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from "@/components/ui/card";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────
interface RevenueDataPoint {
  date: string;
  revenue: number;
  membership?: number;
  course?: number;
  toolCredits?: number;
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

// ── Custom Tooltip ──────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const membership = payload.find((p: any) => p.dataKey === "membership")?.value || 0;
  const course = payload.find((p: any) => p.dataKey === "course")?.value || 0;
  const toolCredits = payload.find((p: any) => p.dataKey === "toolCredits")?.value || 0;
  const total = membership + course + toolCredits;
  return (
    <div className="bg-gray-900 text-white text-xs rounded-xl px-3 py-2.5 shadow-xl min-w-[160px]">
      <p className="text-white/50 mb-2 text-[11px]">{label}</p>
      {membership > 0 && (
        <div className="flex items-center justify-between gap-3 mb-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#8B1414] inline-block" />
            Membership
          </span>
          <span className="font-semibold">{formatRupiah(membership)}</span>
        </div>
      )}
      {course > 0 && (
        <div className="flex items-center justify-between gap-3 mb-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#7C3AED] inline-block" />
            Kelas
          </span>
          <span className="font-semibold">{formatRupiah(course)}</span>
        </div>
      )}
      {toolCredits > 0 && (
        <div className="flex items-center justify-between gap-3 mb-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#2563EB] inline-block" />
            Tools
          </span>
          <span className="font-semibold">{formatRupiah(toolCredits)}</span>
        </div>
      )}
      {total > 0 && (
        <div className="flex items-center justify-between gap-3 pt-1.5 border-t border-white/10 mt-1">
          <span className="text-white/70">Total</span>
          <span className="font-bold">{formatRupiah(total)}</span>
        </div>
      )}
    </div>
  );
}

// ── Mini Metric ──────────────────────────────────────────────────────────
function MiniMetric({
  label, value, accent, loading,
}: { label: string; value: string; accent?: string; loading: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={`text-base font-bold ${accent ? accent : "text-gray-900"}`}>
        {loading ? "—" : value}
      </p>
    </div>
  );
}

// ── Period selector options ──────────────────────────────────────────────
const PERIODS = [
  { label: "7 hr", value: "7" },
  { label: "30 hr", value: "30" },
  { label: "90 hr", value: "90" },
];

// ── Main Component ───────────────────────────────────────────────────────
export function RevenueChart({
  revenueChart,
  revenueStats,
  stats,
  loading,
}: {
  revenueChart: RevenueDataPoint[];
  revenueStats: RevenueStats;
  stats: { totalRevenue: number; activeMembers: number; totalEnrollments: number };
  loading: boolean;
}) {
  const [period, setPeriod] = useState("30");

  const chartData = revenueChart
    .slice(-Number(period))
    .map((d) => ({
      ...d,
      label: new Date(d.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
    }));

  const hasData = chartData.some((d) => d.revenue > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pendapatan</CardTitle>
        <CardToolbar>
          <div className="flex items-center bg-gray-100 rounded-full p-0.5 gap-0.5">
            {PERIODS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 ${
                  period === opt.value
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </CardToolbar>
      </CardHeader>

      <CardContent>
        {/* ── Mini metrics row ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4 mb-5 pb-5 border-b border-black/[0.06]">
          <MiniMetric
            label="MRR"
            value={formatRupiah(revenueStats?.mrr ?? 0)}
            accent="text-[#8B1414]"
            loading={loading}
          />
          <MiniMetric
            label="ARR (proyeksi)"
            value={formatRupiah(revenueStats?.arr ?? 0)}
            accent="text-[#8B1414]"
            loading={loading}
          />
          <MiniMetric
            label="Revenue Bulan Ini"
            value={formatRupiah(revenueStats?.totalRevenueThisMonth ?? 0)}
            loading={loading}
          />
          <MiniMetric
            label="Membership / bln"
            value={formatRupiah(revenueStats?.membershipRevenueThisMonth ?? 0)}
            loading={loading}
          />
          <MiniMetric
            label="Kelas / bln"
            value={formatRupiah(revenueStats?.courseRevenueThisMonth ?? 0)}
            loading={loading}
          />
          <MiniMetric
            label="Tools / bln"
            value={formatRupiah(revenueStats?.toolCreditsRevenueThisMonth ?? 0)}
            loading={loading}
          />
          <MiniMetric
            label="Total Revenue"
            value={formatRupiah(stats.totalRevenue)}
            loading={loading}
          />
        </div>

        {/* ── Chart ─────────────────────────────────────────────────── */}
        {loading ? (
          <div className="skeleton h-52 rounded-xl" />
        ) : !hasData ? (
          <EmptyState
            title="Belum ada data pendapatan"
            description="Data akan muncul setelah ada transaksi."
            size="sm"
            className="py-8"
          />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradMembership" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#8B1414" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#8B1414" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradCourse" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#7C3AED" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradTools" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2563EB" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9CA3AF" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}jt`}
                width={42}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                formatter={(value) => value === "membership" ? "Membership" : value === "toolCredits" ? "Tools" : "Kelas"}
              />
              <Area
                type="monotone"
                dataKey="membership"
                stackId="1"
                stroke="#8B1414"
                strokeWidth={2}
                fill="url(#gradMembership)"
                dot={false}
                activeDot={{ r: 4, fill: "#8B1414", strokeWidth: 0 }}
              />
              <Area
                type="monotone"
                dataKey="course"
                stackId="1"
                stroke="#7C3AED"
                strokeWidth={2}
                fill="url(#gradCourse)"
                dot={false}
                activeDot={{ r: 4, fill: "#7C3AED", strokeWidth: 0 }}
              />
              <Area
                type="monotone"
                dataKey="toolCredits"
                stackId="1"
                stroke="#2563EB"
                strokeWidth={2}
                fill="url(#gradTools)"
                dot={false}
                activeDot={{ r: 4, fill: "#2563EB", strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
