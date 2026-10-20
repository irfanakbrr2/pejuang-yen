"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { automationApi } from "@/lib/api-client";
import { PageHeader, DashboardSection } from "@/components/ui/dashboard-chrome";
import { toast } from "@/components/ui/toast";
import { KeyRound, Trash2, Plus, ArrowLeft, ShieldCheck } from "lucide-react";

interface CredentialItem { id: string; type: string; label: string; created_at: string; }

// Spesifikasi field per tipe credential (selaras dengan templates backend).
const CRED_TYPES: Record<string, { label: string; fields: { name: string; label: string; placeholder?: string }[] }> = {
  repliz: {
    label: "Repliz API",
    fields: [
      { name: "accessKey", label: "Access Key", placeholder: "856127844..." },
      { name: "secretKey", label: "Secret Key", placeholder: "Kp5T0Xfvtd..." },
    ],
  },
  telegram: {
    label: "Telegram Bot",
    fields: [{ name: "botToken", label: "Bot Token", placeholder: "8718709143:AAF..." }],
  },
};

export default function CredentialsPage() {
  const [items, setItems] = useState<CredentialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<keyof typeof CRED_TYPES>("repliz");
  const [label, setLabel] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = () => {
    automationApi.listCredentials()
      .then((res) => { if (res.success && Array.isArray(res.data)) setItems(res.data as CredentialItem[]); })
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const submit = async () => {
    const spec = CRED_TYPES[type];
    if (!label.trim()) { toast.error("Label wajib diisi"); return; }
    for (const f of spec.fields) {
      if (!fields[f.name]?.trim()) { toast.error(`${f.label} wajib diisi`); return; }
    }
    setSaving(true);
    const res = await automationApi.createCredential({ type, label: label.trim(), fields });
    setSaving(false);
    if (!res.success) { toast.error(res.error || "Gagal menyimpan"); return; }
    toast.success("Credential tersimpan & terenkripsi");
    setLabel(""); setFields({});
    load();
  };

  const remove = async (id: string) => {
    const res = await automationApi.deleteCredential(id);
    if (!res.success) { toast.error(res.error || "Gagal menghapus"); return; }
    toast.success("Credential dihapus");
    setItems((prev) => prev.filter((c) => c.id !== id));
  };

  const spec = CRED_TYPES[type];

  return (
    <>
      <Link href="/tools/automation" className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-violet-600 dark:text-slate-400">
        <ArrowLeft className="h-4 w-4" /> Kembali ke Automation
      </Link>
      <PageHeader title="Credential Vault" description="Simpan API key (Repliz, Telegram). Terenkripsi at-rest (AES-GCM) dan tidak pernah ditampilkan kembali." />

      <DashboardSection title="Tambah Credential">
        <div className="grid gap-4 rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-5 sm:max-w-lg">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-300">Tipe</label>
            <select
              value={type}
              onChange={(e) => { setType(e.target.value as keyof typeof CRED_TYPES); setFields({}); }}
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
            >
              {Object.entries(CRED_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-300">Label</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={`Mis. ${spec.label} utama`}
              className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
            />
          </div>
          {spec.fields.map((f) => (
            <div key={f.name}>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-slate-300">{f.label}</label>
              <input
                type="password"
                value={fields[f.name] || ""}
                onChange={(e) => setFields((prev) => ({ ...prev, [f.name]: e.target.value }))}
                placeholder={f.placeholder}
                autoComplete="off"
                className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-transparent px-3 py-2 text-sm font-mono"
              />
            </div>
          ))}
          <button
            onClick={submit}
            disabled={saving}
            className="flex items-center justify-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" /> {saving ? "Menyimpan..." : "Simpan Credential"}
          </button>
          <p className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5" /> Disimpan terenkripsi. Hanya didekripsi saat automation berjalan.
          </p>
        </div>
      </DashboardSection>

      <DashboardSection title="Credential Tersimpan">
        {loading ? (
          <div className="h-16 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/5" />
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">Belum ada credential.</p>
        ) : (
          <div className="space-y-2">
            {items.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3">
                <div className="flex items-center gap-3">
                  <KeyRound className="h-4 w-4 text-violet-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{c.label}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">{CRED_TYPES[c.type]?.label || c.type}</p>
                  </div>
                </div>
                <button onClick={() => remove(c.id)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </DashboardSection>
    </>
  );
}
