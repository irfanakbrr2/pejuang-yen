"use client";

import { useEffect, useState, useCallback } from "react";
import { Target, Users, CheckCircle2, Clock, Gift } from "lucide-react";
import { toast } from "@/components/ui/toast";

interface ChallengeMe {
  progress: number;
  completed: boolean;
  joined: boolean;
}
interface Challenge {
  id: string;
  title: string;
  description: string | null;
  metric: string;
  target: number;
  reward_label: string | null;
  starts_at: string;
  ends_at: string;
  participants: number;
  me: ChallengeMe;
}

const METRIC_LABEL: Record<string, string> = {
  lessons: "pelajaran",
  points: "poin",
  referrals: "referral",
  webinars: "webinar",
};

function daysLeft(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "Berakhir";
  const d = Math.ceil(ms / 86400000);
  return d <= 1 ? "Berakhir hari ini" : `${d} hari lagi`;
}

export function ChallengesPanel() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/challenges/active", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setChallenges(j.data.challenges || []);
      })
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  const join = async (id: string) => {
    setJoining(id);
    try {
      const res = await fetch(`/api/challenges/${id}/join`, { method: "POST", credentials: "include" });
      const j = await res.json();
      if (j.success) {
        toast.success("Berhasil bergabung ke challenge!");
        load();
      } else {
        toast.error(j.error || "Gagal bergabung");
      }
    } catch {
      toast.error("Gagal bergabung");
    } finally {
      setJoining(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto grid gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="h-44 rounded-2xl bg-white/40 dark:bg-white/5 animate-pulse" />
        ))}
      </div>
    );
  }

  if (challenges.length === 0) {
    return (
      <div className="text-center py-20 text-slate-500">
        <div className="w-16 h-16 rounded-full bg-white/60 dark:bg-white/5 ring-1 ring-black/5 flex items-center justify-center mx-auto mb-4">
          <Target className="w-6 h-6 text-slate-400" />
        </div>
        <p>Belum ada challenge aktif. Pantau terus — challenge baru segera hadir!</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto grid gap-4 sm:grid-cols-2">
      {challenges.map((ch) => {
        const pct = ch.target > 0 ? Math.min(100, Math.round((ch.me.progress / ch.target) * 100)) : 0;
        return (
          <div
            key={ch.id}
            className="rounded-2xl bg-white/70 dark:bg-white/5 ring-1 ring-black/5 dark:ring-white/10 p-5 shadow-sm flex flex-col"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-[#F7E8E8] flex items-center justify-center">
                  <Target className="w-5 h-5 text-[#8B1414]" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-tight">{ch.title}</h3>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 whitespace-nowrap">
                <Clock className="w-3 h-3" />
                {daysLeft(ch.ends_at)}
              </span>
            </div>

            {ch.description && (
              <p className="mt-2 text-[13px] leading-snug text-slate-500 dark:text-slate-400">{ch.description}</p>
            )}

            {ch.reward_label && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-[#B7791F]">
                <Gift className="w-3.5 h-3.5" /> {ch.reward_label}
              </p>
            )}

            <div className="mt-auto pt-4">
              {ch.me.joined ? (
                <>
                  <div className="flex items-center justify-between text-[12px] mb-1.5">
                    <span className="font-medium text-slate-500 tabular-nums">
                      {ch.me.progress}/{ch.target} {METRIC_LABEL[ch.metric] || ch.metric}
                    </span>
                    {ch.me.completed ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-[#8B1414]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Selesai
                      </span>
                    ) : (
                      <span className="font-bold tabular-nums text-[#8B1414]">{pct}%</span>
                    )}
                  </div>
                  <div className="h-2 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#8B1414] to-[#C0392B] transition-[width] duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </>
              ) : (
                <button
                  onClick={() => join(ch.id)}
                  disabled={joining === ch.id}
                  className="w-full min-h-[44px] rounded-xl bg-[#8B1414] text-white text-sm font-semibold transition active:scale-[0.97] disabled:opacity-60"
                >
                  {joining === ch.id ? "Bergabung…" : "Ikuti Challenge"}
                </button>
              )}
              <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-400">
                <Users className="w-3 h-3" /> {ch.participants} peserta
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
