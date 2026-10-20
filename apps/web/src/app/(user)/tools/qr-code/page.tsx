import { Suspense } from "react";
import Link from "next/link";
import { ChevronLeft, Lock, Zap } from "lucide-react";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { QrGenerator } from "./QrGenerator";

export const metadata = {
  title: "QR Code Generator",
};

export default function QrCodeToolPage() {
  return (
    <>
      <Link
        href="/tools"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-gray-900 dark:text-slate-400 dark:hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" /> Kembali ke Tools
      </Link>

      <PageHeader
        eyebrow="Tools Gratis"
        title="QR Code Generator"
        description="Buat QR code untuk link, WhatsApp, menu, atau teks apa pun. Atur warna, lalu unduh PNG atau SVG."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
            <Zap className="h-3.5 w-3.5" /> Gratis · 0 kredit
          </span>
        }
      />

      <div className="mt-6 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-5 sm:p-7">
        <Suspense fallback={null}>
          <QrGenerator />
        </Suspense>
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500">
        <Lock className="h-3.5 w-3.5" /> Semua diproses di perangkatmu — link tidak dikirim ke server.
      </p>
    </>
  );
}
