"use client";

import { useEffect, useRef } from "react";
import { track, trackPageView } from "@/lib/tracking/client";
import type { ClientEventName, TrackProps } from "@/types/tracking";

/** Fire a single page_view for this page on mount. */
export function usePageView(page: string): void {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackPageView(page);
  }, [page]);
}

/** Stable tracking helpers for event handlers. */
export function useTracking(): { track: (name: ClientEventName, props?: TrackProps) => void } {
  return { track };
}
