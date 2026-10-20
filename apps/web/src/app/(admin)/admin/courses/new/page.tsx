"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { AIFieldButton } from "@/components/ui/AIFieldButton";
import { AIBundleButton } from "@/components/ui/AIBundleButton";
import { CategorySelector } from "@/components/admin/CategorySelector";

const inputClass = "w-full px-3.5 py-2.5 text-sm rounded-xl border border-[rgba(12,12,10,0.12)] text-warm-black outline-none focus:border-primary focus:ring-2 focus:ring-primary-light transition-colors";

export default function AdminNewCoursePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", slug: "", subtitle: "", description: "", short_description: "",
    thumbnail_url: "",
    level: "beginner", category: "", instructor_name: "PejuangYen Team",
    access_type: "paid", price: 0, compare_at_price: 0, status: "draft", sort_order: 0,
    learning_outcome: "", recommended_for: "", duration_minutes: 0,
  });
  const [primaryCategoryId, setPrimaryCategoryId] = useState<string | null>(null);
  const [secondaryCategoryIds, setSecondaryCategoryIds] = useState<string[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: name === "price" || name === "compare_at_price" || name === "sort_order" ? parseInt(value) || 0 : value }));
  };

  const autoSlug = () => {
    setForm(f => ({ ...f, slug: f.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }));
  };

  const [uploadingCover, setUploadingCover] = useState(false);
  const uploadCover = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("File harus berupa gambar"); return; }
    setUploadingCover(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "Kelas");
      const up = await fetch("/api/admin/storage/upload", { method: "POST", credentials: "include", body: fd });
      const data = await up.json();
      if (!data.success) { toast.error(data.error || "Upload gagal"); return; }
      setForm(f => ({ ...f, thumbnail_url: `https://file.pejuangyen.com/${data.data.key}` }));
      toast.success("Sampul terunggah");
    } catch { toast.error("Upload gagal. Coba lagi."); } finally { setUploadingCover(false); }
  };

  const aiContext = {
    title: form.title,
    category: form.category,
    level: form.level,
    access_type: form.access_type,
    instructor_name: form.instructor_name,
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.status === "published" && !primaryCategoryId) {
      toast.error("Kelas tidak bisa dipublish tanpa kategori utama");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/courses", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          thumbnail_url: form.thumbnail_url.trim() || undefined,
          subtitle: form.subtitle.trim() || undefined,
          duration_minutes: Number(form.duration_minutes) || null,
          primary_category_id: primaryCategoryId,
          secondary_category_ids: secondaryCategoryIds,
        }),
      });
      const data = await res.json();
      if (!data.success) { toast.error(data.error || "Gagal menyimpan"); return; }
      router.push("/admin/courses");
    } catch { toast.error("Terjadi kesalahan. Coba lagi."); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="mb-3"
        >
          <ArrowLeft size={14} />
          Kembali
        </Button>
        <PageHeader title="Tambah Kelas Baru" description="Buat kelas baru untuk platform PejuangYen" />
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl">
        {/* Informasi Dasar */}
        <Card className="mb-5">
          <CardHeader>
            <CardTitle>Informasi Dasar</CardTitle>
            <AIBundleButton
              label="Generate copy"
              entityType="course"
              fields={["subtitle", "short_description", "description"]}
              context={aiContext}
              disabled={!form.title.trim()}
              onFill={(fields) => setForm((f) => ({ ...f, ...fields }))}
            />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">Judul Kelas *</label>
                <input className={inputClass} name="title" value={form.title} onChange={handleChange} onBlur={autoSlug} required placeholder="Contoh: Bahasa Jepang untuk Pemula" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">Slug *</label>
                <input className={inputClass} name="slug" value={form.slug} onChange={handleChange} required placeholder="ai-untuk-pemula" />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-warm-black">Subtitle</label>
                  <AIFieldButton
                    field="subtitle"
                    fieldName="Subtitle"
                    entityType="course"
                    context={aiContext}
                    disabled={!form.title.trim()}
                    onFill={(content) => setForm((f) => ({ ...f, subtitle: content }))}
                  />
                </div>
                <input className={inputClass} name="subtitle" value={form.subtitle} onChange={handleChange} placeholder="Deskripsi singkat 1 kalimat" />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-warm-black">Deskripsi Singkat</label>
                  <AIFieldButton
                    field="short_description"
                    fieldName="Deskripsi Singkat"
                    entityType="course"
                    context={aiContext}
                    disabled={!form.title.trim()}
                    onFill={(content) => setForm((f) => ({ ...f, short_description: content }))}
                  />
                </div>
                <textarea className={inputClass} name="short_description" value={form.short_description} onChange={handleChange} rows={2} placeholder="Untuk tampil di card katalog" />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-warm-black">Deskripsi Lengkap</label>
                  <AIFieldButton
                    field="description"
                    fieldName="Deskripsi Lengkap"
                    entityType="course"
                    context={aiContext}
                    disabled={!form.title.trim()}
                    onFill={(content) => setForm((f) => ({ ...f, description: content }))}
                  />
                </div>
                <textarea className={inputClass} name="description" value={form.description} onChange={handleChange} rows={5} placeholder="Deskripsi detail tentang kelas ini" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">Sampul Kelas</label>
                {form.thumbnail_url ? (
                  <div className="relative w-48">
                    <div className="rounded-lg overflow-hidden border border-[rgba(12,12,10,0.12)]">
                      <img src={form.thumbnail_url} alt="Preview sampul" className="w-full aspect-video object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, thumbnail_url: "" }))}
                      className="absolute -right-2 -top-2 rounded-full bg-red-600 text-white w-6 h-6 text-xs font-bold shadow hover:bg-red-700"
                      title="Hapus sampul"
                    >×</button>
                  </div>
                ) : (
                  <label className={`flex flex-col items-center justify-center gap-1 w-48 aspect-video rounded-lg border-2 border-dashed border-[rgba(12,12,10,0.18)] cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors ${uploadingCover ? "opacity-60 pointer-events-none" : ""}`}>
                    <span className="text-2xl text-[rgba(12,12,10,0.35)]">＋</span>
                    <span className="text-xs font-medium text-[rgba(12,12,10,0.55)]">{uploadingCover ? "Mengunggah…" : "Upload gambar"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingCover}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = ""; }}
                    />
                  </label>
                )}
                <p className="text-xs text-[rgba(12,12,10,0.45)]">Rasio 16:9, maks 50MB. Tersimpan otomatis ke penyimpanan PejuangYen.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pengaturan */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Pengaturan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <CategorySelector
                primaryId={primaryCategoryId}
                secondaryIds={secondaryCategoryIds}
                onChange={(p, s) => { setPrimaryCategoryId(p); setSecondaryCategoryIds(s); }}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">Level</label>
                <select className={inputClass} name="level" value={form.level} onChange={handleChange}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">Tipe Akses</label>
                <select className={inputClass} name="access_type" value={form.access_type} onChange={handleChange}>
                  <option value="free">Free — semua user</option>
                  <option value="paid">Berbayar — beli satuan (kelas satuan)</option>
                  <option value="membership_only">Premium — membership aktif</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">Instructor</label>
                <input className={inputClass} name="instructor_name" value={form.instructor_name} onChange={handleChange} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">Harga (IDR)</label>
                <input className={inputClass} name="price" type="number" value={form.price} onChange={handleChange} min={0} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">Harga Coret (IDR)</label>
                <input className={inputClass} name="compare_at_price" type="number" value={form.compare_at_price} onChange={handleChange} min={0} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">Status</label>
                <select className={inputClass} name="status" value={form.status} onChange={handleChange}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">Urutan</label>
                <input className={inputClass} name="sort_order" type="number" value={form.sort_order} onChange={handleChange} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">Durasi (menit)</label>
                <input className={inputClass} name="duration_minutes" type="number" min={0} value={form.duration_minutes} onChange={(e) => setForm(f => ({ ...f, duration_minutes: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 mt-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">Learning Outcome</label>
                <textarea className={inputClass} name="learning_outcome" rows={2} value={form.learning_outcome} onChange={handleChange} placeholder="Setelah kelas ini, user bisa..." />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">Recommended For</label>
                <input className={inputClass} name="recommended_for" value={form.recommended_for} onChange={handleChange} placeholder="Pemula yang baru mulai belajar bahasa Jepang" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" loading={saving} size="lg">
            {saving ? "Menyimpan..." : "Simpan Kelas"}
          </Button>
          <Button type="button" variant="secondary" size="lg" onClick={() => router.back()}>
            Batal
          </Button>
        </div>
      </form>
    </div>
  );
}
