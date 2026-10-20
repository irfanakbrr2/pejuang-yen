"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { Route, ArrowRight } from "lucide-react";
import { pathsApi } from "@/lib/api-client";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { StatCardSkeleton } from "@/components/ui/Skeleton";

interface PathCard {
  slug: string;
  title: string;
  subtitle: string | null;
  thumbnail_url: string | null;
  level: string | null;
  is_featured: number;
  item_count: number;
  skills: { slug: string; name: string }[];
  progress?: { percent: number; done: number; total: number } | null;
}

const LEVEL_LABEL: Record<string, string> = {
  beginner: "Pemula",
  intermediate: "Menengah",
  advanced: "Lanjutan",
};

export default function PathsPage() {
  const [paths, setPaths] = useState<PathCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pathsApi.list().then((res: { success: boolean; data?: PathCard[] }) => {
      if (res.success) setPaths(res.data || []);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Learning Path"
        description="Rute belajar terkurasi — ikuti langkah demi langkah dari kelas, rekaman, template, sampai tools."
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : paths.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center p-10 text-center">
          <Route className="mb-4 h-12 w-12 text-gray-300" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Belum Ada Learning Path</h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Learning path sedang disiapkan. Sementara itu, jelajahi konten lewat skill.
          </p>
          <Link href="/explore" className="mt-4 text-sm font-medium text-[#8B1414] hover:underline dark:text-[#C0392B]">
            Ke halaman Jelajahi
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {paths.map((p) => {
            const started = p.progress && p.progress.percent > 0;
            return (
              <Link key={p.slug} href={`/paths/${p.slug}`} className="glass-card glass-card-hover group overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1414] focus-visible:ring-offset-2 dark:focus-visible:ring-[#C0392B]">
                {p.thumbnail_url && (
                  <div className="relative h-36 w-full bg-gray-100 dark:bg-slate-800">
                    <NextImage src={p.thumbnail_url} alt={p.title} fill className="object-cover" />
                  </div>
                )}
                <div className="flex flex-col gap-2 p-5">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[#8B1414] dark:text-[#C0392B]">
                    <Route className="h-3.5 w-3.5" />
                    {p.item_count} langkah
                    {p.level && <span className="text-gray-400">· {LEVEL_LABEL[p.level] || p.level}</span>}
                  </div>
                  <h3 className="font-bold leading-tight text-gray-900 transition-colors group-hover:text-[#8B1414] dark:text-white dark:group-hover:text-[#C0392B]">
                    {p.title}
                  </h3>
                  {p.subtitle && (
                    <p className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{p.subtitle}</p>
                  )}
                  {p.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {p.skills.slice(0, 3).map((s) => (
                        <span key={s.slug} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-slate-800 dark:text-gray-400">
                          {s.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {started ? (
                    <div className="mt-2">
                      <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-gray-400">
                        <span>{p.progress!.done}/{p.progress!.total} selesai</span>
                        <span className="flex items-center gap-1 text-[#8B1414] dark:text-[#C0392B]">
                          Lanjutkan <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-[#8B1414] dark:bg-[#C0392B]"
                          style={{ width: `${p.progress!.percent}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <span className="mt-2 flex items-center gap-1 text-xs font-medium text-[#8B1414] dark:text-[#C0392B]">
                      Mulai path ini <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
