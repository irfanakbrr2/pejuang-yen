"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { automationApi } from "@/lib/api-client";
import { PageHeader, DashboardSection } from "@/components/ui/dashboard-chrome";
import { Bot, Plus, KeyRound, Clock, ArrowRight, Zap, HelpCircle, ChevronDown } from "lucide-react";

interface AutomationListItem {
  id: string;
  name: string;
  template_key: string;
  status: "active" | "paused" | "draft";
  schedule_label: string | null;
  next_run_at: string | null;
  last_run_at: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  paused: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  draft: "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-slate-400",
};
const STATUS_LABEL: Record<string, string> = { active: "Aktif", paused: "Jeda", draft: "Draft" };

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta",
    }) + " WIB";
  } catch { return "—"; }
}

export default function AutomationListPage() {
  const [items, setItems] = useState<AutomationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    automationApi.list()
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          const list = res.data as AutomationListItem[];
          setItems(list);
          if (list.length === 0) setShowHelp(true); // buka panduan otomatis untuk pengguna baru
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        title="Content Automation"
        description="Jalankan otomasi konten AI bertema (generate + jadwalkan + notifikasi) tanpa n8n."
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          href="/tools/automation/new"
          className="flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" /> Buat Automation
        </Link>
        <Link
          href="/tools/automation/credentials"
          className="flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-white/10 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-slate-200 transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
        >
          <KeyRound className="h-4 w-4" /> Kelola Credential
        </Link>
        <button
          onClick={() => setShowHelp((v) => !v)}
          className="flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-white/10 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-slate-200 transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
        >
          <HelpCircle className="h-4 w-4" /> Cara pakai
          <ChevronDown className={`h-4 w-4 transition-transform ${showHelp ? "rotate-180" : ""}`} />
        </button>
      </div>

      {showHelp && <HelpPanel />}

      <DashboardSection title="Automation Saya">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/5" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 dark:border-white/10 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 dark:bg-violet-500/10">
              <Bot className="h-6 w-6 text-violet-500" />
            </div>
            <p className="mt-3 text-sm font-semibold text-gray-800 dark:text-white">Belum ada automation</p>
            <p className="mt-1 max-w-sm text-xs text-gray-500 dark:text-slate-400">
              Buat dari template, isi jadwal & credential, lalu aktifkan. Sisanya berjalan otomatis.
            </p>
            <Link href="/tools/automation/new" className="mt-4 flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700">
              <Plus className="h-3.5 w-3.5" /> Buat Automation
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((a) => (
              <Link
                key={a.id}
                href={`/tools/automation/${a.id}`}
                className="group flex items-center justify-between gap-4 rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 transition-all hover:border-violet-200 dark:hover:border-violet-500/30 hover:shadow-md"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-500/10">
                    <Bot className="h-5 w-5 text-violet-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{a.name}</p>
                    <p className="flex items-center gap-1 truncate text-xs text-gray-500 dark:text-slate-400">
                      <Clock className="h-3 w-3" /> {a.schedule_label || "—"}
                      {a.status === "active" && <span className="ml-1">· berikutnya {fmt(a.next_run_at)}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[a.status]}`}>
                    {STATUS_LABEL[a.status]}
                  </span>
                  <ArrowRight className="h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-500" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </DashboardSection>

      <p className="mt-6 flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500">
        <Zap className="h-3 w-3" /> Tiap run otomasi memakai 1 kredit AI Tools.
      </p>
    </>
  );
}

function HelpStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-600 dark:bg-violet-500/20 dark:text-violet-300">{n}</span>
      <div className="text-sm text-gray-600 dark:text-slate-300">
        <p className="font-semibold text-gray-900 dark:text-white">{title}</p>
        <div className="mt-0.5 text-xs leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function HelpPanel() {
  return (
    <div className="mb-6 rounded-2xl border border-violet-100 dark:border-violet-500/20 bg-violet-50/40 dark:bg-violet-500/5 p-5">
      <div className="mb-4 flex items-center gap-2">
        <HelpCircle className="h-5 w-5 text-violet-500" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Cara pakai Content Automation</h3>
      </div>
      <p className="mb-4 text-xs text-gray-600 dark:text-slate-400">
        Automation = robot yang tiap jadwal otomatis: pilih topik &rarr; tulis thread pakai AI &rarr; jadwalkan ke Threads (Repliz) &rarr; kirim notifikasi Telegram. Sekali setup, jalan sendiri.
      </p>
      <div className="space-y-3.5">
        <HelpStep n={1} title="Simpan Credential dulu">
          Buka <Link href="/tools/automation/credentials" className="font-medium text-violet-600 hover:underline">Kelola Credential</Link> &rarr; tambah <strong>Repliz</strong> (Access Key + Secret Key) dan <strong>Telegram</strong> (Bot Token). Tersimpan terenkripsi.
        </HelpStep>
        <HelpStep n={2} title="Buat Automation">
          Klik <strong>Buat Automation</strong> &rarr; pilih template, atur jadwal (WIB), pilih credential, isi Repliz Account/User ID + Telegram Chat ID, lalu tempel daftar topik (satu per baris). Status awal = Jeda.
        </HelpStep>
        <HelpStep n={3} title="Uji dulu">
          Di halaman detail klik <strong>Jalankan sekarang</strong>, tunggu ±6 detik, lalu <strong>Refresh</strong>. Cek riwayat run (status success + preview), notifikasi Telegram, dan thread terjadwal di Repliz.
        </HelpStep>
        <HelpStep n={4} title="Aktifkan">
          Kalau uji lancar, klik <strong>Aktifkan</strong>. Robot jalan otomatis sesuai jadwal (dicek tiap 10 menit). Topik berputar otomatis &mdash; saat habis, reset sendiri.
        </HelpStep>
      </div>
      <p className="mt-4 flex items-center gap-1.5 border-t border-violet-100 dark:border-violet-500/15 pt-3 text-[11px] text-gray-500 dark:text-slate-400">
        <Zap className="h-3 w-3" /> Tiap run sukses memakai 1 kredit AI Tools (otomatis dikembalikan kalau gagal).
      </p>
    </div>
  );
}
