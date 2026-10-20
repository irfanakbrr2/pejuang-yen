"use client";

import { useEffect, useState, Suspense } from "react";
import { PlayCircle, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { AdminTable, StatusBadge, Td, Tr } from "@/components/ui/AdminTable";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { toast } from "@/components/ui/toast";
import { AIFieldButton } from "@/components/ui/AIFieldButton";
import { AIBundleButton } from "@/components/ui/AIBundleButton";
import { SkillTagPicker } from "@/components/admin/SkillTagPicker";
import { Pagination } from "@/components/ui/Pagination";

interface Recording {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  status: string;
  thumbnail_url?: string | null;
  recording_embed_url?: string | null;
  body_html?: string | null;
  category?: string | null;
  format?: string | null;
  tags?: string | null;
  sort_order?: number;
  recorded_at: string;
}

const EMPTY_FORM = {
  title: "",
  slug: "",
  subtitle: "",
  thumbnail_url: "",
  recording_embed_url: "",
  status: "public",
  category: "",
  format: "",
  tags: "",
  body_html: "",
  sort_order: "0",
  recorded_at: new Date().toISOString().slice(0, 16),
};

const inputClass =
  "w-full px-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors";

function autoSlug(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function validationDetailMessage(details: unknown): string {
  if (!Array.isArray(details)) return "";
  return details
    .map((item) => {
      const record = item as { path?: unknown[]; message?: string };
      const path = Array.isArray(record.path) ? record.path.join(".") : "field";
      return `${path}: ${record.message || "tidak valid"}`;
    })
    .filter(Boolean)
    .slice(0, 3)
    .join(" · ");
}

function AdminRecordingsContent() {
  const [page, setPage] = useState(1);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [saving, setSaving] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<Recording | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: "20" });
    const res = await fetch(`/api/admin/recordings?${p}`, { credentials: "include" });
    const data = await res.json();
    if (data.success) {
      setRecordings(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } else {
      toast.error(data.error || "Gagal memuat rekaman");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [page]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditTarget(null);
    setModalMode("create");
  };

  const openEdit = (rec: Recording) => {
    setEditTarget(rec);
    setForm({
      ...EMPTY_FORM,
      title: rec.title || "",
      slug: rec.slug || "",
      subtitle: rec.subtitle || "",
      thumbnail_url: rec.thumbnail_url || "",
      recording_embed_url: rec.recording_embed_url || "",
      status: rec.status || "public",
      category: rec.category || "",
      format: rec.format || "",
      tags: rec.tags || "",
      body_html: rec.body_html || "",
      sort_order: String(rec.sort_order || 0),
      recorded_at: rec.recorded_at ? rec.recorded_at.slice(0, 16) : new Date().toISOString().slice(0, 16),
    });
    setModalMode("edit");
  };

  const save = async () => {
    if (!form.title.trim() || !form.slug.trim() || !form.recording_embed_url?.trim()) {
      toast.error("Judul, slug, dan Link YouTube wajib diisi");
      return;
    }

    setSaving(true);
    const payload = {
      ...form,
      recorded_at: new Date(form.recorded_at).toISOString(),
      sort_order: Number(form.sort_order || 0),
    };

    const isEdit = modalMode === "edit" && editTarget;
    const res = await fetch(isEdit ? `/api/admin/recordings/${editTarget!.id}` : "/api/admin/recordings", {
      method: isEdit ? "PUT" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success) {
      toast.success(isEdit ? "Rekaman diperbarui" : "Rekaman ditambahkan");
      setModalMode(null);
      await load();
    } else {
      const details = validationDetailMessage(data.details);
      toast.error(details || data.error || "Gagal menyimpan rekaman");
    }
    setSaving(false);
  };

  const aiContext = {
    title: form.title,
    status: form.status,
  };

  const remove = async (rec: Recording) => {
    if (!confirm(`Hapus/arsipkan rekaman "${rec.title}"?`)) return;
    const res = await fetch(`/api/admin/recordings/${rec.id}`, { method: "DELETE", credentials: "include" });
    const data = await res.json();
    if (data.success) {
      toast.success(data.data?.message || "Rekaman dihapus");
      load();
    } else {
      toast.error(data.error || "Gagal menghapus rekaman");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Konten"
        title="Rekaman Webinar (VOD)"
        description="Kelola video rekaman (VOD) yang tampil di halaman direktori Rekaman Zoom user."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Tambah Rekaman
          </Button>
        }
      />

      <AdminTable
        columns={[
          { key: "title", label: "Video" },
          { key: "category", label: "Kategori" },
          { key: "status", label: "Akses" },
          { key: "actions", label: "Aksi" },
        ]}
        loading={loading}
        empty={<div className="py-10 text-center text-sm text-gray-500">Belum ada rekaman zoom</div>}
      >
        {recordings.map((rec) => (
          <Tr key={rec.id}>
            <Td>
              <div className="flex items-center gap-3">
                {rec.thumbnail_url ? (
                  <img src={rec.thumbnail_url} alt="thumb" className="h-10 w-16 rounded-md object-cover bg-gray-100" />
                ) : (
                  <div className="flex h-10 w-16 items-center justify-center rounded-md bg-gray-100">
                    <PlayCircle className="h-5 w-5 text-gray-400" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-warm-black line-clamp-1">{rec.title}</p>
                  <p className="font-mono text-xs text-gray-400">/rekaman-zoom/{rec.slug}</p>
                </div>
              </div>
            </Td>
            <Td>
              <span className="text-sm font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-md">
                {rec.category || "-"}
              </span>
            </Td>
            <Td>
              <StatusBadge status={rec.status === "membership_only" ? "premium" : "free"} />
            </Td>
            <Td>
              <div className="flex gap-1.5">
                <button onClick={() => openEdit(rec)} className="inline-flex items-center gap-1 rounded-md bg-warm-cream px-2.5 py-1 text-xs font-semibold text-warm-black hover:bg-[#F2EFEA]">
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button onClick={() => remove(rec)} className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100">
                  <Trash2 className="h-3.5 w-3.5" />
                  Hapus
                </button>
              </div>
            </Td>
          </Tr>
        ))}
      </AdminTable>

      {totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      <Dialog open={!!modalMode} onOpenChange={(open) => { if (!open) setModalMode(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{modalMode === "edit" ? "Edit Rekaman" : "Tambah Rekaman Baru"}</DialogTitle>
            <AIBundleButton
              label="Generate SEO Copy"
              entityType="webinar"
              fields={["title", "subtitle", "body_html"]}
              context={aiContext}
              disabled={!form.title.trim()}
              onFill={(fields) => setForm((f) => ({ ...f, ...fields }))}
            />
          </DialogHeader>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5 text-sm font-medium md:col-span-2">
                <div className="flex items-center gap-2">
                  <span>Judul Rekaman</span>
                  <AIFieldButton
                    field="title"
                    fieldName="Judul"
                    entityType="webinar"
                    context={aiContext}
                    onFill={(content) => setForm((f) => ({ ...f, title: content, slug: f.slug || autoSlug(content) }))}
                  />
                </div>
                <input className={inputClass} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value, slug: f.slug || autoSlug(e.target.value) }))} placeholder="Misal: Tips Lolos Wawancara Kerja di Jepang" />
              </div>
              
              <label className="space-y-1.5 text-sm font-medium">Slug SEO
                <input className={inputClass} value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: autoSlug(e.target.value) }))} />
              </label>
              
              <label className="space-y-1.5 text-sm font-medium">Hak Akses (Free/Premium)
                <select className={inputClass} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="public">Gratis (Public)</option>
                  <option value="membership_only">Premium (Membership Only)</option>
                  <option value="hidden">Disembunyikan (Hidden)</option>
                </select>
              </label>

              <label className="space-y-1.5 text-sm font-medium md:col-span-2">Link YouTube / Embed URL
                <input className={inputClass} value={form.recording_embed_url} onChange={(e) => setForm((f) => ({ ...f, recording_embed_url: e.target.value }))} placeholder="Misal: https://www.youtube.com/embed/..." />
              </label>

              <label className="space-y-1.5 text-sm font-medium md:col-span-2">Thumbnail URL
                <input className={inputClass} value={form.thumbnail_url} onChange={(e) => setForm((f) => ({ ...f, thumbnail_url: e.target.value }))} placeholder="https://..." />
              </label>

              <label className="space-y-1.5 text-sm font-medium">Kategori
                <input className={inputClass} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Misal: Content Creation" />
              </label>
              <label className="space-y-1.5 text-sm font-medium">Tags
                <input className={inputClass} value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="Misal: jlpt, wawancara" />
              </label>
            </div>

            <div className="space-y-1.5 text-sm font-medium">
              <div className="flex items-center gap-2">
                <span>Deskripsi Singkat (Subtitle)</span>
              </div>
              <textarea className={inputClass} rows={2} value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} />
            </div>

            <div className="space-y-1.5 text-sm font-medium">
              <div className="flex items-center gap-2">
                <span>Deskripsi Lengkap (HTML)</span>
              </div>
              <textarea className={`${inputClass} font-mono`} rows={5} value={form.body_html} onChange={(e) => setForm((f) => ({ ...f, body_html: e.target.value }))} />
            </div>

            {modalMode === "edit" && editTarget && (
              <SkillTagPicker contentId={`recording:${editTarget.id}`} />
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setModalMode(null)}>Batal</Button>
            <Button onClick={save} loading={saving}>Simpan Rekaman</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminRecordingsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-[400px] bg-gray-100 rounded-xl animate-pulse" />
      </div>
    }>
      <AdminRecordingsContent />
    </Suspense>
  );
}
