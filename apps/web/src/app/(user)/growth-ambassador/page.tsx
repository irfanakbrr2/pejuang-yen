"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import { Search, Sparkles, Filter } from "lucide-react";
import { LeaderboardHero, type ExtendedLeaderboardEntry } from "./_components/LeaderboardHero";
import { LeaderboardTable } from "./_components/LeaderboardTable";
import { ChallengesPanel } from "./_components/ChallengesPanel";
import RankDelta from "@/components/ui/RankDelta";

export function formatRupiahShort(amount: number) {
  if (amount < 1000) return amount.toString();
  if (amount < 1000000) return (amount / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + "k";
  return (amount / 1000000).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + "jt";
}

type Period = "this_week" | "this_month" | "season" | "all_time";
type Category = "affiliate" | "learning" | "challenge";

const PERIOD_LABEL: Record<Period, string> = {
  this_week: "Minggu Ini",
  this_month: "Bulan Ini",
  season: "Musim",
  all_time: "Sepanjang Masa",
};

interface LeaderboardEntry {
  rank: number;
  name: string;
  initials: string;
  avatar: string | null;
  affiliate_code: string;
  tier?: string;
  referrals: number;
  leads: number;
  totalCommission: number;
  badges: string[];
}

interface LearningEntry {
  rank: number;
  user_id: string;
  name: string;
  initials: string;
  avatar: string | null;
  points: number;
  streak: number;
  level?: number;
  level_title?: string;
  delta?: number | null;
  badges: string[];
}

export default function GrowthAmbassadorPage() {
  const [period, setPeriod] = useState<Period>("this_month");
  const [category, setCategory] = useState<Category>("affiliate");
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [myRank, setMyRank] = useState<LeaderboardEntry | null>(null);
  const [learningData, setLearningData] = useState<LearningEntry[]>([]);
  const [learningMyRank, setLearningMyRank] = useState<LearningEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (category === "challenge") {
      setLoading(false);
      return;
    }

    if (category === "learning") {
      const apiPeriod =
        period === "this_week" ? "weekly" : period === "this_month" ? "monthly" : period === "season" ? "season" : "lifetime";
      fetch(`/api/leaderboard/learning?period=${apiPeriod}`, { credentials: "include" })
        .then((res) => res.json())
        .then((json) => {
          if (json.success) {
            setLearningData(json.data.leaderboard || []);
            setLearningMyRank(json.data.myRank || null);
          }
        })
        .catch((err) => console.error(err))
        .finally(() => setLoading(false));
      return;
    }

    const apiPeriod =
      period === "this_month" ? "monthly" : period === "season" ? "season" : period === "all_time" ? "lifetime" : "monthly";

    fetch(`/api/affiliate/leaderboard?period=${apiPeriod}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setData(json.data.leaderboard || []);
          setMyRank(json.data.myRank || null);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [period, category]);

  const top3 = data.slice(0, 3);
  const others = data.slice(3);

  // Check if current user is already in the displayed list
  const isMeInList = myRank ? data.some(entry => entry.affiliate_code === myRank.affiliate_code) : false;

  const handleCategoryClick = (cat: Category) => {
    if (cat === category) return;
    setLoading(true);
    setCategory(cat);
  };

  return (
    <div className="w-full relative">
      {/* Dark Theme Container - Full width Bleeding layout */}
      <div className="-mx-4 -mt-5 -mb-28 md:-mx-7 md:-mt-7 lg:-mx-9 lg:-mt-9 bg-slate-50 dark:bg-[#05050F] text-slate-900 dark:text-slate-200 relative overflow-hidden min-h-screen">
        
        {/* Background Gradients */}
        <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-sky-100/50 via-slate-50/50 to-slate-50 dark:from-[#1E1B4B]/80 dark:via-[#0B0F24] dark:to-[#05050F] pointer-events-none"></div>
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-400/20 dark:bg-purple-900/20 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] bg-sky-400/20 dark:bg-sky-900/20 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] pointer-events-none mix-blend-overlay"></div>

        {/* Custom Header Area */}
        <div className="relative z-20 px-6 py-6 sm:px-8 border-b border-black/5 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
               Leaderboard
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Climb the ranks and earn exclusive rewards.</p>
          </div>

          <div className="flex items-center gap-3">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Search members..." 
                  className="bg-white/60 dark:bg-white/5 border border-black/5 dark:border-white/10 text-slate-900 dark:text-white text-sm rounded-full pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all w-full sm:w-64 placeholder-slate-400 dark:placeholder-slate-500 shadow-sm dark:shadow-none"
                />
             </div>
          </div>
        </div>

        <div className="px-4 py-8 sm:px-8 relative z-20 pb-32">
          
          {/* Filters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
             <div className="flex bg-white/60 dark:bg-white/5 p-1 rounded-xl ring-1 ring-black/5 dark:ring-white/10 w-max shadow-sm dark:shadow-none">
                {(["affiliate", "learning", "challenge"] as Category[]).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => handleCategoryClick(cat)}
                    className={`px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 capitalize flex items-center gap-1.5 ${
                      category === cat
                        ? "bg-white dark:bg-purple-600/20 text-purple-600 dark:text-purple-300 shadow-sm ring-1 ring-black/5 dark:ring-purple-500/50"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-white/5"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
             </div>

             {category !== "challenge" && (
             <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
                <Filter className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0 mr-2 hidden sm:block" />
                {(["this_week", "this_month", "season", "all_time"] as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => { setPeriod(p); setLoading(true); }}
                    className={`whitespace-nowrap px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 ${
                      period === p
                        ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white ring-1 ring-black/5 dark:ring-white/20 shadow-sm dark:shadow-none"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent hover:border-black/5 dark:hover:border-white/10"
                    }`}
                  >
                    {PERIOD_LABEL[p]}
                  </button>
                ))}
             </div>
             )}
          </div>

          {loading ? (
            <div className="flex justify-center items-end gap-4 h-64 opacity-50 animate-pulse">
              <div className="w-28 h-32 bg-white/40 dark:bg-white/5 rounded-t-xl" />
              <div className="w-36 h-48 bg-white/60 dark:bg-white/10 rounded-t-xl" />
              <div className="w-28 h-24 bg-white/40 dark:bg-white/5 rounded-t-xl" />
            </div>
          ) : category === "challenge" ? (
            <ChallengesPanel />
          ) : category === "learning" ? (
            learningData.length > 0 ? (
              <LearningLeaderboard entries={learningData} myRank={learningMyRank} />
            ) : (
              <div className="text-center py-20 text-slate-500">
                <div className="w-16 h-16 rounded-full bg-white/60 dark:bg-white/5 ring-1 ring-black/5 dark:ring-0 flex items-center justify-center mx-auto mb-4 shadow-sm dark:shadow-none">
                  <Sparkles className="w-6 h-6 text-slate-400 dark:text-slate-600" />
                </div>
                <p>Belum ada poin di periode ini — selesaikan lesson atau check-in harian untuk masuk leaderboard!</p>
              </div>
            )
          ) : top3.length > 0 ? (
            <>
              <LeaderboardHero top3={top3} myRankCode={myRank?.affiliate_code} />
              <LeaderboardTable 
                entries={others} 
                myRank={myRank} 
                isMeInList={isMeInList} 
              />
            </>
          ) : (
            <div className="text-center py-20 text-slate-500">
              <div className="w-16 h-16 rounded-full bg-white/60 dark:bg-white/5 ring-1 ring-black/5 dark:ring-0 flex items-center justify-center mx-auto mb-4 shadow-sm dark:shadow-none">
                 <Sparkles className="w-6 h-6 text-slate-400 dark:text-slate-600" />
              </div>
              <p>No data available for this period</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

const LEARNING_BADGE_EMOJI: Record<string, string> = {
  beginner: "🌱",
  course_graduate: "🎓",
  consistent_7: "🔥",
  consistent_30: "💎",
};

function LearningLeaderboard({ entries, myRank }: { entries: LearningEntry[]; myRank: LearningEntry | null }) {
  const isMeInList = myRank ? entries.some((e) => e.user_id === myRank.user_id) : false;

  const Row = ({ entry, highlight }: { entry: LearningEntry; highlight?: boolean }) => (
    <div
      className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-colors ${
        highlight
          ? "bg-purple-500/10 ring-1 ring-purple-500/30"
          : "bg-white/60 dark:bg-white/5 ring-1 ring-black/5 dark:ring-white/10"
      }`}
    >
      <div className="w-9 flex flex-col items-center">
        <span className={`text-center font-black tabular-nums ${
          entry.rank === 1 ? "text-amber-500" : entry.rank === 2 ? "text-slate-400" : entry.rank === 3 ? "text-orange-400" : "text-slate-500 dark:text-slate-400"
        }`}>
          {entry.rank > 0 ? entry.rank : "—"}
        </span>
        <RankDelta delta={entry.delta} />
      </div>
      <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center overflow-hidden shrink-0 relative">
        {entry.avatar ? (
          <Image src={entry.avatar} alt={entry.name} fill className="object-cover" />
        ) : (
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{entry.initials}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
          {entry.name} {highlight && <span className="text-purple-500 text-xs">(Kamu)</span>}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {entry.level ? (
            <span className="inline-flex items-center rounded-full bg-[#F7E8E8] dark:bg-[#8B1414]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#8B1414] dark:text-emerald-300">
              Lv {entry.level}
              {entry.level_title ? <span className="ml-1 font-medium opacity-80">· {entry.level_title}</span> : null}
            </span>
          ) : null}
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {entry.badges.slice(0, 3).map((b) => LEARNING_BADGE_EMOJI[b] || "🏅").join(" ")}
          </span>
        </div>
      </div>
      {entry.streak > 0 && (
        <span className="text-xs font-semibold text-orange-500 whitespace-nowrap">🔥 {entry.streak}</span>
      )}
      <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
        {entry.points.toLocaleString("id-ID")} <span className="text-[10px] font-medium text-slate-400">pts</span>
      </span>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-2">
      {entries.map((entry) => (
        <Row key={entry.user_id} entry={entry} highlight={myRank?.user_id === entry.user_id} />
      ))}
      {myRank && !isMeInList && (
        <>
          <p className="text-center text-[11px] text-slate-400 py-1">···</p>
          <Row entry={myRank} highlight />
        </>
      )}
    </div>
  );
}
