"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { SignInPage } from "@/components/ui/sign-in";
import { AUTH_HERO_IMAGE, AUTH_TESTIMONIALS } from "@/lib/auth-content";
import { identify } from "@/lib/tracking/client";

function LoginForm() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirectTo = searchParams.get("redirect");

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "").trim();
    const password = String(fd.get("password") || "");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Login gagal. Periksa email dan password kamu.");
        return;
      }

      identify();
      const role = data.data.user.role;
      const defaultRedirect = role === "admin" || role === "super_admin" ? "/admin" : "/dashboard";
      const safeRedirect =
        redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
          ? redirectTo
          : defaultRedirect;
      window.location.href = safeRedirect;
    } catch {
      setError("Terjadi kesalahan jaringan. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background text-foreground">
      <SignInPage
        title={
          <span className="font-light text-foreground tracking-tighter">
            Masuk ke <span className="font-semibold">PejuangYen</span>
          </span>
        }
        description="Lanjutkan persiapan kerja & belajar bahasa Jepang-mu."
        logoSrc="/logo.png"
        heroImageSrc={AUTH_HERO_IMAGE}
        testimonials={AUTH_TESTIMONIALS}
        error={error}
        loading={loading}
        onSignIn={handleSignIn}
        onResetPassword={() => router.push("/forgot-password")}
        onCreateAccount={() => router.push("/register")}
      />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] bg-background flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
