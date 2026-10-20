"use client";

import Image from "next/image";
import { Medal, Crown, Sparkles } from "lucide-react";
import { formatRupiahShort } from "../page";

export interface ExtendedLeaderboardEntry {
  rank: number;
  name: string;
  initials: string;
  avatar: string | null;
  affiliate_code: string;
  tier?: string;
  referrals: number;
  leads: number;
  totalCommission: number;
  delta?: number | null;
  badges: string[];
}

interface LeaderboardHeroProps {
  top3: ExtendedLeaderboardEntry[];
  myRankCode?: string;
}

export function LeaderboardHero({ top3, myRankCode }: LeaderboardHeroProps) {
  const getMedalColor = (rank: number) => {
    if (rank === 1) return "text-yellow-400 fill-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]";
    if (rank === 2) return "text-slate-300 fill-slate-300 drop-shadow-[0_0_10px_rgba(203,213,225,0.8)]";
    if (rank === 3) return "text-purple-400 fill-purple-400 drop-shadow-[0_0_10px_rgba(192,132,252,0.8)]";
    return "text-gray-300";
  };

  const isMe = (code: string) => code === myRankCode;

  return (
    <div className="relative py-12 flex justify-center items-end gap-2 sm:gap-6 z-10 min-h-[340px]">
      {/* Background Orbit/Cosmic Effects for Hero */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center opacity-40">
         <div className="w-[600px] h-[600px] rounded-full border border-black/5 dark:border-white/5 absolute top-[40%] shadow-[0_0_100px_inset_rgba(124,58,237,0.05)] dark:shadow-[0_0_100px_inset_rgba(124,58,237,0.1)] animate-[spin_60s_linear_infinite]"></div>
         <div className="w-[400px] h-[400px] rounded-full border border-black/5 dark:border-white/10 absolute top-[50%] shadow-[0_0_60px_inset_rgba(56,189,248,0.05)] dark:shadow-[0_0_60px_inset_rgba(56,189,248,0.1)] animate-[spin_40s_linear_infinite_reverse]"></div>
         <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-slate-50 dark:from-[#05050F] to-transparent"></div>
      </div>

      {/* Rank 2 */}
      {top3[1] && (
        <div className="flex flex-col items-center w-28 sm:w-40 z-20 transform translate-y-8 hover:-translate-y-1 transition-transform duration-300 relative">
          <div className="relative mb-4 group">
            <div className="absolute inset-0 bg-slate-400/20 rounded-full blur-xl group-hover:bg-slate-400/40 transition-all"></div>
            <Medal className={`absolute -top-5 -right-4 w-9 h-9 ${getMedalColor(2)} z-10`} />
            <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full border-[3px] overflow-hidden relative bg-white dark:bg-[#0D0D1F] p-1 ${isMe(top3[1].affiliate_code) ? 'border-sky-400 shadow-[0_0_25px_rgba(56,189,248,0.5)]' : 'border-slate-300 dark:border-slate-300/80 shadow-[0_0_20px_rgba(203,213,225,0.4)] dark:shadow-[0_0_20px_rgba(203,213,225,0.2)]'}`}>
              <div className="w-full h-full rounded-full overflow-hidden relative">
                <Image
                  src={top3[1].avatar || `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${top3[1].affiliate_code}&backgroundColor=1e293b`}
                  alt={top3[1].name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            </div>
            <div className="absolute -bottom-3 inset-x-0 flex justify-center z-20">
               <span className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-widest shadow-lg">2nd</span>
            </div>
          </div>
          <div className={`w-full mt-4 bg-white/60 dark:bg-white/[0.03] backdrop-blur-md rounded-2xl flex flex-col items-center justify-start p-3 border shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] relative overflow-hidden ${isMe(top3[1].affiliate_code) ? 'border-sky-400/50' : 'border-black/5 dark:border-white/10'}`}>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-100 dark:from-slate-900/80 to-transparent"></div>
            <p className="font-bold text-slate-900 dark:text-slate-100 text-sm text-center px-1 truncate w-full relative z-10 flex justify-center items-center gap-1 mb-2">
              {top3[1].name} {isMe(top3[1].affiliate_code) && <span className="text-[9px] bg-sky-500/20 text-sky-600 dark:text-sky-300 px-1.5 py-0.5 rounded-md uppercase">You</span>}
            </p>
            <div className="space-y-1 text-center w-full relative z-10 bg-white/80 dark:bg-slate-900/50 rounded-lg py-1.5 border border-black/5 dark:border-slate-700/50">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-black flex items-center justify-center">Rp {formatRupiahShort(top3[1].totalCommission)}</p>
              <p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-wide">Komisi</p>
            </div>
          </div>
        </div>
      )}

      {/* Rank 1 */}
      {top3[0] && (
        <div className="flex flex-col items-center w-36 sm:w-48 z-30 hover:-translate-y-2 transition-transform duration-300 relative">
          <div className="relative mb-5 group">
            <div className="absolute inset-0 bg-yellow-400/20 rounded-full blur-2xl group-hover:bg-yellow-400/40 transition-all duration-500"></div>
            <Crown className={`absolute -top-8 -right-6 w-14 h-14 ${getMedalColor(1)} z-20 drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]`} />
            <div className={`w-28 h-28 sm:w-32 sm:h-32 rounded-full border-[4px] overflow-hidden relative bg-white dark:bg-[#0D0D1F] p-1.5 ${isMe(top3[0].affiliate_code) ? 'border-sky-400 shadow-[0_0_40px_rgba(56,189,248,0.6)]' : 'border-yellow-400 shadow-[0_0_40px_rgba(250,204,21,0.5)] dark:shadow-[0_0_40px_rgba(250,204,21,0.3)]'}`}>
              <div className="w-full h-full rounded-full overflow-hidden relative">
                <Image
                  src={top3[0].avatar || `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${top3[0].affiliate_code}&backgroundColor=422006`}
                  alt={top3[0].name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            </div>
            <div className="absolute -bottom-4 inset-x-0 flex justify-center z-20">
               <span className="bg-gradient-to-r from-yellow-400 to-yellow-300 dark:from-yellow-600 dark:to-yellow-400 border border-yellow-200 dark:border-yellow-300 text-yellow-950 text-xs font-black px-4 py-1 rounded-full uppercase tracking-widest shadow-[0_4px_15px_rgba(250,204,21,0.5)]">1st</span>
            </div>
          </div>
          <div className={`w-full mt-4 bg-yellow-50 dark:bg-yellow-500/[0.05] backdrop-blur-md rounded-2xl flex flex-col items-center justify-start p-4 border shadow-[0_8px_30px_rgba(250,204,21,0.2)] dark:shadow-[0_8px_30px_rgba(250,204,21,0.15)] relative overflow-hidden ${isMe(top3[0].affiliate_code) ? 'border-sky-400/50' : 'border-yellow-200 dark:border-yellow-500/30'}`}>
            <div className="absolute inset-0 bg-gradient-to-t from-yellow-100/60 dark:from-yellow-900/60 to-transparent"></div>
            <p className="font-bold text-slate-900 dark:text-yellow-50 text-base text-center px-1 truncate w-full relative z-10 flex justify-center items-center gap-1 mb-3">
              {top3[0].name} {isMe(top3[0].affiliate_code) && <span className="text-[10px] bg-sky-500/20 text-sky-600 dark:text-sky-300 px-1.5 py-0.5 rounded-md uppercase">You</span>}
            </p>
            <div className="space-y-1 text-center w-full relative z-10 bg-white/80 dark:bg-black/40 rounded-xl py-2 border border-yellow-200/50 dark:border-yellow-500/20">
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-black flex items-center justify-center">Rp {formatRupiahShort(top3[0].totalCommission)}</p>
              <p className="text-[10px] text-yellow-600 dark:text-yellow-200/50 uppercase tracking-widest font-semibold">Komisi</p>
            </div>
          </div>
        </div>
      )}

      {/* Rank 3 */}
      {top3[2] && (
        <div className="flex flex-col items-center w-28 sm:w-40 z-20 transform translate-y-12 hover:-translate-y-1 transition-transform duration-300 relative">
          <div className="relative mb-4 group">
             <div className="absolute inset-0 bg-purple-500/20 rounded-full blur-xl group-hover:bg-purple-500/40 transition-all"></div>
            <Medal className={`absolute -top-5 -right-4 w-9 h-9 ${getMedalColor(3)} z-10`} />
            <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full border-[3px] overflow-hidden relative bg-white dark:bg-[#0D0D1F] p-1 ${isMe(top3[2].affiliate_code) ? 'border-sky-400 shadow-[0_0_25px_rgba(56,189,248,0.5)]' : 'border-purple-300 dark:border-purple-400/80 shadow-[0_0_20px_rgba(168,85,247,0.3)] dark:shadow-[0_0_20px_rgba(168,85,247,0.2)]'}`}>
               <div className="w-full h-full rounded-full overflow-hidden relative">
                <Image
                  src={top3[2].avatar || `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${top3[2].affiliate_code}&backgroundColor=3b0764`}
                  alt={top3[2].name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            </div>
             <div className="absolute -bottom-3 inset-x-0 flex justify-center z-20">
               <span className="bg-purple-50 dark:bg-purple-900 border border-purple-200 dark:border-purple-500 text-purple-700 dark:text-purple-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-widest shadow-lg">3rd</span>
            </div>
          </div>
          <div className={`w-full mt-4 bg-purple-50/80 dark:bg-purple-500/[0.03] backdrop-blur-md rounded-2xl flex flex-col items-center justify-start p-3 border shadow-[0_8px_30px_rgba(168,85,247,0.15)] dark:shadow-[0_8px_30px_rgba(168,85,247,0.1)] relative overflow-hidden ${isMe(top3[2].affiliate_code) ? 'border-sky-400/50' : 'border-purple-200 dark:border-purple-500/20'}`}>
             <div className="absolute inset-0 bg-gradient-to-t from-purple-100/60 dark:from-purple-900/60 to-transparent"></div>
            <p className="font-bold text-slate-900 dark:text-purple-50 text-sm text-center px-1 truncate w-full relative z-10 flex justify-center items-center gap-1 mb-2">
              {top3[2].name} {isMe(top3[2].affiliate_code) && <span className="text-[9px] bg-sky-500/20 text-sky-600 dark:text-sky-300 px-1.5 py-0.5 rounded-md uppercase">You</span>}
            </p>
            <div className="space-y-1 text-center w-full relative z-10 bg-white/80 dark:bg-black/30 rounded-lg py-1.5 border border-purple-200/50 dark:border-purple-500/20">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-black flex items-center justify-center">Rp {formatRupiahShort(top3[2].totalCommission)}</p>
              <p className="text-[9px] text-purple-600 dark:text-purple-300/50 uppercase tracking-wide">Komisi</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
