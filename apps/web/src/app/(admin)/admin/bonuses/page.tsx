"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, UploadCloud, Loader2, Folder } from "lucide-react";
import { AdminTable, Tr, Td, StatusBadge } from "@/components/ui/AdminTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { BonusFilesModal } from "./_components/BonusFilesModal";
import { BonusVideosModal } from "./_components/BonusVideosModal";
import { BonusTagsModal } from "./_components/BonusTagsModal";
import { Tag } from "lucide-react";
import { CategorySelector } from "@/components/admin/CategorySelector";

interface Bonus {
  id: string;
  slug: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  external_url?: string;
  bonus_type: string;
  asset_type?: string | null;
  primary_category_id?: string | null;
  related_course_id?: string | null;
  recommended_for?: string | null;
  access_type?: string; // 'free' | 'membership_only'
  status: string;
}

const autoSlug = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const EMPTY_FORM = {
  title: "",
  slug: "",
  description: "",
  thumbnail_url: "",
  external_url: "",
  bonus_type: "content",
  asset_type: "",
  primary_category_id: null as string | null,
  secondary_category_ids: [] as string[],
  related_course_id: "",
  recommended_for: "",
  access_type: "membership_only",
  status: "active",
};

// 12 jenis aset — bentuk konten bonus, BUKAN kategori topik
const ASSET_TYPES = [
  { value: "ebook", label: "Ebook" },
  { value: "template", label: "Template" },
  { value: "checklist", label: "Checklist" },
  { value: "prompt_pack", label: "Prompt Pack" },
  { value: "sop", label: "SOP" },
  { value: "worksheet", label: "Worksheet" },
  { value: "swipe_file", label: "Swipe File" },
  { value: "source_code", label: "Source Code" },
  { value: "asset_pack", label: "Asset Pack" },
  { value: "spreadsheet", label: "Spreadsheet" },
  { value: "notion_template", label: "Notion Template" },
  { value: "pdf_resource", label: "PDF Resource" },
];

const inputClass =
  "w-full px-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors";

function BonusForm({
  form,
  courses,
  onChange,
}: {
  form: typeof EMPTY_FORM;
  courses: { id: string; title: string }[];
  onChange: (f: typeof EMPTY_FORM) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // 1. Read file as Image
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "Bonusses");

      const res = await fetch("/api/admin/storage/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      const data = await res.json();
      if (data.success) {
        onChange({ ...form, thumbnail_url: `https://pub-d56d873c4b8d4204b35361d7bea0dca8.r2.dev/${data.data.key}` });
      } else {
        alert(data.error || "Gagal mengupload gambar");
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan saat memproses gambar.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-warm-black">Judul</label>
        <input
          value={form.title}
          onChange={(e) => onChange({ ...form, title: e.target.value, slug: form.slug || autoSlug(e.target.value) })}
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-warm-black">Slug (URL)</label>
        <input
          value={form.slug}
          onChange={(e) => onChange({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-") })}
          placeholder="contoh: bonus-panduan-jlpt"
          className={inputClass}
        />
        <p className="text-xs text-[rgba(12,12,10,0.35)]">Auto-generate dari judul. Hanya huruf kecil, angka, dan tanda hubung.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-warm-black">Thumbnail URL</label>
        <div className="flex gap-2">
          <input
            value={form.thumbnail_url}
            onChange={(e) => onChange({ ...form, thumbnail_url: e.target.value })}
            placeholder="URL Gambar Thumbnail"
            className={inputClass}
          />
          <label className="flex-shrink-0 flex items-center justify-center gap-2 px-4 bg-[rgba(0,0,0,0.04)] hover:bg-[rgba(0,0,0,0.08)] border border-[rgba(0,0,0,0.1)] rounded-lg cursor-pointer transition-colors text-sm font-medium text-warm-black">
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
            {uploading ? "Uploading..." : "Upload WebP"}
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploading} />
          </label>
        </div>
        {form.thumbnail_url && (
          <div className="mt-2 relative w-32 aspect-video rounded-lg overflow-hidden border border-black/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={form.thumbnail_url} alt="Thumbnail preview" className="object-cover w-full h-full" />
          </div>
        )}
      </div>
      <CategorySelector
        primaryId={form.primary_category_id}
        secondaryIds={form.secondary_category_ids}
        onChange={(p, s) => onChange({ ...form, primary_category_id: p, secondary_category_ids: s })}
        required={form.status === "active"}
      />
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-warm-black">Jenis Aset (Bonus Type) {form.status === "active" && <span className="text-red-500">*</span>}</label>
          <select
            value={form.asset_type}
            onChange={(e) => onChange({ ...form, asset_type: e.target.value })}
            className={inputClass}
          >
            <option value="">— Pilih jenis aset —</option>
            {ASSET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-warm-black">Format Delivery</label>
          <select
            value={form.bonus_type}
            onChange={(e) => onChange({ ...form, bonus_type: e.target.value })}
            className={inputClass}
          >
            <option value="content">Single Link (Eksternal)</option>
            <option value="bundle">Bundle (Multi File)</option>
            <option value="mini_course">Mini Course (Video Playlist)</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-warm-black">Kelas Terkait <span className="text-[rgba(12,12,10,0.35)] font-normal">(opsional)</span></label>
          <select
            value={form.related_course_id}
            onChange={(e) => onChange({ ...form, related_course_id: e.target.value })}
            className={inputClass}
          >
            <option value="">— Tidak ada —</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-warm-black">Recommended For</label>
          <input
            value={form.recommended_for}
            onChange={(e) => onChange({ ...form, recommended_for: e.target.value })}
            placeholder="Pemula yang sedang belajar deployment"
            className={inputClass}
          />
        </div>
      </div>
      {form.bonus_type === 'content' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-warm-black">Resource URL</label>
          <input
            value={form.external_url}
            onChange={(e) => onChange({ ...form, external_url: e.target.value })}
            placeholder="Link Google Drive, Notion, dll"
            className={inputClass}
          />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-warm-black">Akses</label>
        <select
          value={form.access_type}
          onChange={(e) => onChange({ ...form, access_type: e.target.value })}
          className={inputClass}
        >
          <option value="membership_only">Premium (Khusus Member)</option>
          <option value="free">Free (Semua User)</option>
        </select>
        <p className="text-xs text-[rgba(12,12,10,0.5)]">
          Premium: hanya member aktif. Free: bisa diakses semua user tanpa membership.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-warm-black">Status</label>
        <select
          value={form.status}
          onChange={(e) => onChange({ ...form, status: e.target.value })}
          className={inputClass}
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
    </div>
  );
}

export default function AdminBonusesPage() {
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<Bonus | null>(null);
  const [filesTarget, setFilesTarget] = useState<Bonus | null>(null);
  const [videosTarget, setVideosTarget] = useState<Bonus | null>(null);
  const [tagsTarget, setTagsTarget] = useState<Bonus | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [bRes, cRes] = await Promise.all([
        fetch("/api/admin/bonuses", { credentials: "include" }),
        fetch("/api/admin/courses?limit=100", { credentials: "include" }),
      ]);
      const bData = await bRes.json();
      const cData = await cRes.json();
      if (bData.success) setBonuses(bData.data);
      else setError(bData.error || "Gagal memuat data bonus");
      if (cData.success) setCourses((cData.data || []).map((c: { id: string; title: string }) => ({ id: c.id, title: c.title })));
    } catch {
      setError("Gagal memuat data. Periksa koneksi internet.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditTarget(null);
    setModalMode("create");
  };

  const openEdit = (b: Bonus) => {
    setEditTarget(b);
    setForm({
      title: b.title,
      slug: b.slug || autoSlug(b.title),
      description: b.description || "",
      thumbnail_url: b.thumbnail_url || "",
      external_url: b.external_url || "",
      bonus_type: b.bonus_type || "content",
      asset_type: b.asset_type || "",
      primary_category_id: b.primary_category_id || null,
      secondary_category_ids: [],
      related_course_id: b.related_course_id || "",
      recommended_for: b.recommended_for || "",
      access_type: b.access_type || "membership_only",
      status: b.status,
    });
    setModalMode("edit");
  };

  const openManageFiles = (b: Bonus) => {
    setFilesTarget(b);
  };

  const handleSave = async () => {
    if (form.status === "active") {
      if (!form.primary_category_id) { alert("Bonus aktif wajib punya kategori utama"); return; }
      if (!form.asset_type) { alert("Bonus aktif wajib punya jenis aset (Bonus Type)"); return; }
    }
    setSaving(true);
    try {
      const isEdit = modalMode === "edit" && editTarget;
      const res = await fetch(
        isEdit ? `/api/admin/bonuses/${editTarget!.id}` : "/api/admin/bonuses",
        {
          method: isEdit ? "PUT" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            asset_type: form.asset_type || null,
            related_course_id: form.related_course_id || null,
            recommended_for: form.recommended_for || null,
            access_type: form.access_type || "membership_only",
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        setModalMode(null);
        fetchData();
      } else {
        alert(data.error || "Gagal menyimpan");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus bonus ini?")) return;
    await fetch(`/api/admin/bonuses/${id}`, { method: "DELETE", credentials: "include" });
    fetchData();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Konten"
        title="Kelola Bonus"
        description="Atur bonus khusus untuk member"
        actions={
        <Button onClick={openCreate}>
          <Plus size={15} />
          Tambah Bonus
        </Button>
        }
      />

      {error && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-sm text-red-500">{error}</p>
          <button onClick={fetchData} className="text-xs font-medium text-primary hover:underline">Coba Lagi</button>
        </div>
      )}

      {!error && (
        <AdminTable
          columns={[
            { key: "title", label: "Judul Bonus" },
            { key: "plan", label: "Akses" },
            { key: "status", label: "Status" },
            { key: "action", label: "Aksi" },
          ]}
          loading={loading}
          empty={<div className="text-center py-10 text-[rgba(12,12,10,0.35)] text-sm">Belum ada bonus</div>}
        >
          {bonuses.map((b) => (
            <Tr key={b.id}>
              <Td className="font-medium text-warm-black">{b.title}</Td>
              <Td className="text-[rgba(12,12,10,0.65)]">
                {b.access_type === "free" ? "Free (Semua)" : "Premium"}
              </Td>
              <Td><StatusBadge status={b.status} /></Td>
              <Td>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openEdit(b)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-warm-black bg-[rgba(0,0,0,0.06)] rounded-lg hover:bg-[rgba(0,0,0,0.1)] transition-colors"
                  >
                    <Pencil size={12} />
                    Edit
                  </button>
                  <button
                    onClick={() => setTagsTarget(b)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                  >
                    <Tag size={12} />
                    Tags
                  </button>
                  {b.bonus_type === 'bundle' && (
                    <button
                      onClick={() => openManageFiles(b)}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <Folder size={12} />
                      Kelola Files
                    </button>
                  )}
                  {b.bonus_type === 'mini_course' && (
                    <button
                      onClick={() => setVideosTarget(b)}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors"
                    >
                      <Folder size={12} />
                      Kelola Videos
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(b.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    <Trash2 size={12} />
                    Hapus
                  </button>
                </div>
              </Td>
            </Tr>
          ))}
        </AdminTable>
      )}

      <Dialog open={!!modalMode} onOpenChange={(open) => { if (!open) setModalMode(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{modalMode === "edit" ? "Edit Bonus" : "Tambah Bonus"}</DialogTitle>
          </DialogHeader>
          <BonusForm form={form} courses={courses} onChange={setForm} />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setModalMode(null)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving || !form.title}>
              {saving ? "Menyimpan..." : "Simpan Bonus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BonusFilesModal
        bonusId={filesTarget?.id || null}
        open={!!filesTarget}
        onClose={() => setFilesTarget(null)}
      />

      <BonusVideosModal
        bonusId={videosTarget?.id || null}
        open={!!videosTarget}
        onClose={() => setVideosTarget(null)}
      />

      <BonusTagsModal
        bonusId={tagsTarget?.id || null}
        open={!!tagsTarget}
        onClose={() => setTagsTarget(null)}
      />
    </div>
  );
}
