"use client";

import { useEffect, useState } from "react";
import { Megaphone, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/toast";
import { PageHeader } from "@/components/ui/dashboard-chrome";

type Segment = "all" | "paid" | "free";

const SEGMENTS: { id: Segment; label: string; desc: string }[] = [
  { id: "all", label: "Semua user", desc: "Semua user aktif" },
  { id: "paid", label: "Member premium", desc: "Punya membership aktif" },
  { id: "free", label: "Member gratis", desc: "Tanpa membership aktif" },
];

export default function PushBroadcastPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("/dashboard");
  const [segment, setSegment] = useState<Segment>("all");
  const [sending, setSending] = useState(false);
  const [stats, setStats] = useState<{ subscriptions: number; users: number; push_enabled: boolean; push_cap: number } | null>(null);

  useEffect(() => {
    fetch("/api/admin/push/stats", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => j.success && setStats(j.data))
      .catch(() => {});
  }, []);

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Judul dan isi wajib diisi.");
      return;
    }
    if (!confirm(`Kirim broadcast ke segmen "${segment}"? Notifikasi langsung terkirim.`)) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/push/broadcast", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, url, segment }),
      });
      const j = await res.json();
      if (j.success) {
        toast.success(
          `Terkirim! ${j.data.in_app_notified} notifikasi in-app, ${j.data.push_audience} push${j.data.cap_hit ? " (dibatasi)" : ""}.`
        );
        setTitle("");
        setBody("");
      } else {
        toast.error(j.error || "Gagal mengirim broadcast.");
      }
    } catch {
      toast.error("Gagal mengirim broadcast.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        eyebrow="Tools & Sistem"
        title="Broadcast Push"
        description="Kirim notifikasi push + in-app ke user secara massal."
      />

      {stats && !stats.push_enabled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Web Push belum dikonfigurasi (VAPID kosong) — notifikasi in-app tetap terkirim, push tidak.
        </div>
      )}

      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2 text-sm text-[#6B7280] dark:text-slate-400">
          <Users size={15} />
          {stats ? (
            <span>
              {stats.users} user punya push aktif · {stats.subscriptions} device
              {stats.push_cap ? ` · maks ${stats.push_cap}/broadcast` : ""}
            </span>
          ) : (
            "Memuat statistik…"
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-[#0D0D0D] dark:text-white">Judul</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="mis. Kelas baru sudah rilis! 🎉"
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1414]/40"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-[#0D0D0D] dark:text-white">Isi pesan</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={180}
            rows={3}
            placeholder="Tulis pesan singkat & menarik…"
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1414]/40 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-[#0D0D0D] dark:text-white">Link tujuan</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/dashboard"
            className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8B1414]/40"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-[#0D0D0D] dark:text-white">Segmen</label>
          <div className="grid grid-cols-3 gap-2">
            {SEGMENTS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSegment(s.id)}
                className={`rounded-xl border p-3 text-left transition ${
                  segment === s.id
                    ? "border-[#8B1414] bg-[#F7E8E8] dark:bg-[#C0392B]/10"
                    : "border-black/10 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5"
                }`}
              >
                <p className="text-sm font-semibold text-[#0D0D0D] dark:text-white">{s.label}</p>
                <p className="text-[11px] text-[#6B7280] dark:text-slate-400 mt-0.5">{s.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <Button onClick={send} loading={sending} size="lg" className="w-full">
          <Send size={16} className="mr-1.5" /> Kirim Broadcast
        </Button>
      </div>

      <div className="flex items-start gap-2 text-[12px] text-[#6B7280] dark:text-slate-400">
        <Megaphone size={14} className="mt-0.5 shrink-0" />
        <p>Notifikasi in-app menjangkau semua user di segmen (muncul di lonceng). Push hanya ke yang sudah mengaktifkan notifikasi, dibatasi {stats?.push_cap || 800} per broadcast.</p>
      </div>
    </div>
  );
}
