"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, Loader2, FolderOpen, ExternalLink, Lock, Gift, Package } from "lucide-react";
import { api } from "@/lib/api-client";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState } from "@/components/ui/lottie/EmptyState";
import { Button } from "@/components/ui/Button";
import { Typewriter } from "@/components/ui/typewriter";
import { Hero1 } from "@/components/ui/hero-1";

interface BonusTag {
  tag_type: string;
  tag_value: string;
}

interface Bonus {
  id: string;
  slug: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  external_url?: string;
  bonus_type?: string;
  asset_type?: string | null;
  category_name?: string | null;
  category_slug?: string | null;
  is_locked?: boolean;
  file_thumbnails?: string[];
  file_count?: number;
  tags?: BonusTag[];
}

export default function BonusesPage() {
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [categories, setCategories] = useState<{ slug: string; name: string; bonus_count?: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: "12" });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (category !== "all") params.set("category", category);

    try {
      const res = await api(`/api/user/bonuses?${params}`);
      if (res.success) {
        setBonuses(res.data.bonuses || []);
        setCategories(res.data.categories || []);
        setTotalPages(res.data.pagination?.totalPages || 1);
        setTotalItems(res.data.pagination?.total || 0);
      } else {
        setError(res.error || "Gagal memuat data");
      }
    } catch {
      setError("Gagal memuat data. Periksa koneksi internet.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, debouncedSearch, category]);

  const getCategoryTag = (b: Bonus) => b.tags?.find(t => t.tag_type === "category")?.tag_value;
  const getFileCount = (b: Bonus) => b.file_count || 0;

  return (
    <div className="flex flex-col items-center max-w-6xl mx-auto py-6 md:py-10 space-y-8">
      
      <Hero1
        badgeEmoji="🎁"
        badgeText="Exclusive Resources"
        title={
          <>
            <span>Akses koleksi </span>
            <br className="md:hidden" />
            <Typewriter
              text={[
                "bonus eksklusif",
                "resource premium",
                "template bisnis",
                "materi pilihan"
              ]}
              speed={70}
              className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-indigo-300"
              waitTime={1500}
              deleteSpeed={40}
              cursorChar={"_"}
            />
          </>
        }
        subtitle={`${totalItems > 0 ? totalItems : "Berbagai"} bonus resource eksklusif untuk meningkatkan skill dan bisnismu.`}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Cari bonus..."
      >
        {/* Chip 9 kategori utama (horizontal scroll) */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto max-w-full hide-scrollbar pb-1">
            <button
              onClick={() => { setCategory("all"); setPage(1); }}
              className={`shrink-0 text-xs font-medium rounded-full px-3.5 py-1.5 border transition-colors ${
                category === "all"
                  ? "bg-white text-gray-900 border-white"
                  : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10"
              }`}
            >
              Semua Kategori
            </button>
            {categories.map((c) => {
              const isEmpty = (c.bonus_count ?? 0) === 0;
              if (isEmpty) {
                return (
                  <span
                    key={c.slug}
                    className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-3.5 py-1.5 border border-white/5 bg-white/[0.02] text-white/30 cursor-default select-none whitespace-nowrap"
                    title="Bonus untuk kategori ini sedang disiapkan"
                  >
                    {c.name}
                    <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/40">
                      Coming Soon
                    </span>
                  </span>
                );
              }
              return (
                <button
                  key={c.slug}
                  onClick={() => { setCategory(c.slug); setPage(1); }}
                  className={`shrink-0 text-xs font-medium rounded-full px-3.5 py-1.5 border transition-colors whitespace-nowrap ${
                    category === c.slug
                      ? "bg-white text-gray-900 border-white"
                      : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10"
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        )}
      </Hero1>

      {/* Grid */}
      <div className="w-full">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="animate-spin text-primary w-10 h-10" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
            <button onClick={loadData} className="text-xs font-medium text-primary hover:underline">Coba Lagi</button>
          </div>
        ) : bonuses.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
            <Package className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-warm-black dark:text-white">Tidak ada bonus ditemukan</h3>
            <p className="text-gray-500 dark:text-slate-400">Coba ubah kata kunci atau filter pencarian Anda.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {bonuses.map((b) => (
              <div key={b.id} className="group bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-100 dark:border-white/[0.06] overflow-hidden hover:shadow-xl dark:hover:shadow-black/20 transition-all duration-300 hover:-translate-y-1 flex flex-col">
                {/* Thumbnail */}
                <div className="relative aspect-video bg-gray-900 overflow-hidden">
                  {b.thumbnail_url ? (
                    <Image
                      src={b.thumbnail_url}
                      alt={b.title}
                      fill
                      sizes="(max-width: 640px) 100vw, 33vw"
                      loading="lazy"
                      className="object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                    />
                  ) : b.bonus_type === 'bundle' && b.file_thumbnails && b.file_thumbnails.length > 0 ? (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 p-6">
                      <div className="relative w-3/5 aspect-[4/3] flex items-center justify-center transition-transform duration-300 group-hover:-translate-y-1.5 group-hover:scale-105">
                        {b.file_thumbnails.slice(0, 3).reverse().map((thumb, index, arr) => {
                          const position = arr.length - 1 - index;
                          let transformClasses = "";
                          if (position === 0) transformClasses = "z-30 translate-y-0 scale-100 opacity-100 shadow-md";
                          else if (position === 1) transformClasses = "z-20 translate-y-2.5 scale-95 opacity-80 shadow-sm";
                          else if (position === 2) transformClasses = "z-10 translate-y-5 scale-90 opacity-60";

                          return (
                            <div
                              key={index}
                              className={`absolute w-full h-full rounded-xl border border-black/10 overflow-hidden bg-white transition-all duration-300 ${transformClasses}`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={thumb} alt="File Thumbnail" className="w-full h-full object-cover" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-black">
                      <Gift className="w-16 h-16 text-white/20" />
                    </div>
                  )}

                  {/* Locked badge */}
                  {b.is_locked && (
                    <div className="absolute top-3 right-3 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1 shadow-lg">
                      <Lock size={12} />
                      Premium
                    </div>
                  )}

                  {/* File count badge */}
                  {b.bonus_type === 'bundle' && getFileCount(b) > 0 && (
                    <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-md flex items-center gap-1.5">
                      <FolderOpen size={12} />
                      {getFileCount(b)} resources
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col">
                  {/* Badge: kategori topik + jenis aset + label Bonus */}
                  <div className="flex gap-2 mb-3 flex-wrap">
                    <span className="text-xs font-semibold text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10 px-2 py-1 rounded-md">
                      Bonus
                    </span>
                    {(b.category_name || getCategoryTag(b)) && (
                      <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-md">
                        {b.category_name || getCategoryTag(b)}
                      </span>
                    )}
                    {(b.asset_type || b.bonus_type) && (
                      <span className="text-xs font-medium text-gray-600 dark:text-slate-400 bg-gray-100 dark:bg-white/10 px-2 py-1 rounded-md capitalize">
                        {b.asset_type
                          ? b.asset_type.replace(/_/g, " ")
                          : b.bonus_type === 'mini_course' ? 'Mini Course' : b.bonus_type}
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-warm-black dark:text-white line-clamp-2 leading-tight mb-2 group-hover:text-primary transition-colors">
                    {b.title}
                  </h3>

                  {b.description && (
                    <p className="text-sm text-gray-500 dark:text-slate-400 line-clamp-2 mb-4">{b.description}</p>
                  )}

                  {/* Action */}
                  <div className="mt-auto pt-4 border-t border-gray-50 dark:border-white/5">
                    {b.bonus_type === 'bundle' ? (
                      <Link href={`/bonuses/${b.slug}`} className="w-full block">
                        <Button variant="secondary" className="w-full rounded-xl group-hover:bg-[#8B1414] group-hover:text-white hover:bg-[#8B1414] hover:text-white hover:border-transparent transition-colors duration-300">
                          <FolderOpen size={15} className="mr-1.5" />
                          Lihat Bundle
                        </Button>
                      </Link>
                    ) : b.bonus_type === 'mini_course' ? (
                      <Link href={`/bonuses/${b.slug}`} className="w-full block">
                        <Button variant="secondary" className="w-full rounded-xl group-hover:bg-[#8B1414] group-hover:text-white hover:bg-[#8B1414] hover:text-white hover:border-transparent transition-colors duration-300">
                          Lihat Course
                        </Button>
                      </Link>
                    ) : b.is_locked ? (
                      <Button
                        variant="secondary"
                        className="w-full rounded-xl"
                        onClick={() => window.open("https://app.pejuangyen.com/premium/", "_blank")}
                      >
                        <Lock size={14} className="mr-1.5" />
                        Upgrade Membership
                      </Button>
                    ) : b.external_url ? (
                      <a href={b.external_url} target="_blank" rel="noreferrer" className="w-full block">
                        <Button variant="secondary" className="w-full rounded-xl group-hover:bg-[#8B1414] group-hover:text-white hover:bg-[#8B1414] hover:text-white hover:border-transparent transition-colors duration-300">
                          <ExternalLink size={14} className="mr-1.5" />
                          Akses Resource
                        </Button>
                      </a>
                    ) : (
                      <Button variant="secondary" className="w-full rounded-xl" disabled>
                        Link belum tersedia
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && !loading && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}
