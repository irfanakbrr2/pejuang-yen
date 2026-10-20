// Anonymous + session identity for first-party tracking. All storage access
// is wrapped in try/catch — private mode / blocked storage must never throw.

const ANON_KEY = "gwa_anon_id";
const SESSION_KEY = "gwa_session";
const SESSION_TTL_MS = 30 * 60 * 1000; // 30-minute rolling window

function randomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

let memoryAnonId: string | null = null;
let memorySession: { id: string; ts: number } | null = null;

export function getAnonymousId(): string {
  if (typeof window === "undefined") return "";
  try {
    const stored = window.localStorage.getItem(ANON_KEY);
    if (stored) return stored;
    const fresh = randomId();
    window.localStorage.setItem(ANON_KEY, fresh);
    return fresh;
  } catch {
    if (!memoryAnonId) memoryAnonId = randomId();
    return memoryAnonId;
  }
}

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  const now = Date.now();
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    let session: { id: string; ts: number } | null = null;
    if (raw) {
      try {
        session = JSON.parse(raw) as { id: string; ts: number };
      } catch {
        session = null;
      }
    }
    if (!session || !session.id || now - session.ts > SESSION_TTL_MS) {
      session = { id: randomId(), ts: now };
    } else {
      session.ts = now;
    }
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session.id;
  } catch {
    if (!memorySession || now - memorySession.ts > SESSION_TTL_MS) {
      memorySession = { id: randomId(), ts: now };
    } else {
      memorySession.ts = now;
    }
    return memorySession.id;
  }
}
