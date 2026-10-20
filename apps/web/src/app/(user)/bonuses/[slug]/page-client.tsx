"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { File, ArrowLeft, Loader2, Music, Video, FileText, Lock, Play, Eye, ExternalLink } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { track } from "@/lib/tracking/client";

interface BonusFile {
  id: string;
  title: string;
  file_type: string;
  file_url: string;
  preview_url?: string | null;
  thumbnail_url?: string;
}

interface BonusDetail {
  id: string;
  slug: string;
  title: string;
  description: string;
  thumbnail_url: string;
  bonus_type: string;
  is_locked?: boolean;
  required_plan_names?: string[];
  files: BonusFile[];
}

export default function BonusBundleClient() {
  const params = useParams();
  const [actualSlug, setActualSlug] = useState<string>("");
  const [bonus, setBonus] = useState<BonusDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const parts = window.location.pathname.split("/").filter(Boolean);
      const pathSlug = parts[parts.length - 1];
      if (pathSlug && pathSlug !== "_") {
        setActualSlug(pathSlug);
      } else if (params?.slug && params.slug !== "_") {
        setActualSlug(params.slug as string);
      }
    }
  }, [params?.slug]);

  useEffect(() => {
    const fetchBonus = async () => {
      if (!actualSlug) {
        return;
      }
      try {
        const res = await api(`/api/user/bonuses/${actualSlug}`);
        if (res.success) {
          setBonus(res.data);
          track("bonus_viewed", { bonus_id: res.data?.id });
        } else {
          setError(res.error || "Gagal memuat bonus bundle");
        }
      } catch (err) {
        console.error(err);
        setError("Terjadi kesalahan saat memuat bonus");
      } finally {
        setLoading(false);
      }
    };

    fetchBonus();
  }, [actualSlug]);

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText size={20} className="text-red-500" />;
      case 'audio': return <Music size={20} className="text-purple-500" />;
      case 'video': return <Video size={20} className="text-blue-500" />;
      default: return <File size={20} className="text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !bonus) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 border-b border-[rgba(0,0,0,0.06)] pb-6">
          <Link href="/bonuses" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={20} className="text-warm-black" />
          </Link>
          <h1 className="text-xl font-bold text-warm-black">Kembali</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-sm text-red-500">{error || "Bonus tidak ditemukan"}</p>
          <Link href="/bonuses" className="text-xs font-medium text-primary hover:underline">Kembali ke Daftar Bonus</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-10 pt-6">
      <div className="flex items-center gap-4 border-b border-[rgba(0,0,0,0.06)] dark:border-white/5 pb-6">
        <Link href="/bonuses" className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors flex-shrink-0">
          <ArrowLeft size={20} className="text-warm-black dark:text-white" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-warm-black dark:text-white">{bonus.title}</h1>
          <p className="text-sm text-[rgba(12,12,10,0.65)] dark:text-slate-400 mt-1">
            {bonus.bonus_type === 'mini_course' ? 'Mini Course' : 'Bundle Bonus Resources'}
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {bonus.thumbnail_url && (
          <div className="md:col-span-1 rounded-2xl overflow-hidden border border-[rgba(0,0,0,0.06)] dark:border-white/5 shadow-sm bg-white dark:bg-white/5 aspect-video md:aspect-[4/5] h-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={bonus.thumbnail_url} alt={bonus.title} className="w-full h-full object-cover" />
          </div>
        )}
        
        <div className={`space-y-6 ${bonus.thumbnail_url ? 'md:col-span-2' : 'md:col-span-3'}`}>
          {bonus.description && (
            <div className="prose prose-sm text-[rgba(12,12,10,0.7)] dark:text-slate-300 whitespace-pre-wrap">
              {bonus.description}
            </div>
          )}

          {/* Mini Course — video playlist */}
          {bonus.bonus_type === 'mini_course' ? (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-warm-black dark:text-white">
                Video ({bonus.files.length})
              </h3>
              {bonus.files.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 dark:bg-white/5 border border-dashed border-[rgba(0,0,0,0.1)] dark:border-white/10 rounded-2xl">
                  <p className="text-sm text-[rgba(12,12,10,0.5)] dark:text-slate-400">Belum ada video.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {bonus.files.map((file, idx) => (
                    <div
                      key={file.id}
                      className="group flex items-center gap-4 p-3 bg-white dark:bg-white/5 border border-[rgba(0,0,0,0.06)] dark:border-white/5 rounded-xl hover:border-[rgba(0,0,0,0.1)] dark:hover:border-white/10 hover:shadow-sm transition-all"
                    >
                      <span className="text-sm font-bold text-[rgba(12,12,10,0.25)] dark:text-white/20 w-6 shrink-0 text-center">
                        {idx + 1}
                      </span>
                      <div className="relative w-28 aspect-video rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0 border border-black/[0.05] dark:border-white/5">
                        {file.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={file.thumbnail_url} alt={file.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                            <Video size={22} />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-warm-black dark:text-white leading-snug line-clamp-2">{file.title}</p>
                        <span className="text-[10px] font-bold uppercase text-[rgba(12,12,10,0.35)] dark:text-slate-400 mt-1 block">VIDEO</span>
                      </div>
                      {bonus.is_locked ? (
                        <button
                          onClick={() => {
                            alert("Khusus member premium yang bisa menonton video ini. Upgrade membership untuk membuka.");
                          }}
                          className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 hover:bg-gray-200 transition-colors"
                          title="Terkunci"
                        >
                          <Lock size={15} />
                        </button>
                      ) : file.file_url ? (
                        <a
                          href={file.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full bg-[#8B1414]/10 text-[#8B1414] hover:bg-[#8B1414] hover:text-white transition-colors"
                          title="Tonton Video"
                        >
                          <Play size={15} className="translate-x-px" />
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Bundle — file grid */
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-warm-black dark:text-white">Daftar File ({bonus.files.length})</h3>
              {bonus.files.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 dark:bg-white/5 border border-dashed border-[rgba(0,0,0,0.1)] dark:border-white/10 rounded-2xl">
                  <p className="text-sm text-[rgba(12,12,10,0.5)] dark:text-slate-400">Belum ada file di dalam bundle ini.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {bonus.files.map((file) => (
                    <div key={file.id} className="group relative flex flex-col bg-white dark:bg-white/[0.03] border border-[rgba(0,0,0,0.06)] dark:border-white/5 rounded-xl hover:border-[rgba(0,0,0,0.1)] hover:shadow-sm transition-all overflow-hidden">
                      {file.thumbnail_url ? (
                        <div className="aspect-[4/3] w-full bg-gray-50 dark:bg-white/5 relative overflow-hidden border-b border-black/[0.04] dark:border-white/5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={file.thumbnail_url} alt={file.title} loading="lazy" className="w-full h-full object-cover object-top" />
                        </div>
                      ) : (
                        <div className="aspect-[4/3] w-full bg-gray-50 dark:bg-white/5 border-b border-[rgba(0,0,0,0.04)] dark:border-white/5 flex items-center justify-center relative">
                          <div className="w-12 h-12 rounded-lg bg-white dark:bg-gray-800 border border-black/5 dark:border-white/10 flex items-center justify-center text-gray-400">
                            {getFileIcon(file.file_type)}
                          </div>
                        </div>
                      )}
                      <div className="p-3 flex flex-col flex-1">
                        <h4 className="text-[13px] font-semibold text-warm-black dark:text-white leading-snug line-clamp-2 mb-3 min-h-[2.25rem]">{file.title}</h4>
                        {bonus.is_locked ? (
                          <button
                            onClick={() => {
                              alert("Khusus member premium yang bisa akses file ini. Upgrade membership untuk membuka.");
                            }}
                            className="mt-auto flex items-center justify-center gap-1.5 w-full h-9 rounded-lg bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-slate-400 text-xs font-semibold hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                            title="Terkunci"
                          >
                            <Lock size={13} /> Terkunci
                          </button>
                        ) : (
                          <div className="mt-auto grid grid-cols-2 gap-2">
                            {file.preview_url ? (
                              <a
                                href={file.preview_url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center justify-center gap-1.5 h-9 rounded-lg border border-black/[0.08] dark:border-white/10 text-[#0D0D0D] dark:text-white text-xs font-semibold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors active:scale-[0.97]"
                                title="Lihat preview"
                              >
                                <Eye size={13} /> Preview
                              </a>
                            ) : <span />}
                            {file.file_url ? (
                              <a
                                href={file.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center justify-center gap-1.5 h-9 rounded-lg bg-[#8B1414] text-white text-xs font-semibold hover:bg-[#6E0F0F] transition-colors active:scale-[0.97]"
                                title="Akses / Remix template"
                              >
                                <ExternalLink size={13} /> Akses
                              </a>
                            ) : <span />}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
