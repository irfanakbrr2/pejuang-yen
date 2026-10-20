"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { MenuMilestone } from "@growwithai/shared";
import { recordMenuVisit } from "@/lib/api-client";

const PATH_TO_MILESTONE: [string, MenuMilestone][] = [
  ["/my-classes", "visited_my_classes"],
  ["/affiliate", "visited_affiliate"],
  ["/certificates", "visited_certificates"],
];

const SESSION_PREFIX = "gwai_ms_";

// Guard ganda (module Set + sessionStorage) → maksimal 1 POST per milestone per session
const sent = new Set<string>();

/**
 * Catat kunjungan menu utama untuk checklist onboarding.
 * Dipanggil sekali di UserDashboardLayout — semua sub-route otomatis tercakup.
 */
export function useMenuVisit(): void {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const hit = PATH_TO_MILESTONE.find(([prefix]) => pathname.startsWith(prefix));
    if (!hit) return;
    const milestone = hit[1];

    if (sent.has(milestone)) return;
    try {
      if (sessionStorage.getItem(SESSION_PREFIX + milestone)) {
        sent.add(milestone);
        return;
      }
      sessionStorage.setItem(SESSION_PREFIX + milestone, "1");
    } catch {
      /* storage tidak tersedia — module Set tetap mencegah duplikat */
    }
    sent.add(milestone);
    recordMenuVisit(milestone);
  }, [pathname]);
}
