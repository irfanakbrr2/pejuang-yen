"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Check, Crown, Sparkles } from "lucide-react";
import { membershipApi, userApi } from "@/lib/api-client";
import { formatRupiah } from "@/lib/utils";

interface Plan {
  id: string;
  slug: string;
  name: string;
  description?: string;
  duration_type: "monthly" | "yearly" | "lifetime";
  price: number;
  compare_at_price?: number | null;
  features_json?: string | null;
}

interface ActiveMembership {
  plan_name: string;
  plan_slug: string;
  duration_type: "monthly" | "yearly" | "lifetime";
  expires_at: string | null;
}

const MONTHLY_FEATURES = [
  "Akses semua kelas: Bahasa Jepang, JLPT & JFT-Basic",
  "Kelas online + rekaman bisa diputar ulang",
  "Latihan soal JLPT N5 & JFT-Basic",
  "Grup komunitas PejuangYen",
  "Bebas berhenti kapan saja",
];

const YEARLY_FEATURES = [
  "Akses semua kelas premium: Bahasa Jepang & persiapan kerja",
  "Kelas online rutin + semua rekaman",
  "Latihan soal JLPT, JFT-Basic & SSW",
  "Bimbingan CV (rirekisho) & simulasi wawancara",
  "Grup komunitas + prioritas tanya-jawab",
  "Lebih hemat dibanding bayar bulanan",
];

const LIFETIME_FEATURES = [
  "Semua benefit paket Tahunan",
  "Akses selamanya, cukup bayar sekali",
  "Semua kelas & materi baru otomatis terbuka",
  "Tanpa biaya perpanjangan",
];

export default function PremiumPageClient() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [membership, setMembership] = useState<ActiveMembership | null>(null);
  const [loading, setLoading] = useState(true);
  const [refCode, setRefCode] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref") || "";
    if (ref && /^[A-Za-z0-9_-]{3,60}$/.test(ref)) setRefCode(ref);

    Promise.all([
      membershipApi.plans(),
      userApi.membership().catch(() => ({ success: false, data: null })),
    ]).then(([plansRes, membershipRes]) => {
      if (plansRes.success && Array.isArray(plansRes.data)) {
        // Tampilkan SEMUA paket aktif dari admin — paket baru otomatis muncul.
        setPlans(plansRes.data as Plan[]);
      }
      const m = (membershipRes as { success: boolean; data?: unknown }).data as ActiveMembership | null | undefined;
      if (m && m.plan_slug) setMembership(m);
    }).finally(() => setLoading(false));
  }, []);

  const orderHref = (slug: string) => `/order/${slug}${refCode ? `?ref=${encodeURIComponent(refCode)}` : ""}`;

  const isLifetimeMember = membership?.duration_type === "lifetime";
  const isYearlyMember = membership?.duration_type === "yearly";
  const isMonthlyMember = membership?.duration_type === "monthly";

  // Fitur per paket: pakai daftar kurasi untuk slug/durasi yang dikenal,
  // selain itu jatuh ke daftar umum supaya paket baru dari admin tetap tampil rapi.
  const featuresFor = (p: Plan): string[] => {
    // Utamakan benefit yang diatur admin (features_json); fallback ke daftar kurasi.
    if (p.features_json) {
      try {
        const arr = JSON.parse(p.features_json);
        if (Array.isArray(arr) && arr.length > 0) return arr.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
      } catch { /* fallback di bawah */ }
    }
    const bySlug: Record<string, string[]> = {
      monthly: MONTHLY_FEATURES,
      yearly: YEARLY_FEATURES,
      lifetime: LIFETIME_FEATURES,
    };
    if (bySlug[p.slug]) return bySlug[p.slug];
    if (p.duration_type === "monthly") return MONTHLY_FEATURES;
    if (p.duration_type === "yearly") return YEARLY_FEATURES;
    if (p.duration_type === "lifetime") return LIFETIME_FEATURES;
    return MONTHLY_FEATURES;
  };

  const priceNoteFor = (d: Plan["duration_type"]): string =>
    d === "monthly" ? "per bulan" : d === "yearly" ? "per tahun" : "sekali bayar · akses selamanya";

  const badgeFor = (p: Plan): string | undefined => {
    if (p.duration_type === "lifetime") return "Sekali Bayar";
    if (p.duration_type === "yearly") return isYearlyMember ? undefined : "Paling Populer";
    return undefined;
  };

  const renderCard = (plan: Plan | null, fallback: { name: string; price: number; compareAt: number; slug: string }, opts: {
    badge?: string;
    features: string[];
    priceNote: string;
    cta: string;
    featured: boolean;
    alreadyActive?: boolean;
  }) => {
    const name = plan?.name || fallback.name;
    const price = plan?.price ?? fallback.price;
    const compareAt = plan?.compare_at_price ?? fallback.compareAt;
    const slug = plan?.slug || fallback.slug;
    const hasDiscount = compareAt && compareAt > price;

    return (
      <div
        key={slug}
        className={`relative flex flex-col bg-white rounded-2xl border shadow-sm overflow-hidden ${
          opts.featured ? "border-primary ring-1 ring-primary/30" : "border-[rgba(12,12,10,0.08)]"
        }`}
      >
        {opts.badge && (
          <div className="absolute right-4 top-4 rounded-md bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
            {opts.badge}
          </div>
        )}
        <div className={`h-1 w-full ${opts.featured ? "bg-primary" : "bg-[rgba(12,12,10,0.08)]"}`} />
        <div className="flex flex-col flex-1 p-6">
          <p className="text-sm font-bold text-warm-black">{name}</p>

          <div className="mt-3">
            {hasDiscount ? (
              <p className="text-sm line-through" style={{ color: "rgba(12,12,10,0.35)" }}>
                {formatRupiah(compareAt!)}
              </p>
            ) : null}
            <p className="text-3xl font-bold text-warm-black">{formatRupiah(price)}</p>
            <p className="text-xs mt-1" style={{ color: "rgba(12,12,10,0.5)" }}>{opts.priceNote}</p>
          </div>

          <ul className="mt-5 space-y-2.5 flex-1">
            {opts.features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: "rgba(12,12,10,0.7)" }}>
                <Check className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                {f}
              </li>
            ))}
          </ul>

          {opts.alreadyActive ? (
            <div className="mt-6 w-full py-2.5 text-center text-sm font-semibold rounded-xl bg-green-50 border border-green-200 text-green-700">
              ✓ Sudah aktif
            </div>
          ) : (
            <Link
              href={orderHref(slug)}
              className={`mt-6 block w-full py-2.5 text-center text-sm font-semibold rounded-xl transition-colors ${
                opts.featured
                  ? "bg-primary text-white hover:bg-primary-hover"
                  : "border border-primary/40 text-primary hover:bg-[#F7E8E8]"
              }`}
            >
              {opts.cta}
            </Link>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className="min-h-screen bg-warm-cream"
      style={{
        backgroundImage: `linear-gradient(to right, rgba(12,12,10,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(12,12,10,0.04) 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
      }}
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <Link href="/dashboard">
              <Image src="/logo.png" alt="PejuangYen" width={128} height={32} priority className="h-8 w-auto" />
            </Link>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 mb-4">
            <Crown className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Member Premium</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-warm-black tracking-tight">
            Buka Semua Akses PejuangYen
          </h1>
          <p className="mt-2 text-sm leading-relaxed max-w-md mx-auto" style={{ color: "rgba(12,12,10,0.55)" }}>
            Semua kelas Bahasa Jepang, persiapan JLPT/JFT, dan bekal kerja ke Jepang dalam satu membership. Pilih yang paling cocok untukmu.
          </p>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-[rgba(12,12,10,0.45)]">Memuat paket membership...</div>
        ) : isLifetimeMember ? (
          /* Sudah Lifetime — tidak ada yang perlu dibeli lagi */
          <div className="bg-white rounded-2xl border border-green-200 shadow-sm p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 border border-green-200">
              <Sparkles className="h-7 w-7 text-green-600" />
            </div>
            <p className="text-lg font-bold text-warm-black">Kamu sudah Lifetime Member 🎉</p>
            <p className="mt-1.5 text-sm" style={{ color: "rgba(12,12,10,0.55)" }}>
              Semua akses premium sudah terbuka selamanya di akun kamu.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-block py-2.5 px-6 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-hover transition-colors"
            >
              Buka Dashboard →
            </Link>
          </div>
        ) : (
          <>
            {isYearlyMember && (
              <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
                <p className="text-xs text-amber-800">
                  Membership <strong>{membership?.plan_name}</strong> kamu aktif
                  {membership?.expires_at
                    ? ` hingga ${new Date(membership.expires_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`
                    : ""}
                  . Upgrade ke Lifetime supaya tidak perlu perpanjang lagi.
                </p>
              </div>
            )}

            <div
              className={`grid gap-4 items-stretch ${
                plans.length >= 3 ? "md:grid-cols-3" : plans.length === 2 ? "md:grid-cols-2" : "md:max-w-sm md:mx-auto"
              }`}
            >
              {plans.map((p) =>
                renderCard(p, { name: p.name, price: p.price, compareAt: p.compare_at_price ?? 0, slug: p.slug }, {
                  badge: badgeFor(p),
                  features: featuresFor(p),
                  priceNote: priceNoteFor(p.duration_type),
                  cta: `Pilih ${p.name.replace(/^Membership\s+/i, "") || "Paket"} →`,
                  featured: p.duration_type === "yearly" && !isYearlyMember,
                  alreadyActive: membership?.duration_type === p.duration_type,
                })
              )}
            </div>

            <p className="mt-6 text-center text-xs" style={{ color: "rgba(12,12,10,0.45)" }}>
              Pembayaran aman via QRIS & Virtual Account — semua proses di dalam PejuangYen, akses aktif otomatis setelah bayar.
            </p>
          </>
        )}

        <p className="mt-6 text-center text-sm" style={{ color: "rgba(12,12,10,0.45)" }}>
          <Link href="/dashboard" className="hover:text-primary transition-colors">← Kembali ke Dashboard</Link>
        </p>
      </div>
    </div>
  );
}
