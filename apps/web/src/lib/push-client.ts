/* Klien Web Push: minta izin, subscribe via service worker, daftarkan ke API. */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function getPublicKey(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/api/user/push/public-key`, { credentials: "include" });
    const j = await res.json();
    return j?.success && j.data?.enabled ? (j.data.public_key as string) : null;
  } catch {
    return null;
  }
}

async function postSubscription(sub: PushSubscription): Promise<boolean> {
  const json = sub.toJSON();
  const res = await fetch(`${API_BASE}/api/user/push/subscribe`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
  const j = await res.json();
  return !!j?.success;
}

/**
 * Pastikan device ter-subscribe TANPA meminta izin baru (untuk yang sudah granted).
 * Aman dipanggil saat load.
 */
export async function ensurePushSubscribed(): Promise<void> {
  if (!pushSupported() || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      await postSubscription(existing);
      return;
    }
    const key = await getPublicKey();
    if (!key) return;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
    });
    await postSubscription(sub);
  } catch (err) {
    console.warn("[push] ensure subscribe failed:", err);
  }
}

/**
 * Opt-in eksplisit (panggil dari gesture user, mis. klik tombol lonceng).
 * Mengembalikan true bila berhasil subscribe.
 */
export async function enablePush(): Promise<boolean> {
  if (!pushSupported()) return false;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;
    const key = await getPublicKey();
    if (!key) return false;
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });
    }
    return await postSubscription(sub);
  } catch (err) {
    console.warn("[push] enable failed:", err);
    return false;
  }
}
