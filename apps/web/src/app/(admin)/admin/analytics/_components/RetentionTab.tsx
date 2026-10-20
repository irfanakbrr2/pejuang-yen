"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminTable, Tr, Td } from "@/components/ui/AdminTable";
import {
  BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from "recharts";
import { Users, UserMinus, Activity, Timer, Repeat } from "lucide-react";
import { StatCard } from "./shared";

interface CohortRow {
  cohort: string;
  size: number;
  retained: { month_offset: number; active_users: number; pct: number }[];
}
interface MovementRow {
  month: string;
  new: number;
  churned: number;
  active_end: number;
  churn_rate: number | null;
}
interface ConvertBucket {
  bucket: string;
  count: number;
}
interface RetentionData {
  cohorts: CohortRow[];
  membership_movement: MovementRow[];
  time_to_convert: { buckets: ConvertBucket[]; median_days: number | null };
}

const fmt = (n: number | undefined | null) => (n ?? 0).toLocaleString("id-ID");
const pct = (p: number | undefined | null) => `${(p ?? 0).toFixed(0)}%`;
const PRIMARY = "#8B1414";

// Background opacity scaled to retention pct (0..100) — heatmap cell shade.
function heatStyle(p: number): React.CSSProperties {
  const opacity = Math.max(0, Math.min(1, p / 100)) * 0.85 + 0.04;
  const text = p >= 55 ? "#ffffff" : "#1f2937";
  return { backgroundColor: `rgba(139, 20, 20, ${opacity.toFixed(3)})`, color: text };
}

export function RetentionTab({ days }: { days: string }) {
  // days reserved — retensi berbasis bulan (cohort/movement), tidak memakai rentang harian.
  void days;

  const [data, setData] = useState<RetentionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api(`/api/admin/analytics/retention`)
      .then((res) => { if (res.success) setData(res.data as RetentionData); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const cohorts = data?.cohorts || [];
  const maxOffset = cohorts.reduce(
    (m, c) => Math.max(m, ...c.retained.map((r) => r.month_offset), 0),
    0,
  );
  const offsets = Array.from({ length: maxOffset + 1 }, (_, i) => i);

  const movement = data?.membership_movement || [];
  const movementChart = movement.map((m) => ({
    label: m.month,
    new: Number(m.new) || 0,
    churned: Number(m.churned) || 0,
    churn_rate: m.churn_rate == null ? null : Number((m.churn_rate * 100).toFixed(1)),
  }));
  const totalNew = movement.reduce((s, m) => s + (Number(m.new) || 0), 0);
  const totalChurned = movement.reduce((s, m) => s + (Number(m.churned) || 0), 0);
  const latestActive = movement.length ? Number(movement[movement.length - 1].active_end) || 0 : 0;
  const latestChurnRate = movement.length ? movement[movement.length - 1].churn_rate : null;

  const buckets = data?.time_to_convert.buckets || [];
  const medianDays = data?.time_to_convert.median_days ?? null;
  const convertChart = buckets.map((b) => ({ label: b.bucket, count: Number(b.count) || 0 }));

  return (
    <div className="space-y-6">
      {/* KPI ringkas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Member Aktif" value={fmt(latestActive)} hint="Akhir bulan terakhir" icon={Users} accent />
        <StatCard label="Member Baru (12 bln)" value={fmt(totalNew)} hint="Total membership baru" icon={Repeat} />
        <StatCard label="Churn (12 bln)" value={fmt(totalChurned)} hint="Expired / cancelled" icon={UserMinus} />
        <StatCard
          label="Churn Rate"
          value={latestChurnRate == null ? "—" : pct(latestChurnRate * 100)}
          hint="Bulan terakhir"
          icon={Activity}
        />
      </div>

      {/* Cohort retention heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <Activity size={16} className="text-[#8B1414]" /> Cohort Retention (per bulan signup)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-400 py-10 text-center">Memuat data...</p>
          ) : cohorts.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">
              Belum ada data cohort. Data muncul setelah ada signup dan aktivitas member.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th className="text-left px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
                      Cohort
                    </th>
                    <th className="text-right px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
                      Size
                    </th>
                    {offsets.map((o) => (
                      <th
                        key={o}
                        className="text-center px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280] whitespace-nowrap"
                      >
                        M{o}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((c) => {
                    const byOffset = new Map(c.retained.map((r) => [r.month_offset, r]));
                    return (
                      <tr key={c.cohort}>
                        <td className="px-2 py-1.5 font-medium text-gray-900 whitespace-nowrap">{c.cohort}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-gray-700">{fmt(c.size)}</td>
                        {offsets.map((o) => {
                          const cell = byOffset.get(o);
                          if (!cell) {
                            return <td key={o} className="px-2 py-1.5" />;
                          }
                          return (
                            <td
                              key={o}
                              className="px-2 py-1.5 text-center rounded-md tabular-nums font-medium whitespace-nowrap"
                              style={heatStyle(cell.pct)}
                              title={`${fmt(cell.active_users)} aktif / ${fmt(c.size)} (${pct(cell.pct)})`}
                            >
                              {pct(cell.pct)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="text-[11px] text-gray-400 mt-3">
                Sel = % user cohort yang aktif (ada di user_activity_days) pada bulan kalender ke-M. M0 = bulan signup.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Membership movement: new vs churned + churn rate */}
      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <Repeat size={16} className="text-[#8B1414]" /> Pergerakan Membership (12 bulan)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-400 py-10 text-center">Memuat data...</p>
          ) : movementChart.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">Belum ada data membership.</p>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={movementChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    unit="%"
                    allowDecimals={false}
                  />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="new" name="Member Baru" fill={PRIMARY} radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="left" dataKey="churned" name="Churned" fill="#DC2626" radius={[4, 4, 0, 0]} />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="churn_rate"
                    name="Churn Rate (%)"
                    stroke="#D97706"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Time-to-convert histogram */}
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <Timer size={16} className="text-[#8B1414]" /> Waktu ke Konversi (signup → bayar pertama)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-gray-400 py-10 text-center">Memuat data...</p>
            ) : convertChart.every((b) => b.count === 0) ? (
              <p className="text-sm text-gray-400 py-10 text-center">Belum ada konversi berbayar.</p>
            ) : (
              <>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={convertChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" name="User" radius={[4, 4, 0, 0]}>
                        {convertChart.map((entry, i) => (
                          <Cell key={i} fill={PRIMARY} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  Median: {medianDays == null ? "—" : `${fmt(medianDays)} hari`} dari signup ke order paid pertama.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Time-to-convert tabel angka */}
        <Card>
          <CardHeader><CardTitle>Distribusi Waktu Konversi</CardTitle></CardHeader>
          <CardContent>
            <AdminTable
              columns={[
                { key: "bucket", label: "Rentang (hari)" },
                { key: "count", label: "User", className: "text-right" },
              ]}
              loading={loading}
              empty={<p className="text-sm text-gray-400 py-6 text-center">Belum ada konversi berbayar.</p>}
            >
              {buckets.map((b) => (
                <Tr key={b.bucket}>
                  <Td className="font-medium text-gray-700">{b.bucket}</Td>
                  <Td className="text-right tabular-nums">{fmt(b.count)}</Td>
                </Tr>
              ))}
            </AdminTable>
            <p className="text-xs text-gray-400 mt-3">
              Total konversi: {fmt(buckets.reduce((s, b) => s + (Number(b.count) || 0), 0))} user.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
