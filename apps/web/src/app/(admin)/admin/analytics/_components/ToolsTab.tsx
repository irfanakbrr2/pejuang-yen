"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { formatRupiah } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminTable, Tr, Td } from "@/components/ui/AdminTable";
import {
  AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Sparkles, Wrench, Coins, Wallet, Users, CheckCircle2 } from "lucide-react";
import { StatCard, SERIES_COLORS } from "./shared";

interface ToolsEconomyData {
  summary: {
    credits_purchased: number;
    credits_used: number;
    revenue_from_credits: number;
    outstanding_balance: number;
    active_users: number;
  };
  usage_trend: { day: string; credits_used: number }[];
  top_tools: {
    tool_name: string;
    uses: number;
    credits_used: number;
    success: number;
    failed: number;
    success_rate: number;
  }[];
  success_breakdown: { status: string; count: number }[];
}

const fmt = (n: number | undefined | null) => (n ?? 0).toLocaleString("id-ID");
const pct = (n: number | undefined | null) => `${Math.round(((n ?? 0) + Number.EPSILON) * 10) / 10}%`;

const STATUS_LABELS: Record<string, string> = {
  success: "Berhasil",
  failed: "Gagal",
  refunded: "Dikembalikan",
};
const STATUS_COLORS: Record<string, string> = {
  success: "#8B1414",
  failed: "#DC2626",
  refunded: "#D97706",
};

export function ToolsTab({ days }: { days: string }) {
  const [data, setData] = useState<ToolsEconomyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api(`/api/admin/analytics/tools-economy?days=${days}`)
      .then((res) => { if (res.success) setData(res.data as ToolsEconomyData); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  const s = data?.summary;

  // Overall success rate from breakdown (success / non-refunded executions)
  const breakdown = data?.success_breakdown || [];
  const cnt = (status: string) => breakdown.find((b) => b.status === status)?.count ?? 0;
  const successC = cnt("success");
  const failedC = cnt("failed");
  const refundedC = cnt("refunded");
  const totalRuns = successC + failedC;
  const overallSuccessRate = totalRuns > 0 ? (successC / totalRuns) * 100 : null;

  const trend = (data?.usage_trend || []).map((r) => ({
    label: new Date(r.day).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
    credits_used: Number(r.credits_used) || 0,
  }));

  const donutData = [
    { name: STATUS_LABELS.success, status: "success", value: successC },
    { name: STATUS_LABELS.failed, status: "failed", value: failedC },
    { name: STATUS_LABELS.refunded, status: "refunded", value: refundedC },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Kredit Terjual" value={fmt(s?.credits_purchased)} hint={`Dibeli ${days} hari`} icon={Sparkles} accent />
        <StatCard label="Kredit Terpakai" value={fmt(s?.credits_used)} hint={`Dipakai ${days} hari`} icon={Coins} />
        <StatCard label="Revenue Kredit" value={formatRupiah(s?.revenue_from_credits || 0)} hint={`Penjualan ${days} hari`} icon={Wallet} accent />
        <StatCard label="Saldo Terutang" value={fmt(s?.outstanding_balance)} hint="Liability (semua user)" icon={Wallet} />
        <StatCard label="User Aktif Tools" value={fmt(s?.active_users)} hint={`Pakai tools ${days} hari`} icon={Users} />
      </div>

      {/* Success rate banner */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          label="Success Rate"
          value={overallSuccessRate === null ? "—" : pct(overallSuccessRate)}
          hint={`${fmt(successC)} berhasil / ${fmt(totalRuns)} eksekusi`}
          icon={CheckCircle2}
          accent
        />
      </div>

      {/* Usage trend */}
      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <Coins size={16} className="text-[#8B1414]" /> Kredit Terpakai Harian
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trend.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">
              {loading ? "Memuat data..." : "Belum ada pemakaian kredit pada periode ini."}
            </p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="tools-credits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B1414" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#8B1414" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="credits_used" name="Kredit Terpakai" stroke="#8B1414" fill="url(#tools-credits)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top tools */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <Wrench size={16} className="text-[#8B1414]" /> Tools Terpopuler
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AdminTable
              columns={[
                { key: "tool", label: "Tool" },
                { key: "uses", label: "Pemakaian" },
                { key: "credits", label: "Kredit" },
                { key: "success_rate", label: "Success Rate" },
              ]}
              loading={loading}
              empty={<p className="text-sm text-gray-400 py-6 text-center">Belum ada pemakaian tools pada periode ini.</p>}
            >
              {(data?.top_tools || []).map((row, i) => (
                <Tr key={`${row.tool_name}-${i}`}>
                  <Td className="font-medium max-w-[200px] truncate">{row.tool_name || "(tanpa nama)"}</Td>
                  <Td>{fmt(row.uses)}</Td>
                  <Td>{fmt(row.credits_used)}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-[60px] h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#8B1414]"
                          style={{ width: `${Math.min(100, Math.max(0, row.success_rate || 0))}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-700 tabular-nums whitespace-nowrap">{pct(row.success_rate)}</span>
                    </div>
                  </Td>
                </Tr>
              ))}
            </AdminTable>
          </CardContent>
        </Card>

        {/* Success / failed donut */}
        <Card>
          <CardHeader><CardTitle>Status Eksekusi</CardTitle></CardHeader>
          <CardContent>
            {donutData.length === 0 ? (
              <p className="text-sm text-gray-400 py-10 text-center">{loading ? "Memuat..." : "Belum ada eksekusi pada periode ini."}</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>
                      {donutData.map((entry, i) => (
                        <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || SERIES_COLORS[i % SERIES_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${fmt(Number(value))} eksekusi`, name]} />
                    <Legend layout="vertical" align="center" verticalAlign="bottom" wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
