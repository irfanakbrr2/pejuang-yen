"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { formatRupiah } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminTable, Tr, Td } from "@/components/ui/AdminTable";
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { CheckCircle2, XCircle, RefreshCw, Wallet, Rocket, Ticket } from "lucide-react";
import { StatCard, SERIES_COLORS } from "./shared";

interface PaymentHealthData {
  method_success: {
    payment_method: string;
    provider: string;
    paid: number;
    failed: number;
    pending: number;
    total: number;
    success_rate: number | null;
  }[];
  retry_recovery: {
    orders_with_retry: number;
    recovered_orders: number;
    recovery_rate: number | null;
  };
  gateway_fee: {
    total_fee: number;
    total_payment: number;
    total_amount: number;
  };
  failed_summary: {
    total_failed: number;
    total_paid: number;
    failed_rate: number | null;
  };
  funnel_offers: {
    upsell: Record<string, number>;
    downsell: Record<string, number>;
    downsell_rescue_rate: number | null;
    expired: number;
    total: number;
  };
  coupon_roi: {
    coupon_code: string;
    redemptions: number;
    discount_total: number;
    revenue: number;
    discount_pct_of_revenue: number | null;
  }[];
}

const formatRate = (r: number | null | undefined) =>
  r == null ? "—" : `${(r * 100).toFixed(1)}%`;
const formatCount = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString("id-ID");

export function PaymentsTab({ days }: { days: string }) {
  const [data, setData] = useState<PaymentHealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api(`/api/admin/analytics/payment-health?days=${days}`)
      .then((res) => {
        if (res.success) setData(res.data as PaymentHealthData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  // KPI: success rate keseluruhan (paid / paid+failed)
  const overallSuccessRate =
    data && data.failed_summary.total_paid + data.failed_summary.total_failed > 0
      ? data.failed_summary.total_paid /
        (data.failed_summary.total_paid + data.failed_summary.total_failed)
      : null;

  // Identifikasi VA/metode dengan kegagalan terbanyak
  const worstMethod = (data?.method_success || [])
    .filter((m) => m.failed > 0)
    .sort((a, b) => b.failed - a.failed)[0];

  // Data chart success rate per metode (top 8 by total)
  const methodChart = (data?.method_success || [])
    .slice()
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)
    .map((m) => ({
      label: m.payment_method,
      paid: m.paid,
      failed: m.failed,
      rate: m.success_rate != null ? Math.round(m.success_rate * 100) : 0,
    }));

  const up = data?.funnel_offers.upsell || {};
  const down = data?.funnel_offers.downsell || {};
  const upTotal =
    (up.offered || 0) + (up.accepted || 0) + (up.declined || 0) +
    (up.converted || 0) + (up.skipped || 0);
  const upConverted = up.converted || 0;
  const upsellTakeRate = upTotal > 0 ? upConverted / upTotal : null;
  const downTotal =
    (down.offered || 0) + (down.accepted || 0) + (down.declined || 0) +
    (down.converted || 0) + (down.skipped || 0);
  const downConverted = down.converted || 0;
  const downsellTakeRate = downTotal > 0 ? downConverted / downTotal : null;

  return (
    <div className="space-y-6">
      {/* Row 1 — KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Success Rate"
          value={formatRate(overallSuccessRate)}
          hint={`Paid / (paid+failed) · ${days} hari`}
          icon={CheckCircle2}
          accent
        />
        <StatCard
          label="Failed Rate"
          value={formatRate(data?.failed_summary.failed_rate)}
          hint={`${formatCount(data?.failed_summary.total_failed)} pembayaran gagal`}
          icon={XCircle}
        />
        <StatCard
          label="Retry Recovery"
          value={formatRate(data?.retry_recovery.recovery_rate)}
          hint={`${formatCount(data?.retry_recovery.recovered_orders)}/${formatCount(data?.retry_recovery.orders_with_retry)} order pulih`}
          icon={RefreshCw}
          accent
        />
        <StatCard
          label="Gateway Fee"
          value={formatRupiah(data?.gateway_fee.total_fee ?? 0)}
          hint="Total fee terkumpul (paid)"
          icon={Wallet}
        />
      </div>

      {/* Row 2 — success rate per metode (chart + insight) */}
      <Card>
        <CardHeader>
          <CardTitle>Kesehatan Metode Pembayaran ({days} hari)</CardTitle>
        </CardHeader>
        <CardContent>
          {methodChart.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">
              {loading ? "Memuat..." : "Belum ada percobaan pembayaran pada periode ini."}
            </p>
          ) : (
            <>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={methodChart} layout="vertical" margin={{ left: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={110} />
                    <Tooltip
                      formatter={(value: any, _name, item: any) => [
                        `${value}% · ${item?.payload?.paid} paid · ${item?.payload?.failed} failed`,
                        "Success rate",
                      ]}
                    />
                    <Bar dataKey="rate" radius={[0, 6, 6, 0]}>
                      {methodChart.map((entry) => (
                        <Cell
                          key={entry.label}
                          fill={entry.rate >= 80 ? "#8B1414" : entry.rate >= 50 ? "#D97706" : "#DC2626"}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {worstMethod && (
                <p className="mt-3 text-[11px] text-gray-500">
                  Kegagalan terbanyak:{" "}
                  <span className="font-semibold text-[#DC2626]">{worstMethod.payment_method}</span>{" "}
                  ({worstMethod.provider}) — {formatCount(worstMethod.failed)} gagal,
                  success rate {formatRate(worstMethod.success_rate)}.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Row 3 — tabel metode + funnel offers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Rincian per Metode</CardTitle></CardHeader>
          <CardContent>
            <AdminTable
              columns={[
                { key: "method", label: "Metode" },
                { key: "paid", label: "Paid" },
                { key: "failed", label: "Failed" },
                { key: "rate", label: "Success Rate" },
              ]}
              loading={loading}
              empty={<p className="text-sm text-gray-400 py-6 text-center">Belum ada data pembayaran.</p>}
            >
              {(data?.method_success || []).map((row) => {
                const ratePct = row.success_rate != null ? Math.round(row.success_rate * 100) : null;
                return (
                  <Tr key={`${row.payment_method}-${row.provider}`}>
                    <Td className="text-xs font-medium">
                      {row.payment_method}
                      <span className="ml-1 text-[10px] text-gray-400">({row.provider})</span>
                    </Td>
                    <Td className="tabular-nums">{formatCount(row.paid)}</Td>
                    <Td className="tabular-nums">{formatCount(row.failed)}</Td>
                    <Td>
                      {ratePct != null ? (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, ratePct)}%`,
                                backgroundColor: ratePct >= 80 ? "#8B1414" : ratePct >= 50 ? "#D97706" : "#DC2626",
                              }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 tabular-nums">{ratePct}%</span>
                        </div>
                      ) : "—"}
                    </Td>
                  </Tr>
                );
              })}
            </AdminTable>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rocket size={16} className="text-[#8B1414]" /> Kedalaman Funnel Offer
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.funnel_offers.total || 0) === 0 ? (
              <p className="text-sm text-gray-400 py-10 text-center">
                {loading ? "Memuat..." : "Belum ada offer funnel pada periode ini."}
              </p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-gray-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Upsell Take</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-gray-900">{formatRate(upsellTakeRate)}</p>
                    <p className="mt-0.5 text-[11px] text-gray-400">{formatCount(upConverted)} dari {formatCount(upTotal)}</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Downsell Take</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-gray-900">{formatRate(downsellTakeRate)}</p>
                    <p className="mt-0.5 text-[11px] text-gray-400">{formatCount(downConverted)} dari {formatCount(downTotal)}</p>
                  </div>
                  <div className="rounded-xl bg-[#8B1414]/10 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#8B1414]">Downsell Rescue</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-[#8B1414]">
                      {formatRate(data?.funnel_offers.downsell_rescue_rate)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-400">downsell converted / upsell declined</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {(["offered", "accepted", "converted", "declined", "skipped"] as const).map((k, i) => (
                    <div key={k} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-gray-600 capitalize">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length] }} />
                        {k}
                      </span>
                      <span className="tabular-nums text-gray-700">
                        <span className="font-semibold">{formatCount(up[k])}</span> upsell ·{" "}
                        <span className="font-semibold">{formatCount(down[k])}</span> downsell
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400">
                  {formatCount(data?.funnel_offers.total)} sesi offer · {formatCount(data?.funnel_offers.expired)} kedaluwarsa
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 4 — coupon ROI */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket size={16} className="text-[#8B1414]" /> ROI Kupon (paid)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AdminTable
            columns={[
              { key: "code", label: "Kode" },
              { key: "redemptions", label: "Dipakai" },
              { key: "discount", label: "Total Diskon" },
              { key: "revenue", label: "Revenue", className: "text-right" },
              { key: "pct", label: "Diskon % Revenue", className: "text-right" },
            ]}
            loading={loading}
            empty={<p className="text-sm text-gray-400 py-6 text-center">Belum ada kupon terpakai pada periode ini.</p>}
          >
            {(data?.coupon_roi || []).map((row) => (
              <Tr key={row.coupon_code}>
                <Td className="font-mono font-semibold text-sm">{row.coupon_code}</Td>
                <Td className="tabular-nums">{formatCount(row.redemptions)}</Td>
                <Td className="tabular-nums">{formatRupiah(row.discount_total)}</Td>
                <Td className="text-right font-semibold tabular-nums">{formatRupiah(row.revenue)}</Td>
                <Td className="text-right tabular-nums text-gray-500">{formatRate(row.discount_pct_of_revenue)}</Td>
              </Tr>
            ))}
          </AdminTable>
        </CardContent>
      </Card>
    </div>
  );
}
