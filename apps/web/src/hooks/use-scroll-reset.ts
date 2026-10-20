"use client";

import { useEffect, type RefObject } from "react";
import { usePathname } from "next/navigation";

/**
 * Reset scroller internal (dan window) ke atas secara instan setiap pindah halaman.
 *
 * Scroller halaman di app ini adalah <div overflow-y-auto> yang tetap ter-mount
 * lintas navigasi client-side, jadi scrollTop-nya tidak pernah di-reset → halaman
 * "menempel" di posisi scroll sebelumnya. Hook ini memaksa jump-to-top per halaman.
 *
 * Instan (tanpa animasi): set scrollTop langsung — mengabaikan CSS
 * `scroll-behavior: smooth`. window.scrollTo dipanggil defensif untuk halaman
 * yang men-scroll dokumen.
 *
 * @param ref ref ke elemen scroller (div overflow-y-auto)
 * @param dep override trigger; default ke pathname. Pakai mis. lessonSlug bila
 *            komponen tetap mount dan hanya satu segmen path yang berubah.
 */
export function useScrollReset(ref: RefObject<HTMLElement | null>, dep?: string) {
  const pathname = usePathname();
  const trigger = dep ?? pathname;

  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = 0;
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
}
