"use client";

import { useEffect } from "react";
import { captureAttribution } from "@/lib/tracking/attribution";

/**
 * Mounted once in the root layout. Captures UTM/ref/landing attribution on
 * every full page load (first-touch write-once, last-touch on new signal).
 */
export default function TrackingBootstrap() {
  useEffect(() => {
    captureAttribution();
  }, []);
  return null;
}
