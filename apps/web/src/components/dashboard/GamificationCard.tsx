"use client";

import { useState } from "react";
import { Flame, Trophy, Star, CalendarCheck, Medal } from "lucide-react";
import { toast } from "sonner";

export interface LevelData {
  level: number;
  title: string;
  total_points: number;
  current_floor: number;
  next_at: number | null;
  progress_pct: number;
  to_next: number;
}

export interface GamificationData {
  current_streak: number;
  longest_streak: number;
  total_active_days: number;
  total_points: number;
  weekly_points: number;
  checked_in_today: boolean;
  level?: LevelData;
  badges: { badge_key: string; badge_name: string; earned_at: string }[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

const BADGE_EMOJI: Record<string, string> = {
  beginner: "🌱",
  course_graduate: "🎓",
  consistent_7: "🔥",
  consistent_30: "💎",
  growth_ambassador: "👑",
};

export function GamificationCard({ data: initial }: { data: GamificationData | null }) {
  const [data, setData] = useState(initial);
  const [checkingIn, setCheckingIn] = useState(false);

  if (!data) return null;

  const handleCheckin = async () => {
    if (data.checked_in_today || checkingIn) return;
    setCheckingIn(true);
    try {
      const res = await fetch(`${API_BASE}/api/user/checkin`, {
        method: "POST",
        credentials: "include",
      }).then((r) => r.json());

      if (res?.success) {
        setData((prev) => prev ? {
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

  return (
    <div className="bg-white dark:bg-white/5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),_0_4px_16px_rgba(0,0,0,0.04)] dark:shadow-none dark:border dark:border-white/[0.05] p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase">Streak & Poin</p>
        <button
          onClick={handleCheckin}
          disabled={data.checked_in_today || checkingIn}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all duration-150 ${
            data.checked_in_today
              ? "bg-[#8B1414]/10 text-[#8B1414] dark:bg-[#C0392B]/10 dark:text-[#C0392B] cursor-default"
              : "bg-[#8B1414] text-white hover:bg-[#6E0F0F] active:scale-[0.97] dark:bg-[#C0392B] dark:text-slate-900"
          }`}
        >
          <CalendarCheck size={13} />
          {data.checked_in_today ? "Sudah check-in ✓" : checkingIn ? "..." : "Check-in Harian"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-3">
        <div className="text-center rounded-xl bg-orange-50 dark:bg-orange-500/10 py-3">
          <Flame size={16} className="mx-auto text-orange-500 mb-1" />
          <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">{data.current_streak}</p>
          <p className="text-[10px] text-gray-400">streak hari</p>
        </div>
        <div className="text-center rounded-xl bg-[#8B1414]/5 dark:bg-[#C0392B]/10 py-3">
          <Star size={16} className="mx-auto text-[#8B1414] dark:text-[#C0392B] mb-1" />
          <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">{data.total_points}</p>
          <p className="text-[10px] text-gray-400">total poin</p>
        </div>
        <div className="text-center rounded-xl bg-gray-50 dark:bg-white/5 py-3">
          <Trophy size={16} className="mx-auto text-gray-400 mb-1" />
          <p className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">{data.longest_streak}</p>
          <p className="text-[10px] text-gray-400">streak terbaik</p>
        </div>
      </div>

      {data.badges.length > 0 ? (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Medal size={12} className="text-gray-400" />
          {data.badges.slice(0, 4).map((b) => (
            <span
              key={b.badge_key}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-50 dark:bg-white/5 text-[10px] font-semibold text-gray-600 dark:text-slate-300"
              title={new Date(b.earned_at).toLocaleDateString("id-ID")}
            >
              {BADGE_EMOJI[b.badge_key] || "🏅"} {b.badge_name}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500 dark:text-slate-400">
          Selesaikan lesson pertamamu untuk meraih badge 🌱 Beginner.
        </p>
      )}
    </div>
  );
}
