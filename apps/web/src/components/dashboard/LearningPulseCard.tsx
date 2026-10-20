"use client";

import { useState } from "react";
import { Flame, Star, CheckCircle2, CalendarDays, CalendarCheck, Medal } from "lucide-react";
import { toast } from "sonner";
import type { GamificationData } from "./GamificationCard";
import type { ActivitySummary } from "./ActivitySummaryCard";
import LevelRing from "@/components/ui/LevelRing";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

const BADGE_EMOJI: Record<string, string> = {
  beginner: "🌱",
  course_graduate: "🎓",
  consistent_7: "🔥",
  consistent_30: "💎",
  growth_ambassador: "👑",
};

/**
 * Gabungan "Streak & Poin" (GamificationCard) + "Aktivitas Belajar"
 * (ActivitySummaryCard) — satu kartu ringkas: 4 stat + check-in + badges + motivasi.
 */
export function LearningPulseCard({ gamification: initial, activity }: {
  gamification: GamificationData | null;
  activity: ActivitySummary | null;
}) {
  const [gamification, setGamification] = useState(initial);
  const [checkingIn, setCheckingIn] = useState(false);

  if (!gamification && !activity) return null;

  const handleCheckin = async () => {
    if (!gamification || gamification.checked_in_today || checkingIn) return;
    setCheckingIn(true);
    try {
      const res = await fetch(`${API_BASE}/api/user/checkin`, {
        method: "POST",
        credentials: "include",
      }).then((r) => r.json());

      if (res?.success) {
        setGamification((prev) => prev ? {
          ...prev,
          current_streak: res.data.current_streak,
          longest_streak: res.data.longest_streak,
          total_points: res.data.total_points,
          checked_in_today: true,
        } : prev);
        if (res.data.checked_in) {
          toast.success(`Check-in berhasil! +5 poin · Streak ${res.data.current_streak} hari 🔥`);
        }
        for (const badge of res.data.new_badges || []) {
          toast.success(`Badge baru: ${badge === "consistent_7" ? "Consistent — 7 Hari 🔥" : "Consistent — 30 Hari 💎"}`);
        }
      } else {
        toast.error(res?.error || "Gagal check-in, coba lagi.");
      }
    } catch {
      toast.error("Gagal check-in, coba lagi.");
    } finally {
      setCheckingIn(false);
    }
  };

  const motivation = activity
    ? activity.active_days_7d >= 5
      ? "Konsistensi kamu luar biasa minggu ini! 🔥"
      : activity.active_days_7d >= 3
        ? "Bagus! Pertahankan ritme belajarmu."
        : activity.active_days_7d >= 1
          ? "Yuk tambah hari aktif belajarmu minggu ini."
          : "Mulai lagi hari ini — sedikit demi sedikit tetap maju."
    : null;

  const stats = [
    { icon: Flame, color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-500/10", value: gamification?.current_streak ?? 0, label: "streak hari" },
    { icon: Star, color: "text-[#8B1414] dark:text-[#C0392B]", bg: "bg-[#8B1414]/5 dark:bg-[#C0392B]/10", value: gamification?.total_points ?? 0, label: "total poin" },
    { icon: CheckCircle2, color: "text-gray-400", bg: "bg-gray-50 dark:bg-white/5", value: activity?.total_lessons_completed ?? 0, label: "lesson selesai" },
    { icon: CalendarDays, color: "text-gray-400", bg: "bg-gray-50 dark:bg-white/5", value: activity?.active_days_7d ?? 0, label: "aktif / 7 hari" },
  ];

  return (
    <div className="bg-white dark:bg-white/5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),_0_4px_16px_rgba(0,0,0,0.04)] dark:shadow-none dark:border dark:border-white/[0.05] p-5">
      {gamification?.level && (
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100 dark:border-white/5">
          <LevelRing level={gamification.level.level} progress={gamification.level.progress_pct} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
              Level {gamification.level.level} · {gamification.level.title}
            </p>
            <p className="text-[11px] text-gray-400">
              {gamification.level.next_at !== null
                ? `${gamification.level.to_next.toLocaleString("id-ID")} poin lagi ke level ${gamification.level.level + 1}`
                : "Level maksimal tercapai! 👑"}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Aktivitas & Streak</p>
        {gamification && (
          <button
            onClick={handleCheckin}
            disabled={gamification.checked_in_today || checkingIn}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all duration-150 ${
              gamification.checked_in_today
                ? "bg-[#8B1414]/10 text-[#8B1414] dark:bg-[#C0392B]/10 dark:text-[#C0392B] cursor-default"
                : "bg-[#8B1414] text-white hover:bg-[#6E0F0F] active:scale-[0.97] dark:bg-[#C0392B] dark:text-slate-900"
            }`}
          >
            <CalendarCheck size={13} />
            {gamification.checked_in_today ? "Sudah check-in ✓" : checkingIn ? "..." : "Check-in Harian"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-3">
        {stats.map((s) => (
          <div key={s.label} className={`text-center rounded-xl py-3 ${s.bg}`}>
            <s.icon size={16} className={`mx-auto mb-1 ${s.color}`} />
            <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">{s.value}</p>
            <p className="text-[10px] text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      {gamification && gamification.badges.length > 0 ? (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Medal size={12} className="text-gray-400" />
          {gamification.badges.slice(0, 4).map((b) => (
            <span
              key={b.badge_key}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-50 dark:bg-white/5 text-[10px] font-semibold text-gray-600 dark:text-slate-300"
              title={new Date(b.earned_at).toLocaleDateString("id-ID")}
            >
              {BADGE_EMOJI[b.badge_key] || "🏅"} {b.badge_name}
            </span>
          ))}
        </div>
      ) : motivation ? (
        <p className="text-xs text-gray-500 dark:text-slate-400">{motivation}</p>
      ) : (
        <p className="text-xs text-gray-500 dark:text-slate-400">
          Selesaikan lesson pertamamu untuk meraih badge 🌱 Beginner.
        </p>
      )}
    </div>
  );
}
