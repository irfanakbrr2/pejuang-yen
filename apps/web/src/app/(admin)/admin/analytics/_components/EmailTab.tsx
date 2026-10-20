"use client";
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { formatRupiah } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminTable, Tr, Td } from "@/components/ui/AdminTable";
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Mail, MailOpen, MousePointerClick, AlertTriangle, UserX, DollarSign, ShieldOff } from "lucide-react";
import { StatCard, SERIES_COLORS } from "./shared";

interface Campaign {
  id: string;
  name: string;
  status: string;
  sent_count: number;
  open_count: number;
  click_count: number;
  bounce_count: number;
  unsubscribe_count: number;
  revenue_attributed: number;
  open_rate: number;
  click_rate: number;
}

interface Totals {
  sent: number;
  open: number;
  click: number;
  bounce: number;
  unsub: number;
  revenue: number;
  open_rate: number;
  click_rate: number;
  bounce_rate: number;
  unsub_rate: number;
}

interface SequencePerf {
  id: string;
  name: string;
  trigger_event: string;
  status: string;
  active: number;
  completed: number;
  paused: number;
}

interface EventTrendRow {
  event_type: string;
  count: number;
}

interface Suppression {
  total: number;
  new_in_range: number;
}

interface EmailData {
  campaigns: Campaign[];
  totals: Totals;
  sequence_performance: SequencePerf[];
  event_trend: EventTrendRow[];
  suppression: Suppression;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  scheduled: "Dijadwalkan",
  sending: "Mengirim",
  sent: "Terkirim",
  paused: "Jeda",
};

const EVENT_LABELS: Record<string, string> = {
  sent: "Terkirim",
  opened: "Dibuka",
  clicked: "Diklik",
  bounced: "Bounce",
  unsubscribed: "Unsubscribe",
  new_subscriber: "Subscriber Baru",
};

function pct(n: number): string {
  return `${(n ?? 0).toFixed(1)}%`;
}

function num(n: number): string {
  return (n ?? 0).toLocaleString("id-ID");
}

export function EmailTab({ days }: { days: string }) {
  const [data, setData] = useState<EmailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api(`/api/admin/analytics/email?days=${days}`)
      .then((res) => {
        if (res.success) setData(res.data as EmailData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  const t = data?.totals;
  const eventData = (data?.event_trend || []).map((row) => ({
    label: EVENT_LABELS[row.event_type] || row.event_type,
    count: row.count,
  }));

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Terkirim" value={num(t?.sent ?? 0)} hint={`Email ${days} hari`} icon={Mail} accent />
        <StatCard label="Open Rate" value={pct(t?.open_rate ?? 0)} hint={`${num(t?.open ?? 0)} dibuka`} icon={MailOpen} />
        <StatCard label="Click Rate" value={pct(t?.click_rate ?? 0)} hint={`${num(t?.click ?? 0)} diklik`} icon={MousePointerClick} />
        <StatCard label="Bounce Rate" value={pct(t?.bounce_rate ?? 0)} hint={`${num(t?.bounce ?? 0)} bounce`} icon={AlertTriangle} />
        <StatCard label="Unsubscribe" value={num(t?.unsub ?? 0)} hint={pct(t?.unsub_rate ?? 0)} icon={UserX} />
        <StatCard label="Revenue Attributed" value={formatRupiah(t?.revenue ?? 0)} hint={`Dari email ${days} hari`} icon={DollarSign} accent />
      </div>

      {/* Campaigns */}
      <Card>
        <CardHeader><CardTitle>Campaign Terbaru</CardTitle></CardHeader>
        <CardContent>
          <AdminTable
            columns={[
              { key: "name", label: "Nama" },
              { key: "status", label: "Status" },
              { key: "sent", label: "Terkirim" },
              { key: "open", label: "Open %" },
              { key: "click", label: "Click %" },
              { key: "revenue", label: "Revenue", className: "text-right" },
            ]}
            loading={loading}
            empty={<p className="text-sm text-gray-400 py-6 text-center">Belum ada campaign pada periode ini.</p>}
          >
            {(data?.campaigns || []).map((row) => (
              <Tr key={row.id}>
                <Td className="font-medium max-w-[260px] truncate">{row.name}</Td>
                <Td>
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {STATUS_LABELS[row.status] || row.status}
                  </span>
                </Td>
                <Td className="tabular-nums">{num(row.sent_count)}</Td>
                <Td className="tabular-nums">{pct(row.open_rate)}</Td>
                <Td className="tabular-nums">{pct(row.click_rate)}</Td>
                <Td className="text-right font-semibold tabular-nums">{formatRupiah(row.revenue_attributed)}</Td>
              </Tr>
            ))}
          </AdminTable>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Event breakdown */}
        <Card>
          <CardHeader><CardTitle>Email Events ({days} hari)</CardTitle></CardHeader>
          <CardContent>
            {eventData.length === 0 ? (
              <p className="text-sm text-gray-400 py-10 text-center">{loading ? "Memuat..." : "Belum ada event email pada periode ini."}</p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={eventData} layout="vertical" margin={{ left: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={110} />
                    <Tooltip formatter={(value: any) => [num(Number(value)), "Event"]} />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                      {eventData.map((entry, i) => (
                        <Cell key={entry.label} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Suppression growth */}
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <ShieldOff size={16} className="text-[#8B1414]" /> Suppression List
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <StatCard label="Total Suppressed" value={num(data?.suppression.total ?? 0)} hint="Email diblokir total" icon={ShieldOff} accent />
              <StatCard label="Baru" value={num(data?.suppression.new_in_range ?? 0)} hint={`Ditambah ${days} hari`} icon={UserX} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sequence performance */}
      <Card>
        <CardHeader><CardTitle>Performa Sequence</CardTitle></CardHeader>
        <CardContent>
          <AdminTable
            columns={[
              { key: "name", label: "Sequence" },
              { key: "trigger", label: "Trigger" },
              { key: "active", label: "Aktif" },
              { key: "completed", label: "Selesai" },
              { key: "paused", label: "Jeda" },
              { key: "rate", label: "Completion", className: "text-right" },
            ]}
            loading={loading}
            empty={<p className="text-sm text-gray-400 py-6 text-center">Belum ada data sequence.</p>}
          >
            {(data?.sequence_performance || []).map((row) => {
              const enrolled = row.active + row.completed + row.paused;
              const rate = enrolled > 0 ? Math.round((row.completed / enrolled) * 100) : 0;
              return (
                <Tr key={row.id}>
                  <Td className="font-medium max-w-[220px] truncate">{row.name}</Td>
                  <Td className="text-xs text-gray-500 max-w-[160px] truncate">{row.trigger_event}</Td>
                  <Td className="tabular-nums">{num(row.active)}</Td>
                  <Td className="tabular-nums">{num(row.completed)}</Td>
                  <Td className="tabular-nums">{num(row.paused)}</Td>
                  <Td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#8B1414] rounded-full" style={{ width: `${rate}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-700">{rate}%</span>
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </AdminTable>
        </CardContent>
      </Card>
    </div>
  );
}
