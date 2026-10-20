"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Turnstile } from "@marsidev/react-turnstile";
import { AuthShell, GlassInputWrapper } from "@/components/ui/auth-shell";
import { AUTH_HERO_IMAGE, AUTH_TESTIMONIALS } from "@/lib/auth-content";
import { getAttribution } from "@/lib/tracking/attribution";
import { identify } from "@/lib/tracking/client";

const inputClass = "w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none disabled:opacity-60";

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", referral_source: "", _hp_website: "" });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [duplicateField, setDuplicateField] = useState<"email" | "phone" | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (isDuplicate) { setIsDuplicate(false); setDuplicateField(null); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsDuplicate(false);
    setDuplicateField(null);

    if (form.password !== confirmPassword) {
      setError("Password tidak cocok");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...form,
          cfTurnstileResponse: turnstileToken,
          affiliate_code: document.cookie.split(';').find(c => c.trim().startsWith('affiliate_code='))?.split('=')[1]?.trim() || undefined,
          attribution: getAttribution(),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        if (res.status === 409) {
          setIsDuplicate(true);
          setDuplicateField((data.error as string)?.includes("WhatsApp") ? "phone" : "email");
        } else {
          setError(data.error || "Registrasi gagal");
        }
        return;
      }

      // Verifikasi email OTP dinonaktifkan — register selalu auto-verified + auto-login.
      identify();
      window.location.href = "/dashboard";
    } catch {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      logoSrc="/logo.png"
      title={<span className="font-light text-foreground tracking-tighter">Daftar di <span className="font-semibold">PejuangYen</span></span>}
      description="Mulai persiapan kerja & belajar bahasa Jepang-mu"
      heroImageSrc={AUTH_HERO_IMAGE}
      testimonials={AUTH_TESTIMONIALS}
      footer={<>Sudah punya akun? <Link href="/login" className="text-primary hover:underline transition-colors">Masuk</Link></>}
    >
      {isDuplicate && (
        <div className="animate-element rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-800 mb-0.5">Akun kamu sudah terdaftar</p>
          <p className="text-xs text-amber-700 mb-3">
            {duplicateField === "phone" ? "Nomor WhatsApp ini sudah digunakan oleh akun lain." : "Email ini sudah terdaftar di PejuangYen."}
          </p>
          <div className="flex gap-2">
            <Link href="/login" className="flex-1 text-center py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors">Masuk</Link>
            <Link href="/forgot-password" className="flex-1 text-center py-2 border border-primary/30 text-primary text-xs font-semibold rounded-lg hover:bg-primary/5 transition-colors">Lupa Password</Link>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Honeypot */}
        <input type="text" name="_hp_website" value={form._hp_website || ''} onChange={handleChange} style={{ display: 'none' }} tabIndex={-1} autoComplete="off" aria-hidden="true" />

        <div className="animate-element animate-delay-300">
          <label className="text-sm font-medium text-muted-foreground">Nama Lengkap</label>
          <GlassInputWrapper>
            <input name="name" type="text" placeholder="Nama lengkap" value={form.name} onChange={handleChange} required disabled={loading} className={inputClass} />
          </GlassInputWrapper>
        </div>

        <div className="animate-element animate-delay-300">
          <label className="text-sm font-medium text-muted-foreground">Email</label>
          <GlassInputWrapper>
            <input name="email" type="email" placeholder="nama@email.com" value={form.email} onChange={handleChange} required disabled={loading} className={inputClass} />
          </GlassInputWrapper>
        </div>

        <div className="animate-element animate-delay-400">
          <label className="text-sm font-medium text-muted-foreground">No. WhatsApp</label>
          <GlassInputWrapper>
            <input name="phone" type="tel" placeholder="08xxxxxxxxxx" value={form.phone} onChange={handleChange} required disabled={loading} className={inputClass} />
          </GlassInputWrapper>
        </div>

        <div className="animate-element animate-delay-400">
          <label className="text-sm font-medium text-muted-foreground">Tau PejuangYen dari mana?</label>
          <GlassInputWrapper>
            <select name="referral_source" value={form.referral_source} onChange={(e) => setForm({ ...form, referral_source: e.target.value })} disabled={loading} className={`${inputClass} appearance-none`}>
              <option value="">-- Pilih --</option>
              <option value="Instagram">Instagram</option>
              <option value="TikTok">TikTok</option>
              <option value="Google / Search">Google / Search</option>
              <option value="Dari teman">Dari teman</option>
              <option value="Komunitas WhatsApp/Telegram">Komunitas WhatsApp / Telegram</option>
              <option value="YouTube">YouTube</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </GlassInputWrapper>
        </div>

        <div className="animate-element animate-delay-500">
          <label className="text-sm font-medium text-muted-foreground">Password</label>
          <GlassInputWrapper>
            <div className="relative">
              <input name="password" type={showPassword ? "text" : "password"} placeholder="Minimal 8 karakter" value={form.password} onChange={handleChange} required minLength={8} disabled={loading} className={`${inputClass} pr-12`} />
              <button type="button" onClick={() => setShowPassword((p) => !p)} className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </GlassInputWrapper>
        </div>

        <div className="animate-element animate-delay-500">
          <label className="text-sm font-medium text-muted-foreground">Ulangi Password</label>
          <GlassInputWrapper>
            <input type={showPassword ? "text" : "password"} placeholder="Ulangi password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={loading} className={inputClass} />
          </GlassInputWrapper>
          {confirmPassword && form.password !== confirmPassword && (
            <p className="text-xs text-red-500 mt-1">Password tidak cocok</p>
          )}
        </div>

        {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
          <div className="animate-element flex justify-center">
            <Turnstile siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} onSuccess={setTurnstileToken} />
          </div>
        )}

        {error && (
          <div className="animate-element rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <button type="submit" disabled={loading} className="animate-element animate-delay-600 w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-70">
          {loading ? "Memproses…" : "Daftar Sekarang"}
        </button>
      </form>
    </AuthShell>
  );
}
