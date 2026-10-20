"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { automationApi } from "@/lib/api-client";
import { PageHeader, DashboardSection } from "@/components/ui/dashboard-chrome";
import { toast } from "@/components/ui/toast";
import {
  ArrowLeft, Play, Pause, Trash2, RefreshCw, CheckCircle2, XCircle,
  Clock, Loader2, ChevronDown, Plus, Settings, KeyRound, X,
} from "lucide-react";

interface Topic { id: string; topic: string; used_at: string | null; }
interface Run {
  id: string; status: string; trigger: string;
  started_at: string | null; finished_at: string | null;
  preview: string | null; error: string | null; logs_json: string | null;
  credits_used: number; created_at: string;
}
interface Automation {
  id: string; name: string; template_key: string;
  status: "active" | "paused" | "draft";
  schedule_label: string | null; next_run_at: string | null; last_run_at: string | null;
}
interface ConfigField { name: string; label: string; type: "text" | "textarea" | "number"; required?: boolean; placeholder?: string; help?: string; }
interface CredRole { role: string; type: string; label: string; }
interface Template { name: string; usesTopics?: boolean; configFields?: ConfigField[]; requiredCredentials?: CredRole[]; }
type AutomationConfig = Record<string, unknown> & { schedule?: ScheduleObj; credentials?: Record<string, string> };
type ScheduleObj =
  | { mode: "interval"; everyMinutes: number }
  | { mode: "hourly"; atMinute: number }
  | { mode: "daily"; atHour: number; atMinute: number }
  | { mode: "daily_times"; times: { hour: number; minute: number }[] };
interface Credential { id: string; type: string; label: string; }
interface DetailData {
  automation: Automation;
  config?: AutomationConfig;
  topics: Topic[];
  runs: Run[];
  template?: Template;
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta",
    }) + " WIB";
  } catch { return "—"; }
}

const RUN_ICON: Record<string, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
  running: <Loader2 className="h-4 w-4 animate-spin text-violet-500" />,
  queued: <Clock className="h-4 w-4 text-amber-500" />,
};

export default function AutomationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newTopics, setNewTopics] = useState("");
  const [openLog, setOpenLog] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);

  const load = useCallback(() => {
    return automationApi.get(id).then((res) => {
      if (res.success && res.data) setData(res.data as DetailData);
    }).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const a = data?.automation;

  const toggleStatus = async () => {
    if (!a) return;
    const next = a.status === "active" ? "paused" : "active";
    setBusy(true);
    const res = await automationApi.setStatus(a.id, next);
    setBusy(false);
    if (!res.success) { toast.error(res.error || "Gagal"); return; }
    toast.success(next === "active" ? "Automation diaktifkan" : "Automation dijeda");
    load();
  };

  const runNow = async () => {
    if (!a) return;
    setBusy(true);
    const res = await automationApi.runNow(a.id);
    setBusy(false);
    if (!res.success) { toast.error(res.error || "Gagal menjalankan"); return; }
    toast.success("Run dimulai. Hasil muncul dalam beberapa saat.");
    setTimeout(load, 6000);
  };

  const del = async () => {
    if (!a || !confirm("Hapus automation ini beserta riwayatnya?")) return;
    const res = await automationApi.remove(a.id);
    if (!res.success) { toast.error(res.error || "Gagal menghapus"); return; }
    toast.success("Automation dihapus");
    router.push("/tools/automation");
  };

  const addTopics = async () => {
    const list = newTopics.split("\n").map((t) => t.trim()).filter(Boolean);
    if (list.length === 0) { toast.error("Isi minimal 1 topik"); return; }
    const res = await automationApi.addTopics(id, list);
    if (!res.success) { toast.error(res.error || "Gagal"); return; }
    toast.success(`${list.length} topik ditambahkan`);
    setNewTopics("");
    load();
  };

  const delTopic = async (topicId: string) => {
    const res = await automationApi.deleteTopic(id, topicId);
    if (!res.success) { toast.error(res.error || "Gagal"); return; }
    setData((prev) => prev ? { ...prev, topics: prev.topics.filter((t) => t.id !== topicId) } : prev);
  };

  if (loading) return <div className="h-40 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/5" />;
  if (!a) return <p className="text-sm text-gray-500">Automation tidak ditemukan.</p>;

  const unusedCount = data!.topics.filter((t) => !t.used_at).length;

  return (
    <>
      <Link href="/tools/automation" className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-violet-600 dark:text-slate-400">
        <ArrowLeft className="h-4 w-4" /> Kembali
      </Link>
      <PageHeader title={a.name} description={data!.template?.name || a.template_key} />

      {/* Control bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4">
        <button
          onClick={toggleStatus}
          disabled={busy}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${a.status === "active" ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-600 hover:bg-emerald-700"}`}
        >
          {a.status === "active" ? <><Pause className="h-4 w-4" /> Jeda</> : <><Play className="h-4 w-4" /> Aktifkan</>}
        </button>
        <button onClick={runNow} disabled={busy} className="flex items-center gap-1.5 rounded-full border border-violet-200 dark:border-violet-500/30 px-4 py-2 text-sm font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 disabled:opacity-60">
          <Play className="h-4 w-4" /> Jalankan sekarang
        </button>
        <button onClick={load} className="flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-white/10 px-4 py-2 text-sm font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
        <button onClick={() => setShowEdit((v) => !v)} className="flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-white/10 px-4 py-2 text-sm font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5">
          <Settings className="h-4 w-4" /> Pengaturan
        </button>
        <button onClick={del} className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10">
          <Trash2 className="h-4 w-4" /> Hapus
        </button>
      </div>

      {showEdit && (
        <EditPanel
          id={id}
          automation={a}
          config={data!.config || {}}
          template={data!.template}
          onSaved={() => { setShowEdit(false); load(); }}
        />
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Status" value={a.status === "active" ? "Aktif" : a.status === "paused" ? "Jeda" : "Draft"} />
        <Stat label="Jadwal" value={a.schedule_label || "—"} />
        <Stat label="Run berikutnya" value={a.status === "active" ? fmt(a.next_run_at) : "—"} />
      </div>

      {/* Topics — hanya untuk template berbasis pool topik manual */}
      {data!.template?.usesTopics !== false ? (
        <DashboardSection title={`Topik (${unusedCount} belum dipakai / ${data!.topics.length} total)`}>
          <div className="rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4">
            <textarea
              value={newTopics}
              onChange={(e) => setNewTopics(e.target.value)}
              rows={3}
              placeholder="Satu topik per baris…"
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
            />
            <button onClick={addTopics} className="mt-2 flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700">
              <Plus className="h-3.5 w-3.5" /> Tambah Topik
            </button>
            {data!.topics.length > 0 && (
              <div className="mt-4 space-y-1.5">
                {data!.topics.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-50 dark:border-white/5 px-3 py-2">
                    <span className={`truncate text-xs ${t.used_at ? "text-gray-400 line-through dark:text-slate-600" : "text-gray-700 dark:text-slate-200"}`}>{t.topic}</span>
                    <button onClick={() => delTopic(t.id)} className="shrink-0 text-gray-300 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DashboardSection>
      ) : (
        <DashboardSection title="Sumber berita">
          <div className="rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 text-sm text-gray-600 dark:text-slate-300">
            Berita diambil otomatis dari RSS feed (atur di <span className="font-medium">Pengaturan</span>).
            <span className="ml-1 text-gray-400 dark:text-slate-500">{data!.topics.length} artikel sudah pernah dibahas (anti-duplikat).</span>
          </div>
        </DashboardSection>
      )}

      {/* Run history */}
      <DashboardSection title="Riwayat Run">
        {data!.runs.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">Belum ada run.</p>
        ) : (
          <div className="space-y-2">
            {data!.runs.map((r) => {
              const logs = r.logs_json ? (() => { try { return JSON.parse(r.logs_json) as string[]; } catch { return []; } })() : [];
              return (
                <div key={r.id} className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      {RUN_ICON[r.status] || <Clock className="h-4 w-4 text-gray-400" />}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-800 dark:text-white">
                          {r.status} · {r.trigger === "manual" ? "manual" : "terjadwal"}
                        </p>
                        <p className="truncate text-xs text-gray-400 dark:text-slate-500">{fmt(r.created_at)}</p>
                      </div>
                    </div>
                    {(logs.length > 0 || r.error) && (
                      <button onClick={() => setOpenLog(openLog === r.id ? null : r.id)} className="shrink-0 text-gray-400 hover:text-violet-500">
                        <ChevronDown className={`h-4 w-4 transition-transform ${openLog === r.id ? "rotate-180" : ""}`} />
                      </button>
                    )}
                  </div>
                  {r.preview && <p className="mt-2 line-clamp-2 rounded-lg bg-gray-50 dark:bg-white/5 px-3 py-2 text-xs text-gray-600 dark:text-slate-300">{r.preview}</p>}
                  {r.error && <p className="mt-2 rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">{r.error}</p>}
                  {openLog === r.id && logs.length > 0 && (
                    <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-gray-900 px-3 py-2 text-[11px] leading-relaxed text-gray-200">{logs.join("\n")}</pre>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DashboardSection>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4">
      <p className="text-xs text-gray-400 dark:text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

const editInputCls = "w-full rounded-lg border border-gray-200 dark:border-white/10 bg-transparent px-3 py-2 text-sm";

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-300">{label}</label>
      {children}
    </div>
  );
}

function EditNum({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <label className="flex-1 text-xs text-gray-500 dark:text-slate-400">
      {label}
      <input type="number" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className={editInputCls + " mt-1"} />
    </label>
  );
}

function EditPanel({
  id, automation, config, template, onSaved,
}: {
  id: string;
  automation: Automation;
  config: AutomationConfig;
  template?: Template;
  onSaved: () => void;
}) {
  const sched = (config.schedule || { mode: "hourly", atMinute: 30 }) as ScheduleObj;
  const [name, setName] = useState(automation.name);
  const [mode, setMode] = useState<ScheduleObj["mode"]>(sched.mode);
  const [atMinute, setAtMinute] = useState("atMinute" in sched ? sched.atMinute : 30);
  const [atHour, setAtHour] = useState("atHour" in sched ? sched.atHour : 8);
  const [everyMinutes, setEveryMinutes] = useState("everyMinutes" in sched ? sched.everyMinutes : 60);
  const [times, setTimes] = useState<string[]>(
    sched.mode === "daily_times" && sched.times?.length
      ? sched.times.map((t) => `${pad2(t.hour)}:${pad2(t.minute)}`)
      : ["07:00", "12:00", "19:00"]
  );
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const f of template?.configFields || []) v[f.name] = (config[f.name] as string) || "";
    return v;
  });
  const [credRefs, setCredRefs] = useState<Record<string, string>>(() => ({ ...(config.credentials || {}) }));
  const [creds, setCreds] = useState<Credential[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    automationApi.listCredentials().then((res) => {
      if (res.success && Array.isArray(res.data)) setCreds(res.data as Credential[]);
    });
  }, []);

  const buildSchedule = (): ScheduleObj => {
    if (mode === "hourly") return { mode: "hourly", atMinute };
    if (mode === "daily") return { mode: "daily", atHour, atMinute };
    if (mode === "daily_times") return { mode: "daily_times", times: parseTimesStr(times) };
    return { mode: "interval", everyMinutes };
  };

  const save = async () => {
    if (!name.trim()) { toast.error("Nama wajib diisi"); return; }
    if (mode === "daily_times" && parseTimesStr(times).length === 0) { toast.error("Isi minimal 1 jam"); return; }
    for (const role of template?.requiredCredentials || []) {
      if (!credRefs[role.role]) { toast.error(`Pilih credential ${role.label}`); return; }
    }
    for (const f of template?.configFields || []) {
      if (f.required && !values[f.name]?.trim()) { toast.error(`${f.label} wajib diisi`); return; }
    }
    const newConfig: AutomationConfig = { ...config, schedule: buildSchedule(), credentials: credRefs, ...values };
    setSaving(true);
    const res = await automationApi.update(id, { name: name.trim(), config: newConfig });
    setSaving(false);
    if (!res.success) { toast.error(res.error || "Gagal menyimpan"); return; }
    toast.success("Pengaturan disimpan");
    onSaved();
  };

  return (
    <div className="mb-6 grid gap-4 rounded-2xl border border-violet-100 dark:border-violet-500/20 bg-violet-50/30 dark:bg-violet-500/5 p-5">
      <div className="flex items-center gap-2">
        <Settings className="h-4 w-4 text-violet-500" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Edit Pengaturan</h3>
      </div>

      <EditField label="Nama Automation">
        <input value={name} onChange={(e) => setName(e.target.value)} className={editInputCls} />
      </EditField>

      <EditField label="Jadwal (WIB)">
        <select value={mode} onChange={(e) => setMode(e.target.value as ScheduleObj["mode"])} className={editInputCls}>
          <option value="daily_times">Jam tertentu (beberapa, maks 5)</option>
          <option value="hourly">Tiap jam (pada menit tertentu)</option>
          <option value="daily">Setiap hari (satu jam)</option>
          <option value="interval">Tiap N menit</option>
        </select>
        {mode === "daily_times" ? (
          <div className="mt-2"><TimesEditorInline times={times} setTimes={setTimes} /></div>
        ) : (
          <div className="mt-2 flex gap-2">
            {mode === "hourly" && <EditNum label="Menit" value={atMinute} min={0} max={59} onChange={setAtMinute} />}
            {mode === "daily" && <>
              <EditNum label="Jam" value={atHour} min={0} max={23} onChange={setAtHour} />
              <EditNum label="Menit" value={atMinute} min={0} max={59} onChange={setAtMinute} />
            </>}
            {mode === "interval" && <EditNum label="Setiap (menit)" value={everyMinutes} min={10} max={1440} onChange={setEveryMinutes} />}
          </div>
        )}
      </EditField>

      {(template?.requiredCredentials || []).map((role) => {
        const opts = creds.filter((c) => c.type === role.type);
        return (
          <EditField key={role.role} label={`Credential — ${role.label}`}>
            {opts.length === 0 ? (
              <Link href="/tools/automation/credentials" className="flex items-center gap-1.5 text-sm text-violet-600 hover:underline">
                <KeyRound className="h-4 w-4" /> Belum ada — tambah credential dulu
              </Link>
            ) : (
              <select value={credRefs[role.role] || ""} onChange={(e) => setCredRefs((p) => ({ ...p, [role.role]: e.target.value }))} className={editInputCls}>
                <option value="">— pilih —</option>
                {opts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            )}
          </EditField>
        );
      })}

      {(template?.configFields || []).map((f) => (
        <EditField key={f.name} label={f.label + (f.required ? "" : " (opsional)")}>
          {f.type === "textarea" ? (
            <textarea rows={4} value={values[f.name] || ""} onChange={(e) => setValues((p) => ({ ...p, [f.name]: e.target.value }))} placeholder={f.placeholder} className={editInputCls} />
          ) : (
            <input value={values[f.name] || ""} onChange={(e) => setValues((p) => ({ ...p, [f.name]: e.target.value }))} placeholder={f.placeholder} className={editInputCls} />
          )}
          {f.help && <p className="mt-1 text-[11px] text-gray-400 dark:text-slate-500">{f.help}</p>}
        </EditField>
      ))}

      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-full bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
          {saving ? "Menyimpan..." : "Simpan Pengaturan"}
        </button>
      </div>
      <p className="text-[11px] text-gray-400 dark:text-slate-500">Perubahan persona berlaku untuk run berikutnya. Kalau status aktif, jadwal berikutnya dihitung ulang.</p>
    </div>
  );
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseTimesStr(arr: string[]): { hour: number; minute: number }[] {
  return arr.filter(Boolean).slice(0, 5).map((s) => {
    const [h, m] = s.split(":").map(Number);
    return { hour: h || 0, minute: m || 0 };
  });
}

function TimesEditorInline({ times, setTimes }: { times: string[]; setTimes: (t: string[]) => void }) {
  const update = (i: number, v: string) => setTimes(times.map((t, idx) => (idx === i ? v : t)));
  const remove = (i: number) => setTimes(times.filter((_, idx) => idx !== i));
  const add = () => { if (times.length < 5) setTimes([...times, "09:00"]); };
  return (
    <div className="space-y-2">
      {times.map((t, i) => (
        <div key={i} className="flex items-center gap-2">
          <input type="time" value={t} onChange={(e) => update(i, e.target.value)} className={editInputCls + " max-w-[140px]"} />
          {times.length > 1 && (
            <button type="button" onClick={() => remove(i)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      {times.length < 5 && (
        <button type="button" onClick={add} className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:underline">
          <Plus className="h-3.5 w-3.5" /> Tambah jam (maks 5)
        </button>
      )}
    </div>
  );
}
