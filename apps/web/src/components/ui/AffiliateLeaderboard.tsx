"use client";
/* eslint-disable @next/next/no-img-element */

export interface LeaderboardEntry {
  rank: number;
  name: string;
  initials: string;
  avatar?: string;
  referrals: number;
  totalCommission: number;
  isCurrentUser?: boolean;
}

interface AffiliateLeaderboardProps {
  entries: LeaderboardEntry[];
  myRank?: LeaderboardEntry | null;
  className?: string;
}

const MEDAL: Record<number, { bg: string; text: string; label: string }> = {
  1: { bg: "bg-[#FFF7ED] dark:bg-amber-500/10", text: "text-[#D97706] dark:text-amber-500", label: "#1" },
  2: { bg: "bg-[#F8FAFC] dark:bg-slate-500/10", text: "text-[#64748B] dark:text-slate-400", label: "#2" },
  3: { bg: "bg-[#FFF7ED] dark:bg-orange-500/10", text: "text-[#B45309] dark:text-orange-400", label: "#3" },
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(value);
}

export function AffiliateLeaderboard({
  entries,
  myRank,
  className = "",
}: AffiliateLeaderboardProps) {
  if (entries.length === 0 && !myRank) return null;

  const isMeInList = myRank ? entries.some((e) => e.rank === myRank.rank) : false;

  return (
    <div className={`card-sharp p-5 ${className}`}>
      <div className="mb-4">
        <h3 className="text-[15px] font-semibold text-[#0D0D0D] dark:text-white heading-tight">
          Leaderboard Affiliate
        </h3>
        <p className="text-xs text-[#9CA3AF] dark:text-slate-400 mt-0.5">Ranking bulan ini</p>
      </div>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full min-w-[340px] text-sm">
          <thead>
            <tr className="border-b border-black/[0.04] dark:border-white/[0.05] text-[#6B7280] dark:text-slate-400">
              <th className="label-uppercase pb-2 text-left pl-1" style={{ fontSize: "10px" }}>
                Rank
              </th>
              <th className="label-uppercase pb-2 text-left" style={{ fontSize: "10px" }}>
                Member
              </th>
              <th className="label-uppercase pb-2 text-right" style={{ fontSize: "10px" }}>
                Referral
              </th>
              <th className="label-uppercase pb-2 text-right pr-1" style={{ fontSize: "10px" }}>
                Komisi
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => {
              const medal = MEDAL[entry.rank];
              return (
                <tr
                  key={entry.rank}
                  className={`animate-fade-in-left border-b border-black/[0.04] dark:border-white/[0.05] last:border-0 transition-colors duration-150 ${
                    entry.isCurrentUser
                      ? "bg-[#8B1414]/[0.04] dark:bg-[#C0392B]/10 rounded-lg"
                      : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                  }`}
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {/* Rank */}
                  <td className="py-2.5 pl-1">
                    {medal ? (
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-lg text-[11px] font-bold ${medal.bg} ${medal.text}`}
                      >
                        {entry.rank}
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-[#9CA3AF] dark:text-slate-500 pl-1">
                        #{entry.rank}
                      </span>
                    )}
                  </td>

                  {/* Member */}
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#F2F2F7] dark:bg-[#0D0D1F] border border-black/[0.06] dark:border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                        {entry.avatar ? (
                          <img
                            src={entry.avatar}
                            alt={entry.name}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-[10px] font-semibold text-[#6B7280] dark:text-slate-400">
                            {entry.initials}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-sm font-medium truncate max-w-[100px] ${
                          entry.isCurrentUser ? "text-[#8B1414] dark:text-[#C0392B]" : "text-[#0D0D0D] dark:text-white"
                        }`}
                      >
                        {entry.name}
                        {entry.isCurrentUser && (
                          <span className="ml-1 text-[10px] text-[#8B1414] dark:text-[#34D399] font-normal">
                            (Kamu)
                          </span>
                        )}
                      </span>
                    </div>
                  </td>

                  {/* Referrals */}
                  <td className="py-2.5 text-right tabular-nums">
                    <span className="text-sm font-semibold text-[#0D0D0D] dark:text-white">
                      {entry.referrals}
                    </span>
                  </td>

                  {/* Commission */}
                  <td className="py-2.5 text-right tabular-nums pr-1">
                    <span className="text-sm font-semibold text-[#8B1414] dark:text-[#C0392B]">
                      {formatCurrency(entry.totalCommission)}
                    </span>
                  </td>
                </tr>
              );
            })}
            {myRank && !isMeInList && (
              <>
                <tr>
                  <td colSpan={4} className="py-2 text-center">
                    <div className="flex justify-center gap-1 opacity-40">
                      <div className="w-1 h-1 rounded-full bg-[#6B7280]"></div>
                      <div className="w-1 h-1 rounded-full bg-[#6B7280]"></div>
                      <div className="w-1 h-1 rounded-full bg-[#6B7280]"></div>
                    </div>
                  </td>
                </tr>
                <tr className="border-b border-black/[0.04] dark:border-white/[0.05] last:border-0 bg-[#8B1414]/[0.04] dark:bg-[#C0392B]/10 rounded-lg transition-colors duration-150">
                  {/* Rank */}
                  <td className="py-2.5 pl-1">
                    <span className="text-xs font-medium text-[#8B1414] dark:text-[#34D399] pl-1">
                      #{myRank.rank}
                    </span>
                  </td>

                  {/* Member */}
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-[#F2F2F7] dark:bg-[#0D0D1F] border border-[#8B1414]/30 dark:border-[#C0392B]/30 flex items-center justify-center shrink-0 overflow-hidden shadow-[0_0_8px_rgba(192,57,43,0.2)]">
                        {myRank.avatar ? (
                          <img
                            src={myRank.avatar}
                            alt={myRank.name}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-[10px] font-semibold text-[#8B1414] dark:text-[#34D399]">
                            {myRank.initials}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-medium truncate max-w-[100px] text-[#8B1414] dark:text-[#C0392B]">
                        {myRank.name}
                        <span className="ml-1 text-[10px] text-[#8B1414] dark:text-[#34D399] font-normal">
                          (Kamu)
                        </span>
                      </span>
                    </div>
                  </td>

                  {/* Referrals */}
                  <td className="py-2.5 text-right tabular-nums">
                    <span className="text-sm font-semibold text-[#0D0D0D] dark:text-white">
                      {myRank.referrals}
                    </span>
                  </td>

                  {/* Commission */}
                  <td className="py-2.5 text-right tabular-nums pr-1">
                    <span className="text-sm font-semibold text-[#8B1414] dark:text-[#C0392B]">
                      {formatCurrency(myRank.totalCommission)}
                    </span>
                  </td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
