"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Loader2, PlayCircle, Lock } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination } from "@/components/ui/Pagination";
import { Typewriter } from "@/components/ui/typewriter";
import { Hero1 } from "@/components/ui/hero-1";

interface Recording {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  thumbnail_url: string;
  starts_at: string;
  category: string;
  format: string;
  tags: string;
  replay_status: string;
}

export default function RekamanZoomDirectoryPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [format, setFormat] = useState("all");
  const [tag, setTag] = useState("all");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  const load = async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: "12" });
    if (debouncedSearch) p.set("search", debouncedSearch);
    if (category !== "all") p.set("category", category);
    if (format !== "all") p.set("format", format);
    if (tag !== "all") p.set("tag", tag);

    try {
      const res = await api(`/api/user/webinars/recordings/directory?${p}`);
      if (res.success) {
        setRecordings(res.data.recordings || []);
        if (Array.isArray(res.data.categories)) setCategories(res.data.categories);
        setTotalPages(res.data.pagination?.totalPages || 1);
        setTotalItems(res.data.pagination?.total || 0);
      } else {
        toast.error("Gagal memuat rekaman");
      }
    } catch {
      toast.error("Gagal memuat rekaman");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, debouncedSearch, category, format, tag]);

  // Kategori datang dari skill taxonomy via API; format/tag masih daftar umum
  const commonFormats = ["Video", "Workshop", "Q&A", "Course"];
  const commonTags = ["AI", "Copywriting", "Sales", "Automation"];

  return (
    <div className="flex flex-col items-center max-w-6xl mx-auto py-6 md:py-10 space-y-8">
      
      <Hero1
        badgeEmoji="🎥"
        badgeText="Video Recordings"
        title={
          <>
            <span>Tonton kembali </span>
            <br className="md:hidden" />
            <Typewriter
              text={[
                "rekaman webinar kami",
                "strategi dari expert",
                "insight eksklusif",
                "materi premium"
              ]}
              speed={70}
              className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-indigo-300"
              waitTime={1500}
              deleteSpeed={40}
              cursorChar={"_"}
            />
          </>
        }
        subtitle={`Akses ${totalItems > 0 ? totalItems : "berbagai"} video rekaman zoom untuk meningkatkan skill dan bisnismu.`}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Cari judul rekaman..."
      >
        {/* Filters */}
        <div className="flex gap-3 overflow-x-auto max-w-full hide-scrollbar">
          <Select value={category} onValueChange={(val) => { setCategory(val); setPage(1); }}>
            <SelectTrigger className="w-[180px] rounded-full bg-white/5 border-white/10 text-white hover:bg-white/10">
              <SelectValue placeholder="Filter by Categories" />
            </SelectTrigger>
            <SelectContent className="bg-[#1c1528] border-white/10 text-white">
              <SelectItem value="all">Semua Kategori</SelectItem>
              {categories.map((c) => <SelectItem key={c} value={c} className="hover:bg-white/5 focus:bg-white/10 focus:text-white">{c}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={format} onValueChange={(val) => { setFormat(val); setPage(1); }}>
            <SelectTrigger className="w-[180px] rounded-full bg-white/5 border-white/10 text-white hover:bg-white/10">
              <SelectValue placeholder="Filter by Formats" />
            </SelectTrigger>
            <SelectContent className="bg-[#1c1528] border-white/10 text-white">
              <SelectItem value="all">All Formats</SelectItem>
              {commonFormats.map((f) => <SelectItem key={f} value={f} className="hover:bg-white/5 focus:bg-white/10 focus:text-white">{f}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={tag} onValueChange={(val) => { setTag(val); setPage(1); }}>
            <SelectTrigger className="w-[180px] rounded-full bg-white/5 border-white/10 text-white hover:bg-white/10">
              <SelectValue placeholder="Filter by Tags" />
            </SelectTrigger>
            <SelectContent className="bg-[#1c1528] border-white/10 text-white">
              <SelectItem value="all">All Tags</SelectItem>
              {commonTags.map((t) => <SelectItem key={t} value={t} className="hover:bg-white/5 focus:bg-white/10 focus:text-white">{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Hero1>

      {/* Grid */}
      <div className="w-full">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="animate-spin text-primary w-10 h-10" />
          </div>
        ) : recordings.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-2xl border border-gray-100">
            <PlayCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-warm-black">Tidak ada rekaman ditemukan</h3>
            <p className="text-gray-500">Coba ubah kata kunci atau filter pencarian Anda.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {recordings.map((rec) => (
              <div key={rec.id} className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1 flex flex-col">
                <div className="relative aspect-video bg-gray-900 overflow-hidden">
                  {rec.thumbnail_url ? (
                    <img src={rec.thumbnail_url} alt={rec.title} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-black">
                      <PlayCircle className="w-16 h-16 text-white/20" />
                    </div>
                  )}
                  {rec.replay_status === "membership_only" && (
                    <div className="absolute top-3 right-3 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1 shadow-lg">
                      <Lock size={12} />
                      Premium
                    </div>
                  )}
                </div>
                
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex gap-2 mb-3">
                    {rec.category && <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-md">{rec.category}</span>}
                    {rec.format && <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-md">{rec.format}</span>}
                  </div>
                  <h3 className="text-lg font-bold text-warm-black line-clamp-2 leading-tight mb-2 group-hover:text-primary transition-colors">
                    {rec.title}
                  </h3>
                  {rec.subtitle && <p className="text-sm text-gray-500 line-clamp-2 mb-4">{rec.subtitle}</p>}
                  
                  <div className="mt-auto pt-4 border-t border-gray-50">
                    <Link href={`/rekaman-zoom/${rec.slug}`} className="w-full block">
                      <Button variant="secondary" className="w-full rounded-xl group-hover:bg-[#8B1414] group-hover:text-white hover:bg-[#8B1414] hover:text-white hover:border-transparent transition-colors duration-300">
                        Open
                      </Button>
                    </Link>
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
