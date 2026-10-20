"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { formatRupiah } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminTable, Tr, Td } from "@/components/ui/AdminTable";
import {
  BarChart, Bar, Cell, LineChart, Line, PieChart, Pie, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { ShoppingCart, CheckCircle2, Percent, Wallet, Rocket, TrendingUp } from "lucide-react";
import { StatCard, SourceList, SERIES_COLORS } from "./shared";

interface CommerceData {
  funnel: { checkout_intent: number; checkout_started: number; payment_success: number; conversion_rate: number | null };
  order_status: { status: string; count: number; amount: number }[];
  payment_methods: { payment_method: string; payment_provider: string; count: number; revenue: number }[];
  funnel_performance: {
    funnel_id: string; funnel_name: string; step_type: string;
    viewed: number; accepted: number; declined: number; converted: number;
    accept_rate: number | null; convert_rate: number | null; revenue: number;
  }[];
  top_coupons: { coupon_code: string; redemptions: number; discount_total: number; revenue: number }[];
  aov_by_type: { order_type: string; orders: number; revenue: number; aov: number }[];
  aov_trend: { day: string; orders: number; revenue: number; aov: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  paid: "#8B1414",
  pending: "#D97706",
  expired: "#6B7280",
  cancelled: "#9CA3AF",
  failed: "#DC2626",
};

const STEP_LABEL: Record<string, string> = {
  order_bump: "Bump",
  upsell: "Upsell",
  downsell: "Downsell",
};

export function CommerceTab({ days }: { days: string }) {
  const [data, setData] = useState<CommerceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api(`/api/admin/analytics/commerce?days=${days}`)
      .then((res) => {
        if (res.success) setData(res.data as CommerceData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  const paidOrders = data?.order_status.find((s) => s.status === "paid");
  const totalRevenue = data?.aov_by_type.reduce((s, t) => s + t.revenue, 0) || 0;
  const totalOrders = data?.aov_by_type.reduce((s, t) => s + t.orders, 0) || 0;
  const overallAov = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
  const funnelRevenue = data?.funnel_performance.reduce((s, f) => s + f.revenue, 0) || 0;
  const conversionLabel = data?.funnel.conversion_rate != null
    ? `${Math.round(data.funnel.conversion_rate * 100)}%`
    : "—";

  // Donut metode pembayaran: top 6 + "Lainnya"
  const methodTotals = new Map<string, { count: number; revenue: number }>();
  for (const row of data?.payment_methods || []) {
    const entry = methodTotals.get(row.payment_method) || { count: 0, revenue: 0 };
    entry.count += Number(row.count);
    entry.revenue += Number(row.revenue);
    methodTotals.set(row.payment_method, entry);
  }
  const methodList = [...methodTotals.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
  const donutData = methodList.slice(0, 6).map(([name, v]) => ({ name, ...v }));
  const others = methodList.slice(6);
  if (others.length > 0) {
    donutData.push({
      name: "Lainnya",
      count: others.reduce((s, [, v]) => s + v.count, 0),
      revenue: others.reduce((s, [, v]) => s + v.revenue, 0),
    });
  }

  // Per provider (gateway pembayaran)
  const providerTotals = new Map<string, { count: number; revenue: number }>();
  for (const row of data?.payment_methods || []) {
    const entry = providerTotals.get(row.payment_provider) || { count: 0, revenue: 0 };
    entry.count += Number(row.count);
    entry.revenue += Number(row.revenue);
    providerTotals.set(row.payment_provider, entry);
  }

  const aovTrendData = (data?.aov_trend || []).map((row) => ({
    ...row,
    label: new Date(row.day).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
  }));

  return (
    <div className="space-y-6">
      {/* Row 1 — KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Checkout Started" value={String(data?.funnel.checkout_started ?? "—")} hint={`Mulai checkout ${days} hari`} icon={ShoppingCart} />
        <StatCard label="Payment Success" value={String(data?.funnel.payment_success ?? "—")} hint="Pembayaran berhasil" icon={CheckCircle2} />
        <StatCard label="Conversion" value={conversionLabel} hint="Success / started" icon={Percent} accent />
        <StatCard label="Paid Orders" value={String(paidOrders?.count ?? "—")} hint={`Order dibuat ${days} hari → paid`} icon={Wallet} />
        <StatCard label="AOV" value={formatRupiah(overallAov)} hint="Rata-rata nilai order" icon={TrendingUp} accent />
        <StatCard label="Funnel Revenue" value={formatRupiah(funnelRevenue)} hint="Bump / upsell / downsell" icon={Rocket} />
      </div>

      {/* Row 2 — status order + metode pembayaran */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Status Order ({days} hari)</CardTitle></CardHeader>
          <CardContent>
            {(data?.order_status.length || 0) === 0 ? (
              <p className="text-sm text-gray-400 py-10 text-center">{loading ? "Memuat..." : "Belum ada order pada periode ini."}</p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data!.order_status} layout="vertical" margin={{ left: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="status" tick={{ fontSize: 11 }} width={70} />
                    <Tooltip
                      formatter={(value: any, _name, item: any) => [
                        `${value} order · ${formatRupiah(item?.payload?.amount || 0)}`,
                        item?.payload?.status,
                      ]}
                    />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                      {data!.order_status.map((entry) => (
                        <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || "#9CA3AF"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Metode Pembayaran (paid)</CardTitle></CardHeader>
          <CardContent>
            {donutData.length === 0 ? (
              <p className="text-sm text-gray-400 py-10 text-center">{loading ? "Memuat..." : "Belum ada order paid pada periode ini."}</p>
            ) : (
              <>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donutData} dataKey="count" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2}>
                        {donutData.map((entry, i) => (
                          <Cell key={entry.name} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any, name, item: any) => [`${value} order · ${formatRupiah(item?.payload?.revenue || 0)}`, name]} />
                      <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-1 mb-2 text-[11px] text-gray-400">Per gateway — order lama tanpa gateway tercatat tampil sebagai (unknown):</p>
                <SourceList
                  rows={[...providerTotals.entries()].map(([name, v]) => ({
                    label: name,
                    value: `${v.count} · ${formatRupiah(v.revenue)}`,
                  }))}
                  loading={loading}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3 — tren AOV + AOV per tipe */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Tren AOV Harian</CardTitle></CardHeader>
          <CardContent>
            {aovTrendData.length === 0 ? (
              <p className="text-sm text-gray-400 py-10 text-center">{loading ? "Memuat..." : "Belum ada order paid pada periode ini."}</p>
            ) : (
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={aovTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}rb`} />
                    <Tooltip
                      formatter={(value: any, _name, item: any) => [
                        `${formatRupiah(Number(value))} · ${item?.payload?.orders} order · total ${formatRupiah(item?.payload?.revenue || 0)}`,
                        "AOV",
                      ]}
                    />
                    <Line type="monotone" dataKey="aov" name="AOV" stroke="#8B1414" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>AOV per Tipe Order</CardTitle></CardHeader>
          <CardContent>
            <AdminTable
              columns={[
                { key: "type", label: "Tipe" },
                { key: "orders", label: "Orders" },
                { key: "aov", label: "AOV", className: "text-right" },
              ]}
              loading={loading}
              empty={<p className="text-sm text-gray-400 py-6 text-center">Belum ada data.</p>}
            >
              {(data?.aov_by_type || []).map((row) => (
                <Tr key={row.order_type}>
                  <Td className="text-xs font-medium">{row.order_type}</Td>
                  <Td>{row.orders}</Td>
                  <Td className="text-right font-semibold">{formatRupiah(row.aov)}</Td>
                </Tr>
              ))}
            </AdminTable>
          </CardContent>
        </Card>
      </div>

      {/* Row 4 — funnel performance */}
      <Card>
        <CardHeader><CardTitle>Performa Sales Funnel (bump / upsell / downsell)</CardTitle></CardHeader>
        <CardContent>
          <AdminTable
            columns={[
              { key: "funnel", label: "Funnel" },
              { key: "step", label: "Step" },
              { key: "viewed", label: "Dilihat" },
              { key: "accepted", label: "Diterima" },
              { key: "converted", label: "Terbayar" },
              { key: "rate", label: "Accept Rate" },
              { key: "revenue", label: "Revenue", className: "text-right" },
            ]}
            loading={loading}
            empty={<p className="text-sm text-gray-400 py-6 text-center">Belum ada event funnel. Data muncul setelah funnel aktif menerima traffic.</p>}
          >
            {(data?.funnel_performance || []).map((row) => {
              const ratePct = row.accept_rate != null ? Math.round(row.accept_rate * 100) : null;
              return (
                <Tr key={`${row.funnel_id}-${row.step_type}`}>
                  <Td className="font-medium max-w-[200px] truncate">{row.funnel_name}</Td>
                  <Td>
                    <span className="inline-flex text-[10px] font-bold bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 uppercase">
                      {STEP_LABEL[row.step_type] || row.step_type}
                    </span>
                  </Td>
                  <Td>{row.viewed}</Td>
                  <Td>{row.accepted}</Td>
                  <Td>{row.converted}</Td>
                  <Td>
                    {ratePct != null ? (
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#8B1414] rounded-full" style={{ width: `${Math.min(100, ratePct)}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 tabular-nums">{ratePct}%</span>
                      </div>
                    ) : "—"}
                  </Td>
                  <Td className="text-right font-semibold">{formatRupiah(row.revenue)}</Td>
                </Tr>
              );
            })}
          </AdminTable>
        </CardContent>
      </Card>

      {/* Row 5 — top kupon */}
      <Card>
        <CardHeader><CardTitle>Top Kupon (paid)</CardTitle></CardHeader>
        <CardContent>
          <AdminTable
            columns={[
              { key: "code", label: "Kode" },
              { key: "redemptions", label: "Dipakai" },
              { key: "discount", label: "Total Diskon" },
              { key: "revenue", label: "Revenue", className: "text-right" },
            ]}
            loading={loading}
            empty={<p className="text-sm text-gray-400 py-6 text-center">Belum ada kupon terpakai pada periode ini.</p>}
          >
            {(data?.top_coupons || []).map((row) => (
              <Tr key={row.coupon_code}>
                <Td className="font-mono font-semibold text-sm">{row.coupon_code}</Td>
                <Td>{row.redemptions}</Td>
                <Td>{formatRupiah(row.discount_total)}</Td>
                <Td className="text-right font-semibold">{formatRupiah(row.revenue)}</Td>
              </Tr>
            ))}
          </AdminTable>
        </CardContent>
      </Card>
    </div>
  );
}
