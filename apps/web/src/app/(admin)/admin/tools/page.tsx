"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { formatRupiah, formatDate } from "@/lib/utils";
import { AdminTable, Tr, Td, StatusBadge } from "@/components/ui/AdminTable";
import { EmptyState } from "@/components/ui/lottie/EmptyState";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Wand2, Zap, TrendingUp, ShoppingCart, ArrowUpRight } from "lucide-react";

interface ToolsStats {
  revenue_this_month: number;
  revenue_last_month: number;
  total_credits_sold: number;
  total_credits_used: number;
  total_orders: number;
  top_tools: { tool_name: string; uses: number; credits: number }[];
  recent_orders: any[];
  daily_revenue: { date: string; revenue: number; orders: number }[];
}

function pctChange(curr: number, prev: number) {
  if (!prev) return null;
  const pct = ((curr - prev) / prev) * 100;
  return { pct: Math.abs(pct).toFixed(1), up: pct >= 0 };
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 text-white text-xs rounded-xl px-3 py-2.5 shadow-xl min-w-[140px]">
      <p className="text-white/50 mb-2 text-[11px]">{label}</p>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-violet-400 inline-block" />
          Revenue
        </span>
        <span className="font-semibold">{formatRupiah(payload[0]?.value || 0)}</span>
      </div>
    </div>
  );
}

const TOOL_NAME_MAP: Record<string, string> = {
  web_prompt_generator: "Web Prompt Generator",
};

export default function AdminToolsPage() {
  const [data, setData] = useState<ToolsStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<ToolsStats>("/api/admin/tools/stats", { cacheTtl: 0 })
      .then((res) => { if (res.success && res.data) setData(res.data); })
      .catch(() => { /* stats gracefully degrade to empty state */ })
      .finally(() => setLoading(false));
  }, []);

  const change = data ? pctChange(data.revenue_this_month, data.revenue_last_month) : null;

  const kpis = [
    {
      label: "Revenue Tools Bulan Ini",
      value: loading ? "—" : formatRupiah(data?.revenue_this_month || 0),
      icon: TrendingUp,
      color: "text-blue-600",
      bg: "bg-blue-50",
      change,
    },
    {
      label: "Total Kredit Terjual",
      value: loading ? "—" : String(data?.total_credits_sold || 0),
      icon: Zap,
      color: "text-green-600",
      bg: "bg-green-50",
      change: null,
    },
    {
      label: "Total Kredit Terpakai",
      value: loading ? "—" : String(data?.total_credits_used || 0),
      icon: Wand2,
      color: "text-orange-600",
      bg: "bg-orange-50",
      change: null,
    },
    {
      label: "Total Orders (Paid)",
      value: loading ? "—" : String(data?.total_orders || 0),
      icon: ShoppingCart,
      color: "text-violet-600",
      bg: "bg-violet-50",
      change: null,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Subset dari total revenue"
        title="Revenue AI Tools"
        description="Detail khusus penjualan kredit dan penggunaan AI Tools. Angka ini sudah ikut dihitung di /admin/revenue."
      />

      {/* KPIs */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="flex items-center gap-3 rounded-2xl border bg-white px-5 py-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${k.bg}`}>
              <k.icon className={`h-5 w-5 ${k.color}`} />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{k.value}</p>
              <p className="text-xs text-gray-500">{k.label}</p>
              {k.change && (
                <p className={`mt-0.5 flex items-center gap-0.5 text-xs font-medium ${k.change.up ? "text-green-600" : "text-red-500"}`}>
                  <ArrowUpRight className={`h-3 w-3 ${k.change.up ? "" : "rotate-90"}`} />
                  {k.change.pct}% vs bulan lalu
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 rounded-2xl border bg-white p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Revenue Kredit Tools (30 Hari)</h3>
              <p className="mt-0.5 text-xs text-gray-400">Hanya order bertipe tool_credits yang sudah paid.</p>
            </div>
          </div>
          {data?.daily_revenue?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.daily_revenue} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevTools" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.16} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2} fill="url(#colorRevTools)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[220px] items-center justify-center text-sm text-gray-400">Belum ada data</div>
          )}
        </div>

        {/* Top Tools */}
        <div className="rounded-2xl border bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold text-gray-800">Top Tools</h3>
          {data?.top_tools?.length ? (
            <div className="flex flex-col gap-3">
              {data.top_tools.map((t) => (
                <div key={t.tool_name} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50">
                      <Wand2 className="h-3.5 w-3.5 text-violet-500" />
                    </div>
                    <span className="text-xs font-medium text-gray-700">
                      {TOOL_NAME_MAP[t.tool_name] || t.tool_name}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-gray-800">{t.uses}x</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Belum ada data</p>
          )}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="mt-6 rounded-2xl border bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold text-gray-800">Order Kredit Terbaru</h3>
        {!data?.recent_orders?.length ? (
          <EmptyState title="Belum ada order" />
        ) : (
          <AdminTable columns={[
            { key: "order_number", label: "Order #" },
            { key: "user", label: "User" },
            { key: "paket", label: "Paket" },
            { key: "credits", label: "Kredit" },
            { key: "total", label: "Total" },
            { key: "status", label: "Status" },
            { key: "tanggal", label: "Tanggal" },
          ]}>
            {data.recent_orders.map((o: any) => (
              <Tr key={o.id}>
                <Td><span className="font-mono text-xs">{o.order_number}</span></Td>
                <Td>
                  <div>
                    <p className="text-xs font-medium text-gray-800">{o.user_name}</p>
                    <p className="text-[11px] text-gray-400">{o.user_email}</p>
                  </div>
                </Td>
                <Td>{o.package_name || "—"}</Td>
                <Td>{o.package_credits ?? "—"}</Td>
                <Td>{formatRupiah(o.amount)}</Td>
                <Td><StatusBadge status={o.status} /></Td>
                <Td>{formatDate(o.created_at)}</Td>
              </Tr>
            ))}
          </AdminTable>
        )}
      </div>
    </>
  );
}
