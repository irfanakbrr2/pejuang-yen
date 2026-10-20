"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { formatRupiah } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminTable, Tr, Td } from "@/components/ui/AdminTable";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Users, UserCheck, ShoppingCart, DollarSign, Megaphone } from "lucide-react";
import { StatCard } from "./shared";

const PRIMARY = "#8B1414";

interface WebinarSummary {
  total_registered: number;
  total_attended: number;
  attendance_rate: number;
  total_converted: number;
  conversion_rate: number;
  attributed_revenue: number;
}
interface PerWebinarRow {
  webinar_id: string;
  title: string;
  starts_at: string | null;
  registered: number;
  attended: number;
  converted: number;
  revenue: number;
}
interface MembershipRow {
  membership_status_at_registration: string | null;
  registered: number;
}
interface UpsellRow {
  step_type: string;
  viewed: number;
  accepted: number;
  converted: number;
  revenue: number;
}
interface WebinarFunnelData {
  summary: WebinarSummary;
  per_webinar: PerWebinarRow[];
  registration_by_membership_status: MembershipRow[];
  webinar_upsell: UpsellRow[];
}

const fmt = (n: number | undefined | null) => (n ?? 0).toLocaleString("id-ID");
const pct = (r: number | undefined | null) => `${((r ?? 0) * 100).toFixed(1)}%`;

const STEP_LABELS: Record<string, string> = {
  order_bump: "Order Bump",
  upsell: "Upsell",
  downsell: "Downsell",
};

const MEMBERSHIP_LABELS: Record<string, string> = {
  free: "Free (non-member)",
  active: "Member aktif",
};

export function WebinarTab({ days }: { days: string }) {
  const [data, setData] = useState<WebinarFunnelData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api(`/api/admin/analytics/webinar-funnel?days=${days}`)
      .then((res) => { if (res.success) setData(res.data as WebinarFunnelData); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  const s = data?.summary;

  // Funnel: registrasi -> hadir -> beli
  const funnelData = [
    { stage: "Registrasi", value: s?.total_registered ?? 0 },
    { stage: "Hadir", value: s?.total_attended ?? 0 },
    { stage: "Beli", value: s?.total_converted ?? 0 },
  ];
  const funnelColors = [PRIMARY, "#2563EB", "#D97706"];
  const hasFunnel = (s?.total_registered ?? 0) > 0;

  const totalMembership =
    (data?.registration_by_membership_status || []).reduce((acc, r) => acc + (r.registered || 0), 0) || 0;

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Registrasi" value={fmt(s?.total_registered)} hint={`Pendaftar ${days} hari`} icon={Users} accent />
        <StatCard label="Attendance Rate" value={pct(s?.attendance_rate)} hint={`${fmt(s?.total_attended)} hadir`} icon={UserCheck} />
        <StatCard label="Conversion Rate" value={pct(s?.conversion_rate)} hint={`${fmt(s?.total_converted)} beli`} icon={ShoppingCart} />
        <StatCard label="Revenue" value={formatRupiah(s?.attributed_revenue || 0)} hint={`Atribusi ${days} hari`} icon={DollarSign} accent />
      </div>

      {/* Funnel bar: registrasi -> hadir -> beli */}
      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <Users size={16} className="text-[#8B1414]" /> Funnel: Registrasi → Hadir → Beli
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!hasFunnel ? (
            <p className="text-sm text-gray-400 py-10 text-center">
              {loading ? "Memuat data..." : "Belum ada registrasi webinar pada periode ini."}
            </p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} layout="vertical" margin={{ left: 16, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="stage" tick={{ fontSize: 12 }} width={80} />
                  <Tooltip formatter={(v) => fmt(Number(v))} />
                  <Bar dataKey="value" name="Jumlah" radius={[0, 6, 6, 0]}>
                    {funnelData.map((_, i) => (
                      <Cell key={i} fill={funnelColors[i % funnelColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-webinar table dengan progress bar konversi */}
      <Card>
        <CardHeader><CardTitle>Performa per Webinar</CardTitle></CardHeader>
        <CardContent>
          <AdminTable
            columns={[
              { key: "title", label: "Webinar" },
              { key: "registered", label: "Registrasi" },
              { key: "attended", label: "Hadir" },
              { key: "converted", label: "Konversi" },
              { key: "rate", label: "Conversion Rate" },
              { key: "revenue", label: "Revenue", className: "text-right" },
            ]}
            loading={loading}
            empty={<p className="text-sm text-gray-400 py-6 text-center">Belum ada webinar dengan registrasi.</p>}
          >
            {(data?.per_webinar || []).map((row) => {
              const rate = row.registered > 0 ? Math.round((row.converted / row.registered) * 100) : 0;
              return (
                <Tr key={row.webinar_id}>
                  <Td className="font-medium max-w-[260px] truncate">{row.title || "(tanpa judul)"}</Td>
                  <Td>{fmt(row.registered)}</Td>
                  <Td>{fmt(row.attended)}</Td>
                  <Td>{fmt(row.converted)}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#8B1414] rounded-full" style={{ width: `${rate}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{rate}%</span>
                    </div>
                  </Td>
                  <Td className="text-right font-semibold">{formatRupiah(row.revenue || 0)}</Td>
                </Tr>
              );
            })}
          </AdminTable>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Registration by membership status — peluang upsell */}
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <Users size={16} className="text-[#8B1414]" /> Registrasi per Status Membership
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.registration_by_membership_status || []).length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">
                {loading ? "Memuat data..." : "Belum ada registrasi pada periode ini."}
              </p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {(data?.registration_by_membership_status || []).map((row, i) => {
                  const key = row.membership_status_at_registration || "free";
                  const label = MEMBERSHIP_LABELS[key] || key;
                  const share = totalMembership > 0 ? Math.round((row.registered / totalMembership) * 100) : 0;
                  return (
                    <li key={`${key}-${i}`} className="flex items-center justify-between py-3 text-sm">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-gray-700 truncate">{label}</span>
                        <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
                          <div className="h-full bg-[#8B1414] rounded-full" style={{ width: `${share}%` }} />
                        </div>
                      </div>
                      <span className="font-semibold text-gray-900 whitespace-nowrap tabular-nums">
                        {fmt(row.registered)} <span className="text-xs text-gray-400">({share}%)</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Webinar upsell funnel steps */}
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <Megaphone size={16} className="text-[#8B1414]" /> Upsell Funnel Webinar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AdminTable
              columns={[
                { key: "step", label: "Step" },
                { key: "viewed", label: "Dilihat" },
                { key: "accepted", label: "Diterima" },
                { key: "converted", label: "Konversi" },
                { key: "revenue", label: "Revenue", className: "text-right" },
              ]}
              loading={loading}
              empty={<p className="text-sm text-gray-400 py-6 text-center">Belum ada funnel upsell bertipe registrasi webinar pada periode ini.</p>}
            >
              {(data?.webinar_upsell || []).map((row, i) => (
                <Tr key={`${row.step_type}-${i}`}>
                  <Td className="font-medium">{STEP_LABELS[row.step_type] || row.step_type}</Td>
                  <Td>{fmt(row.viewed)}</Td>
                  <Td>{fmt(row.accepted)}</Td>
                  <Td>{fmt(row.converted)}</Td>
                  <Td className="text-right font-semibold">{formatRupiah(row.revenue || 0)}</Td>
                </Tr>
              ))}
            </AdminTable>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
