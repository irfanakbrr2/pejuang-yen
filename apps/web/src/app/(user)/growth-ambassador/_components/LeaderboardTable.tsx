"use client";

import Image from "next/image";
import { Star } from "lucide-react";
import type { ExtendedLeaderboardEntry } from "./LeaderboardHero";
import { formatRupiahShort } from "../page";
import TierBadge from "@/components/ui/TierBadge";
import RankDelta from "@/components/ui/RankDelta";

interface LeaderboardTableProps {
  entries: ExtendedLeaderboardEntry[];
  myRank?: ExtendedLeaderboardEntry | null;
  isMeInList?: boolean;
}

export function LeaderboardTable({ entries, myRank, isMeInList = true }: LeaderboardTableProps) {
  if (entries.length === 0 && !myRank) return null;

  const isMe = (code?: string) => code === myRank?.affiliate_code;

  return (
    <div className="w-full mt-10">
      {/* Desktop Table */}
      <div className="hidden md:block w-full overflow-x-auto pb-4">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-y border-slate-200 dark:border-white/[0.08] bg-slate-100 dark:bg-white/[0.04] text-xs text-slate-700 dark:text-white uppercase tracking-widest font-bold">
              <th className="py-4 pl-6 pr-2 w-20">Rank</th>
              <th className="py-4 px-2">Member</th>
              <th className="py-4 px-2 text-right">Komisi</th>
              <th className="py-4 pl-2 pr-6 text-center">Referrals</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/5">
            {entries.map((user) => {
              const me = isMe(user.affiliate_code);
              return (
                <tr key={user.affiliate_code} className={`transition-colors group ${me ? 'bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/20' : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'}`}>
                  <td className="py-4 pl-6 pr-2">
                    <div className={`${me ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500'} font-bold w-10 text-center text-lg flex flex-col items-center`}>
                      #{user.rank}
                      <RankDelta delta={user.delta} />
                    </div>
                  </td>
                  <td className="py-4 px-2">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full overflow-hidden relative bg-white dark:bg-[#0D0D1F] border shadow-inner shrink-0 ${me ? 'border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.3)]' : 'border-black/10 dark:border-white/10'}`}>
                        <Image
                          src={user.avatar || `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${user.affiliate_code}&backgroundColor=0f172a`}
                          alt={user.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <div>
                        <p className={`font-semibold flex items-center gap-1.5 ${me ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-100'}`}>
                          {user.name}
                          {user.badges?.includes("growth_ambassador") && (
                            <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                          )}
                          {me && <span className="text-[9px] bg-sky-500/20 text-sky-600 dark:text-sky-300 px-1.5 py-0.5 rounded-md uppercase ml-1">You</span>}
                        </p>
                        {user.tier && <div className="mt-1"><TierBadge tier={user.tier} /></div>}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-2 text-right">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">Rp {formatRupiahShort(user.totalCommission)}</span>
                  </td>
                  <td className="py-4 pl-2 pr-6 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-slate-600 dark:text-slate-300 font-semibold">{user.referrals} <span className="text-[10px] font-normal text-slate-400">Ref</span></span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{user.leads || 0} Leads</span>
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Current User Row if not in top list */}
            {myRank && !isMeInList && (
              <>
                <tr>
                  <td colSpan={4} className="py-3 text-center">
                    <div className="flex justify-center gap-1">
                      <div className="w-1 h-1 rounded-full bg-slate-600"></div>
                      <div className="w-1 h-1 rounded-full bg-slate-600"></div>
                      <div className="w-1 h-1 rounded-full bg-slate-600"></div>
                    </div>
                  </td>
                </tr>
                <tr className="bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/20 transition-colors group">
                  <td className="py-4 pl-6 pr-2">
                    <div className="text-sky-600 dark:text-sky-400 font-bold w-8 text-center text-lg">#{myRank.rank}</div>
                  </td>
                  <td className="py-4 px-2">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full overflow-hidden relative bg-white dark:bg-[#0D0D1F] border border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.3)] shadow-inner shrink-0">
                        <Image
                          src={myRank.avatar || `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${myRank.affiliate_code}&backgroundColor=0f172a`}
                          alt={myRank.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                      <div>
                        <p className="font-semibold flex items-center gap-1.5 text-slate-900 dark:text-white">
                          {myRank.name}
                          {myRank.badges?.includes("growth_ambassador") && (
                            <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                          )}
                          <span className="text-[9px] bg-sky-500/20 text-sky-600 dark:text-sky-300 px-1.5 py-0.5 rounded-md uppercase ml-1">You</span>
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-2 text-right">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">Rp {formatRupiahShort(myRank.totalCommission)}</span>
                  </td>
                  <td className="py-4 pl-2 pr-6 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-slate-600 dark:text-slate-300 font-semibold">{myRank.referrals} <span className="text-[10px] font-normal text-slate-400">Ref</span></span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{myRank.leads || 0} Leads</span>
                    </div>
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-3 mt-4">
        {entries.map((user) => {
          const me = isMe(user.affiliate_code);
          return (
            <div key={user.affiliate_code} className={`${me ? 'bg-sky-50 dark:bg-sky-500/10 border-sky-300 dark:border-sky-500/30' : 'bg-white dark:bg-white/[0.02] border-black/5 dark:border-white/5 shadow-sm dark:shadow-none'} border rounded-2xl p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors relative overflow-hidden group`}>
               <div className={`absolute -right-2 -bottom-4 text-6xl font-black pointer-events-none group-hover:scale-110 transition-transform ${me ? 'text-sky-500/10' : 'text-slate-900/[0.02] dark:text-white/[0.02]'}`}>
                 {user.rank}
               </div>
               
              <div className="flex items-center gap-3 relative z-10">
                <div className={`w-9 flex flex-col items-center font-bold text-sm ${me ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500'}`}>#{user.rank}<RankDelta delta={user.delta} /></div>
                <div className={`w-10 h-10 rounded-full overflow-hidden relative bg-white dark:bg-[#0D0D1F] border shrink-0 ${me ? 'border-sky-400/50' : 'border-black/5 dark:border-white/10'}`}>
                  <Image
                    src={user.avatar || `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${user.affiliate_code}&backgroundColor=0f172a`}
                    alt={user.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="min-w-0">
                  <p className={`font-semibold text-sm truncate flex items-center gap-1 ${me ? 'text-slate-900 dark:text-white' : 'text-slate-800 dark:text-slate-100'}`}>
                    {user.name}
                    {user.badges?.includes("growth_ambassador") && (
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0" />
                    )}
                    {me && <span className="text-[9px] bg-sky-500/20 text-sky-600 dark:text-sky-300 px-1.5 py-0.5 rounded-md uppercase ml-1">You</span>}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                     {user.tier && <TierBadge tier={user.tier} />}
                     <span>{user.referrals} Ref • {user.leads || 0} Leads</span>
                  </div>
                </div>
              </div>
              <div className="text-right relative z-10 pl-2">
                <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">Rp {formatRupiahShort(user.totalCommission)}</p>
                <p className="text-[9px] text-slate-500 uppercase tracking-wide">Komisi</p>
              </div>
            </div>
          );
        })}

        {/* Current User Mobile Card if not in top list */}
        {myRank && !isMeInList && (
          <>
            <div className="flex justify-center gap-1 py-2">
              <div className="w-1 h-1 rounded-full bg-slate-600"></div>
              <div className="w-1 h-1 rounded-full bg-slate-600"></div>
              <div className="w-1 h-1 rounded-full bg-slate-600"></div>
            </div>
            <div className="bg-sky-50 dark:bg-sky-500/10 border-sky-300 dark:border-sky-500/30 border rounded-2xl p-4 flex items-center justify-between hover:bg-sky-100 dark:hover:bg-white/[0.04] transition-colors relative overflow-hidden group shadow-sm dark:shadow-none">
               <div className="absolute -right-2 -bottom-4 text-6xl font-black pointer-events-none group-hover:scale-110 transition-transform text-sky-500/10">
                 {myRank.rank}
               </div>
               
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-8 text-center font-bold text-sm text-sky-600 dark:text-sky-400">#{myRank.rank}</div>
                <div className="w-10 h-10 rounded-full overflow-hidden relative bg-white dark:bg-[#0D0D1F] border shrink-0 border-sky-400/50">
                  <Image
                    src={myRank.avatar || `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${myRank.affiliate_code}&backgroundColor=0f172a`}
                    alt={myRank.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate flex items-center gap-1 text-slate-900 dark:text-white">
                    {myRank.name}
                    {myRank.badges?.includes("growth_ambassador") && (
                      <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0" />
                    )}
                    <span className="text-[9px] bg-sky-500/20 text-sky-600 dark:text-sky-300 px-1.5 py-0.5 rounded-md uppercase ml-1">You</span>
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                     <span>{myRank.referrals} Referrals • {myRank.leads || 0} Leads</span>
                  </div>
                </div>
              </div>
              <div className="text-right relative z-10 pl-2">
                <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">Rp {formatRupiahShort(myRank.totalCommission)}</p>
                <p className="text-[9px] text-slate-500 uppercase tracking-wide">Komisi</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
