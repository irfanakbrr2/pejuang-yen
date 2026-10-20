import type { ClientEventName, TrackProps, TrackingEventPayload } from "@/types/tracking";
import { getAnonymousId, getSessionId } from "./session";
import { getAttribution } from "./attribution";

// First-party tracking client. IMPORTANT: uses raw fetch (keepalive), NOT the
// api() wrapper — api() invalidates the whole GET cache on every POST, which
// would wipe the session cache on every event flush. All paths fail silently
// in production; dev logs to console.debug.

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const FLUSH_SIZE = 10;
const FLUSH_INTERVAL_MS = 10_000;
const MAX_QUEUE = 60;

const isDev = process.env.NODE_ENV === "development";

let queue: TrackingEventPayload[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let listenersAttached = false;

function debugLog(...args: unknown[]): void {
  if (isDev) console.debug("[tracking]", ...args);
}

function postJson(path: string, body: unknown): Promise<Response | null> {
  return fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    keepalive: true,
    body: JSON.stringify(body),
  }).catch((err) => {
    debugLog("post failed", path, err);
    return null;
  });
}

export function flush(): void {
  if (queue.length === 0) return;
  const events = queue;
  queue = [];
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  debugLog("flush", events.length, "events");
  void postJson("/api/tracking/events", { events });
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_INTERVAL_MS);
}

function attachLifecycleListeners(): void {
  if (listenersAttached || typeof window === "undefined") return;
  listenersAttached = true;
  // keepalive fetch survives unload; sendBeacon can't send cross-origin JSON
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}

/**
 * Queue a tracking event. Safe to call anywhere on the client; no-ops on the
 * server and never throws.
 */
export function track(eventName: ClientEventName, props: TrackProps = {}): void {
  if (typeof window === "undefined") return;
  try {
    attachLifecycleListeners();
    const last = getAttribution().last;
    const event: TrackingEventPayload = {
      utm_source: last?.source,
      utm_medium: last?.medium,
      utm_campaign: last?.campaign,
      utm_term: last?.term,
      utm_content: last?.content,
      affiliate_code: last?.affiliate_code,
      referral_code: last?.referral_code,
      landing_page: last?.landing_page,
      ...props,
      event_name: eventName,
      anonymous_id: getAnonymousId(),
      session_id: getSessionId(),
      page_url: window.location.pathname + window.location.search,
      referrer_url: document.referrer || undefined,
    };
    debugLog("track", eventName, event);
    queue.push(event);
    if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
    if (queue.length >= FLUSH_SIZE) {
      flush();
    } else {
      scheduleFlush();
    }
  } catch (err) {
    debugLog("track error", err);
  }
}

export function trackPageView(page?: string): void {
  track("page_view", page ? { metadata: { page } } : {});
}

/**
 * Link pre-signup anonymous activity to the logged-in user and sync
 * client-side attribution to the server. Call after login/register succeeds.
 */
export function identify(): void {
  if (typeof window === "undefined") return;
  try {
    flush();
    const payload = {
      anonymous_id: getAnonymousId(),
      attribution: getAttribution(),
    };
    debugLog("identify", payload);
    void postJson("/api/tracking/identify", payload);
  } catch (err) {
    debugLog("identify error", err);
  }
}
