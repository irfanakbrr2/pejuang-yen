"use client";

import { Flame, CheckCircle2, CalendarDays } from "lucide-react";

export interface ActivitySummary {
  active_days_7d: number;
  last_active: string | null;
  total_lessons_completed: number;
}

export function ActivitySummaryCard({ activity }: { activity: ActivitySummary | null }) {
  if (!activity) return null;

  const motivation =
    activity.active_days_7d >= 5
      ? "Konsistensi kamu luar biasa minggu ini! 🔥"
      : activity.active_days_7d >= 3
        ? "Bagus! Pertahankan ritme belajarmu."
        : activity.active_days_7d >= 1
          ? "Yuk tambah hari aktif belajarmu minggu ini."
          : "Mulai lagi hari ini — sedikit demi sedikit tetap maju.";

  return (
    <div className="bg-white dark:bg-white/5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),_0_4px_16px_rgba(0,0,0,0.04)] dark:shadow-none dark:border dark:border-white/[0.05] p-5">
      <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase mb-3">Aktivitas Belajar</p>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center rounded-xl bg-[#8B1414]/5 py-3">
          <Flame size={16} className="mx-auto text-[#8B1414] mb-1" />
          <p className="text-lg font-bold text-gray-900 dark:text-white">{activity.active_days_7d}</p>
          <p className="text-[10px] text-gray-400">hari aktif / 7d</p>
        </div>
        <div className="text-center rounded-xl bg-gray-50 dark:bg-white/5 py-3">
          <CheckCircle2 size={16} className="mx-auto text-gray-400 mb-1" />
          <p className="text-lg font-bold text-gray-900 dark:text-white">{activity.total_lessons_completed}</p>
          <p className="text-[10px] text-gray-400">lesson selesai</p>
        </div>
        <div className="text-center rounded-xl bg-gray-50 dark:bg-white/5 py-3">
          <CalendarDays size={16} className="mx-auto text-gray-400 mb-1" />
          <p className="text-[11px] font-bold text-gray-900 dark:text-white mt-1.5">
            {activity.last_active
              ? new Date(activity.last_active).toLocaleDateString("id-ID", { day: "numeric", month: "short" })
              : "—"}
          </p>
          <p className="text-[10px] text-gray-400">terakhir aktif</p>
        </div>
      </div>

      <p className="text-xs text-gray-500 dark:text-slate-400">{motivation}</p>
    </div>
  );
}
