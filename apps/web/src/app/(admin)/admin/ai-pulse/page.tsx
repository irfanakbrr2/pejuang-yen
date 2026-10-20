"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { aiPulseAdminApi } from "@/lib/api-client";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { Card, CardContent } from "@/components/ui/card";
import { AdminTable, Tr, Td } from "@/components/ui/AdminTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/Pagination";
import { toast } from "@/components/ui/toast";
import { Radar, RefreshCw, Send, Sparkles, Archive } from "lucide-react";

const STATUS_TABS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
] as const;

const IMPACT_OPTS = ["major", "update", "breaking"];
const CATEGORY_OPTS: { id: string; label: string }[] = [
  { id: "", label: "—" },
  { id: "cat_01", label: "AI Fundamentals & Prompting" },
  { id: "cat_02", label: "Vibecoding & Web Dev" },
  { id: "cat_03", label: "Vibe Design & Visual" },
  { id: "cat_04", label: "Marketing, Sales & Growth" },
  { id: "cat_05", label: "AI Automation & Workflow" },
  { id: "cat_06", label: "Content & Personal Branding" },
  { id: "cat_07", label: "Business & Monetization" },
  { id: "cat_08", label: "Career, Freelance & Portfolio" },
  { id: "cat_09", label: "Productivity & Learning" },
];

interface AdminItem {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  why_it_matters: string | null;
  who_should_use: string | null;
  business_insight: string | null;
  use_cases: string[];
  faq: { q: string; a: string }[];
  tags: string[];
  impact_level: string;
  primary_category_id: string | null;
  featured: boolean;
  related_course_ids: string[];
  related_bonus_ids: string[];
  related_automation_template_keys: string[];
  source_name: string | null;
  source_url: string | null;
  status: string;
  view_count: number;
}

const COLUMNS = [
  { key: "title", label: "Judul" },
  { key: "source", label: "Sumber" },
  { key: "impact", label: "Impact" },
  { key: "status", label: "Status" },
  { key: "actions", label: "", className: "text-right" },
];

const IMPACT_BADGE: Record<string, string> = {
  major: "bg-emerald-50 text-emerald-700 border-emerald-200",
  update: "bg-amber-50 text-amber-700 border-amber-200",
  breaking: "bg-red-50 text-red-700 border-red-200",
};

export default function AdminAiPulsePage() {
  const [status, setStatus] = useState<string>("published");
  const [items, setItems] = useState<AdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [editing, setEditing] = useState<AdminItem | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await aiPulseAdminApi.list(status, page);
    if (res.success) {
      setItems((res.data as AdminItem[]) ?? []);
      setTotalPages((res as any).pagination?.totalPages ?? 1);
    }
    setLoading(false);
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  const runIngest = async () => {
    setBusy(true);
    toast.info("Menjalankan ingestion...");
    const res = await aiPulseAdminApi.ingest();
    setBusy(false);
    if (res.success) {
      const s = res.data as { inserted: number; skippedDuplicate: number; failed: number };
      toast.success(`Ingest selesai: ${s.inserted} baru, ${s.skippedDuplicate} duplikat, ${s.failed} gagal`);
      load();
    } else {
      toast.error(res.error || "Ingestion gagal");
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="AI Pulse"
        title="Review Queue"
        description="Curate draft hasil AI sebelum publish. Ingestion harian otomatis; bisa juga trigger manual."
        actions={
          <Button onClick={runIngest} loading={busy} variant="secondary">
            <RefreshCw className="mr-1.5 h-4 w-4" /> Ingest sekarang
          </Button>
        }
      />

      <div className="flex gap-1.5">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => { setStatus(t.value); setPage(1); }}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              status === t.value ? "bg-[#8B1414] text-white" : "bg-white text-[#6B7280] hover:bg-gray-50 border border-[rgba(0,0,0,0.08)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <AdminTable
            columns={COLUMNS}
            loading={loading}
            empty={
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Radar className="h-8 w-8 text-gray-300" />
                <p className="text-sm text-gray-500">Tidak ada item di status ini.</p>
              </div>
            }
          >
            {items.map((it) => (
              <Tr key={it.id}>
                <Td>
                  <div className="max-w-md">
                    <div className="truncate font-semibold text-[#111827]">{it.title}</div>
                    <div className="truncate text-xs text-gray-400">{it.summary || "(belum ada ringkasan)"}</div>
                  </div>
                </Td>
                <Td><span className="text-xs text-gray-500">{it.source_name || "—"}</span></Td>
                <Td>
                  <span className={`inline-block rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ${IMPACT_BADGE[it.impact_level] || ""}`}>
                    {it.impact_level}
                  </span>
                </Td>
                <Td><span className="text-xs capitalize text-gray-500">{it.status}</span></Td>
                <Td className="text-right">
                  <Button size="sm" variant="outline" onClick={() => setEditing(it)}>Review</Button>
                </Td>
              </Tr>
            ))}
          </AdminTable>
        </CardContent>
      </Card>

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />

      {editing ? (
        <ReviewDialog
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      ) : null}
    </div>
  );
}

function ReviewDialog({ item, onClose, onSaved }: { item: AdminItem; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: item.title,
    summary: item.summary ?? "",
    why_it_matters: item.why_it_matters ?? "",
    who_should_use: item.who_should_use ?? "",
    business_insight: item.business_insight ?? "",
    use_cases: item.use_cases.join("\n"),
    tags: item.tags.join(", "),
    impact_level: item.impact_level,
    primary_category_id: item.primary_category_id ?? "",
    featured: item.featured,
    related_course_ids: item.related_course_ids.join(", "),
    related_bonus_ids: item.related_bonus_ids.join(", "),
    related_automation_template_keys: item.related_automation_template_keys.join(", "),
  });
  const [saving, setSaving] = useState(false);
  const [regen, setRegen] = useState(false);

  const splitLines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
  const splitCsv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

  const payload = () => ({
    title: form.title,
    summary: form.summary,
    why_it_matters: form.why_it_matters,
    who_should_use: form.who_should_use,
    business_insight: form.business_insight,
    use_cases: splitLines(form.use_cases),
    tags: splitCsv(form.tags),
    impact_level: form.impact_level,
    primary_category_id: form.primary_category_id || null,
    featured: form.featured,
    related_course_ids: splitCsv(form.related_course_ids),
    related_bonus_ids: splitCsv(form.related_bonus_ids),
    related_automation_template_keys: splitCsv(form.related_automation_template_keys),
  });

  const save = async (thenPublish: boolean) => {
    setSaving(true);
    const res = await aiPulseAdminApi.update(item.id, payload());
    if (!res.success) { setSaving(false); toast.error(res.error || "Gagal menyimpan"); return; }
    if (thenPublish) {
      const pub = await aiPulseAdminApi.publish(item.id);
      setSaving(false);
      if (!pub.success) { toast.error(pub.error || "Gagal publish"); return; }
      toast.success("Item dipublish");
    } else {
      setSaving(false);
      toast.success("Tersimpan");
    }
    onSaved();
  };

  const regenerate = async () => {
    setRegen(true);
    const res = await aiPulseAdminApi.regenerate(item.id);
    setRegen(false);
    if (res.success && res.data) {
      const d = res.data as AdminItem;
      setForm((f) => ({
        ...f,
        summary: d.summary ?? "",
        why_it_matters: d.why_it_matters ?? "",
        who_should_use: d.who_should_use ?? "",
        business_insight: d.business_insight ?? "",
        use_cases: d.use_cases.join("\n"),
        tags: d.tags.join(", "),
        impact_level: d.impact_level,
        primary_category_id: d.primary_category_id ?? f.primary_category_id,
      }));
      toast.success("Learning package digenerate ulang");
    } else {
      toast.error(res.error || "Regenerasi gagal");
    }
  };

  const archive = async () => {
    const res = await aiPulseAdminApi.archive(item.id);
    if (res.success) { toast.success("Diarsipkan"); onSaved(); }
    else toast.error(res.error || "Gagal");
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Intel</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <Field label="Judul">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Ringkasan">
            <TextArea value={form.summary} onChange={(v) => setForm({ ...form, summary: v })} rows={3} />
          </Field>
          <Field label="Kenapa penting">
            <TextArea value={form.why_it_matters} onChange={(v) => setForm({ ...form, why_it_matters: v })} rows={2} />
          </Field>
          <Field label="Siapa yang cocok">
            <TextArea value={form.who_should_use} onChange={(v) => setForm({ ...form, who_should_use: v })} rows={2} />
          </Field>
          <Field label="Use cases (satu per baris)">
            <TextArea value={form.use_cases} onChange={(v) => setForm({ ...form, use_cases: v })} rows={4} />
          </Field>
          <Field label="Insight bisnis">
            <TextArea value={form.business_insight} onChange={(v) => setForm({ ...form, business_insight: v })} rows={2} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Impact">
              <Select value={form.impact_level} onChange={(v) => setForm({ ...form, impact_level: v })} options={IMPACT_OPTS.map((o) => ({ id: o, label: o }))} />
            </Field>
            <Field label="Kategori">
              <Select value={form.primary_category_id} onChange={(v) => setForm({ ...form, primary_category_id: v })} options={CATEGORY_OPTS} />
            </Field>
          </div>

          <Field label="Tags (pisah koma)">
            <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          </Field>
          <Field label="Related Course IDs (koma)">
            <Input value={form.related_course_ids} onChange={(e) => setForm({ ...form, related_course_ids: e.target.value })} />
          </Field>
          <Field label="Related Bonus IDs (koma)">
            <Input value={form.related_bonus_ids} onChange={(e) => setForm({ ...form, related_bonus_ids: e.target.value })} />
          </Field>
          <Field label="Automation template keys (koma)">
            <Input value={form.related_automation_template_keys} onChange={(e) => setForm({ ...form, related_automation_template_keys: e.target.value })} />
          </Field>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-[#374151]">
            <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} className="h-4 w-4 rounded" />
            Tandai sebagai Featured
          </label>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="ghost" onClick={regenerate} loading={regen}><Sparkles className="mr-1.5 h-4 w-4" /> Regenerate AI</Button>
          {item.status !== "archived" ? (
            <Button variant="ghost" onClick={archive}><Archive className="mr-1.5 h-4 w-4" /> Arsipkan</Button>
          ) : null}
          <div className="flex-1" />
          <Button variant="secondary" onClick={() => save(false)} loading={saving}>Simpan</Button>
          {item.status !== "published" ? (
            <Button variant="primary" onClick={() => save(true)} loading={saving}><Send className="mr-1.5 h-4 w-4" /> Publish</Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-[#6B7280]">{label}</label>
      {children}
    </div>
  );
}

function TextArea({ value, onChange, rows = 3 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className="w-full resize-y rounded-lg border border-[rgba(0,0,0,0.12)] bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#8B1414] focus:ring-2 focus:ring-[#8B1414]/20"
    />
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { id: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-lg border border-[rgba(0,0,0,0.12)] bg-white px-2 text-sm text-[#111827] outline-none focus:border-[#8B1414] focus:ring-2 focus:ring-[#8B1414]/20"
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>{o.label}</option>
      ))}
    </select>
  );
}
