"use client";
/* eslint-disable react-hooks/purity */

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { CalendarDays, CheckCircle2, ExternalLink, Eye, EyeOff, Receipt, Ticket, Timer, User, Check, Copy, AlertCircle } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { checkoutApi, funnelsApi } from "@/lib/api-client";
import { FunnelBumpCard, type BumpOffer } from "@/components/checkout/FunnelBumpCard";
import { Turnstile } from "@marsidev/react-turnstile";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AvatarStack, ParticipantPreview } from "@/components/ui/AvatarStack";
import { track } from "@/lib/tracking/client";

const WEBINAR_NORMAL_PRICE = 99000;

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
  timezone?: string | null;
  capacity?: number | null;
  registered_count?: number;
  participants_preview?: ParticipantPreview[];
  join_url?: string | null;
  calendar_url?: string | null;
  recording_url?: string | null;
  recording_embed_url?: string | null;
  replay_status?: string | null;
  is_registered?: boolean;
  registration?: { coupon_code?: string; registered_at?: string; status?: string; registration_type?: string } | null;
  paid_registration_enabled?: number;
  free_registration_enabled?: number;
  paid_registration_price?: number;
  share_required_count?: number;
}

interface UserInfo {
  name: string;
  email: string;
  phone: string | null;
}

interface TimeRemaining {
  total: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
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
    .find((cookie) => cookie.trim().startsWith("affiliate_code="))
    ?.split("=")[1]
    ?.trim() || "";
}

function setAffiliateCookie(ref: string) {
  const encoded = encodeURIComponent(ref);
  document.cookie = `affiliate_code=${encoded}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
}

function getTimeRemaining(targetDate: string): TimeRemaining {
  const total = Math.max(0, new Date(targetDate).getTime() - Date.now());
  return {
    total,
    days: Math.floor(total / (1000 * 60 * 60 * 24)),
    hours: Math.floor((total / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((total / (1000 * 60)) % 60),
    seconds: Math.floor((total / 1000) % 60),
  };
}

export default function WebinarRegistrationPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = pathname.split("/").filter(Boolean)[1] ?? "_";

  const [webinar, setWebinar] = useState<Webinar | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [authFormMode, setAuthFormMode] = useState<"register" | "login">("register");
  const [guestForm, setGuestForm] = useState({ name: "", email: "", phone: "", password: "", referral_source: "", _hp_website: "" });
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [duplicateField, setDuplicateField] = useState<"email" | "phone" | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining | null>(null);

  // Gate states
  const [gateMethodModal, setGateMethodModal] = useState(false);
  const [webinarBump, setWebinarBump] = useState<BumpOffer | null>(null);
  const [webinarBumpSelected, setWebinarBumpSelected] = useState(false);
  const [gateShareModal, setGateShareModal] = useState(false);
  const [shareData, setShareData] = useState<{ message: string; short_url: string } | null>(null);
  const [shareChecked, setShareChecked] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const refCode = useMemo(() => searchParams.get("ref") || "", [searchParams]);
  const clickIdParam = useMemo(() => searchParams.get("click_id") || "", [searchParams]);
  const trackingAffiliateCode = refCode || getAffiliateCookie();
  const couponCode = "GROW";
  const hasStarted = webinar ? new Date(webinar.starts_at).getTime() <= Date.now() : false;
  
  // Registration is complete if status is registered, registered_free, or registered_paid
  const isCompleted = Boolean(
    webinar?.is_registered &&
    ['registered', 'registered_free', 'registered_paid'].includes(webinar.registration?.status || '')
  ) || Boolean(successMessage);

  // First-party tracking: webinar landing view (once per loaded webinar)
  const webinarId = webinar?.id;
  useEffect(() => {
    if (!webinarId) return;
    track("webinar_viewed", { webinar_id: webinarId });
  }, [webinarId]);

  useEffect(() => {
    if (!refCode) return;
    setAffiliateCookie(refCode);
    fetch("/api/affiliate/track-click", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        affiliate_code: refCode,
        landing_url: window.location.href,
        referrer_url: document.referrer || undefined,
        campaign: `webinar:${slug}`,
      }),
    }).catch(() => {});
  }, [refCode, slug]);

  useEffect(() => {
    if (clickIdParam) {
      document.cookie = `webinar_click_id=${encodeURIComponent(clickIdParam)}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
    }
  }, [clickIdParam]);

  const loadWebinar = async () => {
    if (!slug || slug === "_") {
      setIsLoggedIn(false);
      setLoading(false);
      return;
    }
    setError("");

    // Use relative URLs so requests go through the Cloudflare Pages proxy
    // (same-origin), which forwards cookies correctly.
    // This matches the pattern used by the order page.
    const auth = await fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .catch(() => ({ success: false }));

    if (auth.success) {
      const currentUser = auth.data?.user || auth.data;
      setIsLoggedIn(true);
      setUser({
        name: currentUser.name || "",
        email: currentUser.email || "",
        phone: currentUser.phone || null,
      });

      // Logged-in: use user endpoint for registration status
      const detail = await fetch(`/api/user/webinars/${slug}`, { credentials: "include" })
        .then((r) => r.json())
        .catch(() => ({ success: false }));
      if (detail.success) {
        setWebinar(detail.data as Webinar);
      } else {
        // Fallback to public endpoint if user endpoint fails
        const pub = await fetch(`/api/public/webinars/${slug}`, { credentials: "include" })
          .then((r) => r.json())
          .catch(() => ({ success: false }));
        if (pub.success) {
          setWebinar(pub.data as Webinar);
        } else {
          setError(pub.error || "Webinar tidak ditemukan.");
        }
      }
    } else {
      setIsLoggedIn(false);
      // Not logged in: use public endpoint
      const detail = await fetch(`/api/public/webinars/${slug}`, { credentials: "include" })
        .then((r) => r.json())
        .catch(() => ({ success: false }));

      if (detail.success) {
        setWebinar(detail.data as Webinar);
      } else {
        setError(detail.error || "Webinar tidak ditemukan.");
      }
    }
  };

  useEffect(() => {
    setLoading(true);
    loadWebinar().finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (webinar?.registration?.status === 'share_confirmation_pending') {
      // Auto-open modal if they reload
      handleSelectFreeShare();
    } else if (webinar?.registration?.status === 'payment_pending') {
      // Could auto-open payment gateway, but let's just let them click it
    }
  }, [webinar?.registration?.status]);

  useEffect(() => {
    if (!webinar?.starts_at) return;

    const updateCountdown = () => setTimeRemaining(getTimeRemaining(webinar.starts_at));
    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(interval);
  }, [webinar?.starts_at]);

  const registerWebinarOldFlow = async () => {
    if (!webinar) return false;
    const res = await fetch(`/api/user/webinars/${webinar.id}/register`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ affiliate_code: trackingAffiliateCode || undefined }),
    })
      .then((r) => r.json())
      .catch(() => ({ success: false }));
    if (!res.success) {
      setError(res.error || "Gagal mendaftar webinar. Silakan coba lagi.");
      return false;
    }
    await loadWebinar();
    setSuccessMessage("Registrasi berhasil. Email konfirmasi sedang dikirim.");
    return true;
  };

  const handleMainRegisterClick = async () => {
    if (webinar?.paid_registration_enabled) {
      if (webinar.registration?.status === 'share_confirmation_pending') {
        handleSelectFreeShare();
      } else if (webinar.registration?.status === 'payment_pending') {
        handleSelectPaid();
      } else {
        setGateMethodModal(true);
      }
    } else {
      setSubmitting(true);
      setError("");
      await registerWebinarOldFlow();
      setSubmitting(false);
    }
  };

  const handleSelectFreeShare = async () => {
    if (!webinar) return;
    setSubmitting(true);
    setError("");
    const res = await fetch(`/api/user/webinars/${webinar.id}/select-method`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: 'free_share' }),
    })
      .then((r) => r.json())
      .catch(() => ({ success: false }));
    setSubmitting(false);
    
    if (res.success) {
      setShareData(res.data?.share_data || null);
      setGateMethodModal(false);
      setGateShareModal(true);
      if (res.data?.registration) {
         setWebinar(prev => prev ? { ...prev, registration: res.data.registration } : null);
      }
    } else {
      setError(res.error || 'Gagal memilih pendaftaran gratis.');
    }
  };

  const handleSelectPaid = async () => {
    if (!webinar) return;
    setSubmitting(true);
    setError("");
    const res = await fetch(`/api/user/webinars/${webinar.id}/select-method`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: 'paid' }),
    })
      .then((r) => r.json())
      .catch(() => ({ success: false }));
    
    if (res.success) {
      // Webinar = produk murah → default QRIS; user bisa ganti metode di halaman checkout
      const orderRes = await checkoutApi.createPayment({
        order_type: 'webinar_registration',
        product_id: webinar.id,
        coupon_code: 'GROW',
        payment_method: 'qris',
        ...(webinarBump && webinarBumpSelected
          ? { addons: [{ type: 'funnel_bump', step_id: webinarBump.step_id }] }
          : {}),
      });

      setSubmitting(false);
      const orderData = orderRes.data as { order_id?: string } | undefined;
      if (orderRes.success && orderData?.order_id) {
        router.push(`/checkout/${orderData.order_id}`);
      } else {
        setError(orderRes.error || 'Gagal membuat tagihan pembayaran.');
      }
    } else {
      setSubmitting(false);
      setError(res.error || 'Gagal memilih pendaftaran berbayar.');
    }
  };

  const handleConfirmShare = async () => {
    if (!webinar || !shareChecked) return;
    setSubmitting(true);
    setError("");
    const res = await fetch(`/api/user/webinars/${webinar.id}/confirm-free-share`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((r) => r.json())
      .catch(() => ({ success: false }));
    setSubmitting(false);
    
    if (res.success) {
      setGateShareModal(false);
      setSuccessMessage("Registrasi gratis berhasil dikonfirmasi. Email detail webinar akan segera dikirim.");
      loadWebinar();
    } else {
      setError(res.error || 'Gagal mengonfirmasi share.');
    }
  };

  const handleCopyMessage = async () => {
    if (shareData?.message) {
      await navigator.clipboard.writeText(shareData.message);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleGuestRegister = async () => {
    if (!webinar) return;
    const { name, email, phone, password } = guestForm;
    if (!name.trim() || !email.trim() || !phone.trim() || !password.trim()) {
      setError("Semua field wajib diisi.");
      return;
    }
    if (password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Password tidak cocok.");
      return;
    }

    setSubmitting(true);
    setError("");
    setIsDuplicate(false);
    setDuplicateField(null);

    const regResponse = await fetch("/api/auth/register", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        referral_source: guestForm.referral_source || undefined,
        affiliate_code: document.cookie.split(';').find(c => c.trim().startsWith('affiliate_code='))?.split('=')[1]?.trim() || undefined,
        cfTurnstileResponse: turnstileToken,
      }),
    });
    const regRes = await regResponse.json().catch(() => ({ success: false }));

    if (!regRes.success) {
      if (regResponse.status === 409) {
        setIsDuplicate(true);
        setDuplicateField((regRes.error as string)?.includes("WhatsApp") ? "phone" : "email");
      } else {
        setError(regRes.error || "Gagal membuat akun. Silakan coba lagi.");
      }
      setSubmitting(false);
      return;
    }

    // Register langsung auto-verified + auto-login (verifikasi OTP dinonaktifkan).
    // Lanjut seperti alur setelah login — tanpa step verifikasi email.
    const currentUser = regRes.data?.user || regRes.data || {};
    setIsLoggedIn(true);
    setUser({
      name: currentUser.name || name.trim(),
      email: currentUser.email || email.trim(),
      phone: currentUser.phone || phone.trim() || null,
    });

    if (webinar.paid_registration_enabled) {
      await loadWebinar(); // reload status
      setGateMethodModal(true);
      setSubmitting(false);
    } else {
      const ok = await registerWebinarOldFlow();
      if (!ok) {
        setSubmitting(false);
        return;
      }
      window.location.href = "/dashboard";
    }
  };

  const handleGuestLogin = async () => {
    if (!webinar) return;
    const { email, password } = loginForm;
    if (!email.trim() || !password.trim()) {
      setError("Email dan password wajib diisi.");
      return;
    }

    setSubmitting(true);
    setError("");
    setIsDuplicate(false);
    setDuplicateField(null);

    const loginResponse = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const loginRes = await loginResponse.json().catch(() => ({ success: false }));

    if (!loginRes.success) {
      setError(loginRes.error || "Login gagal. Cek email dan password kamu.");
      setSubmitting(false);
      return;
    }

    const currentUser = loginRes.data?.user || loginRes.data;
    setIsLoggedIn(true);
    setUser({
      name: currentUser.name || "",
      email: currentUser.email || email.trim(),
      phone: currentUser.phone || null,
    });

    if (webinar.paid_registration_enabled) {
      await loadWebinar(); // reload status
      setGateMethodModal(true);
      setSubmitting(false);
    } else {
      const ok = await registerWebinarOldFlow();
      if (!ok) {
        setSubmitting(false);
        return;
      }
      window.location.href = "/dashboard";
    }
  };

  const inputClass =
    "w-full px-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black outline-none focus:border-primary transition-colors";
  const readOnlyInputClass =
    "w-full px-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.08)] bg-[rgba(12,12,10,0.03)] text-warm-black cursor-default select-none";

  if (loading || isLoggedIn === null) {
    return (
      <div className="min-h-screen bg-warm-cream flex items-center justify-center">
        <div className="text-sm text-[rgba(12,12,10,0.45)]">Memuat webinar...</div>
      </div>
    );
  }

  if (!webinar) {
    return (
      <div className="min-h-screen bg-warm-cream flex items-center justify-center p-4">
        <div className="max-w-md rounded-2xl border border-black/[0.08] bg-white p-6 text-center shadow-sm">
          <p className="mb-2 font-semibold text-warm-black">Webinar tidak ditemukan</p>
          <p className="mb-5 text-sm text-[rgba(12,12,10,0.55)]">{error || "Link webinar ini belum tersedia."}</p>
          <Link href="https://pejuangyen.com/webinar/" className="text-sm font-semibold text-primary">
            Lihat katalog webinar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-warm-cream flex items-center justify-center p-4"
      style={{
        backgroundImage:
          "linear-gradient(to right, rgba(12,12,10,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(12,12,10,0.04) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }}
    >
      <div className="w-full max-w-md space-y-3">
        <div className="overflow-hidden rounded-2xl border border-[rgba(12,12,10,0.08)] bg-white shadow-sm">
          <div className="h-1 w-full bg-primary" />
          <div className="flex justify-center px-6 pb-5 pt-6">
            <Image src="/logo.png" alt="PejuangYen" width={128} height={32} priority className="h-8 w-auto" />
          </div>

          {webinar.thumbnail_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={webinar.thumbnail_url} alt={webinar.title} className="aspect-video w-full bg-black/[0.03] object-contain" />
          )}

          <div className="border-t border-black/[0.06] px-6 py-4">
            <div className="mb-3 flex items-center gap-2">
              <Ticket className="h-4 w-4 text-[rgba(12,12,10,0.4)]" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[rgba(12,12,10,0.4)]">
                Webinar {webinar.paid_registration_enabled ? "Eksklusif" : "Gratis"}
              </span>
            </div>
            <h1 className="text-lg font-semibold leading-tight text-warm-black">{webinar.title}</h1>
            {webinar.subtitle && (
              <p className="mt-1 text-xs leading-relaxed text-[rgba(12,12,10,0.55)]">{webinar.subtitle}</p>
            )}
            {!webinar.paid_registration_enabled && (
              <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3">
                <p className="text-sm font-semibold text-green-700">Kupon GROW aktif — diskon 100%</p>
                <p className="mt-0.5 text-xs text-green-600">
                  {hasStarted ? "Event sudah berjalan. Login untuk akses Zoom atau rekaman yang tersedia." : "Daftar gratis langsung untuk mengamankan slot."}
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-black/[0.06] px-6 py-4">
            <div className="mb-3 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[rgba(12,12,10,0.4)]" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[rgba(12,12,10,0.4)]">
                Jadwal
              </span>
            </div>
            <p className="text-sm font-semibold text-warm-black">
              {formatEventDate(webinar.starts_at, webinar.timezone || "Asia/Jakarta")}
            </p>
            {webinar.host_name && <p className="mt-1 text-xs text-[rgba(12,12,10,0.5)]">Host: {webinar.host_name}</p>}
            {typeof webinar.registered_count === "number" && (
              <div className="mt-1 flex items-center gap-2 text-xs text-[rgba(12,12,10,0.5)]">
                {webinar.participants_preview && webinar.participants_preview.length > 0 ? (
                  <AvatarStack participants={webinar.participants_preview} total={webinar.registered_count} />
                ) : (
                  <span>{webinar.registered_count}{webinar.capacity ? `/${webinar.capacity}` : ""} pendaftar</span>
                )}
              </div>
            )}
            {!hasStarted && timeRemaining && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-800">
                  <Timer className="h-4 w-4" />
                  Pendaftaran berakhir saat event dimulai
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Hari", value: timeRemaining.days },
                    { label: "Jam", value: timeRemaining.hours },
                    { label: "Menit", value: timeRemaining.minutes },
                    { label: "Detik", value: timeRemaining.seconds },
                  ].map((item) => (
                    <div key={item.label} className="min-w-0 rounded-lg bg-white px-2 py-2 text-center ring-1 ring-amber-200">
                      <p className="text-lg font-bold tabular-nums text-warm-black">{String(item.value).padStart(2, "0")}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[rgba(12,12,10,0.45)]">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-black/[0.06] px-6 py-4">
            <div className="mb-3 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-[rgba(12,12,10,0.4)]" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[rgba(12,12,10,0.4)]">
                Ringkasan Harga
              </span>
            </div>
            
            {webinar.paid_registration_enabled ? (
              <div className="mb-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3 text-[rgba(12,12,10,0.6)]">
                  <span>Biaya Asli Webinar</span>
                  <span className="font-semibold line-through text-[rgba(12,12,10,0.4)]">{formatRupiah(WEBINAR_NORMAL_PRICE)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-emerald-700">
                  <span>Kupon <span className="font-mono font-semibold">"{couponCode}"</span></span>
                  <span className="font-semibold">- {formatRupiah(WEBINAR_NORMAL_PRICE - (webinar.paid_registration_price || 49000))}</span>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-black/[0.06] pt-2">
                  <span className="font-semibold text-warm-black">Opsi 1: Gratis</span>
                  <span className="font-bold text-green-700">Share ke {webinar.share_required_count || 2} Grup</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-warm-black">Opsi 2: Bayar Langsung</span>
                  <span className="font-bold text-warm-black">{formatRupiah(webinar.paid_registration_price || 49000)}</span>
                </div>
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 mt-2 border border-amber-200">
                  <AlertCircle className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
                  Kamu dapat mendaftar gratis dengan membantu membagikan info webinar ini.
                </p>
              </div>
            ) : (
              <>
                <div className="mb-3 space-y-1.5 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[rgba(12,12,10,0.5)]">Biaya webinar normal</span>
                    <span className="font-medium text-[rgba(12,12,10,0.35)] line-through">
                      {formatRupiah(WEBINAR_NORMAL_PRICE)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[rgba(12,12,10,0.5)]">
                      Kupon <span className="font-mono font-semibold text-[rgba(12,12,10,0.65)]">"{couponCode}"</span>
                    </span>
                    <span className="font-semibold text-green-600">Diskon 100%</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-black/[0.06] pt-2">
                    <span className="font-semibold text-warm-black">Total</span>
                    <span className="font-bold text-green-700">Gratis</span>
                  </div>
                </div>
                <input
                  readOnly
                  value={couponCode}
                  className="w-full rounded-lg border border-green-300 bg-green-50 px-3.5 py-2.5 font-mono text-sm font-semibold text-warm-black"
                />
              </>
            )}
          </div>

          {!isCompleted && (
            <div className="border-t border-black/[0.06] px-6 py-4">
              <div className="mb-3 flex items-center gap-2">
                <User className="h-4 w-4 text-[rgba(12,12,10,0.4)]" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[rgba(12,12,10,0.4)]">
                  {isLoggedIn ? "Data Peserta" : authFormMode === "login" ? "Masuk Akun" : "Buat Akun Baru"}
                </span>
              </div>

              {isLoggedIn && user ? (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[rgba(12,12,10,0.65)]">Nama</label>
                    <input readOnly value={user.name} className={readOnlyInputClass} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-[rgba(12,12,10,0.65)]">Email</label>
                    <input readOnly value={user.email} className={readOnlyInputClass} />
                  </div>
                  {user.phone && (
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-[rgba(12,12,10,0.65)]">WhatsApp</label>
                      <input readOnly value={user.phone} className={readOnlyInputClass} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {authFormMode === "register" ? (
                    <>
                      <p className="text-xs leading-5 text-[rgba(12,12,10,0.55)]">
                        Isi data di bawah. Akun dibuat otomatis sebelum melanjutkan.{" "}
                        <button
                          type="button"
                          onClick={() => {
                            setAuthFormMode("login");
                            setError("");
                            setIsDuplicate(false);
                            setDuplicateField(null);
                            setLoginForm((prev) => ({ ...prev, email: guestForm.email || prev.email }));
                          }}
                          className="font-semibold text-primary hover:underline"
                        >
                          Sudah punya akun?
                        </button>
                      </p>
                      {(
                        [
                          { key: "name", label: "Nama Lengkap", type: "text", placeholder: "John Doe" },
                          { key: "email", label: "Email", type: "email", placeholder: "nama@email.com" },
                          { key: "phone", label: "WhatsApp", type: "tel", placeholder: "08xxxxxxxxxx" },
                        ] as const
                      ).map((field) => (
                        <div key={field.key}>
                          <label className="mb-1.5 block text-xs font-semibold text-[rgba(12,12,10,0.65)]">
                            {field.label} <span className="text-red-500">*</span>
                          </label>
                          <input
                            type={field.type}
                            value={guestForm[field.key]}
                            onChange={(event) => {
                              setGuestForm((prev) => ({ ...prev, [field.key]: event.target.value }));
                              if (isDuplicate) {
                                setIsDuplicate(false);
                                setDuplicateField(null);
                              }
                            }}
                            placeholder={field.placeholder}
                            className={inputClass}
                          />
                        </div>
                      ))}
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-[rgba(12,12,10,0.65)]">
                          Tau PejuangYen dari mana?
                        </label>
                        <select
                          value={guestForm.referral_source}
                          onChange={(e) => setGuestForm((prev) => ({ ...prev, referral_source: e.target.value }))}
                          className={inputClass}
                        >
                          <option value="">-- Pilih --</option>
                          <option value="Instagram @irfanakbrr">Instagram @irfanakbrr</option>
                          <option value="Instagram @aiforeveryone.id">Instagram @aiforeveryone.id</option>
                          <option value="Instagram @digitalpreneur_jogja">Instagram @digitalpreneur_jogja</option>
                          <option value="TikTok">TikTok</option>
                          <option value="Google / Search">Google / Search</option>
                          <option value="Dari teman">Dari teman</option>
                          <option value="Komunitas WhatsApp/Telegram">Komunitas WhatsApp / Telegram</option>
                          <option value="YouTube">YouTube</option>
                          <option value="Lainnya">Lainnya</option>
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-[rgba(12,12,10,0.65)]">
                          Password <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            value={guestForm.password}
                            onChange={(event) => setGuestForm((prev) => ({ ...prev, password: event.target.value }))}
                            placeholder="Minimal 8 karakter"
                            className={`${inputClass} pr-10`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(12,12,10,0.4)] transition-colors hover:text-warm-black"
                            aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-[rgba(12,12,10,0.65)]">
                          Ulangi Password <span className="text-red-500">*</span>
                        </label>
                        <input
                          type={showPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          placeholder="Ulangi password"
                          className={inputClass}
                        />
                        {confirmPassword && guestForm.password !== confirmPassword && (
                          <p className="mt-1 text-xs text-red-500">Password tidak cocok</p>
                        )}
                      </div>
                      {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
                        <div className="flex justify-center pt-2">
                          <input type="text" name="_hp_website" value={guestForm._hp_website} onChange={(e) => setGuestForm((prev) => ({ ...prev, _hp_website: e.target.value }))} style={{ display: 'none' }} tabIndex={-1} autoComplete="off" aria-hidden="true" />
                          <Turnstile
                            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                            onSuccess={setTurnstileToken}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-xs leading-5 text-[rgba(12,12,10,0.55)]">
                        Masuk dengan akun PejuangYen kamu.{" "}
                        <button
                          type="button"
                          onClick={() => {
                            setAuthFormMode("register");
                            setError("");
                          }}
                          className="font-semibold text-primary hover:underline"
                        >
                          Belum punya akun?
                        </button>
                      </p>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-[rgba(12,12,10,0.65)]">
                          Email <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          value={loginForm.email}
                          onChange={(event) => setLoginForm((prev) => ({ ...prev, email: event.target.value }))}
                          placeholder="nama@email.com"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-[rgba(12,12,10,0.65)]">
                          Password <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            value={loginForm.password}
                            onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
                            placeholder="Password akun kamu"
                            className={`${inputClass} pr-10`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(12,12,10,0.4)] transition-colors hover:text-warm-black"
                            aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        <Link href="/forgot-password" className="mt-1.5 inline-block text-xs font-semibold text-primary hover:underline">
                          Lupa password?
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {isDuplicate && !isLoggedIn && (
            <div className="mx-5 mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3.5">
              <p className="mb-0.5 text-xs font-semibold text-amber-800">Akun sudah terdaftar</p>
              <p className="mb-2.5 text-[11px] text-amber-700">
                {duplicateField === "phone"
                  ? "Nomor WhatsApp ini sudah digunakan oleh akun lain."
                  : "Email ini sudah terdaftar di PejuangYen."}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuthFormMode("login");
                    setError("");
                    setIsDuplicate(false);
                    setDuplicateField(null);
                    setLoginForm((prev) => ({ ...prev, email: guestForm.email || prev.email }));
                  }}
                  className="flex-1 rounded-md bg-[#8B1414] py-1.5 text-center text-[11px] font-semibold text-white transition-colors hover:bg-[#6E0F0F]"
                >
                  Masuk
                </button>
                <Link
                  href="/forgot-password"
                  className="flex-1 rounded-md border border-[#8B1414]/30 py-1.5 text-center text-[11px] font-semibold text-[#8B1414] transition-colors hover:bg-[#F7E8E8]"
                >
                  Lupa Kata Sandi
                </Link>
              </div>
            </div>
          )}

          {error && (
            <div className="mx-5 mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="mx-5 mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              {successMessage}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-[rgba(12,12,10,0.08)] bg-white px-5 py-4 shadow-sm">
          <div>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-bold text-green-700">Gratis</p>
            </div>
            {webinar.paid_registration_enabled && <p className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full inline-block mt-0.5">Hanya dengan share WA</p>}
          </div>
          {isCompleted || hasStarted ? (
            <div className="flex shrink-0 items-center gap-2">
              {webinar.join_url ? (
                <a
                  href={webinar.join_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
                >
                  Akses Zoom
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : (
                <button
                  onClick={() => router.push(`/dashboard`)}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Buka Dashboard
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={isLoggedIn ? handleMainRegisterClick : authFormMode === "login" ? handleGuestLogin : handleGuestRegister}
              disabled={submitting}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Memproses...
                </>
              ) : isLoggedIn ? (
                webinar.registration?.status === 'share_confirmation_pending' ? "Lanjut Share WA" :
                webinar.registration?.status === 'payment_pending' ? "Lanjut Bayar" :
                "Daftar Webinar"
              ) : authFormMode === "login" ? (
                "Masuk & Daftar"
              ) : (
                "Daftar & Buat Akun"
              )}
            </button>
          )}
        </div>
        
        {/* Method Selection Modal */}
        <Dialog
          open={gateMethodModal}
          onOpenChange={(open) => {
            setGateMethodModal(open);
            // Lazy fetch bump funnel saat modal pilih-metode dibuka
            if (open && webinar?.paid_registration_enabled && !webinarBump) {
              funnelsApi.getBump('webinar_registration', webinar.id).then((res) => {
                if (res.success && res.data) setWebinarBump(res.data as BumpOffer);
              });
            }
          }}
        >
          <DialogContent className="max-w-md w-11/12 rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl">Pilih Metode Pendaftaran</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-sm text-gray-600">
                Pilih opsi di bawah untuk mengamankan slot kamu di webinar eksklusif ini.
              </p>
              
              <button 
                onClick={handleSelectFreeShare}
                disabled={submitting}
                className="w-full text-left rounded-xl border-2 border-primary/20 bg-green-50/50 hover:bg-green-50 p-4 transition-colors relative"
              >
                <div className="absolute top-4 right-4 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Terpopuler</div>
                <h3 className="font-bold text-warm-black mb-1 text-lg">Opsi 1: Gratis 100%</h3>
                <p className="text-sm text-gray-600 mb-2">Cukup bantu kami membagikan info webinar ini ke <span className="font-bold text-warm-black">{webinar?.share_required_count || 2} Grup WhatsApp/Telegram</span>.</p>
                <div className="text-primary font-semibold text-sm flex items-center gap-1.5 mt-2">
                  Pilih Gratis <CheckCircle2 className="w-4 h-4" />
                </div>
              </button>

              <button 
                onClick={handleSelectPaid}
                disabled={submitting}
                className="w-full text-left rounded-xl border border-gray-200 bg-white hover:bg-gray-50 p-4 transition-colors"
              >
                <h3 className="font-bold text-warm-black mb-1 text-base">Opsi 2: Bayar Langsung</h3>
                <p className="text-sm text-gray-600 mb-2">Tidak mau repot share ke grup? Bayar biaya administrasi sebesar <span className="font-bold text-warm-black">{formatRupiah(webinar?.paid_registration_price || 49000)}</span>.</p>
                <div className="text-warm-black font-semibold text-sm mt-2">
                  Bayar Sekarang{webinarBump && webinarBumpSelected ? ` + ${formatRupiah(webinarBump.amount)}` : ""}
                </div>
              </button>

              {webinarBump && (
                <FunnelBumpCard bump={webinarBump} selected={webinarBumpSelected} onChange={setWebinarBumpSelected} />
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Free Share Task Modal */}
        <Dialog open={gateShareModal} onOpenChange={setGateShareModal}>
          <DialogContent className="max-w-md w-11/12 rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl">Satu Langkah Lagi! 🚀</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 pt-2">
              <p className="text-sm text-gray-600">
                Untuk mendapatkan tiket gratis, mohon bantu bagikan info webinar ini ke <span className="font-bold text-warm-black">{webinar?.share_required_count || 2} Grup WhatsApp atau Telegram</span> kamu.
              </p>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Pesan untuk dibagikan</span>
                  <button 
                    onClick={handleCopyMessage}
                    className="text-xs font-semibold text-primary flex items-center gap-1 hover:underline"
                  >
                    {copySuccess ? <><Check className="w-3.5 h-3.5" /> Tersalin</> : <><Copy className="w-3.5 h-3.5" /> Salin Pesan</>}
                  </button>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-sm whitespace-pre-wrap font-mono text-gray-700 max-h-48 overflow-y-auto">
                  {shareData?.message || "Memuat pesan..."}
                </div>
              </div>

              <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                <input 
                  type="checkbox" 
                  checked={shareChecked}
                  onChange={(e) => setShareChecked(e.target.checked)}
                  className="mt-1 rounded text-primary focus:ring-primary w-5 h-5 border-gray-300"
                />
                <span className="text-sm text-gray-700 leading-tight">
                  Saya setuju dan mengonfirmasi bahwa saya <strong>sudah membagikan</strong> pesan di atas ke setidaknya {webinar?.share_required_count || 2} grup.
                </span>
              </label>

              <button 
                onClick={handleConfirmShare}
                disabled={!shareChecked || submitting}
                className="w-full flex justify-center items-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-base font-semibold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Memproses..." : "Selesaikan Pendaftaran"}
              </button>
            </div>
          </DialogContent>
        </Dialog>

        <p className="text-center text-sm text-[rgba(12,12,10,0.45)]">
          <Link href="https://pejuangyen.com/webinar/" className="transition-colors hover:text-primary">
            Lihat semua webinar
          </Link>
        </p>
      </div>
    </div>
  );
}
