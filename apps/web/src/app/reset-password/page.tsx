"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { AuthShell, GlassInputWrapper } from "@/components/ui/auth-shell";
import { AUTH_HERO_IMAGE, AUTH_TESTIMONIALS } from "@/lib/auth-content";

const inputClass = "w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none disabled:opacity-60";

function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";

  useEffect(() => {
    if (!token) setError("Token tidak valid. Minta link reset baru.");
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError("Password tidak cocok");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (data.success) {
        setDone(true);
        setTimeout(() => router.push("/login"), 2000);
      } else {
        setError(data.error || "Gagal reset password");
      }
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      logoSrc="/logo.png"
      title={<span className="font-light text-foreground tracking-tighter">Reset Password</span>}
      description="Masukkan password baru kamu."
      heroImageSrc={AUTH_HERO_IMAGE}
      testimonials={AUTH_TESTIMONIALS}
      footer={<><Link href="/login" className="text-primary hover:underline transition-colors">Kembali ke halaman masuk</Link></>}
    >
      {done ? (
        <div className="animate-element rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary text-center">
          Password berhasil direset. Mengarahkan ke halaman masuk…
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="animate-element animate-delay-300">
            <label className="text-sm font-medium text-muted-foreground">Password Baru</label>
            <GlassInputWrapper>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} disabled={loading} placeholder="Min. 8 karakter" className={`${inputClass} pr-12`} />
                <button type="button" onClick={() => setShowPassword((p) => !p)} className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </GlassInputWrapper>
          </div>

          <div className="animate-element animate-delay-400">
            <label className="text-sm font-medium text-muted-foreground">Konfirmasi Password</label>
            <GlassInputWrapper>
              <input type={showPassword ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} disabled={loading} placeholder="Ulangi password baru" className={inputClass} />
            </GlassInputWrapper>
            {confirm && password !== confirm && (
              <p className="text-xs text-red-500 mt-1">Password tidak cocok</p>
            )}
          </div>

          {error && (
            <div className="animate-element rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <button type="submit" disabled={loading || !token} className="animate-element animate-delay-500 w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60">
            {loading ? "Memproses…" : "Reset Password"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-background flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
