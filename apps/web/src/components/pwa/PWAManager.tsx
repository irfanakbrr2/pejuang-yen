"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { ensurePushSubscribed } from "@/lib/push-client";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const INSTALL_DISMISSED_KEY = "gwa_pwa_install_dismissed";

/**
 * Mengelola sisi-klien PWA:
 *  - mendaftarkan service worker
 *  - menampilkan banner install kustom (beforeinstallprompt)
 *  - memberi tahu status offline/online
 * Aman untuk static export — semua dijalankan setelah hydrate di client.
 */
export default function PWAManager() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);

  // Register service worker
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (window.location.hostname === "localhost") return; // hindari SW di dev
    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => ensurePushSubscribed())
        .catch((err) => {
          console.warn("[PWA] SW registration failed:", err);
        });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  // Install prompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      if (localStorage.getItem(INSTALL_DISMISSED_KEY) === "1") return;
      setInstallEvent(e as BeforeInstallPromptEvent);
      setShowInstall(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => {
      setShowInstall(false);
      setInstallEvent(null);
    });
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Offline / online feedback
  useEffect(() => {
    const goOffline = () =>
      toast.error("Kamu sedang offline", {
        description: "Beberapa fitur mungkin tidak tersedia sampai koneksi kembali.",
        id: "pwa-offline",
        duration: Infinity,
      });
    const goOnline = () => {
      toast.dismiss("pwa-offline");
      toast.success("Kembali online", { id: "pwa-online", duration: 2500 });
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setShowInstall(false);
    setInstallEvent(null);
  }, [installEvent]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
    setShowInstall(false);
  }, []);

  if (!showInstall) return null;

  return (
    <div
      role="dialog"
      aria-label="Pasang aplikasi PejuangYen"
      className="fixed inset-x-3 bottom-3 z-[1000] mx-auto max-w-md rounded-2xl border border-[#E4ECFC] bg-white p-4 shadow-[0_8px_30px_rgba(139,20,20,0.18)] sm:inset-x-auto sm:right-4 sm:left-auto sm:w-96"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white border border-[#8B1414]/15">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" width={30} height={30} className="rounded-md" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#0D0D0D]">Pasang PejuangYen</p>
          <p className="mt-0.5 text-[13px] leading-snug text-slate-500">
            Akses lebih cepat & dapat notifikasi langsung di layar utama.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleInstall}
              className="min-h-[40px] flex-1 rounded-lg bg-[#8B1414] px-4 text-sm font-semibold text-white transition active:scale-[0.97]"
            >
              Pasang
            </button>
            <button
              onClick={handleDismiss}
              className="min-h-[40px] rounded-lg px-4 text-sm font-medium text-slate-500 transition hover:bg-slate-50"
            >
              Nanti
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
