"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/purity */

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Copy, Share2, Check, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { EmptyState } from "@/components/ui/lottie/EmptyState";
import { toast } from "@/components/ui/toast";
import { affiliateApi, webinarsApi } from "@/lib/api-client";
import { publicWebinarAffiliateLink } from "@/lib/affiliate-links";
import { cn } from "@/lib/utils";
import { AvatarStack, ParticipantPreview } from "@/components/ui/AvatarStack";

interface Webinar {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  thumbnail_url?: string | null;
  host_name?: string | null;
  starts_at: string;
  timezone?: string;
  join_url?: string | null;
  recording_url?: string | null;
  recording_embed_url?: string | null;
  registered_count?: number;
  capacity?: number | null;
  is_registered?: boolean;
  affiliate_link?: string | null;
  participants_preview?: ParticipantPreview[];
}

function formatEventDate(date: string, timezone = "Asia/Jakarta") {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: timezone,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export default function WebinarsPage() {
  const [webinars, setWebinars] = useState<Webinar[]>([]);
  const [isAffiliate, setIsAffiliate] = useState(false);
  const [affiliateCode, setAffiliateCode] = useState<string | null>(null);
  const [publicRefCode, setPublicRefCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [joiningAffiliate, setJoiningAffiliate] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await webinarsApi.list();
    if (res.success) {
      const data = res.data as { webinars: Webinar[]; is_affiliate: boolean; affiliate_code?: string | null; public_ref_code?: string | null };
      setWebinars(data.webinars || []);
      setIsAffiliate(Boolean(data.is_affiliate));
      setAffiliateCode(data.affiliate_code || null);
      setPublicRefCode(data.public_ref_code || null);
    } else {
      toast.error(res.error || "Gagal memuat webinar");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const joinAffiliate = async () => {
    setJoiningAffiliate(true);
    const res = await affiliateApi.register();
    if (res.success) {
      toast.success("Affiliate aktif. Link promosi webinar sudah siap.");
      await load();
    } else {
      toast.error(res.error || "Gagal mengaktifkan affiliate");
    }
    setJoiningAffiliate(false);
  };

  const copyLink = async (webinar: Webinar) => {
    const link = webinar.affiliate_link ||
      (publicRefCode ? publicWebinarAffiliateLink(publicRefCode, webinar.slug) : affiliateCode ? `https://app.pejuangyen.com/webinar/${webinar.slug}/?ref=${affiliateCode}` : "");
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopiedSlug(webinar.slug);
    setTimeout(() => setCopiedSlug(null), 1800);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Event Gratis"
        title="Katalog Webinar"
        description="Ikuti event gratis PejuangYen dan bagikan link affiliate untuk tracking lead."
        actions={
          !isAffiliate ? (
            <Button onClick={joinAffiliate} loading={joiningAffiliate}>
              <UserPlus className="h-4 w-4" />
              Jadi Affiliate
            </Button>
          ) : null
        }
      />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="glass-card p-5">
              <div className="skeleton mb-4 aspect-video rounded-xl" />
              <div className="skeleton mb-2 h-5 w-3/4 rounded" />
              <div className="skeleton h-4 w-1/2 rounded" />
            </div>
          ))}
        </div>
      ) : webinars.length === 0 ? (
        <EmptyState
          title="Belum ada webinar"
          description="Katalog webinar gratis akan muncul di sini saat sudah dipublikasikan."
          className="py-14"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {webinars.map((webinar) => {
            const hasStarted = new Date(webinar.starts_at).getTime() <= Date.now();
            const copied = copiedSlug === webinar.slug;
            const affiliateLink = webinar.affiliate_link ||
              (publicRefCode ? publicWebinarAffiliateLink(publicRefCode, webinar.slug) : affiliateCode ? `https://app.pejuangyen.com/webinar/${webinar.slug}?ref=${affiliateCode}` : "");
            return (
              <article key={webinar.id} className="glass-card overflow-hidden">
                {webinar.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={webinar.thumbnail_url} alt={webinar.title} className="aspect-video w-full bg-black/[0.03] dark:bg-white/[0.03] object-contain" />
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-[#F7E8E8] dark:bg-[#C0392B]/10 text-[#8B1414] dark:text-[#C0392B]">
                    <CalendarDays className="h-10 w-10" />
                  </div>
                )}
                <div className="space-y-4 p-5">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                        webinar.is_registered ? "bg-green-100 dark:bg-green-500/10 text-green-800 dark:text-green-400" : hasStarted ? "bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-400" : "bg-amber-100 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400"
                      )}>
                        {webinar.is_registered ? "Terdaftar" : hasStarted ? "Sudah berjalan" : "Upcoming"}
                      </span>
                      {webinar.participants_preview && webinar.participants_preview.length > 0 ? (
                        <AvatarStack participants={webinar.participants_preview} total={webinar.registered_count || 0} />
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-slate-400">
                          <Users className="h-3 w-3" />
                          {webinar.registered_count || 0}{webinar.capacity ? `/${webinar.capacity}` : ""}
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-bold leading-tight text-[#0D0D0D] dark:text-white">{webinar.title}</h2>
                    {webinar.subtitle && <p className="mt-1 line-clamp-2 text-sm leading-6 text-gray-600 dark:text-slate-400">{webinar.subtitle}</p>}
                  </div>
                  <div className="rounded-xl bg-white/62 dark:bg-white/5 p-3 text-sm text-gray-700 dark:text-slate-300">
                    <p className="font-semibold text-[#0D0D0D] dark:text-white">{formatEventDate(webinar.starts_at, webinar.timezone)}</p>
                    {webinar.host_name && <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">Host: {webinar.host_name}</p>}
                  </div>
                  {isAffiliate && affiliateLink && (
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">Link Affiliate</label>
                      <input
                        readOnly
                        value={affiliateLink}
                        className="w-full rounded-xl border border-black/[0.06] dark:border-white/[0.05] bg-white/70 dark:bg-black/20 px-3 py-2 font-mono text-xs text-gray-700 dark:text-slate-300 outline-none"
                      />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/webinars/${webinar.slug}`}
                      className="inline-flex items-center justify-center rounded-xl bg-white dark:bg-white/5 px-3.5 py-2 text-sm font-semibold text-gray-700 dark:text-slate-300 ring-1 ring-black/[0.08] dark:ring-white/[0.05] transition-colors hover:bg-gray-50 dark:hover:bg-white/10"
                    >
                      {hasStarted ? "Akses Webinar" : "Detail"}
                    </Link>
                    {!webinar.is_registered && !hasStarted && (
                      <Link
                        href={`/webinar/${webinar.slug}`}
                        className="inline-flex items-center justify-center rounded-xl bg-[#8B1414] dark:bg-[#C0392B] px-3.5 py-2 text-sm font-semibold text-white dark:text-black transition-colors hover:bg-[#6E0F0F] dark:hover:bg-[#A93226]"
                      >
                        Daftar Event
                      </Link>
                    )}
                    {hasStarted && webinar.join_url && (
                      <a
                        href={webinar.join_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-xl bg-[#8B1414] dark:bg-[#C0392B] px-3.5 py-2 text-sm font-semibold text-white dark:text-black transition-colors hover:bg-[#6E0F0F] dark:hover:bg-[#A93226]"
                      >
                        Akses Zoom
                      </a>
                    )}
                    {isAffiliate ? (
                      <button
                        onClick={() => copyLink(webinar)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#F7E8E8] dark:bg-[#C0392B]/10 px-3.5 py-2 text-sm font-semibold text-[#8B1414] dark:text-[#C0392B] transition-colors hover:bg-[#d0ede4] dark:hover:bg-[#C0392B]/20"
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied ? "Tersalin" : "Salin Link"}
                      </button>
                    ) : (
                      <button
                        onClick={joinAffiliate}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#F7E8E8] dark:bg-[#C0392B]/10 px-3.5 py-2 text-sm font-semibold text-[#8B1414] dark:text-[#C0392B] transition-colors hover:bg-[#dff7ef] dark:hover:bg-[#C0392B]/20"
                      >
                        <Share2 className="h-4 w-4" />
                        Jadi Affiliate
                      </button>
                    )}
                    {webinar.is_registered && (
                      <a
                        href="https://chat.whatsapp.com/REPLACE_PEJUANGYEN_COMMUNITY_GROUP"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center rounded-xl bg-white dark:bg-white/5 px-3.5 py-2 text-sm font-semibold text-[#8B1414] dark:text-[#C0392B] ring-1 ring-[#8B1414]/20 dark:ring-[#C0392B]/20 transition-colors hover:bg-[#F7E8E8] dark:hover:bg-[#C0392B]/10"
                      >
                        <Users className="mr-1.5 h-4 w-4" />
                        Join Komunitas
                      </a>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
