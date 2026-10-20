"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { formatRupiah } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from "@/components/ui/card";
import { AdminTable, Tr, Td, StatusBadge } from "@/components/ui/AdminTable";
import { EmptyState } from "@/components/ui/lottie/EmptyState";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar,
} from "recharts";
import { TrendingUp, Award, Star, CreditCard, DollarSign, Calendar, ArrowUpRight } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────
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

interface RevenueDataPoint {
  date: string;
  revenue: number;
  membership?: number;
  course?: number;
  toolCredits?: number;
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
            <span className="w-2 h-2 rounded-full bg-[#2563EB] inline-block" />
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

export default function AdminRevenuePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState("30");

  useEffect(() => {
    api("/api/admin/dashboard/stats")
      .then((res) => { if (res.success) setData(res.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const stats = data?.stats || { totalRevenue: 0, activeMembers: 0, totalEnrollments: 0 };
  const revenueStats: RevenueStats = data?.revenueStats || {
    mrr: 0, arr: 0, totalRevenueThisMonth: 0,
    membershipRevenueThisMonth: 0, courseRevenueThisMonth: 0, toolCreditsRevenueThisMonth: 0,
    newMembersThisMonth: 0, membershipRevenueTotal: 0, courseRevenueTotal: 0, toolCreditsRevenueTotal: 0,
  };
  const recentOrders: any[] = data?.recentOrders || [];
  const rawChartData: RevenueDataPoint[] = data?.revenueChart || [];

  // Filter only paid orders that still have a paid payment record.
  const revenueLog = recentOrders.filter((order) => order.status === "paid" && order.payment_id);

  // Format chart data based on period selection
  const chartData = rawChartData
    .slice(-Number(chartPeriod))
    .map((d) => ({
      ...d,
      label: new Date(d.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
    }));

  const hasChartData = chartData.some((d) => d.revenue > 0);

  // Calculate percentage splits
  const totalAll = revenueStats.membershipRevenueTotal + revenueStats.courseRevenueTotal + revenueStats.toolCreditsRevenueTotal;
  const membershipPct = totalAll > 0 ? Math.round((revenueStats.membershipRevenueTotal / totalAll) * 100) : 0;
  const coursePct = totalAll > 0 ? Math.round((revenueStats.courseRevenueTotal / totalAll) * 100) : 0;
  const toolsPct = totalAll > 0 ? Math.max(0, 100 - membershipPct - coursePct) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Laporan Keuangan"
        title={<span className="inline-flex items-center gap-2"><TrendingUp className="text-[#8B1414]" /> Detail Pendapatan</span>}
        description="Analisis performa MRR, ARR, serta breakdown pendapatan membership dan kelas."
      />

      {/* Grid Utama Metric Atas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* MRR Card */}
        <div className="bg-white border border-[rgba(0,0,0,0.07)] shadow-[var(--shadow-card)] rounded-[var(--radius-lg,12px)] p-5 relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-[10px] font-bold tracking-wider text-[#8B1414] uppercase">Monthly Recurring Revenue</p>
              <h2 className="text-2xl font-black text-[#8B1414] mt-1">MRR</h2>
            </div>
            <div className="p-2.5 bg-white/60 rounded-xl text-[#8B1414]">
              <Calendar size={18} />
            </div>
          </div>
          <p className="text-xl font-bold text-[#8B1414]">{formatRupiah(revenueStats.mrr)}</p>
          <p className="text-xs text-[#8B1414]/70 mt-2">Dihitung dari langganan aktif bulanan saat ini.</p>
        </div>

        {/* ARR Card */}
        <div className="bg-white border border-[rgba(0,0,0,0.07)] shadow-[var(--shadow-card)] rounded-[var(--radius-lg,12px)] p-5 relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-[10px] font-bold tracking-wider text-[#2563EB] uppercase">Annual Recurring Revenue</p>
              <h2 className="text-2xl font-black text-[#2563EB] mt-1">ARR</h2>
            </div>
            <div className="p-2.5 bg-[#EFF6FF] rounded-xl text-[#2563EB]">
              <TrendingUp size={18} />
            </div>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatRupiah(revenueStats.arr)}</p>
          <p className="text-xs text-gray-400 mt-2">Proyeksi tahunan berdasarkan basis MRR saat ini.</p>
        </div>

        {/* Total Revenue */}
        <div className="bg-white border border-[rgba(0,0,0,0.07)] shadow-[var(--shadow-card)] rounded-[var(--radius-lg,12px)] p-5 relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Lifetime Revenue</p>
              <h2 className="text-2xl font-black text-gray-900 mt-1">All-Time</h2>
            </div>
            <div className="p-2.5 bg-gray-50 rounded-xl text-gray-400">
              <DollarSign size={18} />
            </div>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatRupiah(stats.totalRevenue)}</p>
          <p className="text-xs text-gray-400 mt-2">Total seluruh transaksi berhasil (paid).</p>
        </div>

        {/* Monthly Revenue */}
        <div className="bg-white border border-[rgba(0,0,0,0.07)] shadow-[var(--shadow-card)] rounded-[var(--radius-lg,12px)] p-5 relative overflow-hidden">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Revenue Bulan Ini</p>
              <h2 className="text-2xl font-black text-gray-900 mt-1">Bulan Ini</h2>
            </div>
            <div className="p-2.5 bg-gray-50 rounded-xl text-gray-400">
              <ArrowUpRight size={18} />
            </div>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatRupiah(revenueStats.totalRevenueThisMonth)}</p>
          <p className="text-xs text-gray-400 mt-2">Total omset yang terkumpul di bulan berjalan.</p>
        </div>
      </div>

      {/* Stacked Area Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Grafik Tren Pendapatan</CardTitle>
          <CardToolbar>
            <div className="flex items-center bg-gray-100 rounded-full p-0.5 gap-0.5">
              {[
                { label: "7 Hari", value: "7" },
                { label: "30 Hari", value: "30" },
                { label: "90 Hari", value: "90" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setChartPeriod(opt.value)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 ${
                    chartPeriod === opt.value
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
          {loading ? (
            <div className="skeleton h-80 rounded-xl animate-pulse" />
          ) : !hasChartData ? (
            <EmptyState
              title="Belum ada data grafik"
              description="Grafik transaksi akan muncul setelah ada data penjualan masuk."
              size="sm"
              className="py-12"
            />
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="chartMembership" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B1414" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#8B1414" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="chartCourse" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="chartTools" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  tickLine={false}
                  axisLine={false}
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
                  wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
                  formatter={(value) => (value === "membership" ? "Membership" : value === "toolCredits" ? "Tools" : "Kelas")}
                />
                <Area
                  type="monotone"
                  dataKey="membership"
                  stackId="1"
                  stroke="#8B1414"
                  strokeWidth={2.5}
                  fill="url(#chartMembership)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#8B1414", strokeWidth: 0 }}
                />
                <Area
                  type="monotone"
                  dataKey="course"
                  stackId="1"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  fill="url(#chartCourse)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#2563EB", strokeWidth: 0 }}
                />
                <Area
                  type="monotone"
                  dataKey="toolCredits"
                  stackId="1"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  fill="url(#chartTools)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#2563EB", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Segment Breakdown & Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Billing Split Proportion */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Proporsi Sumber Pendapatan</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col justify-between h-full min-h-[220px]">
            <div>
              <p className="text-xs text-gray-400 mb-4">Pembagian total pendapatan all-time berdasarkan kategori produk:</p>
              
              {/* Custom CSS Split Bar */}
              <div className="h-6 w-full bg-gray-100 rounded-full overflow-hidden flex mb-6">
                <div
                  style={{ width: `${membershipPct}%` }}
                  className="bg-[#8B1414] h-full flex items-center justify-center text-[10px] font-bold text-white transition-all duration-500"
                  title={`Membership: ${membershipPct}%`}
                >
                  {membershipPct > 15 ? `${membershipPct}%` : ""}
                </div>
                <div
                  style={{ width: `${coursePct}%` }}
                  className="bg-[#2563EB] h-full flex items-center justify-center text-[10px] font-bold text-white transition-all duration-500"
                  title={`Kelas: ${coursePct}%`}
                >
                  {coursePct > 15 ? `${coursePct}%` : ""}
                </div>
                <div
                  style={{ width: `${toolsPct}%` }}
                  className="bg-[#2563EB] h-full flex items-center justify-center text-[10px] font-bold text-white transition-all duration-500"
                  title={`Tools: ${toolsPct}%`}
                >
                  {toolsPct > 15 ? `${toolsPct}%` : ""}
                </div>
              </div>

              {/* Legends with breakdown values */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#8B1414]" />
                    <span className="text-xs font-semibold text-gray-700">Membership</span>
                  </div>
                  <span className="text-xs font-bold text-gray-900">{formatRupiah(revenueStats.membershipRevenueTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#2563EB]" />
                    <span className="text-xs font-semibold text-gray-700">Kelas Satuan</span>
                  </div>
                  <span className="text-xs font-bold text-gray-900">{formatRupiah(revenueStats.courseRevenueTotal)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detailed Breakdown Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Membership Detail */}
          <Card>
            <CardHeader className="bg-[#F7E8E8]/30 border-b border-black/[0.04]">
              <div className="flex items-center gap-2">
                <Star size={16} className="text-[#8B1414]" />
                <CardTitle className="text-[#8B1414] font-bold">Segmen Membership</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div>
                <p className="text-xs text-gray-400">Total Omset Membership</p>
                <p className="text-xl font-bold text-[#8B1414] mt-0.5">{formatRupiah(revenueStats.membershipRevenueTotal)}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-black/[0.04]">
                <div>
                  <p className="text-[10px] uppercase font-semibold text-gray-400">Bulan Ini</p>
                  <p className="text-sm font-bold text-gray-900">{formatRupiah(revenueStats.membershipRevenueThisMonth)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-semibold text-gray-400">Member Baru (Bulan Ini)</p>
                  <p className="text-sm font-bold text-gray-900">+{revenueStats.newMembersThisMonth} member</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Course Detail */}
          <Card>
            <CardHeader className="bg-[#EFF6FF]/40 border-b border-black/[0.04]">
              <div className="flex items-center gap-2">
                <Award size={16} className="text-[#2563EB]" />
                <CardTitle className="text-[#2563EB] font-bold">Segmen Kelas Satuan</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div>
                <p className="text-xs text-gray-400">Total Penjualan Kelas</p>
                <p className="text-xl font-bold text-[#2563EB] mt-0.5">{formatRupiah(revenueStats.courseRevenueTotal)}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-black/[0.04]">
                <div>
                  <p className="text-[10px] uppercase font-semibold text-gray-400">Bulan Ini</p>
                  <p className="text-sm font-bold text-gray-900">{formatRupiah(revenueStats.courseRevenueThisMonth)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-semibold text-gray-400">Total Pendaftaran Kelas</p>
                  <p className="text-sm font-bold text-gray-900">{stats.totalEnrollments} kali</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Disembunyikan untuk PejuangYen (fitur GWA tak dipakai): Segmen AI Tools / kredit.
          <Card>
            <CardHeader className="bg-blue-50/70 border-b border-black/[0.04]">
              <div className="flex items-center gap-2">
                <Wand2 size={16} className="text-[#2563EB]" />
                <CardTitle className="text-[#2563EB] font-bold">Segmen AI Tools</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-5">
              <div>
                <p className="text-xs text-gray-400">Total Penjualan Kredit Tools</p>
                <p className="text-xl font-bold text-[#2563EB] mt-0.5">{formatRupiah(revenueStats.toolCreditsRevenueTotal)}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-black/[0.04]">
                <div>
                  <p className="text-[10px] uppercase font-semibold text-gray-400">Bulan Ini</p>
                  <p className="text-sm font-bold text-gray-900">{formatRupiah(revenueStats.toolCreditsRevenueThisMonth)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-semibold text-gray-400">Halaman Detail</p>
                  <p className="text-sm font-bold text-gray-900">/admin/tools</p>
                </div>
              </div>
            </CardContent>
          </Card>
          */}
        </div>
      </div>

      {/* Transaksi Pendapatan Terbaru */}
      <Card>
        <CardHeader>
          <CardTitle>Log Transaksi Masuk (Paid)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <AdminTable
            columns={[
              { key: "orderId", label: "Nomor Order" },
              { key: "user", label: "Pelanggan" },
              { key: "product_name", label: "Produk" },
              { key: "order_type", label: "Jenis" },
              { key: "amount", label: "Jumlah" },
              { key: "status", label: "Status" },
            ]}
            loading={loading}
            empty={
              <EmptyState
                title="Belum ada transaksi pendapatan"
                description="Transaksi sukses berbayar akan muncul di sini."
                size="sm"
                className="py-12"
              />
            }
          >
            {revenueLog.map((order) => (
              <Tr key={order.orderId}>
                <Td className="font-semibold font-mono text-warm-black">#{order.orderId}</Td>
                <Td className="text-warm-black">{order.user}</Td>
                <Td>
                  <div className="max-w-[200px] truncate font-medium text-warm-black" title={order.product_name}>
                    {order.product_name}
                  </div>
                </Td>
                <Td>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      order.order_type === "membership"
                        ? "bg-[#F7E8E8] text-[#8B1414]"
                        : order.order_type === "tool_credits"
                          ? "bg-blue-50 text-[#2563EB]"
                          : "bg-[#EFF6FF] text-[#2563EB]"
                    }`}
                  >
                    {order.order_type === "membership" ? "Member" : order.order_type === "tool_credits" ? "Tools" : "Kelas"}
                  </span>
                </Td>
                <Td className="font-bold text-warm-black">{formatRupiah(order.amount)}</Td>
                <Td><StatusBadge status={order.status} /></Td>
              </Tr>
            ))}
          </AdminTable>
        </CardContent>
      </Card>
    </div>
  );
}
