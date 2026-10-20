import type { Attribution, AttributionTouch } from "@/types/tracking";

// First/last-touch attribution persisted on the visitor's device.
// gwa_attr_first is written once and never overwritten; gwa_attr_last is
// refreshed whenever a new campaign signal appears (utm/ref/referral param
// or an external referrer).

const FIRST_KEY = "gwa_attr_first";
const LAST_KEY = "gwa_attr_last";
const MAX_LEN = 500;

function clip(value: string | null | undefined): string | undefined {
  const trimmed = (value || "").trim();
  return trimmed ? trimmed.slice(0, MAX_LEN) : undefined;
}

function readTouch(key: string): AttributionTouch | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AttributionTouch;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeTouch(key: string, touch: AttributionTouch): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(touch));
  } catch {
    // storage blocked — attribution simply not persisted
  }
}

// First-touch UTM yang ditangkap di situs landing (origin terpisah) dibawa ke
// app lewat cookie `.pejuangyen.com` bernama gwa_utm — pola sama dengan cookie
// affiliate_code. localStorage bersifat per-origin sehingga tak bisa dipakai
// lintas-subdomain; cookie inilah jembatannya.
function readUtmCookie(): Record<string, string> | null {
  try {
    const raw = document.cookie
      .split("; ")
      .find((c) => c.startsWith("gwa_utm="))
      ?.split("=")[1];
    if (!raw) return null;
    const parsed = JSON.parse(decodeURIComponent(raw)) as Record<string, string>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function isExternalReferrer(referrer: string): boolean {
  if (!referrer) return false;
  try {
    const ref = new URL(referrer);
    return ref.hostname !== window.location.hostname;
  } catch {
    return false;
  }
}

/**
 * Capture attribution from the current URL on page entry. Call once per
 * full page load (TrackingBootstrap).
 */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const referrer = document.referrer || "";
    const external = isExternalReferrer(referrer);

    // URL menang; bila app dibuka tanpa utm di URL, pakai first-touch dari cookie
    // lintas-subdomain yang diset di landing.
    const cookieUtm = readUtmCookie();
    const utm = (key: string): string | undefined =>
      clip(params.get(`utm_${key}`)) ?? clip(cookieUtm?.[`utm_${key}`]);

    const touch: AttributionTouch = {
      source: utm("source"),
      medium: utm("medium"),
      campaign: utm("campaign"),
      term: utm("term"),
      content: utm("content"),
      affiliate_code: clip(params.get("ref")),
      referral_code: clip(params.get("referral")),
      landing_page: clip(window.location.pathname + window.location.search),
      referrer: external ? clip(referrer) : undefined,
      ts: new Date().toISOString(),
    };

    const hasCampaignSignal = !!(
      touch.source || touch.medium || touch.campaign ||
      touch.affiliate_code || touch.referral_code || (external && touch.referrer)
    );

    if (!readTouch(FIRST_KEY)) {
      // First visit we can observe — record it even without campaign params
      // so landing page + referrer of the first session are preserved.
      writeTouch(FIRST_KEY, touch);
    }

    if (hasCampaignSignal) {
      writeTouch(LAST_KEY, touch);
    }
  } catch {
    // never break the page for tracking
  }
}

export function getAttribution(): Attribution {
  if (typeof window === "undefined") return { first: null, last: null };
  return {
    first: readTouch(FIRST_KEY),
    last: readTouch(LAST_KEY),
  };
}
