"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

// Util & komponen bersama untuk hub /admin/analytics

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

// Palet seri chart — konsisten di semua tab
export const SERIES_COLORS = ["#8B1414", "#2563EB", "#D97706", "#DC2626", "#7C3AED", "#6B7280"];

export function utcDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export function StatCard({ label, value, hint, icon: Icon, accent }: {
  label: string; value: string; hint: string; icon: any; accent?: boolean;
}) {
  return (
    <div className="bg-white border border-[rgba(0,0,0,0.07)] shadow-[var(--shadow-card)] rounded-[var(--radius-lg,12px)] p-5">
      <div className="flex justify-between items-start mb-3">
        <p className={`text-[10px] font-bold tracking-wider uppercase ${accent ? "text-[#8B1414]" : "text-gray-400"}`}>{label}</p>
        <div className={`p-2 rounded-xl ${accent ? "bg-[#8B1414]/10 text-[#8B1414]" : "bg-gray-50 text-gray-400"}`}>
          <Icon size={16} />
        </div>
      </div>
      <p className="text-xl font-bold text-gray-900 tabular-nums">{value}</p>
      <p className="text-xs text-gray-400 mt-2">{hint}</p>
    </div>
  );
}

export function SourceList({ rows, loading }: { rows: { label: string; value: string }[]; loading: boolean }) {
  if (loading) return <p className="text-sm text-gray-400 py-4 text-center">Memuat...</p>;
  if (rows.length === 0) return <p className="text-sm text-gray-400 py-4 text-center">Belum ada data.</p>;
  return (
    <ul className="divide-y divide-gray-100">
      {rows.slice(0, 10).map((row, i) => (
        <li key={`${row.label}-${i}`} className="flex items-center justify-between py-2 text-sm">
          <span className="text-gray-700 truncate pr-3">{row.label}</span>
          <span className="font-semibold text-gray-900 whitespace-nowrap tabular-nums">{row.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function PillSelect<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (v: T) => void;
  options: { label: string; value: T }[];
}) {
  return (
    <div className="flex items-center bg-gray-100 rounded-full p-0.5 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 cursor-pointer ${
            value === opt.value ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
