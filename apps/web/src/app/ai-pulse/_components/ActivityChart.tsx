"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Point {
  day: string;
  count: number;
}

function formatDay(day: string): string {
  const d = new Date(day);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

/** Area chart "aktivitas AI" 14 hari. Gridline tipis, tooltip, reduced-motion, fallback tabel. */
export function ActivityChart({ data }: { data: Point[] }) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const chartData = data.map((d) => ({ ...d, label: formatDay(d.day) }));
  const isEmpty = chartData.every((d) => d.count === 0) || chartData.length === 0;

  if (isEmpty) {
    return (
      <div className="glass-card flex h-44 items-center justify-center text-sm text-[#A1A1AA]">
        Belum ada aktivitas terpantau.
      </div>
    );
  }

  return (
    <div className="glass-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-bold text-[#09090B]">Aktivitas AI · 14 hari</span>
      </div>
      <div className="h-44" role="img" aria-label="Grafik jumlah intel AI terbit per hari selama 14 hari terakhir">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id="pulseFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8B1414" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#8B1414" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} width={32} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ stroke: "#cbd5e1", strokeWidth: 1 }}
              contentStyle={{ borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)", fontSize: 12 }}
              labelStyle={{ fontWeight: 600 }}
              formatter={(v) => [`${v} intel`, "Terbit"]}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#8B1414"
              strokeWidth={2}
              fill="url(#pulseFill)"
              isAnimationActive={!reduced}
              animationDuration={reduced ? 0 : 400}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {/* Fallback data untuk screen reader / no-color */}
      <table className="sr-only">
        <caption>Jumlah intel AI per hari</caption>
        <thead>
          <tr><th>Tanggal</th><th>Jumlah</th></tr>
        </thead>
        <tbody>
          {chartData.map((d) => (
            <tr key={d.day}><td>{d.label}</td><td>{d.count}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
