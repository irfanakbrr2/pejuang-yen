"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Store, Package, Wallet, Settings, ExternalLink, Crown, ChevronRight,
  Percent, Zap, ShieldCheck, Copy, CheckCircle2, Circle, Link2,
} from "lucide-react";
import { tokoApi } from "@/lib/api-client";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { toast } from "@/components/ui/toast";
import { formatRupiah, formatDate } from "@/lib/utils";

interface StoreData {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  logo_url?: string | null;
  custom_html?: string | null;
  payout_bank_account?: string | null;
  status: string;
}

interface Balance {
  available: number;
  pending: number;
  lifetime_net: number;
  total_paid_out: number;
}

interface Sale {
  created_at: string;
  gross_amount: number;
  fee_amount: number;
  net_amount: number;
  product_name: string;
  order_number: string;
}

const inputClass =
  "w-full px-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors";

const BENEFITS = [
  { icon: Percent, title: "Fee Cuma 2%", desc: "Platform sejenis memotong 10% atau lebih. Di sini, 98% hasil penjualan jadi milikmu." },
  { icon: Zap, title: "Pembayaran Otomatis", desc: "QRIS & Virtual Account langsung aktif — pembeli bayar, akses terkirim otomatis, saldo tercatat." },
  { icon: ShieldCheck, title: "File Aman", desc: "Penyimpanan privat: hanya pembeli yang bisa mengunduh. Tidak bisa dibagikan via link langsung." },
];

/** Halaman jualan untuk user FREE — alasan join premium. */
function PremiumPitch() {
  return (
    <div className="mx-auto max-w-2xl py-8">
      {/* Hero */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200">
          <Store className="h-7 w-7 text-amber-600" />
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700">
          <Crown className="h-3 w-3" /> Khusus Member Premium
        </span>
        <h1 className="mt-3 text-2xl md:text-3xl font-bold text-warm-black tracking-tight">
          Buka Tokomu Sendiri di PejuangYen
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-500">
          Jual ebook, template, dan produk digital buatanmu — checkout QRIS/VA otomatis,
          saldo & penarikan rapi, tanpa perlu bikin website sendiri.
        </p>
      </div>

      {/* Benefit */}
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {BENEFITS.map((b) => (
          <div key={b.title} className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white p-4">
            <b.icon className="h-5 w-5 text-primary" />
            <p className="mt-2 text-sm font-bold text-warm-black">{b.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500">{b.desc}</p>
          </div>
        ))}
      </div>

      {/* Mockup storefront (CSS murni) */}
      <div className="mt-8 rounded-2xl border border-[rgba(0,0,0,0.07)] bg-white overflow-hidden shadow-sm" aria-hidden>
        <div className="flex items-center gap-1.5 border-b border-[rgba(0,0,0,0.06)] bg-gray-50 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-300" />
          <span className="ml-3 rounded-md bg-white border border-[rgba(0,0,0,0.06)] px-2 py-0.5 text-[10px] text-gray-400 font-mono">
            app.pejuangyen.com/toko/<span className="text-primary font-semibold">toko-kamu</span>
          </span>
        </div>
        <div className="p-6">
          <div className="mx-auto h-12 w-12 rounded-xl bg-[#F7E8E8] border border-primary/20 flex items-center justify-center">
            <Store className="h-6 w-6 text-primary" />
          </div>
          <div className="mx-auto mt-2 h-3 w-32 rounded bg-gray-200" />
          <div className="mx-auto mt-1.5 h-2 w-48 rounded bg-gray-100" />
          <div className="mt-5 grid grid-cols-2 gap-3">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-xl border border-[rgba(0,0,0,0.06)] p-3">
                <div className="h-16 rounded-lg bg-warm-cream" />
                <div className="mt-2 h-2.5 w-3/4 rounded bg-gray-200" />
                <div className="mt-1.5 h-3 w-1/2 rounded bg-[#8B1414]/20" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA — satu primer */}
      <div className="mt-8 text-center">
        <Link
          href="/premium"
          className="inline-block rounded-xl bg-primary px-8 py-3 text-sm font-bold text-white hover:bg-primary-hover transition-colors"
        >
          Upgrade & Buka Toko →
        </Link>
        <p className="mt-3 text-xs text-gray-400">
          Sudah termasuk semua benefit premium: semua kelas, live session, bonus & template.
        </p>
      </div>
    </div>
  );
}

export default function TokoSayaPage() {
  const [loading, setLoading] = useState(true);
  const [gate, setGate] = useState<"premium_required" | "feature_disabled" | null>(null);
  const [store, setStore] = useState<StoreData | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [productCount, setProductCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  // Onboarding form (belum punya toko)
  const [form, setForm] = useState({ name: "", slug: "", description: "" });
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const res = await tokoApi.me();
    if (res.success && res.data) {
      const s = res.data as StoreData;
      setStore(s);
      setShared(typeof localStorage !== "undefined" && localStorage.getItem(`toko-shared-${s.slug}`) === "1");
      const [balRes, salesRes, productsRes] = await Promise.all([
        tokoApi.balance(),
        tokoApi.sales(),
        tokoApi.products(),
      ]);
      if (balRes.success && balRes.data) setBalance(balRes.data as Balance);
      if (salesRes.success && salesRes.data) setSales((salesRes.data as Sale[]).slice(0, 6));
      if (productsRes.success && Array.isArray(productsRes.data)) {
        setProductCount((productsRes.data as unknown[]).length);
      }
    } else if (res.error?.includes("premium")) {
      setGate("premium_required");
    } else if (res.error?.includes("belum tersedia")) {
      setGate("feature_disabled");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyLink = async () => {
    if (!store) return;
    try {
      await navigator.clipboard.writeText(`https://app.pejuangyen.com/toko/${store.slug}`);
      setCopied(true);
      setShared(true);
      localStorage.setItem(`toko-shared-${store.slug}`, "1");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Gagal menyalin link");
    }
  };

  const createStore = async () => {
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error("Nama dan slug toko wajib diisi");
      return;
    }
    setCreating(true);
    const res = await tokoApi.create({
      name: form.name.trim(),
      slug: form.slug.trim().toLowerCase(),
      description: form.description.trim() || undefined,
    });
    setCreating(false);
    if (res.success) {
      toast.success("Toko berhasil dibuat! 🎉");
      setLoading(true);
      load();
    } else {
      toast.error(res.error || "Gagal membuat toko");
    }
  };

  if (loading) return <p className="py-10 text-center text-sm text-gray-500">Memuat...</p>;

  if (gate === "feature_disabled") {
    return (
      <div className="py-14 text-center">
        <Store className="mx-auto mb-3 h-10 w-10 text-gray-300" />
        <p className="text-sm font-semibold text-warm-black">Fitur toko belum tersedia</p>
        <p className="mt-1 text-xs text-gray-500">Segera hadir — nantikan ya!</p>
      </div>
    );
  }

  if (gate === "premium_required") return <PremiumPitch />;

  if (!store) {
    return (
      <>
        <PageHeader title="Buka Toko Kamu" description="Jual produk digital buatanmu — fee platform hanya 2% per penjualan." />
        <div className="max-w-lg rounded-2xl border border-[rgba(0,0,0,0.07)] bg-white p-6 space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-gray-600">Nama Toko *</label>
            <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Toko Belajar Bahasa Jepang" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-gray-600">Slug (alamat toko) *</label>
            <input className={`${inputClass} font-mono`} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} placeholder="toko-bahasa-jepang" />
            <p className="mt-1 text-xs text-gray-400">app.pejuangyen.com/toko/<strong>{form.slug || "slug-kamu"}</strong></p>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 text-gray-600">Deskripsi singkat</label>
            <textarea className={inputClass} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <button
            onClick={createStore}
            disabled={creating}
            className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-hover transition-colors disabled:opacity-60"
          >
            {creating ? "Membuat..." : "Buat Toko →"}
          </button>
        </div>
      </>
    );
  }

  // ── Dashboard pemilik toko ──
  const checklist = [
    { done: !!store.payout_bank_account, label: "Lengkapi rekening bank", href: "/toko-saya/pengaturan" },
    { done: (productCount ?? 0) > 0, label: "Tambah produk pertama", href: "/toko-saya/produk" },
    { done: !!(store.logo_url || store.custom_html), label: "Pasang logo / section HTML toko", href: "/toko-saya/pengaturan" },
    { done: shared, label: "Bagikan link tokomu", action: copyLink },
  ];
  const checklistDone = checklist.every((c) => c.done);

  return (
    <>
      <PageHeader
        title={store.name}
        description={store.status === "suspended" ? "⚠️ Toko sedang ditangguhkan admin" : `app.pejuangyen.com/toko/${store.slug}`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={copyLink}
              className={`flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
                copied
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-[rgba(12,12,10,0.12)] text-warm-black hover:border-primary"
              }`}
            >
              {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Tersalin ✓" : "Salin Link"}
            </button>
            <a
              href={`/toko/${store.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover transition-colors"
            >
              <ExternalLink className="h-4 w-4" /> Lihat Toko
            </a>
          </div>
        }
      />

      {/* KPI */}
      <div className="mb-5 grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Saldo Tersedia", value: balance?.available ?? 0, accent: true },
          { label: "Saldo Tertahan", value: balance?.pending ?? 0 },
          { label: "Total Pendapatan", value: balance?.lifetime_net ?? 0 },
          { label: "Sudah Ditarik", value: balance?.total_paid_out ?? 0 },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{s.label}</p>
            <p className={`mt-1 text-lg font-bold tabular-nums ${s.accent ? "text-primary" : "text-warm-black"}`}>{formatRupiah(s.value)}</p>
          </div>
        ))}
      </div>

      {/* Checklist onboarding toko — hilang otomatis saat lengkap */}
      {!checklistDone && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <p className="mb-2.5 text-sm font-bold text-warm-black">Selesaikan setup tokomu</p>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {checklist.map((c) =>
              c.done ? (
                <div key={c.label} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-400 line-through">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" /> {c.label}
                </div>
              ) : c.href ? (
                <Link key={c.label} href={c.href} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-warm-black hover:bg-white transition-colors">
                  <Circle className="h-4 w-4 shrink-0 text-amber-500" /> {c.label}
                  <ChevronRight className="ml-auto h-3.5 w-3.5 text-gray-400" />
                </Link>
              ) : (
                <button key={c.label} onClick={c.action} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium text-warm-black hover:bg-white transition-colors cursor-pointer">
                  <Circle className="h-4 w-4 shrink-0 text-amber-500" /> {c.label}
                  <Link2 className="ml-auto h-3.5 w-3.5 text-gray-400" />
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* Penjualan (2/3) + navigasi kompak (1/3) */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-[rgba(0,0,0,0.07)] bg-white p-5">
          <p className="mb-3 text-sm font-bold text-warm-black">Penjualan Terbaru</p>
          {sales.length === 0 ? (
            <p className="text-sm text-gray-500">
              Belum ada penjualan. Bagikan link tokomu untuk mulai jualan:
              {" "}<button onClick={copyLink} className="font-semibold text-primary hover:underline cursor-pointer">salin link</button>.
            </p>
          ) : (
            <div className="space-y-2">
              {sales.map((s, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-[rgba(0,0,0,0.05)] px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-warm-black truncate">{s.product_name}</p>
                    <p className="text-xs text-gray-400">{formatDate(s.created_at)} · fee {formatRupiah(s.fee_amount)}</p>
                  </div>
                  <p className="shrink-0 font-bold text-primary tabular-nums">+{formatRupiah(s.net_amount)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white p-2">
          {[
            { href: "/toko-saya/produk", icon: Package, title: "Produk", desc: productCount != null ? `${productCount} produk` : "Kelola produk digital" },
            { href: "/toko-saya/penarikan", icon: Wallet, title: "Penarikan", desc: "Tarik saldo ke rekening" },
            { href: "/toko-saya/pengaturan", icon: Settings, title: "Pengaturan", desc: "Profil, branding & rekening" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="flex items-center gap-3 rounded-lg px-3 py-3 hover:bg-warm-cream/60 transition-colors group">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F7E8E8] border border-primary/15">
                <l.icon className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-warm-black">{l.title}</p>
                <p className="text-xs text-gray-400 truncate">{l.desc}</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
