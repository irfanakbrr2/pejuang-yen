"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthShell, GlassInputWrapper } from "@/components/ui/auth-shell";
import { AUTH_HERO_IMAGE, AUTH_TESTIMONIALS } from "@/lib/auth-content";

const inputClass = "w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-none disabled:opacity-60";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) setSent(true);
      else setError(data.error || "Gagal mengirim email reset");
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      logoSrc="/logo.png"
      title={<span className="font-light text-foreground tracking-tighter">Lupa Password?</span>}
      description="Masukkan email kamu, kami akan kirimkan link reset."
      heroImageSrc={AUTH_HERO_IMAGE}
      testimonials={AUTH_TESTIMONIALS}
      footer={<><Link href="/login" className="text-primary hover:underline transition-colors">Kembali ke halaman masuk</Link></>}
    >
      {sent ? (
        <div className="animate-element rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary">
          Jika email terdaftar, link reset password telah dikirim. Cek inbox kamu.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="animate-element animate-delay-300">
            <label className="text-sm font-medium text-muted-foreground">Email</label>
            <GlassInputWrapper>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} placeholder="nama@email.com" className={inputClass} />
            </GlassInputWrapper>
          </div>

          {error && (
            <div className="animate-element rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}

          <button type="submit" disabled={loading} className="animate-element animate-delay-500 w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-70">
            {loading ? "Mengirim…" : "Kirim Link Reset"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
