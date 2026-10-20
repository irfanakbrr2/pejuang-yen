"use client";

import { useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";
import { api, resourcesApi } from "@/lib/api-client";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { StatCardSkeleton } from "@/components/ui/Skeleton";
import { ContentCard, type ContentItem } from "@/components/content/ContentCard";

interface CategoryChip {
  slug: string;
  name: string;
  course_count?: number;
}

// Katalog kelas — hanya Content Type: Class, difilter per 9 kategori utama
// (taxonomy topik — docs/content-taxonomy-plan.md)
export default function KelasCatalogPage() {
  const [courses, setCourses] = useState<ContentItem[]>([]);
  const [categories, setCategories] = useState<CategoryChip[]>([]);
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);

  // Preselect dari ?category=<slug> (link "Lihat Katalog" di /my-classes).
  // Dibaca di effect (client-only): pada static export, query tidak tersedia
  // saat prerender, jadi lazy-init via window selalu "" di HTML hasil build.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("category");
    if (fromUrl) setCategory(fromUrl);
  }, []);

  useEffect(() => {
    api("/api/categories").then((res: { success: boolean; data?: CategoryChip[] }) => {
      if (res.success && Array.isArray(res.data)) setCategories(res.data);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = { type: "course" };
    if (category) params.taxonomy_category = category;
    resourcesApi.list(params).then((res: { success: boolean; data?: ContentItem[] }) => {
      if (res.success) setCourses(res.data || []);
    }).finally(() => setLoading(false));
  }, [category]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Semua Kelas"
        description="Katalog lengkap kelas PejuangYen — pilih kategori untuk mempersempit."
      />

      {/* Chip 9 kategori utama */}
      {categories.length > 0 && (
        <div
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
          role="group"
          aria-label="Filter kategori"
        >
          <button
            onClick={() => setCategory("")}
            aria-pressed={!category}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1414] ${
              !category
                ? "bg-[#8B1414] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300"
            }`}
          >
            Semua Kategori
          </button>
          {categories.map((c) => {
            const isEmpty = (c.course_count ?? 0) === 0;
            if (isEmpty) {
              return (
                <span
                  key={c.slug}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium bg-gray-50 text-gray-300 dark:bg-slate-900 dark:text-slate-600 cursor-default select-none"
                  title="Kelas untuk kategori ini sedang disiapkan"
                >
                  {c.name}
                  <span className="rounded-full bg-gray-200 dark:bg-slate-700 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-400">
                    Coming Soon
                  </span>
                </span>
              );
            }
            return (
              <button
                key={c.slug}
                onClick={() => setCategory(category === c.slug ? "" : c.slug)}
                aria-pressed={category === c.slug}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1414] ${
                  category === c.slug
                    ? "bg-[#8B1414] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300"
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>
      )}

      <p aria-live="polite" className={!loading ? "text-xs font-medium text-gray-400" : "sr-only"}>
        {!loading ? `${courses.length} kelas ditemukan` : "Memuat kelas…"}
      </p>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <StatCardSkeleton key={i} />)}
        </div>
      ) : courses.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center p-10 text-center">
          <GraduationCap className="mb-4 h-12 w-12 text-gray-300" aria-hidden="true" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Belum Ada Kelas di Kategori Ini</h3>
          <p className="mt-2 text-gray-500 dark:text-gray-400">Coba pilih kategori lain.</p>
          {category && (
            <button
              onClick={() => setCategory("")}
              className="mt-4 text-sm font-medium text-[#8B1414] hover:underline dark:text-[#C0392B]"
            >
              Tampilkan semua kelas
            </button>
          )}
        </div>
      ) : (
        /* Dua kelompok akses: Free dan Premium — tidak dicampur */
        <div className="space-y-8">
          {[
            {
              key: "free",
              label: "Kelas Gratis",
              badge: "FREE",
              badgeClass: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
              wrapClass: "rounded-2xl bg-green-50/50 p-4 ring-1 ring-green-100 dark:bg-green-900/10 dark:ring-green-900/20",
              items: courses.filter((c) => c.access_type === "free"),
            },
            {
              key: "premium",
              label: "Kelas Premium",
              badge: "PREMIUM",
              badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
              wrapClass: "rounded-2xl bg-amber-50/50 p-4 ring-1 ring-amber-100 dark:bg-amber-900/10 dark:ring-amber-900/20",
              items: courses.filter((c) => c.access_type !== "free"),
            },
          ].map((group) =>
            group.items.length === 0 ? null : (
              <section key={group.key} aria-label={group.label} className={group.wrapClass}>
                <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
                  {group.label}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${group.badgeClass}`}>
                    {group.badge}
                  </span>
                  <span className="text-sm font-medium text-gray-400">({group.items.length})</span>
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {group.items.map((c, idx) => (
                    <div
                      key={c.id || c.ref_id}
                      className="animate-fade-in-up"
                      style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}
                    >
                      <ContentCard item={c} />
                    </div>
                  ))}
                </div>
              </section>
            )
          )}
        </div>
      )}
    </div>
  );
}
