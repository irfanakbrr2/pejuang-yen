"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BarChart3, Gift, Rocket, Tag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { toast } from "@/components/ui/toast";
import { formatRupiah } from "@/lib/utils";

interface FunnelStep {
  id?: string;
  step_type: "order_bump" | "upsell" | "downsell";
  enabled: number;
  product_type: string;
  product_id: string;
  product_label?: string;
  price_override?: number | null;
  headline?: string | null;
  description?: string | null;
  badge_text?: string | null;
  image_url?: string | null;
  countdown_seconds?: number | null;
}

interface FunnelDetail {
  id: string;
  name: string;
  status: "draft" | "active" | "archived";
  trigger_product_type: string;
  trigger_product_id: string;
  trigger_label: string;
  offer_window_minutes: number;
  exit_url?: string | null;
  steps: FunnelStep[];
}

interface ProductOption {
  id: string;
  name: string;
  price: number;
}

type StepStats = Record<string, Record<string, { count: number; amount: number }>>;

const STEP_META: Record<FunnelStep["step_type"], { title: string; desc: string; icon: typeof Gift }> = {
  order_bump: { title: "Order Bump", desc: "Checkbox penawaran tambahan di halaman checkout (sebelum bayar).", icon: Gift },
  upsell: { title: "Upsell", desc: "Penawaran setelah pembayaran sukses — accept langsung lanjut bayar.", icon: Rocket },
  downsell: { title: "Downsell", desc: "Ditawarkan sekali bila upsell ditolak — versi lebih terjangkau.", icon: Tag },
};

const STEP_PRODUCT_TYPES: Record<string, { value: string; label: string }[]> = {
  order_bump: [
    { value: "digital_product", label: "Produk Digital" },
    { value: "course", label: "Kelas" },
    { value: "tool_credits", label: "Paket Kredit" },
  ],
  upsell: [
    { value: "membership", label: "Membership" },
    { value: "digital_product", label: "Produk Digital" },
    { value: "course", label: "Kelas" },
    { value: "tool_credits", label: "Paket Kredit" },
  ],
  downsell: [
    { value: "membership", label: "Membership" },
    { value: "digital_product", label: "Produk Digital" },
    { value: "course", label: "Kelas" },
    { value: "tool_credits", label: "Paket Kredit" },
  ],
};

const inputClass =
  "w-full px-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors";
const labelClass = "block text-xs font-semibold mb-1.5 text-gray-600";

function StepCard({ funnelId, stepType, initial, onSaved }: {
  funnelId: string;
  stepType: FunnelStep["step_type"];
  initial: FunnelStep | null;
  onSaved: () => void;
}) {
  const meta = STEP_META[stepType];
  const Icon = meta.icon;
  const [enabled, setEnabled] = useState(initial ? Number(initial.enabled) === 1 : false);
  const [productType, setProductType] = useState(initial?.product_type || STEP_PRODUCT_TYPES[stepType][0].value);
  const [productId, setProductId] = useState(initial?.product_id || "");
  const [priceOverride, setPriceOverride] = useState(initial?.price_override != null ? String(initial.price_override) : "");
  const [headline, setHeadline] = useState(initial?.headline || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [badgeText, setBadgeText] = useState(initial?.badge_text || "");
  const [countdown, setCountdown] = useState(initial?.countdown_seconds != null ? String(initial.countdown_seconds) : "");
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/funnels/options/${productType}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setOptions(d.success ? d.data || [] : []));
  }, [productType]);

  const selectedProduct = options.find((o) => o.id === productId);

  const save = async () => {
    if (!productId) {
      toast.error(`Pilih produk untuk ${meta.title}`);
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/admin/funnels/${funnelId}/steps/${stepType}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled,
        product_type: productType,
        product_id: productId,
        price_override: priceOverride || null,
        headline: headline.trim() || null,
        description: description.trim() || null,
        badge_text: badgeText.trim() || null,
        countdown_seconds: stepType !== "order_bump" && countdown ? Number(countdown) : null,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.success) {
      toast.success(`${meta.title} disimpan`);
      onSaved();
    } else {
      toast.error(data.error || "Gagal menyimpan step");
    }
  };

  return (
    <div className={`rounded-xl border bg-white p-5 ${enabled ? "border-primary/40" : "border-[rgba(0,0,0,0.07)]"}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${enabled ? "text-primary" : "text-gray-400"}`} />
          <p className="text-sm font-bold text-warm-black">{meta.title}</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-gray-600">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 rounded text-primary focus:ring-primary" />
          Aktif
        </label>
      </div>
      <p className="mb-4 text-xs text-gray-500">{meta.desc}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Tipe Produk</label>
          <select className={inputClass} value={productType} onChange={(e) => { setProductType(e.target.value); setProductId(""); }}>
            {STEP_PRODUCT_TYPES[stepType].map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Produk</label>
          <select className={inputClass} value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">— pilih —</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>{o.name} ({formatRupiah(o.price)})</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Harga Khusus (Rp) — kosong = harga normal</label>
          <input type="number" className={inputClass} value={priceOverride} onChange={(e) => setPriceOverride(e.target.value)} placeholder={selectedProduct ? String(selectedProduct.price) : ""} />
        </div>
        {stepType !== "order_bump" && (
          <div>
            <label className={labelClass}>Countdown (detik, opsional)</label>
            <input type="number" className={inputClass} value={countdown} onChange={(e) => setCountdown(e.target.value)} placeholder="300" />
          </div>
        )}
        <div className="sm:col-span-2">
          <label className={labelClass}>Headline</label>
          <input className={inputClass} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder={stepType === "order_bump" ? "Penawaran spesial hanya di checkout ini" : "Tunggu! Penawaran sekali seumur hidup"} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Deskripsi</label>
          <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Badge (opsional)</label>
          <input className={inputClass} value={badgeText} onChange={(e) => setBadgeText(e.target.value)} placeholder="Hemat 60%" />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? "Menyimpan..." : `Simpan ${meta.title}`}</Button>
      </div>
    </div>
  );
}

export default function FunnelEditorClient() {
  const pathname = usePathname();
  const funnelId = pathname.split("/").filter(Boolean)[2] ?? "_";

  const [funnel, setFunnel] = useState<FunnelDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StepStats>({});
  const [savingMeta, setSavingMeta] = useState(false);

  const load = useCallback(async () => {
    const [detailRes, statsRes] = await Promise.all([
      fetch(`/api/admin/funnels/${funnelId}`, { credentials: "include" }).then((r) => r.json()),
      fetch(`/api/admin/funnels/${funnelId}/stats`, { credentials: "include" }).then((r) => r.json()).catch(() => ({ success: false })),
    ]);
    if (detailRes.success) setFunnel(detailRes.data);
    if (statsRes.success) setStats(statsRes.data || {});
    setLoading(false);
  }, [funnelId]);

  useEffect(() => {
    if (!funnelId || funnelId === "_") return;
    load();
  }, [funnelId, load]);

  const updateFunnel = async (patch: Record<string, unknown>) => {
    if (!funnel) return;
    setSavingMeta(true);
    const res = await fetch(`/api/admin/funnels/${funnel.id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    setSavingMeta(false);
    if (data.success) {
      toast.success("Funnel diperbarui");
      load();
    } else {
      toast.error(data.error || "Gagal memperbarui funnel");
    }
  };

  if (loading) return <p className="py-10 text-center text-sm text-gray-500">Memuat...</p>;
  if (!funnel) {
    return (
      <div className="py-14 text-center">
        <p className="text-sm font-semibold text-warm-black">Funnel tidak ditemukan</p>
        <Link href="/admin/funnels" className="mt-2 inline-block text-xs text-primary">← Kembali</Link>
      </div>
    );
  }

  const stepFor = (type: FunnelStep["step_type"]) => funnel.steps.find((s) => s.step_type === type) || null;
  const statRow = (type: string) => {
    const s = stats[type] || {};
    const viewed = s.viewed?.count || 0;
    const accepted = s.accepted?.count || 0;
    const converted = s.converted?.count || 0;
    const revenue = s.converted?.amount || 0;
    return { viewed, accepted, converted, revenue, rate: viewed > 0 ? Math.round((accepted / viewed) * 100) : 0 };
  };

  return (
    <>
      <Link href="/admin/funnels" className="mb-3 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" /> Semua Funnels
      </Link>
      <PageHeader
        title={funnel.name}
        description={`Trigger: ${funnel.trigger_label} (${funnel.trigger_product_type}${funnel.trigger_product_id === "*" ? " · semua produk" : ""})`}
        actions={
          <div className="flex items-center gap-2">
            <select
              className={inputClass}
              value={funnel.status}
              disabled={savingMeta}
              onChange={(e) => updateFunnel({ status: e.target.value })}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        }
      />

      {/* Stats ringkas */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        {(["order_bump", "upsell", "downsell"] as const).map((type) => {
          const s = statRow(type);
          return (
            <div key={type} className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white p-4">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-3.5 w-3.5 text-gray-400" />
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{STEP_META[type].title}</p>
              </div>
              <p className="text-lg font-bold text-warm-black">{formatRupiah(s.revenue)}</p>
              <p className="text-xs text-gray-500">
                {s.viewed} dilihat · {s.accepted} diterima ({s.rate}%) · {s.converted} terbayar
              </p>
            </div>
          );
        })}
      </div>

      {/* Pengaturan offer window + exit */}
      <div className="mb-5 rounded-xl border border-[rgba(0,0,0,0.07)] bg-white p-5">
        <p className="mb-3 text-sm font-bold text-warm-black">Pengaturan Offer</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Masa berlaku offer (menit setelah bayar)</label>
            <input
              type="number"
              className={inputClass}
              defaultValue={funnel.offer_window_minutes}
              onBlur={(e) => {
                const v = Number(e.target.value);
                if (v && v !== funnel.offer_window_minutes) updateFunnel({ offer_window_minutes: v });
              }}
            />
          </div>
          <div>
            <label className={labelClass}>Exit URL (setelah offer ditolak — kosong = otomatis per tipe produk)</label>
            <input
              className={inputClass}
              defaultValue={funnel.exit_url || ""}
              placeholder="/dashboard"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (funnel.exit_url || "")) updateFunnel({ exit_url: v || null });
              }}
            />
          </div>
        </div>
      </div>

      {/* Step cards */}
      <div className="space-y-4">
        {(["order_bump", "upsell", "downsell"] as const).map((type) => (
          <StepCard key={`${type}-${stepFor(type)?.id || "new"}`} funnelId={funnel.id} stepType={type} initial={stepFor(type)} onSaved={load} />
        ))}
      </div>
    </>
  );
}
