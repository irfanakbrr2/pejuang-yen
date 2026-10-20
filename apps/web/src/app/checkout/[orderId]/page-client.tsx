"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import QRCode from "qrcode";
import { CheckCircle2, Clock, Copy, CreditCard, Receipt, RefreshCw, ShoppingBag, XCircle } from "lucide-react";
import { checkoutApi } from "@/lib/api-client";
import { formatRupiah } from "@/lib/utils";
import { PAYMENT_METHODS, methodLabel, type PaymentMethodId } from "@/lib/payment-methods";

interface CheckoutPricing {
  product_amount?: number;
  discount_amount?: number;
  subtotal_amount?: number;
  order_bump_amount?: number;
  payment_admin_fee?: number;
  total_amount?: number;
}

interface CheckoutData {
  order_id: string;
  order_number: string;
  order_type: string;
  product_name: string;
  amount: number;
  status: string;
  payment_status: "pending" | "paid" | "expired" | "failed";
  paid_at: string | null;
  created_at: string;
  pricing: CheckoutPricing | null;
  order_page_url: string;
  payment: {
    method: string;
    payment_number: string | null;
    fee: number;
    total_payment: number;
    expired_at: string | null;
    status: string;
  } | null;
}

const QRIS_STEPS = [
  "Buka aplikasi e-wallet atau m-banking kamu (GoPay, OVO, DANA, BCA, dll).",
  "Pilih menu Bayar / Scan QR, lalu scan QR code di atas.",
  "Periksa nama merchant & nominal, lalu konfirmasi pembayaran.",
  "Status di halaman ini akan terupdate otomatis setelah pembayaran berhasil.",
];

const VA_STEPS = [
  "Buka m-banking / ATM bank yang sesuai dengan Virtual Account di atas.",
  "Pilih menu Transfer / Bayar → Virtual Account.",
  "Masukkan nomor Virtual Account, lalu periksa nama & nominal tagihan.",
  "Nominal transfer HARUS sama persis dengan total pembayaran.",
  "Status di halaman ini akan terupdate otomatis setelah pembayaran berhasil.",
];

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function groupVaNumber(value: string): string {
  return value.replace(/(.{4})/g, "$1 ").trim();
}

export default function CheckoutPageClient() {
  const pathname = usePathname();
  const router = useRouter();
  const orderId = pathname.split("/").filter(Boolean)[1] ?? "_";

  const [data, setData] = useState<CheckoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState("");
  const [showMethodPicker, setShowMethodPicker] = useState(false);
  const [repayMethod, setRepayMethod] = useState<PaymentMethodId>("qris");
  const [repaying, setRepaying] = useState(false);
  const [repayError, setRepayError] = useState("");
  const [manualInfo, setManualInfo] = useState<Record<string, string> | null>(null);

  const goSuccess = useCallback(() => {
    router.replace(`/checkout/success?order_id=${encodeURIComponent(orderId)}`);
  }, [router, orderId]);

  const load = useCallback(async () => {
    const res = await checkoutApi.get(orderId);
    if (res.success && res.data) {
      const d = res.data as CheckoutData;
      setData(d);
      setLoadError("");
      if (d.payment?.method && d.payment.method !== "qris") {
        setRepayMethod((d.payment.method as PaymentMethodId) || "qris");
      }
      if (d.payment_status === "paid") goSuccess();
    } else if (res.error === "Unauthorized" || res.error?.includes("(401)")) {
      router.push(`/login?redirect=/checkout/${orderId}`);
      return;
    } else {
      setLoadError(res.error || "Gagal memuat data checkout.");
    }
    setLoading(false);
  }, [orderId, router, goSuccess]);

  useEffect(() => {
    if (!orderId || orderId === "_") return;
    load();
  }, [orderId, load]);

  // Render QR untuk QRIS — payment_number adalah QR string, JANGAN tampilkan mentah
  useEffect(() => {
    const payment = data?.payment;
    if (payment?.method === "qris" && payment.payment_number) {
      QRCode.toDataURL(payment.payment_number, { width: 560, margin: 1 })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(null));
    } else {
      setQrDataUrl(null);
    }
  }, [data?.payment, data?.payment?.payment_number]);

  // Countdown ke expired_at
  useEffect(() => {
    const expiredAt = data?.payment?.expired_at;
    if (!expiredAt || data?.payment_status !== "pending") {
      setRemainingMs(null);
      return;
    }
    const tick = () => setRemainingMs(new Date(expiredAt).getTime() - Date.now());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [data?.payment?.expired_at, data?.payment_status]);

  // Ambil info rekening untuk order Transfer Manual
  useEffect(() => {
    if (data?.payment?.method === "manual_transfer" && !manualInfo) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/manual-payment`, { credentials: "include" })
        .then((r) => r.json())
        .then((d) => { if (d.success) setManualInfo(d.data); })
        .catch(() => {});
    }
  }, [data?.payment?.method, manualInfo]);

  const countdownExpired = remainingMs !== null && remainingMs <= 0;
  const effectiveStatus: CheckoutData["payment_status"] | null = data
    ? (data.payment_status === "pending" && countdownExpired ? "expired" : data.payment_status)
    : null;

  // Polling status dengan backoff bertahap + jitter.
  // Pembayaran difulfill server-side via webhook; polling hanya untuk deteksi UX,
  // jadi aman melambat. Backoff + jitter mencegah thundering-herd ke D1 saat
  // ribuan checkout berjalan serentak (mis. webinar). Cepat di awal (mayoritas
  // bayar dalam menit pertama), lalu melebar.
  useEffect(() => {
    if (effectiveStatus !== "pending") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const startedAt = Date.now();

    // Interval naik seiring waktu: ≤60s → 5s, ≤180s → 10s, selebihnya → 20s.
    const nextDelay = () => {
      const elapsed = Date.now() - startedAt;
      const base = elapsed <= 60_000 ? 5_000 : elapsed <= 180_000 ? 10_000 : 20_000;
      // Jitter ±25% agar klien tidak polling di tick wall-clock yang sama.
      return Math.round(base * (0.75 + Math.random() * 0.5));
    };

    const tick = async () => {
      const res = await checkoutApi.status(orderId);
      if (cancelled) return;
      const status = (res.data as { status?: string } | undefined)?.status;
      if (res.success && status === "paid") {
        goSuccess();
        return;
      }
      if (res.success && (status === "expired" || status === "failed")) {
        load();
        return;
      }
      timer = setTimeout(tick, nextDelay());
    };

    timer = setTimeout(tick, nextDelay());
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [effectiveStatus, orderId, goSuccess, load]);

  const handleCopy = async () => {
    const va = data?.payment?.payment_number;
    if (!va) return;
    try {
      await navigator.clipboard.writeText(va);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard tidak tersedia */
    }
  };

  // Tombol "Saya sudah bayar" — backend konfirmasi ke Transaction Detail API
  const handleCheck = async () => {
    setChecking(true);
    setCheckMessage("");
    const res = await checkoutApi.check(orderId);
    const status = (res.data as { status?: string } | undefined)?.status;
    if (res.success && status === "paid") {
      goSuccess();
      return;
    }
    setCheckMessage(
      res.success
        ? "Pembayaran belum terdeteksi. Jika kamu sudah bayar, tunggu beberapa saat lalu coba lagi."
        : res.error || "Gagal mengecek pembayaran. Coba lagi."
    );
    setChecking(false);
  };

  const handleRepay = async () => {
    setRepaying(true);
    setRepayError("");
    const res = await checkoutApi.repay(orderId, repayMethod);
    if (res.success) {
      setShowMethodPicker(false);
      setCheckMessage("");
      setLoading(true);
      await load();
    } else {
      setRepayError(res.error || "Gagal membuat pembayaran baru. Coba lagi.");
    }
    setRepaying(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-warm-cream flex items-center justify-center">
        <div className="text-sm text-[rgba(12,12,10,0.45)]">Memuat checkout...</div>
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="min-h-screen bg-warm-cream flex items-center justify-center p-4">
        <div className="text-center">
          <p className="font-semibold text-warm-black mb-2">{loadError || "Order tidak ditemukan"}</p>
          <Link href="/dashboard" className="text-sm text-primary">← Kembali ke Dashboard</Link>
        </div>
      </div>
    );
  }

  const payment = data.payment;
  const isQris = payment?.method === "qris";
  const totalPayment = payment?.total_payment || data.amount;
  const pricing = data.pricing;

  // ── Order TRANSFER MANUAL: tampilkan instruksi rekening + konfirmasi admin ──
  if (payment?.method === "manual_transfer") {
    const isPaid = effectiveStatus === "paid";
    const waRaw = (manualInfo?.manual_whatsapp || "").replace(/[^0-9]/g, "");
    const waIntl = waRaw ? (waRaw.startsWith("0") ? "62" + waRaw.slice(1) : waRaw) : "";
    const waLink = waIntl
      ? `https://wa.me/${waIntl}?text=${encodeURIComponent(`Halo admin, saya sudah transfer untuk order ${data.order_number} (${data.product_name}). Mohon diverifikasi ya.`)}`
      : null;
    return (
      <div className="min-h-screen bg-warm-cream py-8 px-4">
        <div className="max-w-lg mx-auto bg-white rounded-2xl border border-black/[0.06] p-6 space-y-5">
          <div className="text-center">
            <img src="/logo.png" alt="PejuangYen" className="h-8 w-auto mx-auto mb-3" />
            <h1 className="text-lg font-bold text-warm-black">Selesaikan Pembayaran</h1>
            <p className="text-sm text-[rgba(12,12,10,0.55)] mt-1">{data.product_name}</p>
          </div>

          {isPaid ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center text-sm text-green-800">
              Pembayaran terverifikasi. Akses kamu sudah aktif.
              <div className="mt-3"><Link href="/dashboard" className="text-primary font-semibold">Ke Dashboard →</Link></div>
            </div>
          ) : (
            <>
              <div className="rounded-xl bg-[#F7E8E8] p-4 text-center">
                <p className="text-xs text-[rgba(12,12,10,0.55)]">Total transfer</p>
                <p className="text-2xl font-bold text-[#8B1414]">Rp{data.amount.toLocaleString("id-ID")}</p>
                <p className="text-[11px] text-[rgba(12,12,10,0.5)] mt-1">No. Order: <b>{data.order_number}</b></p>
              </div>

              <div className="rounded-xl border border-black/[0.08] text-sm">
                <div className="flex justify-between px-4 py-3 border-b border-black/[0.06]">
                  <span className="text-[rgba(12,12,10,0.55)]">Bank</span>
                  <span className="font-semibold text-warm-black">{manualInfo?.manual_bank_name || "…"}</span>
                </div>
                <div className="flex justify-between items-center px-4 py-3 border-b border-black/[0.06]">
                  <span className="text-[rgba(12,12,10,0.55)]">No. Rekening</span>
                  <span className="flex items-center gap-2">
                    <span className="font-bold text-warm-black font-mono">{manualInfo?.manual_bank_account || "…"}</span>
                    {manualInfo?.manual_bank_account && (
                      <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(manualInfo.manual_bank_account)}
                        className="text-xs text-primary hover:underline"
                      >Salin</button>
                    )}
                  </span>
                </div>
                <div className="flex justify-between px-4 py-3">
                  <span className="text-[rgba(12,12,10,0.55)]">Atas Nama</span>
                  <span className="font-semibold text-warm-black text-right">{manualInfo?.manual_bank_holder || "…"}</span>
                </div>
              </div>

              {manualInfo?.manual_payment_note && (
                <p className="text-xs text-[rgba(12,12,10,0.6)] leading-relaxed">{manualInfo.manual_payment_note}</p>
              )}

              {waLink && (
                <a href={waLink} target="_blank" rel="noopener noreferrer"
                   className="block w-full text-center rounded-xl bg-[#25D366] text-white font-semibold py-3 hover:opacity-90 transition-opacity">
                  Konfirmasi via WhatsApp
                </a>
              )}
              <p className="text-center text-xs text-[rgba(12,12,10,0.5)]">
                Status: menunggu verifikasi admin. Halaman ini otomatis diperbarui setelah pembayaran dikonfirmasi.
              </p>
              <Link href="/dashboard" className="block text-center text-sm text-primary">← Kembali ke Dashboard</Link>
            </>
          )}
        </div>
      </div>
    );
  }

  const sectionLabelClass = "text-[10px] font-semibold tracking-widest uppercase";
  const sectionLabelStyle = { color: "rgba(12,12,10,0.4)" } as const;

  const methodPicker = (
    <div className="space-y-2">
      {PAYMENT_METHODS.map((m) => (
        <label
          key={m.id}
          className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
            repayMethod === m.id
              ? "border-primary bg-[#F7E8E8]"
              : "border-[rgba(12,12,10,0.12)] bg-white hover:border-[rgba(12,12,10,0.25)]"
          }`}
        >
          <input
            type="radio"
            name="repay-method"
            checked={repayMethod === m.id}
            onChange={() => setRepayMethod(m.id)}
            className="h-4 w-4 text-primary focus:ring-primary"
          />
          <span className="text-sm font-medium text-warm-black">{m.label}</span>
        </label>
      ))}
      {repayError && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{repayError}</div>
      )}
      <button
        onClick={handleRepay}
        disabled={repaying}
        className="w-full py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {repaying ? "Memproses..." : "Buat Pembayaran Baru →"}
      </button>
    </div>
  );

  return (
    <div
      className="min-h-screen bg-warm-cream flex items-center justify-center p-4"
      style={{
        backgroundImage: `linear-gradient(to right, rgba(12,12,10,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(12,12,10,0.04) 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
      }}
    >
      <div className="w-full max-w-md space-y-3 py-6">
        {/* Announcement status untuk screen reader — visual tidak berubah */}
        <p className="sr-only" role="status" aria-live="polite">
          {effectiveStatus === "pending"
            ? "Menunggu pembayaran. Halaman akan terupdate otomatis setelah pembayaran terdeteksi."
            : effectiveStatus === "expired"
              ? "Pembayaran kadaluarsa. Silakan buat pembayaran baru."
              : effectiveStatus === "failed"
                ? "Order tidak dapat diproses."
                : "Pembayaran berhasil."}
        </p>
        <div className="bg-white rounded-2xl border border-[rgba(12,12,10,0.08)] shadow-sm overflow-hidden">
          <div className="h-1 bg-primary w-full" />

          {/* Logo */}
          <div className="flex justify-center px-6 pt-6 pb-5">
            <Image src="/logo.png" alt="PejuangYen" width={128} height={32} priority className="h-8 w-auto" />
          </div>

          {/* ── Produk ── */}
          <div className="h-px bg-black/[0.06]" />
          <div className="px-6 py-4">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingBag className="h-4 w-4" style={sectionLabelStyle} />
              <span className={sectionLabelClass} style={sectionLabelStyle}>Detail Pesanan</span>
            </div>
            <p className="text-base font-semibold text-warm-black">{data.product_name}</p>
            <p className="text-xs mt-1 font-mono" style={{ color: "rgba(12,12,10,0.5)" }}>{data.order_number}</p>
          </div>

          {/* ── Status pending: QRIS / VA ── */}
          {effectiveStatus === "pending" && payment && (
            <>
              <div className="h-px bg-black/[0.06]" />
              <div className="px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" style={sectionLabelStyle} />
                    <span className={sectionLabelClass} style={sectionLabelStyle}>{methodLabel(payment.method)}</span>
                  </div>
                  {remainingMs !== null && (
                    <span
                      aria-label={`Sisa waktu pembayaran ${formatCountdown(remainingMs)}`}
                      className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 tabular-nums"
                    >
                      <Clock className="h-3.5 w-3.5" aria-hidden />
                      {formatCountdown(remainingMs)}
                    </span>
                  )}
                </div>

                {isQris ? (
                  <div className="flex flex-col items-center">
                    {qrDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qrDataUrl}
                        alt="QRIS — scan untuk membayar"
                        className="w-64 h-64 rounded-xl border border-[rgba(12,12,10,0.08)]"
                      />
                    ) : (
                      <div className="w-64 h-64 rounded-xl border border-[rgba(12,12,10,0.08)] flex items-center justify-center text-xs text-[rgba(12,12,10,0.45)]">
                        Menyiapkan QR code...
                      </div>
                    )}
                    <p className="text-xs mt-3 text-center" style={{ color: "rgba(12,12,10,0.5)" }}>
                      Scan QR di atas dengan e-wallet atau m-banking apa pun yang mendukung QRIS.
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs mb-1.5" style={{ color: "rgba(12,12,10,0.5)" }}>Nomor Virtual Account</p>
                    <div className="flex items-center gap-2">
                      <p className="flex-1 text-lg font-bold font-mono text-warm-black tracking-wide break-all">
                        {payment.payment_number ? groupVaNumber(payment.payment_number) : "-"}
                      </p>
                      <button
                        onClick={handleCopy}
                        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors whitespace-nowrap ${
                          copied
                            ? "text-green-700 bg-green-50 border-green-200"
                            : "text-warm-black bg-warm-cream border-[rgba(12,12,10,0.08)] hover:bg-[#e6ddc5]"
                        }`}
                      >
                        {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? "Tersalin" : "Salin"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Total pembayaran */}
                <div className="mt-4 rounded-xl bg-warm-cream border border-[rgba(12,12,10,0.08)] px-4 py-3 flex items-center justify-between">
                  <span className="text-xs font-semibold" style={{ color: "rgba(12,12,10,0.55)" }}>Total Pembayaran</span>
                  <span className="text-lg font-bold text-primary">{formatRupiah(totalPayment)}</span>
                </div>
                {payment.fee > 0 && (
                  <p className="text-[11px] mt-1.5 text-right" style={{ color: "rgba(12,12,10,0.4)" }}>
                    Termasuk biaya metode pembayaran {formatRupiah(payment.fee)}
                  </p>
                )}
              </div>

              {/* ── Instruksi ── */}
              <div className="h-px bg-black/[0.06]" />
              <div className="px-6 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Receipt className="h-4 w-4" style={sectionLabelStyle} />
                  <span className={sectionLabelClass} style={sectionLabelStyle}>Cara Membayar</span>
                </div>
                <ol className="space-y-1.5 list-decimal pl-4 text-xs leading-relaxed" style={{ color: "rgba(12,12,10,0.6)" }}>
                  {(isQris ? QRIS_STEPS : VA_STEPS).map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>

              {/* ── Aksi ── */}
              <div className="h-px bg-black/[0.06]" />
              <div className="px-6 py-4 space-y-2.5">
                {checkMessage && (
                  <div className="px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                    {checkMessage}
                  </div>
                )}
                <button
                  onClick={handleCheck}
                  disabled={checking}
                  className="w-full py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {checking ? "Mengecek pembayaran..." : "Saya sudah bayar"}
                </button>
                <button
                  onClick={() => setShowMethodPicker((v) => !v)}
                  className="w-full py-2.5 text-sm font-semibold text-primary border border-primary/30 rounded-xl hover:bg-[#F7E8E8] transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Ganti metode pembayaran
                </button>
                {showMethodPicker && methodPicker}
              </div>
            </>
          )}

          {/* ── Expired ── */}
          {effectiveStatus === "expired" && (
            <>
              <div className="h-px bg-black/[0.06]" />
              <div className="px-6 py-4">
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-amber-700" />
                    <p className="text-sm font-bold text-amber-800">Pembayaran kadaluarsa</p>
                  </div>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    Tenang, pesanan kamu masih tersimpan. Pilih metode pembayaran lalu buat pembayaran baru.
                  </p>
                </div>
                {methodPicker}
              </div>
            </>
          )}

          {/* ── Failed / cancelled ── */}
          {effectiveStatus === "failed" && (
            <>
              <div className="h-px bg-black/[0.06]" />
              <div className="px-6 py-4">
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <p className="text-sm font-bold text-red-700">Order tidak dapat diproses</p>
                  </div>
                  <p className="text-xs text-red-600 leading-relaxed">
                    Order ini sudah dibatalkan atau gagal. Silakan buat order baru untuk melanjutkan.
                  </p>
                </div>
                <Link
                  href={data.order_page_url}
                  className="block w-full py-2.5 bg-primary text-white text-sm font-semibold text-center rounded-xl hover:bg-primary-hover transition-colors"
                >
                  Buat Order Baru →
                </Link>
              </div>
            </>
          )}

          {/* ── Ringkasan harga ── */}
          {pricing && (
            <>
              <div className="h-px bg-black/[0.06]" />
              <div className="px-6 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Receipt className="h-4 w-4" style={sectionLabelStyle} />
                  <span className={sectionLabelClass} style={sectionLabelStyle}>Ringkasan Harga</span>
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: "rgba(12,12,10,0.5)" }}>Harga produk</span>
                    <span className="text-warm-black">{formatRupiah(pricing.product_amount || 0)}</span>
                  </div>
                  {(pricing.discount_amount || 0) > 0 && (
                    <div className="flex justify-between">
                      <span style={{ color: "rgba(12,12,10,0.5)" }}>Diskon kupon</span>
                      <span className="text-green-600 font-semibold">− {formatRupiah(pricing.discount_amount || 0)}</span>
                    </div>
                  )}
                  {(pricing.order_bump_amount || 0) > 0 && (
                    <div className="flex justify-between">
                      <span style={{ color: "rgba(12,12,10,0.5)" }}>Konsultasi 1:1 Private</span>
                      <span className="text-warm-black">{formatRupiah(pricing.order_bump_amount || 0)}</span>
                    </div>
                  )}
                  {(pricing.payment_admin_fee || 0) > 0 && (
                    <div className="flex justify-between">
                      <span style={{ color: "rgba(12,12,10,0.5)" }}>Biaya admin</span>
                      <span className="text-warm-black">{formatRupiah(pricing.payment_admin_fee || 0)}</span>
                    </div>
                  )}
                  <div className="h-px bg-black/[0.06] my-1" />
                  <div className="flex justify-between font-bold">
                    <span className="text-warm-black">Total</span>
                    <span className="text-warm-black">{formatRupiah(pricing.total_amount || data.amount)}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-sm" style={{ color: "rgba(12,12,10,0.45)" }}>
          <Link href="/dashboard" className="hover:text-primary transition-colors">← Kembali ke Dashboard</Link>
        </p>
      </div>
    </div>
  );
}
