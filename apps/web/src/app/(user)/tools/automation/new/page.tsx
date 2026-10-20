"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { automationApi } from "@/lib/api-client";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { toast } from "@/components/ui/toast";
import { ArrowLeft, Sparkles, KeyRound, Plus, X } from "lucide-react";

interface CredField { name: string; label: string; secret?: boolean; placeholder?: string; }
interface CredRole { role: string; type: string; label: string; fields: CredField[]; }
interface ConfigField { name: string; label: string; type: "text" | "textarea" | "number"; required?: boolean; placeholder?: string; help?: string; }
interface Template {
  key: string; name: string; description: string; credits_per_use: number;
  usesTopics?: boolean;
  requiredCredentials: CredRole[]; configFields: ConfigField[];
}
interface Credential { id: string; type: string; label: string; }

type ScheduleMode = "hourly" | "daily" | "daily_times" | "interval";

export default function NewAutomationPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [templateKey, setTemplateKey] = useState("");
  const [name, setName] = useState("");
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>("hourly");
  const [atMinute, setAtMinute] = useState(30);
  const [atHour, setAtHour] = useState(8);
  const [everyMinutes, setEveryMinutes] = useState(60);
  const [times, setTimes] = useState<string[]>(["07:00", "12:00", "19:00"]);
  const [credRefs, setCredRefs] = useState<Record<string, string>>({});
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [topics, setTopics] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    automationApi.templates().then((res) => {
      if (res.success && Array.isArray(res.data)) {
        const list = res.data as Template[];
        setTemplates(list);
        if (list[0]) { setTemplateKey(list[0].key); setName(list[0].name); }
      }
    });
    automationApi.listCredentials().then((res) => {
      if (res.success && Array.isArray(res.data)) setCredentials(res.data as Credential[]);
    });
  }, []);

  const template = useMemo(() => templates.find((t) => t.key === templateKey), [templates, templateKey]);

  const buildSchedule = () => {
    if (scheduleMode === "hourly") return { mode: "hourly", atMinute };
    if (scheduleMode === "daily") return { mode: "daily", atHour, atMinute };
    if (scheduleMode === "daily_times") return { mode: "daily_times", times: parseTimes(times) };
    return { mode: "interval", everyMinutes };
  };

  const submit = async () => {
    if (!template) return;
    if (!name.trim()) { toast.error("Nama wajib diisi"); return; }
    if (scheduleMode === "daily_times" && parseTimes(times).length === 0) { toast.error("Isi minimal 1 jam"); return; }
    for (const role of template.requiredCredentials) {
      if (!credRefs[role.role]) { toast.error(`Pilih credential ${role.label}`); return; }
    }
    for (const f of template.configFields) {
      if (f.required && !configValues[f.name]?.trim()) { toast.error(`${f.label} wajib diisi`); return; }
    }
    const topicList = topics.split("\n").map((t) => t.trim()).filter(Boolean);

    const config: Record<string, unknown> = {
      schedule: buildSchedule(),
      credentials: credRefs,
      ...configValues,
    };

    setSaving(true);
    const res = await automationApi.create({ templateKey, name: name.trim(), config, topics: topicList });
    setSaving(false);
    if (!res.success) { toast.error(res.error || "Gagal membuat automation"); return; }
    toast.success("Automation dibuat. Aktifkan dari halaman detail.");
    const id = (res.data as { id: string }).id;
    router.push(`/tools/automation/${id}`);
  };

  const credsForType = (type: string) => credentials.filter((c) => c.type === type);

  return (
    <>
      <Link href="/tools/automation" className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-violet-600 dark:text-slate-400">
        <ArrowLeft className="h-4 w-4" /> Kembali
      </Link>
      <PageHeader title="Buat Automation" description="Pilih template, atur jadwal & credential, isi topik. Aktifkan setelah dibuat." />

      <div className="grid max-w-2xl gap-5">
        {/* Template */}
        <Field label="Template">
          <select value={templateKey} onChange={(e) => { setTemplateKey(e.target.value); const t = templates.find((x) => x.key === e.target.value); if (t) setName(t.name); }} className={inputCls}>
            {templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
          </select>
          {template && <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{template.description}</p>}
        </Field>

        <Field label="Nama Automation">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Mis. Thread harian @irfanakbrr" />
        </Field>

        {/* Schedule */}
        <Field label="Jadwal (WIB)">
          <select value={scheduleMode} onChange={(e) => setScheduleMode(e.target.value as ScheduleMode)} className={inputCls}>
            <option value="daily_times">Jam tertentu (beberapa, maks 5)</option>
            <option value="hourly">Tiap jam (pada menit tertentu)</option>
            <option value="daily">Setiap hari (satu jam)</option>
            <option value="interval">Tiap N menit</option>
          </select>
          {scheduleMode === "daily_times" ? (
            <div className="mt-2"><TimesEditor times={times} setTimes={setTimes} /></div>
          ) : (
            <div className="mt-2 flex gap-2">
              {scheduleMode === "hourly" && (
                <NumIn label="Menit" value={atMinute} min={0} max={59} onChange={setAtMinute} />
              )}
              {scheduleMode === "daily" && (
                <>
                  <NumIn label="Jam" value={atHour} min={0} max={23} onChange={setAtHour} />
                  <NumIn label="Menit" value={atMinute} min={0} max={59} onChange={setAtMinute} />
                </>
              )}
              {scheduleMode === "interval" && (
                <NumIn label="Setiap (menit)" value={everyMinutes} min={10} max={1440} onChange={setEveryMinutes} />
              )}
            </div>
          )}
          <p className="mt-1 text-[11px] text-gray-400 dark:text-slate-500">Granularitas cek = 10 menit (pilih menit kelipatan 10 untuk presisi penuh).</p>
        </Field>

        {/* Credentials */}
        {template?.requiredCredentials.map((role) => {
          const opts = credsForType(role.type);
          return (
            <Field key={role.role} label={`Credential — ${role.label}`}>
              {opts.length === 0 ? (
                <Link href="/tools/automation/credentials" className="flex items-center gap-1.5 text-sm text-violet-600 hover:underline">
                  <KeyRound className="h-4 w-4" /> Belum ada — tambah credential dulu
                </Link>
              ) : (
                <select value={credRefs[role.role] || ""} onChange={(e) => setCredRefs((p) => ({ ...p, [role.role]: e.target.value }))} className={inputCls}>
                  <option value="">— pilih —</option>
                  {opts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              )}
            </Field>
          );
        })}

        {/* Config fields */}
        {template?.configFields.map((f) => (
          <Field key={f.name} label={f.label + (f.required ? "" : " (opsional)")}>
            {f.type === "textarea" ? (
              <textarea rows={4} value={configValues[f.name] || ""} onChange={(e) => setConfigValues((p) => ({ ...p, [f.name]: e.target.value }))} placeholder={f.placeholder} className={inputCls} />
            ) : (
              <input value={configValues[f.name] || ""} onChange={(e) => setConfigValues((p) => ({ ...p, [f.name]: e.target.value }))} placeholder={f.placeholder} className={inputCls} />
            )}
            {f.help && <p className="mt-1 text-[11px] text-gray-400 dark:text-slate-500">{f.help}</p>}
          </Field>
        ))}

        {/* Topics — hanya untuk template berbasis pool topik */}
        {template?.usesTopics !== false && (
          <Field label="Daftar Topik (satu per baris)">
            <textarea rows={5} value={topics} onChange={(e) => setTopics(e.target.value)} placeholder={"Cara pakai AI buat hemat waktu kerja\nKesalahan finansial anak muda\n..."} className={inputCls} />
          </Field>
        )}

        <button onClick={submit} disabled={saving || !template} className="flex items-center justify-center gap-1.5 rounded-full bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60">
          <Sparkles className="h-4 w-4" /> {saving ? "Membuat..." : "Buat Automation"}
        </button>
      </div>
    </>
  );
}

const inputCls = "w-full rounded-lg border border-gray-200 dark:border-white/10 bg-transparent px-3 py-2 text-sm";

export function parseTimes(arr: string[]): { hour: number; minute: number }[] {
  return arr.filter(Boolean).slice(0, 5).map((s) => {
    const [h, m] = s.split(":").map(Number);
    return { hour: h || 0, minute: m || 0 };
  });
}

export function TimesEditor({ times, setTimes }: { times: string[]; setTimes: (t: string[]) => void }) {
  const update = (i: number, v: string) => setTimes(times.map((t, idx) => (idx === i ? v : t)));
  const remove = (i: number) => setTimes(times.filter((_, idx) => idx !== i));
  const add = () => { if (times.length < 5) setTimes([...times, "09:00"]); };
  return (
    <div className="space-y-2">
      {times.map((t, i) => (
        <div key={i} className="flex items-center gap-2">
          <input type="time" value={t} onChange={(e) => update(i, e.target.value)} className={inputCls + " max-w-[140px]"} />
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-300">{label}</label>
      {children}
    </div>
  );
}

function NumIn({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return (
    <label className="flex-1 text-xs text-gray-500 dark:text-slate-400">
      {label}
      <input type="number" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className={inputCls + " mt-1"} />
    </label>
  );
}
