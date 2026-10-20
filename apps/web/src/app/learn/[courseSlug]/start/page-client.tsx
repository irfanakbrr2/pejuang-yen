"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

type State = "loading" | "redirecting" | "no-lessons" | "no-access" | "not-found";

export default function StartClient() {
  const pathname = usePathname();
  const courseSlug = pathname.split('/').filter(Boolean)[1];
  const router = useRouter();
  const [state, setState] = useState<State>("loading");
  const [courseTitle, setCourseTitle] = useState<string>("");

  useEffect(() => {
    if (!courseSlug || courseSlug === "_") return;

    fetch(`/api/user/progress/${courseSlug}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) {
          if (d.error?.includes("access") || d.error?.includes("Access")) {
            setState("no-access");
          } else {
            setState("not-found");
            setTimeout(() => router.replace("/my-classes"), 2000);
          }
          return;
        }

        const modules = d.data?.modules ?? [];
        const allLessons = modules.flatMap((m: any) => m.lessons ?? []);

        if (allLessons.length === 0) {
          setCourseTitle(d.data?.course?.title ?? "");
          setState("no-lessons");
          return;
        }

        setState("redirecting");

        // Find first uncompleted lesson, fall back to first lesson
        let target: string | null = null;
        outer: for (const mod of modules) {
          for (const lesson of mod.lessons ?? []) {
            if (!lesson.is_completed) {
              target = lesson.slug;
              break outer;
            }
          }
        }

        if (!target) target = allLessons[0]?.slug ?? null;

        if (target) {
          router.replace(`/learn/${courseSlug}/${target}`);
        } else {
          router.replace("/my-classes");
        }
      })
      .catch(() => {
        setState("not-found");
        setTimeout(() => router.replace("/my-classes"), 2000);
      });
  }, [courseSlug, router]);

  if (state === "loading" || state === "redirecting") {
    return (
      <div className="flex-1 w-full flex items-center justify-center min-h-screen bg-warm-cream dark:bg-[#0D0D0D]">
        <p className="text-sm text-[rgba(12,12,10,0.55)] dark:text-slate-400">Memuat kelas…</p>
      </div>
    );
  }

  if (state === "no-lessons") {
    return (
      <div className="flex-1 w-full flex flex-col items-center justify-center min-h-screen bg-warm-cream dark:bg-[#0D0D0D] gap-4 px-4 text-center">
        <div className="text-4xl">📚</div>
        <h2 className="text-lg font-bold text-[#0D0D0D] dark:text-white">
          {courseTitle || "Kelas"} segera hadir
        </h2>
        <p className="text-sm text-[rgba(12,12,10,0.55)] dark:text-slate-400 max-w-xs">
          Materi kelas ini sedang disiapkan. Cek kembali dalam beberapa saat.
        </p>
        <Link
          href="/my-classes"
          className="mt-2 px-5 py-2.5 bg-[#8B1414] dark:bg-[#C0392B] text-white dark:text-black text-sm font-medium rounded-xl hover:bg-[#6E0F0F] dark:hover:bg-[#A93226] transition-colors"
        >
          Kembali ke Kelas Saya
        </Link>
      </div>
    );
  }

  if (state === "no-access") {
    return (
      <div className="flex-1 w-full flex flex-col items-center justify-center min-h-screen bg-warm-cream dark:bg-[#0D0D0D] gap-4 px-4 text-center">
        <div className="text-4xl">🔒</div>
        <h2 className="text-lg font-bold text-[#0D0D0D] dark:text-white">Akses Diperlukan</h2>
        <p className="text-sm text-[rgba(12,12,10,0.55)] dark:text-slate-400 max-w-xs">
          Kamu belum memiliki akses ke kelas ini. Beli kelas satuan atau aktifkan membership untuk melanjutkan.
        </p>
        <div className="mt-2 flex flex-col sm:flex-row items-center gap-3">
          <Link
            href={`/order/${courseSlug}`}
            className="px-5 py-2.5 bg-[#8B1414] dark:bg-[#C0392B] text-white dark:text-black text-sm font-medium rounded-xl hover:bg-[#6E0F0F] dark:hover:bg-[#A93226] transition-colors"
          >
            Beli Kelas Ini
          </Link>
          <Link
            href="/my-classes"
            className="px-5 py-2.5 border border-[#8B1414] dark:border-[#C0392B] text-[#8B1414] dark:text-[#C0392B] text-sm font-medium rounded-xl hover:bg-[#8B1414]/5 dark:hover:bg-[#C0392B]/10 transition-colors"
          >
            Lihat Kelas Saya
          </Link>
        </div>
      </div>
    );
  }

  // not-found — auto-redirecting
  return (
    <div className="flex-1 w-full flex items-center justify-center min-h-screen bg-warm-cream dark:bg-[#0D0D0D]">
      <p className="text-sm text-[rgba(12,12,10,0.55)] dark:text-slate-400">Kelas tidak ditemukan, mengalihkan…</p>
    </div>
  );
}
