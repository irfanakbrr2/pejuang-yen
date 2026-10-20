"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Archive, Package, UploadCloud } from "lucide-react";
import { tokoApi } from "@/lib/api-client";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/toast";
import { formatRupiah } from "@/lib/utils";

interface CreatorProduct {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  thumbnail_url?: string | null;
  price: number;
  compare_at_price?: number | null;
  delivery_type: "file" | "link";
  upload_id?: string | null;
  external_url?: string | null;
  status: string;
  sales_count: number;
  file_name?: string | null;
}

const EMPTY_FORM = {
  title: "",
  slug: "",
  description: "",
  thumbnail_url: "",
  price: "",
  compare_at_price: "",
  delivery_type: "file" as "file" | "link",
  external_url: "",
  upload_id: "",
  upload_name: "",
  status: "active",
};

const inputClass =
  "w-full px-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors";
const labelClass = "block text-xs font-semibold mb-1.5 text-gray-600";

export default function TokoProdukPage() {
  const [products, setProducts] = useState<CreatorProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [noStore, setNoStore] = useState(false);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<CreatorProduct | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);

  const load = async () => {
    const res = await tokoApi.products();
    if (res.success) {
      setProducts((res.data as CreatorProduct[]) || []);
    } else if (res.error?.includes("toko") || res.error?.includes("Toko")) {
      setNoStore(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditTarget(null);
    setModal("create");
  };

  const openEdit = (p: CreatorProduct) => {
    setEditTarget(p);
    setForm({
      title: p.title,
      slug: p.slug,
      description: p.description || "",
      thumbnail_url: p.thumbnail_url || "",
      price: String(p.price),
      compare_at_price: p.compare_at_price ? String(p.compare_at_price) : "",
      delivery_type: p.delivery_type,
      external_url: p.external_url || "",
      upload_id: p.upload_id || "",
      upload_name: p.file_name || "",
      status: p.status,
    });
    setModal("edit");
  };

  const uploadDeliverable = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/toko/me/uploads", { method: "POST", credentials: "include", body: fd });
      const data = await res.json();
      if (data.success) {
        setForm((f) => ({ ...f, upload_id: data.data.upload_id, upload_name: data.data.original_name }));
        toast.success("File terupload");
      } else {
        toast.error(data.error || "Upload gagal");
      }
    } finally {
      setUploading(false);
    }
  };

  const uploadThumbnail = async (file: File) => {
    setUploadingThumb(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/toko/me/assets", { method: "POST", credentials: "include", body: fd });
      const data = await res.json();
      if (data.success) {
        setForm((f) => ({ ...f, thumbnail_url: data.data.url }));
        toast.success("Thumbnail terupload");
      } else {
        toast.error(data.error || "Upload gagal");
      }
    } finally {
      setUploadingThumb(false);
    }
  };

  const save = async () => {
    if (!form.title.trim() || !form.slug.trim() || !form.price) {
      toast.error("Judul, slug, dan harga wajib diisi");
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim().toLowerCase(),
      description: form.description.trim() || null,
      thumbnail_url: form.thumbnail_url || null,
      price: Number(form.price),
      compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : null,
      delivery_type: form.delivery_type,
      external_url: form.delivery_type === "link" ? form.external_url.trim() : null,
      upload_id: form.delivery_type === "file" ? form.upload_id : null,
      status: form.status,
    };
    const res = modal === "edit" && editTarget
      ? await tokoApi.updateProduct(editTarget.id, payload)
      : await tokoApi.createProduct(payload);
    setSaving(false);
    if (res.success) {
      toast.success("Produk disimpan");
      setModal(null);
      load();
    } else {
      toast.error(res.error || "Gagal menyimpan produk");
    }
  };

  const archive = async (p: CreatorProduct) => {
    if (!confirm(`Arsipkan produk "${p.title}"? Produk hilang dari toko (pembeli lama tetap punya akses).`)) return;
    const res = await tokoApi.archiveProduct(p.id);
    if (res.success) {
      toast.success("Produk diarsipkan");
      load();
    } else {
      toast.error(res.error || "Gagal mengarsipkan");
    }
  };

  if (loading) return <p className="py-10 text-center text-sm text-gray-500">Memuat...</p>;
  if (noStore) {
    return (
      <div className="py-14 text-center">
        <Package className="mx-auto mb-3 h-10 w-10 text-gray-300" />
        <p className="text-sm font-semibold text-warm-black">Buat toko dulu</p>
        <Link href="/toko-saya" className="mt-2 inline-block text-xs text-primary">← Ke Toko Saya</Link>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Produk Toko"
        description="Ebook, template, atau file digital lain — harga minimal Rp1.000."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" /> Tambah Produk
          </Button>
        }
      />

      {products.length === 0 ? (
        <div className="py-14 text-center">
          <Package className="mx-auto mb-3 h-10 w-10 text-gray-300" />
          <p className="text-sm font-semibold text-warm-black">Belum ada produk</p>
          <p className="mt-1 text-xs text-gray-500">Mulai dengan ebook atau template pertamamu.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div key={p.id} className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white p-4">
              {p.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.thumbnail_url} alt={p.title} className="mb-3 h-28 w-full rounded-lg object-cover" />
              ) : (
                <div className="mb-3 flex h-28 w-full items-center justify-center rounded-lg bg-warm-cream">
                  <Package className="h-7 w-7 text-gray-300" />
                </div>
              )}
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-warm-black leading-snug">{p.title}</p>
                <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                  p.status === "active" ? "bg-green-50 text-green-700 border border-green-200"
                  : p.status === "suspended" ? "bg-red-50 text-red-600 border border-red-200"
                  : "bg-gray-50 text-gray-500 border border-gray-200"
                }`}>{p.status}</span>
              </div>
              <p className="mt-1 text-sm font-bold text-primary">{formatRupiah(p.price)}</p>
              <p className="mt-0.5 text-xs text-gray-400">{p.sales_count} terjual · {p.delivery_type === "file" ? "File" : "Link"}</p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => openEdit(p)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[rgba(12,12,10,0.12)] py-1.5 text-xs font-semibold text-warm-black hover:border-primary transition-colors">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                {p.status !== "archived" && (
                  <button onClick={() => archive(p)} aria-label={`Arsipkan ${p.title}`} title="Arsipkan" className="flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors cursor-pointer">
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!modal} onOpenChange={(open) => !open && setModal(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modal === "edit" ? "Edit Produk" : "Tambah Produk"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass}>Judul *</label>
              <input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ebook Panduan Belajar Hiragana" />
            </div>
            <div>
              <label className={labelClass}>Slug *</label>
              <input className={`${inputClass} font-mono`} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} placeholder="ebook-panduan-hiragana" />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active (tampil di toko)</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Harga (Rp) *</label>
              <input type="number" className={inputClass} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="49000" />
            </div>
            <div>
              <label className={labelClass}>Harga Coret (Rp)</label>
              <input type="number" className={inputClass} value={form.compare_at_price} onChange={(e) => setForm({ ...form, compare_at_price: e.target.value })} placeholder="99000" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Deskripsi</label>
              <textarea className={inputClass} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <p className="mt-1 text-[11px] text-gray-400">Mendukung HTML — link, list, sampai embed video (dirender aman di halaman produk).</p>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Cara Pengiriman</label>
              <select className={inputClass} value={form.delivery_type} onChange={(e) => setForm({ ...form, delivery_type: e.target.value as "file" | "link" })}>
                <option value="file">File (PDF/ZIP — aman, hanya pembeli yang bisa unduh)</option>
                <option value="link">Link eksternal (Notion, GDrive, dll)</option>
              </select>
            </div>
            {form.delivery_type === "file" ? (
              <div className="sm:col-span-2">
                <label className={labelClass}>File Produk (PDF/ZIP, maks 50MB) *</label>
                {form.upload_name && (
                  <p className="mb-1.5 text-xs text-green-700">✓ {form.upload_name}</p>
                )}
                <label className={`flex items-center justify-center gap-2 rounded-lg border border-dashed border-[rgba(12,12,10,0.2)] px-3 py-3 text-sm cursor-pointer hover:border-primary transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                  <UploadCloud className="h-4 w-4" />
                  {uploading ? "Mengupload..." : form.upload_id ? "Ganti file" : "Upload file"}
                  <input type="file" accept=".pdf,.zip" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDeliverable(f); e.target.value = ""; }} />
                </label>
              </div>
            ) : (
              <div className="sm:col-span-2">
                <label className={labelClass}>Link Produk (https) *</label>
                <input className={inputClass} value={form.external_url} onChange={(e) => setForm({ ...form, external_url: e.target.value })} placeholder="https://..." />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className={labelClass}>Thumbnail (JPG/PNG/WebP, maks 2MB)</label>
              {form.thumbnail_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.thumbnail_url} alt={`Thumbnail ${form.title || "produk"}`} className="mb-1.5 h-20 rounded-lg object-cover" />
              )}
              <label className={`inline-flex items-center gap-2 rounded-lg border border-dashed border-[rgba(12,12,10,0.2)] px-3 py-2 text-xs cursor-pointer hover:border-primary transition-colors ${uploadingThumb ? "opacity-50 pointer-events-none" : ""}`}>
                <UploadCloud className="h-3.5 w-3.5" />
                {uploadingThumb ? "Mengupload..." : "Upload thumbnail"}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadThumbnail(f); e.target.value = ""; }} />
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setModal(null)}>Batal</Button>
            <Button onClick={save} disabled={saving || uploading}>{saving ? "Menyimpan..." : "Simpan Produk"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
