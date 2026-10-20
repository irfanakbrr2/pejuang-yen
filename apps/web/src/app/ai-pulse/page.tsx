"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Activity, ArrowLeft, Bookmark, Radar, Radio, Rss } from "lucide-react";
import { aiPulseApi } from "@/lib/api-client";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { Pagination } from "@/components/ui/Pagination";
import { PulseCard, PulseCardSkeleton } from "./_components/PulseCard";
import { ActivityChart } from "./_components/ActivityChart";
import {
  CATEGORY_OPTIONS,
  IMPACT_OPTIONS,
  type PulseListItem,
  type PulseOverview,
} from "./_lib/pulse";

const PAGE_LIMIT = 12;

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Activity }) {
  return (
    <div className="glass-card flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F7E8E8] text-[#8B1414]">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-2xl font-bold tabular-nums leading-none text-[#09090B]">{value}</div>
        <div className="mt-1 text-[11px] font-medium text-[#71717A]">{label}</div>
      </div>
    </div>
  );
}

export default function AiPulsePage() {
  const [overview, setOverview] = useState<PulseOverview | null>(null);
  const [items, setItems] = useState<PulseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [category, setCategory] = useState<string>("");
  const [impact, setImpact] = useState<string>("");

  useEffect(() => {
    aiPulseApi.overview().then((res) => {
      if (res.success) setOverview(res.data as PulseOverview);
    });
  }, []);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    const res = await aiPulseApi.feed({ page, limit: PAGE_LIMIT, category, impact });
    if (res.success) {
      setItems((res.data as PulseListItem[]) ?? []);
      const meta = (res as { pagination?: { totalPages: number } }).pagination;
      setTotalPages(meta?.totalPages ?? 1);
    }
    setLoading(false);
  }, [page, category, impact]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const onFilter = (next: { category?: string; impact?: string }) => {
    if (next.category !== undefined) setCategory(next.category);
    if (next.impact !== undefined) setImpact(next.impact);
    setPage(1);
  };

  return (
    <div className="min-h-dvh bg-[#F7F7F8]">
      {/* Top bar konsisten dengan app + tombol balik ke dashboard */}
      <header className="sticky top-0 z-20 border-b border-[rgba(0,0,0,0.06)] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-[#3F3F46] transition-colors hover:bg-black/[0.04]"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </Link>
          <div className="mx-1 h-5 w-px bg-[rgba(0,0,0,0.08)]" />
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#8B1414] text-white">
              <Radar className="h-4 w-4" />
            </span>
            <span className="font-bold tracking-tight text-[#09090B]">AI Pulse</span>
          </div>
          <Link
            href="/ai-pulse/tersimpan"
            className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-[#3F3F46] transition-colors hover:bg-black/[0.04]"
          >
            <Bookmark className="h-4 w-4" /> Tersimpan
          </Link>
          <Link
            href="/"
            className="rounded-lg bg-[#8B1414] px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#6E0F0F]"
          >
            PejuangYen
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <PageHeader
          eyebrow="AI Intelligence"
          title="Intel AI, langsung jadi skill"
          description="Setiap update AI penting kami ubah jadi paket pembelajaran siap praktik: ringkasan, kenapa penting, use case, sampai kelas & workflow terkait."
        />

        {/* KPI + Chart */}
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="grid grid-cols-3 gap-3 lg:col-span-1 lg:grid-cols-1">
            <StatCard label="Hari ini" value={overview?.kpi.today ?? 0} icon={Radio} />
            <StatCard label="Minggu ini" value={overview?.kpi.this_week ?? 0} icon={Activity} />
            <StatCard label="Sumber aktif" value={overview?.kpi.active_sources ?? 0} icon={Rss} />
          </div>
          <div className="lg:col-span-2">
            <ActivityChart data={overview?.daily_activity ?? []} />
          </div>
        </div>

        {/* Filter chips */}
        <div className="mt-6 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-[#A1A1AA]">Dampak</span>
            <FilterChip active={impact === ""} onClick={() => onFilter({ impact: "" })}>Semua</FilterChip>
            {IMPACT_OPTIONS.map((o) => (
              <FilterChip key={o.id} active={impact === o.id} onClick={() => onFilter({ impact: o.id })}>{o.label}</FilterChip>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-[#A1A1AA]">Topik</span>
            <FilterChip active={category === ""} onClick={() => onFilter({ category: "" })}>Semua</FilterChip>
            {CATEGORY_OPTIONS.map((o) => (
              <FilterChip key={o.id} active={category === o.id} onClick={() => onFilter({ category: o.id })}>{o.label}</FilterChip>
            ))}
          </div>
        </div>

        {/* Feed */}
        <div className="mt-6">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <PulseCardSkeleton key={i} />)}
            </div>
          ) : items.length === 0 ? (
            <div className="glass-card flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Radar className="h-8 w-8 text-gray-300" />
              <p className="text-sm font-medium text-[#71717A]">Belum ada intel untuk filter ini.</p>
              <button onClick={() => onFilter({ category: "", impact: "" })} className="text-sm font-semibold text-[#8B1414] hover:underline">
                Reset filter
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item, i) => <PulseCard key={item.id} item={item} index={i} />)}
              </div>
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-[#8B1414] bg-[#8B1414] text-white"
          : "border-[rgba(0,0,0,0.1)] bg-white text-[#3F3F46] hover:border-[#8B1414]/30 hover:bg-[#F7E8E8]"
      }`}
    >
      {children}
    </button>
  );
}
