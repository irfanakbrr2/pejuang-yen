"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { formatRupiah } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminTable, Tr, Td } from "@/components/ui/AdminTable";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Users, MousePointerClick, Target, Percent, DollarSign, Wallet } from "lucide-react";
import { StatCard, SERIES_COLORS } from "./shared";

interface PipelineEntry {
  status: string;
  count: number;
  amount: number;
}

interface TopAffiliate {
  affiliate_code: string;
  name: string | null;
  clicks: number;
  conversions: number;
  attributed_revenue: number;
  commission_amount: number;
  conversion_rate: number;
}

interface AffiliateData {
  summary: {
    total_affiliates: number;
    active_affiliates: number;
    total_clicks: number;
    total_conversions: number;
    conversion_rate: number;
    attributed_revenue: number;
    commission_total: number;
  };
  commission_pipeline: PipelineEntry[];
  top_affiliates: TopAffiliate[];
}

// Warna konsisten per status pipeline komisi
const STATUS_COLORS: Record<string, string> = {
  pending: "#D97706",
  approved: "#2563EB",
  paid: "#8B1414",
  rejected: "#DC2626",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  paid: "Paid",
  rejected: "Rejected",
};

const fmtCount = (n: number | null | undefined) => (n ?? 0).toLocaleString("id-ID");
const fmtRate = (r: number | null | undefined) => `${((r ?? 0) * 100).toFixed(1)}%`;

export function AffiliateTab({ days }: { days: string }) {
  const [data, setData] = useState<AffiliateData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api(`/api/admin/analytics/affiliates?days=${days}`)
      .then((res) => {
        if (res.success) setData(res.data as AffiliateData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  const s = data?.summary;
  const pipeline = data?.commission_pipeline ?? [];
  const topAffiliates = data?.top_affiliates ?? [];

  // Liabilitas (komisi terutang) = pending + approved
  const owed = pipeline
    .filter((p) => p.status === "pending" || p.status === "approved")
    .reduce((acc, p) => acc + (p.amount ?? 0), 0);

  // Donut hanya menampilkan status dengan count > 0
  const donutData = pipeline.filter((p) => (p.count ?? 0) > 0);

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="Affiliate Aktif"
          value={s ? fmtCount(s.active_affiliates) : "—"}
          hint={`dari ${fmtCount(s?.total_affiliates)} terdaftar`}
          icon={Users}
          accent
        />
        <StatCard
          label="Total Klik"
          value={s ? fmtCount(s.total_clicks) : "—"}
          hint={`Klik referral ${days} hari`}
          icon={MousePointerClick}
        />
        <StatCard
          label="Konversi"
          value={s ? fmtCount(s.total_conversions) : "—"}
          hint={`Order beratribusi ${days} hari`}
          icon={Target}
        />
        <StatCard
          label="Conversion Rate"
          value={s ? fmtRate(s.conversion_rate) : "—"}
          hint="Konversi / klik"
          icon={Percent}
        />
        <StatCard
          label="Attributed Revenue"
          value={formatRupiah(s?.attributed_revenue || 0)}
          hint={`Order paid beratribusi ${days} hari`}
          icon={DollarSign}
        />
        <StatCard
          label="Komisi Terutang"
          value={formatRupiah(owed)}
          hint="Pending + approved"
          icon={Wallet}
          accent
        />
      </div>

      {/* Commission pipeline */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Komisi</CardTitle>
        </CardHeader>
        <CardContent>
          {donutData.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">
              {loading ? "Memuat..." : "Belum ada komisi affiliate."}
            </p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} dataKey="amount" nameKey="status" innerRadius={56} outerRadius={84} paddingAngle={2}>
                      {donutData.map((entry) => (
                        <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || "#9CA3AF"} />
                      ))}
                    </Pie>
                    <Tooltip
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(value: any, _name: any, item: any) => [
                        `${fmtCount(item?.payload?.count)} komisi · ${formatRupiah(value || 0)}`,
                        STATUS_LABELS[item?.payload?.status ?? ""] || item?.payload?.status,
                      ]}
                    />
                    <Legend
                      layout="vertical"
                      align="right"
                      verticalAlign="middle"
                      wrapperStyle={{ fontSize: 11 }}
                      formatter={(value: string) => STATUS_LABELS[value] || value}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="divide-y divide-gray-100">
                {pipeline.map((p) => (
                  <li key={p.status} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="inline-flex items-center gap-2 text-gray-700">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full"
                        style={{ background: STATUS_COLORS[p.status] || "#9CA3AF" }}
                      />
                      {STATUS_LABELS[p.status] || p.status}
                      <span className="text-xs text-gray-400">({fmtCount(p.count)})</span>
                    </span>
                    <span className="font-semibold text-gray-900 tabular-nums">{formatRupiah(p.amount || 0)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top affiliates */}
      <Card>
        <CardHeader>
          <CardTitle>Top Affiliate</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminTable
            columns={[
              { key: "code", label: "Affiliate" },
              { key: "clicks", label: "Klik" },
              { key: "conversions", label: "Konversi" },
              { key: "revenue", label: "Revenue" },
              { key: "commission", label: "Komisi" },
              { key: "rate", label: "Conv Rate", className: "text-right" },
            ]}
            loading={loading}
            empty={<p className="text-sm text-gray-400 py-6 text-center">Belum ada data affiliate.</p>}
          >
            {topAffiliates.map((row, i) => (
              <Tr key={`${row.affiliate_code}-${i}`}>
                <Td>
                  <p className="font-medium text-gray-900">{row.name || row.affiliate_code}</p>
                  <p className="text-xs text-gray-400 font-mono">{row.affiliate_code}</p>
                </Td>
                <Td>{fmtCount(row.clicks)}</Td>
                <Td>{fmtCount(row.conversions)}</Td>
                <Td>{formatRupiah(row.attributed_revenue || 0)}</Td>
                <Td className="font-medium text-[#8B1414]">{formatRupiah(row.commission_amount || 0)}</Td>
                <Td className="text-right font-semibold">{fmtRate(row.conversion_rate)}</Td>
              </Tr>
            ))}
          </AdminTable>
        </CardContent>
      </Card>
    </div>
  );
}
