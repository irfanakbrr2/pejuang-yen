"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/purity */

import { useEffect, useState } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { userApi, affiliateApi } from "@/lib/api-client";
import {
  BookOpen, Award, Star, TrendingUp,
  ArrowRight, Play, CheckCircle2, Share2, Users, X, Crown, Rocket,
} from "lucide-react";
import { StatCardSkeleton } from "@/components/ui/Skeleton";
import { formatDate, formatRupiah } from "@/lib/utils";
import { BentoStatCard } from "@/components/ui/bento-stat-card";
import { ProgressTracker } from "@/components/ui/ProgressTracker";
import { ActivityFeed } from "@/components/ui/ActivityFeed";
import { NotificationCenter } from "@/components/ui/NotificationCenter";
import { EmptyState } from "@/components/ui/lottie/EmptyState";
import { DashboardSection, PageHeader } from "@/components/ui/dashboard-chrome";
import type { Notification } from "@/components/ui/NotificationCenter";
import type { Activity } from "@/components/ui/ActivityFeed";
import { usePageView } from "@/hooks/use-tracking";
import { ContinueLearningCard, type LastWatched, type NextLesson } from "@/components/dashboard/ContinueLearningCard";
import type { ActivitySummary } from "@/components/dashboard/ActivitySummaryCard";
import type { GamificationData } from "@/components/dashboard/GamificationCard";
import { LearningPulseCard } from "@/components/dashboard/LearningPulseCard";

const COMMUNITY_WHATSAPP_URL = "https://chat.whatsapp.com/REPLACE_PEJUANGYEN_COMMUNITY_GROUP";
const COMMUNITY_NOTICE_STORAGE_KEY = "pejuangyen-community-notice-dismissed";
const PREMIUM_GROUP_URL = "https://chat.whatsapp.com/REPLACE_PEJUANGYEN_PREMIUM_GROUP";
const PREMIUM_NOTICE_STORAGE_KEY = "pejuangyen-premium-notice-dismissed";
// Banner WhatsApp hanya tampil jika link grup sudah diisi (bukan placeholder REPLACE_*)
const WA_COMMUNITY_READY = !COMMUNITY_WHATSAPP_URL.includes("REPLACE_");
const WA_PREMIUM_READY = !PREMIUM_GROUP_URL.includes("REPLACE_");

export default function UserDashboardPage() {
  usePageView("dashboard");
  const [data, setData] = useState<{
    user: any;
    profile: any;
    membership: any;
    classes: any[];
    certCount: number;
    completedLessons: number;
    totalLessons: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastWatched, setLastWatched] = useState<LastWatched | null>(null);
  const [nextLesson, setNextLesson] = useState<NextLesson | null>(null);
  const [activitySummary, setActivitySummary] = useState<ActivitySummary | null>(null);
  const [gamification, setGamification] = useState<GamificationData | null>(null);
  const [recommendations, setRecommendations] = useState<any>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [affiliateStats, setAffiliateStats] = useState<any>(null);
  const [communityNoticeDismissed, setCommunityNoticeDismissed] = useState(false);
  const [premiumNoticeDismissed, setPremiumNoticeDismissed] = useState(false);

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    userApi.markAllNotificationsRead();
  };

  const handleMarkRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    userApi.markNotificationRead(id);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCommunityNoticeDismissed(localStorage.getItem(COMMUNITY_NOTICE_STORAGE_KEY) === "true");
      setPremiumNoticeDismissed(localStorage.getItem(PREMIUM_NOTICE_STORAGE_KEY) === "true");
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const handleDismissCommunityNotice = () => {
    localStorage.setItem(COMMUNITY_NOTICE_STORAGE_KEY, "true");
    setCommunityNoticeDismissed(true);
  };

  const handleDismissPremiumNotice = () => {
    localStorage.setItem(PREMIUM_NOTICE_STORAGE_KEY, "true");
    setPremiumNoticeDismissed(true);
  };

  useEffect(() => {
    async function loadCore() {
      try {
        // Phase 1: Single consolidated request replaces 4 separate calls
        const res = await userApi.dashboard();

        if (res?.success && res.data) {
          const d = res.data;
          const enrolled = d.classes?.enrolled || [];

          setData({
            user: d.user,
            profile: d.profile,
            membership: d.membership,
            classes: [...enrolled, ...(d.classes?.membership || [])],
            certCount: 0,
            completedLessons: enrolled.reduce((s: number, c: any) => s + (c.completed_lessons || 0), 0),
            totalLessons: enrolled.reduce((s: number, c: any) => s + (c.total_lessons || 0), 0),
          });
          setLastWatched(d.learning?.last_watched || null);
          setNextLesson(d.learning?.next_lesson || null);
          setActivitySummary(d.activity || null);
          setGamification(d.gamification || null);
          
          if (d.user?.role !== 'admin' && d.user?.role !== 'super_admin') {
            userApi.recommendations().then(r => {
              if (r.success) setRecommendations(r.data);
            });
          }

          setNotifications(
            (d.notifications || []).map((n: any) => {
              let href: string | undefined = undefined;
              if (n.data_json) {
                try {
                  const data = typeof n.data_json === 'string' ? JSON.parse(n.data_json) : n.data_json;
                  if (data.url) href = data.url;
                } catch (e) {}
              }
              return {
                id: n.id,
                type: n.type as Notification["type"],
                title: n.title,
                body: n.body || undefined,
                timestamp: new Date(n.created_at),
                read: !!n.read_at,
                href,
              };
            })
          );

          const acts: Activity[] = (d.transactions || [])
            .filter((t: any) => t.status === "paid")
            .slice(0, 6)
            .map((t: any) => ({
              id: t.id,
              type: "payment" as const,
              title: "Pembayaran dikonfirmasi",
              description: t.product_name || t.order_type || undefined,
              timestamp: new Date(t.paid_at || t.created_at),
            }));
          setActivities(acts);
        }
      } catch (err) {
        console.error("Failed to load core dashboard data", err);
      } finally {
        setLoading(false);
      }
    }

    async function loadSecondary() {
      // Phase 2: Non-critical data — load in background, does not block render
      try {
        const [certsRes, affiliateRes] = await Promise.allSettled([
          fetch("/api/user/certificates", { credentials: "include" }).then((r) => r.json()).catch(() => ({ success: false })),
          affiliateApi.me(),
        ]);

        if (certsRes.status === "fulfilled" && certsRes.value?.success) {
          setData((prev) => prev ? { ...prev, certCount: certsRes.value.data?.length || 0 } : prev);
        }

        if (
          affiliateRes.status === "fulfilled" &&
          affiliateRes.value?.data?.is_affiliate &&
          affiliateRes.value.data.stats
        ) {
          setAffiliateStats(affiliateRes.value.data.stats);
        }
      } catch (err) {
        console.error("Failed to load secondary dashboard data", err);
      }
    }

    loadCore().then(() => loadSecondary());
  }, []);

  const activeClasses = data?.classes || [];
  const activeMembership = data?.membership;
  const firstName = data?.user?.name?.split(" ")[0] || "Pelajar";
  const isPaidMember = activeMembership
    ? !activeMembership.expires_at || new Date(activeMembership.expires_at) > new Date()
    : false;

  const progressClasses = activeClasses.slice(0, 4).map((c: any) => ({
    id: c.id ?? String(Math.random()),
    title: c.title || `Kelas #${String(c.id).slice(0, 6)}`,
    thumbnail: c.thumbnail_url ?? undefined,
    progress: c.progress ?? 0,
    completedLessons: c.completed_lessons ?? 0,
    totalLessons: c.total_lessons ?? 1,
    href: c.slug ? `/learn/${c.slug}/start` : undefined,
  }));

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <PageHeader
        eyebrow="Selamat datang kembali"
        title={loading ? "Dashboard" : firstName}
        description="Lanjutkan persiapanmu menuju kerja di Jepang."
        actions={
          <NotificationCenter
            notifications={notifications}
            onMarkAllRead={handleMarkAllRead}
            onMarkRead={handleMarkRead}
          />
        }
      />

      {/* ── Premium Group Notice (paid members only) ── */}
      {!loading && isPaidMember && WA_PREMIUM_READY && !premiumNoticeDismissed && (
        <div className="flex items-center gap-3 rounded-[var(--radius-md,8px)] border border-amber-200 bg-amber-50 px-4 py-2.5">
          <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-amber-800">
            Selamat datang di PejuangYen Premium! Kamu punya akses grup eksklusif.
          </p>
          <a
            href={PREMIUM_GROUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[12px] font-semibold text-amber-700 underline-offset-2 hover:underline"
          >
            Gabung sekarang
          </a>
          <button
            type="button"
            onClick={handleDismissPremiumNotice}
            className="ml-1 shrink-0 rounded p-0.5 text-amber-500 transition-colors hover:text-amber-700"
            aria-label="Tutup"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {WA_COMMUNITY_READY && !communityNoticeDismissed && (
        <div className="flex items-center gap-3 rounded-[var(--radius-md,8px)] border border-[#8B1414]/20 bg-[#FDF2F2] px-4 py-2.5">
          <Users className="h-3.5 w-3.5 shrink-0 text-[#8B1414]" />
          <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-[#7A1414]">
            Join komunitas gratis PejuangYen — ribuan calon pekerja ke Jepang sudah bergabung.
          </p>
          <a
            href={COMMUNITY_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-[12px] font-semibold text-[#8B1414] underline-offset-2 hover:underline"
          >
            Gabung WhatsApp
          </a>
          <button
            type="button"
            onClick={handleDismissCommunityNotice}
            className="ml-1 shrink-0 rounded p-0.5 text-[#8B1414]/60 transition-colors hover:text-[#8B1414]"
            aria-label="Tutup"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}



      {/* ── Baris 1: 4 Stat Cards ── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {(() => {
            const daysLeft = activeMembership?.expires_at
              ? Math.ceil((new Date(activeMembership.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null;
            const isExpiringSoon = daysLeft !== null && daysLeft > 0 && daysLeft <= 7;
            const isExpired = daysLeft !== null && daysLeft <= 0;

            let subtitle = "Akses lebih banyak kelas";
            let accent: "blue" | "green" | "purple" | "orange" | "rose" | "teal" | "gold" = "teal";
            if (activeMembership) {
              if (isExpired) {
                subtitle = "Membership telah berakhir";
                accent = "rose";
              } else if (isExpiringSoon) {
                subtitle = `⚠️ Berakhir dalam ${daysLeft} hari`;
                accent = "orange";
              } else if (activeMembership.expires_at) {
                subtitle = `Berakhir ${formatDate(activeMembership.expires_at)}`;
                accent = "gold";
              } else {
                subtitle = "Lifetime access ✨";
                accent = "gold";
              }
            }

            return (
              <BentoStatCard
                title={activeMembership ? activeMembership.plan_name : "Free Plan"}
                value={activeMembership ? (isExpired ? "Expired" : "Aktif") : "Upgrade"}
                subtitle={subtitle}
                icon={Star}
                accentColor={accent}
                href="/account"
              />
            );
          })()}
          <BentoStatCard
            title="Kelas Diikuti"
            value={activeClasses.length}
            subtitle="kelas aktif"
            icon={BookOpen}
            accentColor="blue"
            href="/my-classes"
          />
          <BentoStatCard
            title="Sertifikat"
            value={data?.certCount ?? 0}
            subtitle="kelas selesai"
            icon={Award}
            accentColor="purple"
            href="/certificates"
          />
          <BentoStatCard
            title="Lesson Selesai"
            value={data?.completedLessons ?? 0}
            subtitle={`dari ${data?.totalLessons ?? 0} lesson`}
            icon={TrendingUp}
            accentColor="orange"
          />
        </div>
      )}

      {/* ── Upgrade CTA — free members only ── */}
      {!loading && !isPaidMember && (
        <div className="flex items-center gap-4 rounded-[var(--radius-md,8px)] border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
            <Rocket className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold text-[#0D0D0D] leading-tight">Unlock Akses Member Premium</p>
            <p className="text-[12px] text-[#71717A] leading-tight mt-0.5 hidden sm:block">
              Akses semua kelas, grup eksklusif, dan fitur premium.
            </p>
          </div>
          <a
            href="https://app.pejuangyen.com/premium/"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg bg-[#8B1414] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#6E0F0F] transition-colors whitespace-nowrap"
          >
            Upgrade Sekarang
          </a>
        </div>
      )}

      {/* ── Baris 2: Quick Actions + Affiliate Stats ── */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Quick Actions */}
          <div className="bg-white border border-[rgba(0,0,0,0.07)] shadow-[var(--shadow-card)] rounded-[var(--radius-lg,12px)] p-5 flex flex-col justify-between min-h-[120px]">
            <div>
              <p className="label-uppercase mb-1">⚡ Aksi Cepat</p>
              <p className="text-sm font-medium text-[#374151] dark:text-slate-300">
                Lanjutkan belajar atau lihat pencapaianmu
              </p>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <Link
                href="/my-classes"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#8B1414] dark:bg-[#C0392B]/20 text-white dark:text-[#C0392B] text-sm font-medium rounded-xl hover:bg-[#6E0F0F] dark:hover:bg-[#C0392B]/30 transition-colors duration-150 active:scale-[0.97]"
              >
                <Play className="h-3.5 w-3.5" />
                Lanjutkan Belajar
              </Link>
              <Link
                href="/certificates"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-black/[0.05] dark:bg-white/[0.05] text-[#374151] dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-black/[0.08] dark:hover:bg-white/[0.1] transition-colors duration-150 active:scale-[0.97]"
              >
                <Award className="h-3.5 w-3.5" />
                Lihat Sertifikat
              </Link>
            </div>
          </div>

          {/* Affiliate Mini Stats — hanya jika user sudah jadi affiliate */}
          {affiliateStats ? (
            <div className="bg-white border border-[rgba(0,0,0,0.07)] shadow-[var(--shadow-card)] rounded-[var(--radius-lg,12px)] p-5 flex flex-col justify-between min-h-[120px]">
              <div className="flex items-center justify-between mb-3">
                <p className="label-uppercase">🔗 Affiliate Saya</p>
                <Link
                  href="/affiliate"
                  className="text-xs font-medium text-[#8B1414] dark:text-[#C0392B] hover:text-[#6E0F0F] dark:hover:text-[#34D399] transition-colors"
                >
                  Lihat detail →
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] text-[#9CA3AF] dark:text-slate-400 mb-0.5">Referrals</p>
                  <p className="text-xl font-bold text-[#0D0D0D] dark:text-white heading-tight tabular-nums">
                    {affiliateStats.total_referrals}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[#9CA3AF] dark:text-slate-400 mb-0.5">Komisi Belum Dibayar</p>
                  <p className="text-xl font-bold text-[#0D0D0D] dark:text-white heading-tight tabular-nums">
                    {formatRupiah(affiliateStats.unpaid_commissions)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* CTA jika belum affiliate */
            <div className="bg-white border border-[rgba(0,0,0,0.07)] shadow-[var(--shadow-card)] rounded-[var(--radius-lg,12px)] p-5 flex flex-col justify-between min-h-[120px]">
              <div>
                <p className="label-uppercase mb-1">🔗 Program Affiliate</p>
                <p className="text-sm text-[#6B7280] dark:text-slate-400 leading-relaxed">
                  Dapatkan komisi untuk setiap orang yang bergabung via link referral kamu.
                </p>
              </div>
              <Link
                href="/affiliate"
                className="self-start inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-black/[0.05] dark:bg-white/[0.05] text-[#374151] dark:text-slate-300 text-sm font-medium rounded-xl hover:bg-black/[0.08] dark:hover:bg-white/[0.1] transition-colors duration-150 active:scale-[0.97]"
              >
                <Share2 className="h-3.5 w-3.5" />
                Daftar Affiliate
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ── Rekomendasi ── */}
      {!loading && recommendations && recommendations.recommended_course && (
        <div className="space-y-4 mt-8">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Direkomendasikan Untukmu</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Berdasarkan profilmu, berikut adalah rekomendasi terbaik untuk mulai belajar.
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Jalur Belajar */}
            <div className="bg-white border border-[rgba(0,0,0,0.07)] shadow-[var(--shadow-card)] rounded-[var(--radius-lg,12px)] p-5 lg:col-span-1 flex flex-col justify-center">
              <p className="label-uppercase mb-2 text-[#8B1414] dark:text-[#C0392B]">Jalur Belajarmu</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                {recommendations.profile_context?.recommended_track || "Start Here"}
              </p>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#8B1414]/10 text-[#8B1414] dark:bg-[#C0392B]/10 dark:text-[#C0392B]"><CheckCircle2 className="h-3 w-3" /></div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Bahasa Jepang Dasar</p>
                </div>
                <div className="w-0.5 h-3 bg-gray-200 dark:bg-slate-700 ml-3"></div>
                <div className="flex items-center gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#8B1414] text-white dark:bg-[#C0392B] dark:text-slate-900"><Play className="h-3 w-3" /></div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Core Workflow</p>
                </div>
                <div className="w-0.5 h-3 bg-gray-200 dark:bg-slate-700 ml-3"></div>
                <div className="flex items-center gap-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-slate-800 dark:text-gray-500"><Star className="h-3 w-3" /></div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Sertifikat</p>
                </div>
              </div>
            </div>

            {/* Rekomendasi Utama */}
            <div className="bg-white border border-[rgba(0,0,0,0.07)] shadow-[var(--shadow-card)] rounded-[var(--radius-lg,12px)] p-0 lg:col-span-2 overflow-hidden flex flex-col sm:flex-row group">
              <div className="sm:w-2/5 h-48 sm:h-auto bg-gray-100 dark:bg-slate-800 relative">
                {recommendations.recommended_course.thumbnail_url ? (
                  <NextImage src={recommendations.recommended_course.thumbnail_url} alt="Course Thumbnail" fill className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-400"><BookOpen className="h-10 w-10" /></div>
                )}
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <span className="inline-flex items-center rounded-md bg-[#8B1414]/10 px-2 py-1 text-xs font-medium text-[#8B1414] dark:bg-[#C0392B]/10 dark:text-[#C0392B] mb-3">
                    Course Pilihan
                  </span>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white line-clamp-2 leading-tight">
                    {recommendations.recommended_course.title}
                  </h3>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                    {recommendations.recommended_course.description}
                  </p>
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  <Link href={`/learn/${recommendations.recommended_course.slug}/start`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#8B1414] px-4 py-2 text-sm font-semibold text-white hover:bg-[#6E0F0F] dark:bg-[#C0392B] dark:text-slate-900 dark:hover:bg-[#34D399]">
                    <Play className="h-4 w-4" /> Mulai Belajar
                  </Link>
                  {/* Disembunyikan untuk PejuangYen (fitur GWA tak dipakai): Resources.
                  <Link href="/resources" className="inline-flex items-center justify-center rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700">
                    Eksplor Resources
                  </Link> */}
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── Progress + Activity Row ── */}
      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Progress Tracker — 2 cols */}
          <div className="lg:col-span-2">
            {progressClasses.length > 0 ? (
              <ProgressTracker classes={progressClasses} />
            ) : (
              <div className="card-sharp">
                <EmptyState
                  title="Belum ada kelas"
                  description="Kunjungi pejuangyen.com untuk melihat kelas yang tersedia."
                  size="sm"
                />
              </div>
            )}
          </div>

          {/* Activity Feed — 1 col */}
          <ActivityFeed activities={activities} />
        </div>
      )}

      {/* ── Lanjutkan Belajar (widget gamifikasi/streak GWA dinonaktifkan) ── */}
      {lastWatched && !loading && (
        <div className="grid grid-cols-1 gap-3">
          <ContinueLearningCard lastWatched={lastWatched} nextLesson={nextLesson} />
        </div>
      )}

      {/* ── Kelas Saya ── */}
      <DashboardSection
        title="📖 Kelas Saya"
        actions={
          <Link
            href="/my-classes"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#8B1414] dark:text-[#C0392B] hover:text-[#6E0F0F] dark:hover:text-[#34D399] transition-colors duration-150"
          >
            Lihat semua <ArrowRight className="h-3 w-3" />
          </Link>
        }
      >

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-[rgba(0,0,0,0.07)] shadow-[var(--shadow-card)] rounded-[var(--radius-lg,12px)] p-5">
                <div className="skeleton h-4 w-3/4 mb-3" />
                <div className="skeleton h-2 w-full mb-2" />
                <div className="skeleton h-2 w-1/3" />
              </div>
            ))}
          </div>
        ) : activeClasses.length === 0 ? (
          <div className="card-sharp">
            <EmptyState
              title="Belum ada kelas"
              description="Kunjungi pejuangyen.com untuk melihat kelas yang tersedia."
              action={{ label: "Jelajahi Kelas", onClick: () => window.open("https://app.pejuangyen.com/premium/", "_blank") }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {activeClasses.slice(0, 3).map((enrollment: any) => {
              const isDone = enrollment.progress === 100;
              const href = enrollment.slug ? `/learn/${enrollment.slug}/start` : "/my-classes";
              return (
                <Link
                  key={enrollment.id}
                  href={href}
                className="bg-white border border-[rgba(0,0,0,0.07)] shadow-[var(--shadow-card)] rounded-[var(--radius-lg,12px)] p-5 block group hover:-translate-y-[1px] hover:border-[rgba(139,20,20,0.14)] transition-all duration-[220ms]"
                >
                  {/* Thumbnail */}
                  <div className="h-[72px] rounded-xl mb-4 bg-[#F2F2F7] dark:bg-slate-800/50 border border-black/[0.04] dark:border-white/[0.05] flex items-center justify-center overflow-hidden transition-colors duration-300 group-hover:bg-[#F7E8E8] dark:group-hover:bg-[#C0392B]/10">
                    {enrollment.thumbnail_url ? (
                      <NextImage
                        src={enrollment.thumbnail_url}
                        alt={enrollment.title}
                        width={200}
                        height={72}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : isDone ? (
                      <CheckCircle2 className="h-7 w-7 text-[#22C55E] dark:text-[#C0392B]" strokeWidth={1.5} />
                    ) : (
                      <BookOpen className="h-7 w-7 text-[#9CA3AF] dark:text-slate-500 group-hover:text-[#8B1414] dark:group-hover:text-[#C0392B] transition-colors duration-300" strokeWidth={1.5} />
                    )}
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                        isDone ? "bg-[#F0FDF4] dark:bg-[#C0392B]/10 text-[#16A34A] dark:text-[#34D399]" : "bg-[#F7E8E8] dark:bg-[#8B1414]/20 text-[#8B1414] dark:text-[#34D399]"
                      }`}
                    >
                      {isDone ? "Selesai" : "Berjalan"}
                    </span>
                  </div>

                  <p className="font-semibold text-sm text-[#0D0D0D] dark:text-white mb-3 leading-snug heading-tight line-clamp-2">
                    {enrollment.title || `Kelas #${String(enrollment.id).slice(0, 6)}`}
                  </p>

                  <div className="h-1.5 bg-[#8B1414]/[0.08] dark:bg-white/[0.05] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#8B1414] dark:bg-[#C0392B] transition-all duration-500"
                      style={{ width: `${enrollment.progress ?? 0}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-[#9CA3AF] dark:text-slate-400 mt-1.5 tabular-nums">
                    {enrollment.progress ?? 0}% selesai
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </DashboardSection>

    </div>
  );
}
