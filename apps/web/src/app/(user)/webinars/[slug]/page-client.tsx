"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, react-hooks/purity */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, Copy, ExternalLink, Ticket, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { toast } from "@/components/ui/toast";
import { affiliateApi, webinarsApi } from "@/lib/api-client";
import { formatRupiah } from "@/lib/utils";

const WEBINAR_NORMAL_PRICE = 50000;

interface Webinar {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  body_html?: string | null;
  thumbnail_url?: string | null;
  host_name?: string | null;
  starts_at: string;
  ends_at?: string | null;
  timezone?: string;
  join_url?: string | null;
  calendar_url?: string | null;
  recording_url?: string | null;
  recording_embed_url?: string | null;
  replay_body_html?: string | null;
  replay_status?: string;
  is_registered?: boolean;
  registration?: { coupon_code?: string; registered_at?: string } | null;
  affiliate_link?: string | null;
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

function getAffiliateCookie() {
  if (typeof document === "undefined") return "";
  return document.cookie
    .split(";")
    .find((c) => c.trim().startsWith("affiliate_code="))
    ?.split("=")[1]
    ?.trim() || "";
}

export default function WebinarDetailPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const slug = pathname.split("/").filter(Boolean)[1] ?? "_";
  const [webinar, setWebinar] = useState<Webinar | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [joiningAffiliate, setJoiningAffiliate] = useState(false);

  const refCode = searchParams.get("ref") || getAffiliateCookie();
  const couponCode = "GROW";

  const load = async () => {
    setLoading(true);
    const res = await webinarsApi.detail(slug);
    if (res.success) setWebinar(res.data as Webinar);
    else toast.error(res.error || "Gagal memuat webinar");
    setLoading(false);
  };

  useEffect(() => { load(); }, [slug]);

  const register = async () => {
    if (!webinar) return;
    setRegistering(true);
    const res = await webinarsApi.register(webinar.id, refCode);
    if (res.success) {
      toast.success("Registrasi berhasil. Email konfirmasi sedang dikirim.");
      await load();
    } else {
      toast.error(res.error || "Gagal mendaftar webinar");
    }
    setRegistering(false);
  };

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

  const copyAffiliateLink = async () => {
    if (!webinar?.affiliate_link) return;
    await navigator.clipboard.writeText(webinar.affiliate_link);
    toast.success("Link affiliate tersalin");
  };

  if (loading) return <div className="text-sm text-gray-500">Memuat webinar...</div>;
  if (!webinar) return <div className="text-sm text-red-500">Webinar tidak ditemukan.</div>;
  const hasStarted = new Date(webinar.starts_at).getTime() <= Date.now();

  return (
    <div className="space-y-6">
      <Link href="/webinars" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" />
        Kembali ke katalog
      </Link>

      <PageHeader
        eyebrow="Webinar Gratis"
        title={webinar.title}
        description={webinar.subtitle || "Daftar gratis dan simpan detail event dari dashboard kamu."}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <article className="space-y-5">
          {webinar.thumbnail_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={webinar.thumbnail_url} alt={webinar.title} className="aspect-video w-full rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] object-contain" />
          )}
          <div className="glass-card p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#8B1414] dark:text-[#C0392B]">
              <CalendarDays className="h-4 w-4" />
              {formatEventDate(webinar.starts_at, webinar.timezone)}
            </div>
            {webinar.body_html ? (
              <div
                className="lesson-content prose prose-sm max-w-none text-gray-700 dark:text-slate-300"
                dangerouslySetInnerHTML={{ __html: webinar.body_html }}
              />
            ) : (
              <p className="text-sm leading-6 text-gray-600 dark:text-slate-400">Detail webinar akan segera diperbarui.</p>
            )}
          </div>

          {webinar.replay_status === "public" && (webinar.recording_embed_url || webinar.recording_url) && (
            <div className="glass-card p-5">
              <h2 className="mb-3 text-lg font-bold text-[#0D0D0D] dark:text-white">Tonton Ulang</h2>
              {webinar.recording_embed_url ? (
                <iframe
                  src={webinar.recording_embed_url}
                  title={`Rekaman ${webinar.title}`}
                  className="aspect-video w-full rounded-xl border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <a href={webinar.recording_url || "#"} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-semibold text-[#8B1414] dark:text-[#C0392B]">
                  Buka rekaman
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
              {webinar.replay_body_html && (
                <div className="lesson-content prose prose-sm mt-4 max-w-none text-gray-700 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: webinar.replay_body_html }} />
              )}
            </div>
          )}
        </article>

        <aside className="space-y-4">
          <div className="glass-card p-5">
            <div className="mb-4 flex items-center gap-2">
              {webinar.is_registered ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500" />
              ) : (
                <Ticket className="h-5 w-5 text-[#8B1414] dark:text-[#C0392B]" />
              )}
              <h2 className="text-base font-bold text-[#0D0D0D] dark:text-white">
                {webinar.is_registered ? "Kamu sudah terdaftar" : hasStarted ? "Akses Event" : "Daftar Event"}
              </h2>
            </div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-500 dark:text-slate-400">Kode kupon</label>
            <input
              readOnly
              value={couponCode}
              className="mb-4 w-full rounded-xl border border-black/[0.08] dark:border-white/[0.05] bg-white dark:bg-white/5 px-3.5 py-2.5 font-mono text-sm font-semibold text-[#0D0D0D] dark:text-white"
            />
            <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 dark:border-[#C0392B]/20 dark:bg-[#C0392B]/10">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-600 dark:text-slate-400">Biaya webinar normal</span>
                <span className="font-medium text-gray-400 line-through dark:text-slate-500">
                  {formatRupiah(WEBINAR_NORMAL_PRICE)}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-3 text-sm">
                <span className="text-gray-600 dark:text-slate-400">
                  Kupon <span className="font-mono font-semibold text-[#0D0D0D] dark:text-white">"{couponCode}"</span>
                </span>
                <span className="font-semibold text-green-700 dark:text-[#C0392B]">Diskon 100%</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-green-200 pt-2 text-sm dark:border-[#C0392B]/20">
                <span className="font-semibold text-[#0D0D0D] dark:text-white">Total</span>
                <span className="font-bold text-green-700 dark:text-[#C0392B]">Gratis</span>
              </div>
            </div>
            {webinar.is_registered || hasStarted ? (
              <div className="space-y-2">
                {webinar.join_url && (
                  <a href={webinar.join_url} target="_blank" rel="noopener noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#8B1414] dark:bg-[#C0392B] px-4 py-2.5 text-sm font-semibold text-white dark:text-black">
                    Buka Link Join
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
                {webinar.calendar_url && (
                  <a href={webinar.calendar_url} target="_blank" rel="noopener noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white dark:bg-white/5 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-slate-300 ring-1 ring-black/[0.08] dark:ring-white/[0.05]">
                    Simpan ke Kalender
                    <CalendarDays className="h-4 w-4" />
                  </a>
                )}
                {hasStarted && !webinar.join_url && !webinar.recording_url && !webinar.recording_embed_url && (
                  <p className="rounded-xl bg-amber-50 dark:bg-amber-500/10 p-3 text-sm leading-6 text-amber-800 dark:text-amber-400">
                    Event sudah berjalan. Link Zoom atau rekaman akan muncul di sini setelah admin menambahkannya.
                  </p>
                )}
              </div>
            ) : (
              <Button className="w-full" size="lg" onClick={register} loading={registering}>
                Daftar Gratis
              </Button>
            )}
          </div>

          <div className="glass-card p-5">
            <h2 className="mb-2 text-base font-bold text-[#0D0D0D] dark:text-white">Promosikan Webinar</h2>
            {webinar.affiliate_link ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500">Link Affiliate</label>
                  <input
                    readOnly
                    value={webinar.affiliate_link}
                    className="w-full rounded-xl border border-black/[0.06] dark:border-white/[0.05] bg-white/70 dark:bg-black/20 px-3 py-2 font-mono text-xs text-gray-700 dark:text-slate-300 outline-none"
                  />
                </div>
                <Button variant="secondary" className="w-full" onClick={copyAffiliateLink}>
                  <Copy className="h-4 w-4" />
                  Salin Link Affiliate
                </Button>
              </div>
            ) : (
              <Button variant="secondary" className="w-full" onClick={joinAffiliate} loading={joiningAffiliate}>
                <UserPlus className="h-4 w-4" />
                Jadi Affiliate
              </Button>
            )}
            <p className="mt-3 text-xs leading-5 text-gray-500 dark:text-slate-400">
              Setiap pendaftaran dari link kamu akan tercatat sebagai lead webinar gratis.
            </p>
          </div>

          {webinar.is_registered && (
            <div className="glass-card p-5">
              <h2 className="mb-2 text-base font-bold text-[#0D0D0D] dark:text-white">Komunitas</h2>
              <a
                href="https://chat.whatsapp.com/REPLACE_PEJUANGYEN_COMMUNITY_GROUP"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#F7E8E8] dark:bg-[#C0392B]/10 px-4 py-2.5 text-sm font-semibold text-[#8B1414] dark:text-[#C0392B] transition-colors hover:bg-[#dff7ef] dark:hover:bg-[#C0392B]/20"
              >
                <Users className="h-4 w-4" />
                Join Grup WhatsApp
              </a>
              <p className="mt-3 text-xs leading-5 text-gray-500 dark:text-slate-400">
                Gabung dengan grup WhatsApp komunitas untuk diskusi dan info terbaru.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
