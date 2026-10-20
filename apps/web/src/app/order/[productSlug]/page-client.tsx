"use client";
/* eslint-disable react-hooks/set-state-in-effect, react/no-unescaped-entities */

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { CreditCard, Eye, EyeOff, ShoppingBag, Tag, User, Receipt } from "lucide-react";
import { checkoutApi, funnelsApi } from "@/lib/api-client";
import { formatRupiah } from "@/lib/utils";
import { PAYMENT_METHODS, recommendedMethod, type PaymentMethodId } from "@/lib/payment-methods";
import { FunnelBumpCard, type BumpOffer } from "@/components/checkout/FunnelBumpCard";
import { Turnstile } from "@marsidev/react-turnstile";
import { track, trackPageView } from "@/lib/tracking/client";

interface Product {
  id: string;
  name: string;
  price: number;
  compare_at_price?: number;
  type: "course" | "membership" | "digital_product";
  description?: string;
  access_type?: string;
  slug?: string;
}

// Plans whose promo is built into the price (compare_at_price → price). For
// these we show the promo code as branding and HIDE the manual coupon input so
// the deep promo can't be stacked. The matching coupon records are kept inactive.
const PLAN_PROMO_CODE: Record<string, string> = {
  yearly: "TAHUNAN",
  lifetime: "LIFETIME",
};

interface UserInfo {
  name: string;
  email: string;
  phone: string | null;
}

export default function OrderPageClient() {
  const pathname = usePathname();
  const router = useRouter();
  const productSlug = pathname.split("/").filter(Boolean)[1] ?? "_";

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [error, setError] = useState("");
  const [refCode, setRefCode] = useState("");
  const [bump, setBump] = useState<BumpOffer | null>(null);
  const [bumpSelected, setBumpSelected] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>(recommendedMethod());

  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [user, setUser] = useState<UserInfo | null>(null);
  // For logged-in users missing phone
  const [mobile, setMobile] = useState("");

  // Guest checkout form
  const [guestForm, setGuestForm] = useState({ name: "", email: "", phone: "", password: "", _hp_website: "" });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [duplicateField, setDuplicateField] = useState<"email" | "phone" | null>(null);
  const [turnstileToken, setTurnstileToken] = useState("");

  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [couponState, setCouponState] = useState<{ status: 'idle' | 'loading' | 'valid' | 'invalid', error?: string, discount_type?: string, discount_value?: number, max_discount_amount?: number | null }>({ status: 'idle' });


  // Read ?ref= from URL and track click
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref") || "";
    if (ref) {
      setRefCode(ref);
      fetch("/api/affiliate/track-click", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ affiliate_code: ref, landing_url: window.location.pathname }),
      }).catch(() => {});
    }
  }, []);

  // First-party tracking: order page entry = upgrade intent signal
  useEffect(() => {
    if (!productSlug || productSlug === "_") return;
    trackPageView("order");
    track("checkout_intent", { metadata: { product_slug: productSlug } });
  }, [productSlug]);

  // Auth check
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) {
          setIsLoggedIn(false);
        } else {
          const u = d.data?.user || d.data;
          setIsLoggedIn(true);
          setUser({ name: u.name || "", email: u.email || "", phone: u.phone || null });
        }
      })
      .catch(() => setIsLoggedIn(false));
  }, [productSlug]);

  // Fetch product info
  useEffect(() => {
    if (!productSlug || productSlug === "_") return;

    const isMembership = productSlug.startsWith("membership-") || productSlug.endsWith("-promo") || ["monthly", "yearly", "lifetime"].includes(productSlug);
    if (isMembership) {
      const planSlug = productSlug.startsWith("membership-")
        ? productSlug.replace("membership-", "")
        : productSlug;
      fetch("/api/membership/plans", { credentials: "include" })
        .then((r) => r.json())
        .then((d) => {
          const plan = (d.data || []).find((p: { slug: string }) => p.slug === planSlug);
          if (plan) {
            setProduct({
              id: plan.id,
              name: plan.name,
              price: plan.price,
              compare_at_price: plan.compare_at_price,
              type: "membership",
              description: plan.description,
              slug: plan.slug,
            });
          }
          setLoading(false);
        });
    } else {
      fetch("/api/courses", { credentials: "include" })
        .then((r) => r.json())
        .then(async (d) => {
          const course = (d.data || []).find((c: { slug: string }) => c.slug === productSlug);
          if (course) {
            setProduct({
              id: course.id,
              name: course.title,
              price: course.price,
              type: "course",
              description: course.short_description,
              access_type: course.access_type,
              slug: course.slug,
            });
            setLoading(false);
            return;
          }
          // Fallback: produk digital (tripwire/ebook/template)
          try {
            const dpRes = await fetch(`/api/public/digital-products/${productSlug}`, { credentials: "include" });
            const dp = await dpRes.json();
            if (dp.success && dp.data) {
              setProduct({
                id: dp.data.id,
                name: dp.data.name,
                price: dp.data.price,
                compare_at_price: dp.data.compare_at_price || undefined,
                type: "digital_product",
                description: dp.data.description || undefined,
                slug: dp.data.slug,
              });
            }
          } catch { /* produk tidak ditemukan */ }
          setLoading(false);
        });
    }
  }, [productSlug]);

  // Order bump dari funnel aktif (menggantikan bump konsultasi hardcoded)
  useEffect(() => {
    setBump(null);
    setBumpSelected(false);
    if (!product) return;
    funnelsApi.getBump(product.type, product.id).then((res) => {
      if (res.success && res.data) setBump(res.data as BumpOffer);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  // Default metode pembayaran: Annual/Lifetime → VA, lainnya → QRIS
  useEffect(() => {
    if (product) setPaymentMethod(recommendedMethod(product.type, product.slug || productSlug));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  const getAffiliateCookie = () =>
    document.cookie
      .split(";")
      .find((c) => c.trim().startsWith("affiliate_code="))
      ?.split("=")[1]
      ?.trim() || refCode || "";

  // Logged-in user: paid order
  const handleOrder = async () => {
    if (!product) return;
    const needsMobile = !user?.phone;
    if (needsMobile && !mobile.trim()) {
      setError("Nomor WhatsApp wajib diisi");
      return;
    }
    setOrdering(true);
    setError("");

    const res = await checkoutApi.createPayment({
      order_type: product.type,
      product_id: product.id,
      payment_method: paymentMethod,
      affiliate_code: getAffiliateCookie() || undefined,
      coupon_code: couponState.status === 'valid' && couponCode ? couponCode : undefined,
      ...(mobile.trim() ? { mobile: mobile.trim() } : {}),
      ...(bump && bumpSelected ? { addons: [{ type: "funnel_bump", step_id: bump.step_id }] } : {}),
    });

    const d = res.data as { order_id?: string } | undefined;
    if (res.success && d?.order_id) {
      router.push(`/checkout/${d.order_id}`);
    } else {
      setError(res.error || "Gagal membuat order. Silakan coba lagi.");
      setOrdering(false);
    }
  };

  // Logged-in user: free enroll
  const handleFreeEnroll = async () => {
    if (!product) return;
    setOrdering(true);
    const res = await fetch("/api/user/enroll/free", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course_id: product.id }),
    });
    const d = await res.json();
    if (d.success) {
      router.push(`/learn/${product.slug || productSlug}/start`);
    } else {
      setError(d.error || "Gagal mendaftar. Silakan coba lagi.");
      setOrdering(false);
    }
  };

  // Guest: register + order/enroll in one step
  const handleGuestOrder = async () => {
    if (!product) return;
    const { name, email, phone, password } = guestForm;
    if (!name.trim() || !email.trim() || !phone.trim() || !password.trim()) {
      setError("Semua field wajib diisi");
      return;
    }
    if (password.length < 8) {
      setError("Password minimal 8 karakter");
      return;
    }
    if (password !== confirmPassword) {
      setError("Password tidak cocok");
      return;
    }
    setOrdering(true);
    setError("");
    setIsDuplicate(false);
    setDuplicateField(null);

    // Step 1: Register — sets session cookie
    const regResponse = await fetch("/api/auth/register", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim(), password, cfTurnstileResponse: turnstileToken }),
    });
    const regRes = await regResponse.json();

    if (!regRes.success) {
      if (regResponse.status === 409) {
        setIsDuplicate(true);
        setDuplicateField((regRes.error as string)?.includes("WhatsApp") ? "phone" : "email");
      } else {
        setError(regRes.error || "Gagal membuat akun. Coba lagi.");
      }
      setOrdering(false);
      return;
    }

    // Step 2: Free → enroll, paid → create order (session now active via cookie)
    if (isFree) {
      const res = await fetch("/api/user/enroll/free", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: product.id }),
      }).then((r) => r.json());
      if (res.success) {
        router.push(`/learn/${product.slug || productSlug}/start`);
      } else {
        setError(res.error || "Gagal mendaftar.");
        setOrdering(false);
      }
      return;
    }

    const res = await checkoutApi.createPayment({
      order_type: product.type,
      product_id: product.id,
      payment_method: paymentMethod,
      affiliate_code: getAffiliateCookie() || undefined,
      coupon_code: couponState.status === 'valid' && couponCode ? couponCode : undefined,
      ...(bump && bumpSelected ? { addons: [{ type: "funnel_bump", step_id: bump.step_id }] } : {}),
    });
    const d = res.data as { order_id?: string } | undefined;
    if (res.success && d?.order_id) {
      router.push(`/checkout/${d.order_id}`);
    } else {
      setError(res.error || "Gagal membuat order. Silakan coba lagi.");
      setOrdering(false);
    }
  };

  const durationLabel: Record<string, string> = {
    "membership-monthly": "per bulan",
    "membership-yearly": "per tahun",
    "membership-lifetime": "sekali bayar, akses selamanya",
    "monthly": "per bulan",
    "yearly": "per tahun",
    "lifetime": "sekali bayar, akses selamanya",
  };

  if (loading || isLoggedIn === null) {
    return (
      <div className="min-h-screen bg-warm-cream flex items-center justify-center">
        <div className="text-sm text-[rgba(12,12,10,0.45)]">Memuat...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-warm-cream flex items-center justify-center">
        <div className="text-center">
          <p className="font-semibold text-warm-black mb-2">Produk tidak ditemukan</p>
          <Link href="/dashboard" className="text-sm text-primary">← Kembali ke Dashboard</Link>
        </div>
      </div>
    );
  }

  const isFree = product.type === "course" && product.access_type === "free";
  const needsMobile = isLoggedIn && !user?.phone;
  
  const validateCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponState({ status: 'loading' });
    try {
      const res = await fetch('/api/public/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponInput.trim(), plan_id: product.id })
      });
      const data = await res.json();
      if (data.success && data.data) {
        setCouponState({ 
          status: 'valid', 
          discount_type: data.data.discount_type,
          discount_value: data.data.discount_value,
          max_discount_amount: data.data.max_discount_amount
        });
        setCouponCode(couponInput.trim());
      } else {
        setCouponState({ status: 'invalid', error: data.error || 'Kupon tidak valid' });
      }
    } catch {
      setCouponState({ status: 'invalid', error: 'Gagal mengecek kupon' });
    }
  };

  const removeCoupon = () => {
    setCouponInput("");
    setCouponCode("");
    setCouponState({ status: 'idle' });
  };

  const readOnlyInputClass =
    "w-full px-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.08)] bg-[rgba(12,12,10,0.03)] text-warm-black cursor-default select-none";
  const editableInputClass =
    "w-full px-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black outline-none focus:border-primary transition-colors";

  const hasDiscount = !!(product.compare_at_price && product.compare_at_price > product.price);
  const promoCode = product.slug ? PLAN_PROMO_CODE[product.slug] : undefined;
  const discountPct = hasDiscount
    ? Math.round(((product.compare_at_price! - product.price) / product.compare_at_price!) * 100)
    : 0;
  
  // Calculate coupon discount
  let couponDiscountAmount = 0;
  if (couponState.status === 'valid' && couponState.discount_value) {
    if (couponState.discount_type === 'percentage') {
      couponDiscountAmount = Math.floor(product.price * (couponState.discount_value / 100));
      if (couponState.max_discount_amount && couponDiscountAmount > couponState.max_discount_amount) {
        couponDiscountAmount = couponState.max_discount_amount;
      }
    } else {
      couponDiscountAmount = couponState.discount_value;
    }
    if (couponDiscountAmount > product.price) couponDiscountAmount = product.price;
  }

  const bumpAmount = bump && bumpSelected ? bump.amount : 0;
  const displayTotal = product.price - couponDiscountAmount + bumpAmount;

  return (
    <div
      className="min-h-screen bg-warm-cream flex items-center justify-center p-4"
      style={{
        backgroundImage: `linear-gradient(to right, rgba(12,12,10,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(12,12,10,0.04) 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
      }}
    >
      <div className="w-full max-w-md space-y-3">
        {/* ── Main card ── */}
        <div className="bg-white rounded-2xl border border-[rgba(12,12,10,0.08)] shadow-sm overflow-hidden">
          <div className="h-1 bg-primary w-full" />

          {/* Logo */}
          <div className="flex justify-center px-6 pt-6 pb-5">
            <Image
              src="/logo.png"
              alt="PejuangYen"
              width={128}
              height={32}
              priority
              className="h-8 w-auto"
            />
          </div>

          {/* ── Section: Produk ── */}
          <div className="h-px bg-black/[0.06]" />
          <div className="px-6 py-4">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingBag className="h-4 w-4" style={{ color: "rgba(12,12,10,0.4)" }} />
              <span
                className="text-[10px] font-semibold tracking-widest uppercase"
                style={{ color: "rgba(12,12,10,0.4)" }}
              >
                {product.type === "membership" ? "Membership" : product.type === "digital_product" ? "Produk Digital" : "Kelas"}
              </span>
            </div>
            {isFree ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-sm font-semibold text-green-700">{product.name}</p>
                <p className="text-xs text-green-600 mt-0.5">Kelas Gratis — daftar tanpa biaya apapun</p>
              </div>
            ) : (
              <div>
                <p className="text-base font-semibold text-warm-black">{product.name}</p>
                {product.description && (
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: "rgba(12,12,10,0.5)" }}>
                    {product.description}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Section: Kode Kupon (paid only; disembunyikan utk plan yg promonya sudah built-in di harga) ── */}
          {!isFree && product.type !== "digital_product" && !promoCode && (
            <>
              <div className="h-px bg-black/[0.06]" />
              <div className="px-6 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="h-4 w-4" style={{ color: "rgba(12,12,10,0.4)" }} />
                  <span
                    className="text-[10px] font-semibold tracking-widest uppercase"
                    style={{ color: "rgba(12,12,10,0.4)" }}
                  >
                    Kode Kupon
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="Masukkan kode..."
                    readOnly={couponState.status === 'valid'}
                    className={`flex-1 px-3.5 py-2.5 text-sm rounded-lg border font-mono ${
                      couponState.status === 'valid' 
                        ? 'border-green-300 bg-green-50 text-warm-black font-semibold cursor-default' 
                        : 'border-[rgba(12,12,10,0.12)] bg-white text-warm-black outline-none focus:border-primary'
                    }`}
                  />
                  {couponState.status === 'valid' ? (
                    <button onClick={removeCoupon} className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors px-3 py-2.5 rounded-lg whitespace-nowrap">
                      Hapus
                    </button>
                  ) : (
                    <button 
                      onClick={validateCoupon} 
                      disabled={!couponInput.trim() || couponState.status === 'loading'}
                      className="flex items-center gap-1 text-xs font-semibold text-warm-black bg-warm-cream hover:bg-[#e6ddc5] transition-colors border border-[rgba(12,12,10,0.08)] px-3 py-2.5 rounded-lg whitespace-nowrap disabled:opacity-50"
                    >
                      {couponState.status === 'loading' ? 'Mengecek...' : 'Terapkan'}
                    </button>
                  )}
                </div>
                {couponState.status === 'invalid' && couponState.error && (
                  <p className="text-xs text-red-500 mt-2">{couponState.error}</p>
                )}
                {couponState.status === 'valid' && (
                  <p className="text-xs text-green-700 mt-2">Kupon berhasil diterapkan!</p>
                )}
              </div>
            </>
          )}

          {/* ── Section: Data Pemesan ── */}
          <div className="h-px bg-black/[0.06]" />
          <div className="px-6 py-4">
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4" style={{ color: "rgba(12,12,10,0.4)" }} />
              <span
                className="text-[10px] font-semibold tracking-widest uppercase"
                style={{ color: "rgba(12,12,10,0.4)" }}
              >
                {isLoggedIn === false ? "Buat Akun & Checkout" : "Data Pemesan"}
              </span>
            </div>

            {/* Guest note */}
            {isLoggedIn === false && (
              <p className="text-xs mb-3" style={{ color: "rgba(12,12,10,0.5)" }}>
                Isi data di bawah — akun otomatis dibuat sekaligus checkout.{" "}
                <Link
                  href={`/login?redirect=/order/${productSlug}`}
                  className="text-primary font-semibold"
                >
                  Sudah punya akun?
                </Link>
              </p>
            )}

            {/* Logged-in user */}
            {isLoggedIn && user && (
              <div className="space-y-3">
                <div>
                  <label
                    className="block text-xs font-semibold mb-1.5"
                    style={{ color: "rgba(12,12,10,0.65)" }}
                  >
                    Nama
                  </label>
                  <input type="text" value={user.name} readOnly className={readOnlyInputClass} />
                </div>
                <div>
                  <label
                    className="block text-xs font-semibold mb-1.5"
                    style={{ color: "rgba(12,12,10,0.65)" }}
                  >
                    Email
                  </label>
                  <input type="email" value={user.email} readOnly className={readOnlyInputClass} />
                </div>
                <div>
                  <label
                    className="block text-xs font-semibold mb-1.5"
                    style={{ color: "rgba(12,12,10,0.65)" }}
                  >
                    WhatsApp
                    {needsMobile && !isFree && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  {user.phone ? (
                    <input type="tel" value={user.phone} readOnly className={readOnlyInputClass} />
                  ) : !isFree ? (
                    <>
                      <input
                        type="tel"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        placeholder="08xxxxxxxxxx"
                        className={editableInputClass}
                      />
                      <p className="text-xs mt-1" style={{ color: "rgba(12,12,10,0.4)" }}>
                        Digunakan untuk konfirmasi pembayaran
                      </p>
                    </>
                  ) : null}
                </div>
              </div>
            )}

            {/* Guest form */}
            {isLoggedIn === false && (
              <div className="space-y-3">
                <input type="text" name="_hp_website" value={guestForm._hp_website} onChange={(e) => setGuestForm((prev) => ({ ...prev, _hp_website: e.target.value }))} style={{ display: 'none' }} tabIndex={-1} autoComplete="off" aria-hidden="true" />
                {(
                  [
                    { key: "name", label: "Nama Lengkap", type: "text", placeholder: "John Doe" },
                    { key: "email", label: "Email", type: "email", placeholder: "nama@email.com" },
                    { key: "phone", label: "WhatsApp", type: "tel", placeholder: "08xxxxxxxxxx" },
                  ] as const
                ).map((f) => (
                  <div key={f.key}>
                    <label
                      className="block text-xs font-semibold mb-1.5"
                      style={{ color: "rgba(12,12,10,0.65)" }}
                    >
                      {f.label} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type={f.type}
                      value={guestForm[f.key]}
                      onChange={(e) => {
                        setGuestForm((prev) => ({ ...prev, [f.key]: e.target.value }));
                        if (isDuplicate) {
                          setIsDuplicate(false);
                          setDuplicateField(null);
                        }
                      }}
                      placeholder={f.placeholder}
                      className={editableInputClass}
                    />
                  </div>
                ))}

                <div>
                  <label
                    className="block text-xs font-semibold mb-1.5"
                    style={{ color: "rgba(12,12,10,0.65)" }}
                  >
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={guestForm.password}
                      onChange={(e) =>
                        setGuestForm((prev) => ({ ...prev, password: e.target.value }))
                      }
                      placeholder="Minimal 8 karakter"
                      className={`${editableInputClass} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                      style={{ color: "rgba(12,12,10,0.4)" }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    className="block text-xs font-semibold mb-1.5"
                    style={{ color: "rgba(12,12,10,0.65)" }}
                  >
                    Ulangi Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi password"
                      className={`${editableInputClass} pr-10`}
                    />
                  </div>
                  {confirmPassword && guestForm.password !== confirmPassword && (
                    <p className="text-xs text-red-500 mt-1">Password tidak cocok</p>
                  )}
                </div>
                {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
                  <div className="flex justify-center pt-2">
                    <Turnstile
                      siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
                      onSuccess={setTurnstileToken}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Section: Order Bump (funnel-driven) ── */}
          {!isFree && bump && (
            <>
              <div className="h-px bg-black/[0.06]" />
              <div className="px-6 py-4">
                <FunnelBumpCard bump={bump} selected={bumpSelected} onChange={setBumpSelected} />
              </div>
            </>
          )}

          {/* Duplicate account warning */}
          {isDuplicate && isLoggedIn === false && (
            <div className="mx-5 mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3.5">
              <p className="text-xs font-semibold text-amber-800 mb-0.5">Akun sudah terdaftar</p>
              <p className="text-[11px] text-amber-700 mb-2.5">
                {duplicateField === "phone"
                  ? "Nomor WhatsApp ini sudah digunakan oleh akun lain."
                  : "Email ini sudah terdaftar di PejuangYen."}
              </p>
              <div className="flex gap-2">
                <Link
                  href={`/login?redirect=/order/${productSlug}`}
                  className="flex-1 text-center py-1.5 bg-[#8B1414] text-white text-[11px] font-semibold rounded-md hover:bg-[#6E0F0F] transition-colors"
                >
                  Masuk
                </Link>
                <Link
                  href="/forgot-password"
                  className="flex-1 text-center py-1.5 border border-[#8B1414]/30 text-[#8B1414] text-[11px] font-semibold rounded-md hover:bg-[#F7E8E8] transition-colors"
                >
                  Lupa Kata Sandi
                </Link>
              </div>
            </div>
          )}

          {/* ── Section: Metode Pembayaran (paid only) ── */}
          {!isFree && (
            <>
              <div className="h-px bg-black/[0.06]" />
              <div className="px-6 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <CreditCard className="h-4 w-4" style={{ color: "rgba(12,12,10,0.4)" }} />
                  <span
                    className="text-[10px] font-semibold tracking-widest uppercase"
                    style={{ color: "rgba(12,12,10,0.4)" }}
                  >
                    Metode Pembayaran
                  </span>
                </div>
                <div className="space-y-2">
                  {PAYMENT_METHODS.map((m) => (
                    <label
                      key={m.id}
                      className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        paymentMethod === m.id
                          ? "border-primary bg-[#F7E8E8]"
                          : "border-[rgba(12,12,10,0.12)] bg-white hover:border-[rgba(12,12,10,0.25)]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="payment-method"
                        checked={paymentMethod === m.id}
                        onChange={() => setPaymentMethod(m.id)}
                        className="h-4 w-4 text-primary focus:ring-primary"
                      />
                      <span className="flex-1 text-sm font-medium text-warm-black">{m.label}</span>
                      {recommendedMethod(product.type, product.slug || productSlug) === m.id && (
                        <span className="shrink-0 rounded-md bg-[#F7E8E8] border border-primary/30 px-2 py-0.5 text-[10px] font-bold text-primary">
                          Direkomendasikan
                        </span>
                      )}
                    </label>
                  ))}
                </div>
                <p className="text-xs mt-2.5" style={{ color: "rgba(12,12,10,0.4)" }}>
                  Pembayaran diproses di halaman PejuangYen — tanpa pindah ke situs lain.
                </p>
              </div>
            </>
          )}

          {/* ── Section: Ringkasan Harga (paid only) ── */}
          {!isFree && (
            <>
              <div className="h-px bg-black/[0.06]" />
              <div className="px-6 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Receipt className="h-4 w-4" style={{ color: "rgba(12,12,10,0.4)" }} />
                  <span
                    className="text-[10px] font-semibold tracking-widest uppercase"
                    style={{ color: "rgba(12,12,10,0.4)" }}
                  >
                    Ringkasan Harga
                  </span>
                </div>
                <div className="space-y-1.5 text-sm">
                  {hasDiscount && (
                    <div className="flex justify-between">
                      <span style={{ color: "rgba(12,12,10,0.5)" }}>Harga normal</span>
                      <span
                        className="line-through"
                        style={{ color: "rgba(12,12,10,0.35)" }}
                      >
                        {formatRupiah(product.compare_at_price!)}
                      </span>
                    </div>
                  )}
                  {hasDiscount && (
                    <div className="flex justify-between">
                      <span style={{ color: "rgba(12,12,10,0.5)" }}>
                        {promoCode ? (
                          <>Promo <span className="font-mono font-semibold" style={{ color: "rgba(12,12,10,0.65)" }}>{promoCode}</span> (−{discountPct}%)</>
                        ) : "Diskon Reguler"}
                      </span>
                      <span className="text-green-600 font-semibold">
                        − {formatRupiah(product.compare_at_price! - product.price)}
                      </span>
                    </div>
                  )}
                  {couponState.status === 'valid' && (
                    <div className="flex justify-between">
                      <span style={{ color: "rgba(12,12,10,0.5)" }}>
                        Kupon <span className="font-mono font-semibold" style={{ color: "rgba(12,12,10,0.65)" }}>"{couponCode}"</span>
                      </span>
                      <span className="text-emerald-600 font-semibold">
                        − {formatRupiah(couponDiscountAmount)}
                      </span>
                    </div>
                  )}
                  {bump && bumpSelected && (
                    <div className="flex justify-between">
                      <span style={{ color: "rgba(12,12,10,0.5)" }}>{bump.label}</span>
                      <span className="font-semibold text-warm-black">{formatRupiah(bump.amount)}</span>
                    </div>
                  )}
                  {durationLabel[productSlug] && (
                    <p
                      className="text-xs pt-0.5"
                      style={{ color: "rgba(12,12,10,0.4)" }}
                    >
                      {durationLabel[productSlug]}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="mx-5 mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* ── Footer: Total + CTA ── */}
        <div className="bg-white rounded-2xl border border-[rgba(12,12,10,0.08)] shadow-sm px-5 py-3.5 flex items-center justify-between gap-4">
          <div>
            {!isFree ? (
              <>
                <p className="text-xl font-bold text-warm-black">{formatRupiah(displayTotal)}</p>
                {hasDiscount && (
                  <p
                    className="text-xs line-through"
                    style={{ color: "rgba(12,12,10,0.35)" }}
                  >
                    {formatRupiah(product.compare_at_price!)}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xl font-bold text-green-700">Gratis</p>
            )}
          </div>
          <button
            onClick={
              isLoggedIn === false
                ? handleGuestOrder
                : isFree
                ? handleFreeEnroll
                : handleOrder
            }
            disabled={ordering}
            className="py-2.5 px-6 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
          >
            {ordering ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Memproses...
              </>
            ) : isLoggedIn === false ? (
              isFree ? "Daftar & Mulai →" : "Daftar & Bayar →"
            ) : isFree ? (
              "Daftar Gratis →"
            ) : (
              "Bayar Sekarang →"
            )}
          </button>
        </div>

        <p
          className="text-center text-sm"
          style={{ color: "rgba(12,12,10,0.45)" }}
        >
          <Link href="/dashboard" className="hover:text-primary transition-colors">
            ← Kembali ke Dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
