"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, Suspense } from "react";
import { Plus, Trash2, Pencil, Files, Package, UploadCloud } from "lucide-react";
import { AdminTable, StatusBadge, Td, Tr } from "@/components/ui/AdminTable";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { toast } from "@/components/ui/toast";
import { Pagination } from "@/components/ui/Pagination";
import { formatRupiah } from "@/lib/utils";

interface DigitalProduct {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  thumbnail_url?: string | null;
  price: number;
  compare_at_price?: number | null;
  delivery_type: "files" | "external_url" | "service";
  external_url?: string | null;
  status: "draft" | "active" | "archived";
  sort_order: number;
  file_count: number;
  sales_count: number;
}

interface ProductFile {
  id: string;
  title: string;
  file_type: string;
  file_url?: string | null;
  r2_key?: string | null;
  sort_order: number;
}

const EMPTY_FORM = {
  slug: "",
  name: "",
  description: "",
  thumbnail_url: "",
  price: "",
  compare_at_price: "",
  delivery_type: "files" as DigitalProduct["delivery_type"],
  external_url: "",
  status: "draft" as DigitalProduct["status"],
  sort_order: "0",
};

const DELIVERY_LABELS: Record<string, string> = {
  files: "File (download)",
  external_url: "Link Eksternal",
  service: "Layanan (follow-up admin)",
};

const inputClass =
  "w-full px-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors";

function AdminDigitalProductsContent() {
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState<DigitalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [saving, setSaving] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<DigitalProduct | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  // Files manager
  const [filesTarget, setFilesTarget] = useState<DigitalProduct | null>(null);
  const [files, setFiles] = useState<ProductFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fileTitle, setFileTitle] = useState("");

  const load = async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: "20" });
    const res = await fetch(`/api/admin/digital-products?${p}`, { credentials: "include" });
    const data = await res.json();
    if (data.success) {
      setProducts(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } else {
      toast.error(data.error || "Gagal memuat produk digital");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditTarget(null);
    setModalMode("create");
  };

  const openEdit = (p: DigitalProduct) => {
    setEditTarget(p);
    setForm({
      slug: p.slug,
      name: p.name,
      description: p.description || "",
      thumbnail_url: p.thumbnail_url || "",
      price: String(p.price),
      compare_at_price: p.compare_at_price ? String(p.compare_at_price) : "",
      delivery_type: p.delivery_type,
      external_url: p.external_url || "",
      status: p.status,
      sort_order: String(p.sort_order || 0),
    });
    setModalMode("edit");
  };

  const save = async () => {
    if (!form.name.trim() || !form.slug.trim() || !form.price) {
      toast.error("Nama, slug, dan harga wajib diisi");
      return;
    }
    setSaving(true);
    const payload = {
      slug: form.slug.trim().toLowerCase(),
      name: form.name.trim(),
      description: form.description.trim() || null,
      thumbnail_url: form.thumbnail_url.trim() || null,
      price: Number(form.price),
      compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : null,
      delivery_type: form.delivery_type,
      external_url: form.external_url.trim() || null,
      status: form.status,
      sort_order: Number(form.sort_order) || 0,
    };
    const url = modalMode === "edit" && editTarget
      ? `/api/admin/digital-products/${editTarget.id}`
      : "/api/admin/digital-products";
    const res = await fetch(url, {
      method: modalMode === "edit" ? "PUT" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (data.success) {
      toast.success(modalMode === "edit" ? "Produk diperbarui" : "Produk dibuat");
      setModalMode(null);
      load();
    } else {
      toast.error(data.error || "Gagal menyimpan");
    }
  };

  const remove = async (p: DigitalProduct) => {
    if (!confirm(`Hapus produk "${p.name}"?`)) return;
    const res = await fetch(`/api/admin/digital-products/${p.id}`, { method: "DELETE", credentials: "include" });
    const data = await res.json();
    if (data.success) {
      toast.success("Produk dihapus");
      load();
    } else {
      toast.error(data.error || "Gagal menghapus");
    }
  };

  // ── Files manager ──
  const openFiles = async (p: DigitalProduct) => {
    setFilesTarget(p);
    setFilesLoading(true);
    const res = await fetch(`/api/admin/digital-products/${p.id}`, { credentials: "include" });
    const data = await res.json();
    setFiles(data.success ? data.data?.files || [] : []);
    setFilesLoading(false);
  };

  const uploadFile = async (file: File) => {
    if (!filesTarget) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "DigitalProducts");
      const up = await fetch("/api/admin/storage/upload", { method: "POST", credentials: "include", body: fd });
      const upData = await up.json();
      if (!upData.success) {
        toast.error(upData.error || "Upload gagal");
        return;
      }
      const fileUrl = `https://pub-d56d873c4b8d4204b35361d7bea0dca8.r2.dev/${upData.data.key}`;
      const res = await fetch(`/api/admin/digital-products/${filesTarget.id}/files`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fileTitle.trim() || file.name,
          file_type: file.name.split(".").pop() || "file",
          file_url: fileUrl,
          r2_key: upData.data.key,
          sort_order: files.length,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("File ditambahkan");
        setFileTitle("");
        openFiles(filesTarget);
        load();
      } else {
        toast.error(data.error || "Gagal menambah file");
      }
    } finally {
      setUploading(false);
    }
  };

  const removeFile = async (fileId: string) => {
    if (!filesTarget) return;
    const res = await fetch(`/api/admin/digital-products/${filesTarget.id}/files/${fileId}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = await res.json();
    if (data.success) {
      openFiles(filesTarget);
      load();
    } else {
      toast.error(data.error || "Gagal menghapus file");
    }
  };

  return (
    <>
      <PageHeader
        title="Produk Digital"
        description="Ebook, template, mini course, atau layanan — untuk tripwire & item funnel."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" /> Tambah Produk
          </Button>
        }
      />

      <AdminTable
        columns={[
          { key: "name", label: "Produk" },
          { key: "price", label: "Harga" },
          { key: "delivery", label: "Delivery" },
          { key: "files", label: "Files" },
          { key: "sales", label: "Terjual" },
          { key: "status", label: "Status" },
          { key: "actions", label: "" },
        ]}
        loading={loading}
        empty={
          <div className="py-10 text-center text-sm text-gray-500">
            <Package className="mx-auto mb-2 h-8 w-8 text-gray-300" />
            Belum ada produk digital. Buat ebook/template murah sebagai tripwire.
          </div>
        }
      >
        {products.map((p) => (
          <Tr key={p.id}>
            <Td>
              <p className="font-semibold text-warm-black">{p.name}</p>
              <p className="text-xs text-gray-500 font-mono">/{p.slug}</p>
            </Td>
            <Td>
              <p className="font-semibold">{formatRupiah(p.price)}</p>
              {p.compare_at_price ? (
                <p className="text-xs text-gray-400 line-through">{formatRupiah(p.compare_at_price)}</p>
              ) : null}
            </Td>
            <Td>{DELIVERY_LABELS[p.delivery_type] || p.delivery_type}</Td>
            <Td>{p.delivery_type === "files" ? p.file_count : "—"}</Td>
            <Td>{p.sales_count}</Td>
            <Td>
              <StatusBadge status={p.status} />
            </Td>
            <Td>
              <div className="flex items-center justify-end gap-1.5">
                {p.delivery_type === "files" && (
                  <button onClick={() => openFiles(p)} aria-label={`Kelola files ${p.name}`} title="Kelola files" className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-gray-100 text-gray-500 cursor-pointer">
                    <Files className="h-4 w-4" />
                  </button>
                )}
                <button onClick={() => openEdit(p)} aria-label={`Edit ${p.name}`} title="Edit" className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-gray-100 text-gray-500 cursor-pointer">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => remove(p)} aria-label={`Hapus ${p.name}`} title="Hapus" className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-red-50 text-red-500 cursor-pointer">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Td>
          </Tr>
        ))}
      </AdminTable>

      <div className="mt-4">
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      {/* ── Create / Edit dialog ── */}
      <Dialog open={!!modalMode} onOpenChange={(open) => !open && setModalMode(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{modalMode === "edit" ? "Edit Produk Digital" : "Tambah Produk Digital"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1.5 text-gray-600">Nama *</label>
              <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ebook Panduan Wawancara Kerja Jepang" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-gray-600">Slug *</label>
              <input className={`${inputClass} font-mono`} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} placeholder="ebook-panduan-wawancara" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-gray-600">Status</label>
              <select className={inputClass} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as DigitalProduct["status"] })}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-gray-600">Harga (Rp) *</label>
              <input type="number" className={inputClass} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="49000" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-gray-600">Harga Coret (Rp)</label>
              <input type="number" className={inputClass} value={form.compare_at_price} onChange={(e) => setForm({ ...form, compare_at_price: e.target.value })} placeholder="199000" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-gray-600">Tipe Delivery</label>
              <select className={inputClass} value={form.delivery_type} onChange={(e) => setForm({ ...form, delivery_type: e.target.value as DigitalProduct["delivery_type"] })}>
                <option value="files">File (download)</option>
                <option value="external_url">Link eksternal</option>
                <option value="service">Layanan (follow-up admin)</option>
              </select>
            </div>
            {form.delivery_type === "external_url" && (
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-gray-600">External URL (https)</label>
                <input className={inputClass} value={form.external_url} onChange={(e) => setForm({ ...form, external_url: e.target.value })} placeholder="https://..." />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1.5 text-gray-600">Deskripsi</label>
              <textarea className={inputClass} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1.5 text-gray-600">Thumbnail URL</label>
              <input className={inputClass} value={form.thumbnail_url} onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })} placeholder="https://pub-d56d873c4b8d4204b35361d7bea0dca8.r2.dev/..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setModalMode(null)}>Batal</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Files manager dialog ── */}
      <Dialog open={!!filesTarget} onOpenChange={(open) => !open && setFilesTarget(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Files — {filesTarget?.name}</DialogTitle>
          </DialogHeader>
          {filesLoading ? (
            <p className="text-sm text-gray-500 py-4">Memuat...</p>
          ) : (
            <div className="space-y-2">
              {files.length === 0 && <p className="text-sm text-gray-500">Belum ada file.</p>}
              {files.map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-lg border border-[rgba(12,12,10,0.08)] px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-warm-black truncate">{f.title}</p>
                    <p className="text-xs text-gray-400 font-mono truncate">{f.r2_key || f.file_url}</p>
                  </div>
                  <button onClick={() => removeFile(f.id)} aria-label={`Hapus file ${f.title}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-red-50 text-red-500 cursor-pointer">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <div className="pt-2 border-t border-[rgba(12,12,10,0.06)] space-y-2">
                <input className={inputClass} value={fileTitle} onChange={(e) => setFileTitle(e.target.value)} placeholder="Judul file (opsional, default nama file)" />
                <label className={`flex items-center justify-center gap-2 rounded-lg border border-dashed border-[rgba(12,12,10,0.2)] px-3 py-3 text-sm cursor-pointer hover:border-primary transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                  <UploadCloud className="h-4 w-4" />
                  {uploading ? "Mengupload..." : "Upload file (maks 50MB)"}
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadFile(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AdminDigitalProductsPage() {
  return (
    <Suspense>
      <AdminDigitalProductsContent />
    </Suspense>
  );
}
