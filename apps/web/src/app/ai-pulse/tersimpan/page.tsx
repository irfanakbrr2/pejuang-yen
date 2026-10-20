"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bookmark, Radar } from "lucide-react";
import { aiPulseApi } from "@/lib/api-client";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { PulseCard, PulseCardSkeleton } from "../_components/PulseCard";
import type { PulseListItem } from "../_lib/pulse";

export default function AiPulseSavedPage() {
  const [items, setItems] = useState<PulseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);

  useEffect(() => {
    aiPulseApi.bookmarks().then((res) => {
      if (res.success) {
        setItems((res.data as PulseListItem[]) ?? []);
      } else if (res.error?.toLowerCase().match(/unauth|login|session/)) {
        setNeedLogin(true);
      }
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-dvh bg-[#F7F7F8]">
      <header className="sticky top-0 z-20 border-b border-[rgba(0,0,0,0.06)] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link href="/ai-pulse" className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-[#3F3F46] hover:bg-black/[0.04]">
            <ArrowLeft className="h-4 w-4" /> AI Pulse
          </Link>
          <Link href="/dashboard" className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-[#71717A] hover:bg-black/[0.04]">
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <PageHeader eyebrow="AI Pulse" title="Tersimpan" description="Artikel AI Pulse yang kamu simpan." />

        <div className="mt-5">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => <PulseCardSkeleton key={i} />)}
            </div>
          ) : needLogin ? (
            <div className="glass-card flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Bookmark className="h-8 w-8 text-gray-300" />
              <p className="text-sm font-medium text-[#71717A]">Masuk dulu untuk melihat artikel tersimpan.</p>
              <Link href="/login?redirect=/ai-pulse/tersimpan" className="rounded-lg bg-[#8B1414] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6E0F0F]">
                Masuk
              </Link>
            </div>
          ) : items.length === 0 ? (
            <div className="glass-card flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Radar className="h-8 w-8 text-gray-300" />
              <p className="text-sm font-medium text-[#71717A]">Belum ada artikel tersimpan.</p>
              <Link href="/ai-pulse" className="text-sm font-semibold text-[#8B1414] hover:underline">Jelajahi AI Pulse</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item, i) => <PulseCard key={item.id} item={item} index={i} />)}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
