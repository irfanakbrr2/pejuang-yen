"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from "@/components/ui/card";
import { AdminTable, Tr, Td } from "@/components/ui/AdminTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Pagination } from "@/components/ui/Pagination";
import { toast } from "@/components/ui/toast";
import { Quote, Plus, Pencil, Trash2, Star, Eye, EyeOff } from "lucide-react";

const APPROVAL_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;

const APPROVAL_BADGE: Record<string, { variant: "warning" | "success" | "error"; label: string }> = {
  pending: { variant: "warning", label: "Pending" },
  approved: { variant: "success", label: "Approved" },
  rejected: { variant: "error", label: "Rejected" },
};

const TAG_SUGGESTIONS = "Cerita Member, Before After, Project Showcase, Income/Opportunity, Workflow AI, Career Growth";

interface Story {
  id: string;
  title: string;
  member_name: string;
  member_role: string | null;
  member_email: string | null;
  avatar_url: string | null;
  before_text: string | null;
  after_text: string | null;
  result_text: string | null;
  course_id: string | null;
  course_title: string | null;
  tags_json: string | null;
  quote: string | null;
  link_url: string | null;
  approval_status: string;
  is_featured: number;
  is_published: number;
  sort_order: number;
}

interface CourseOption { id: string; title: string; }

const EMPTY_FORM = {
  title: "",
  member_name: "",
  member_role: "",
  member_email: "",
  avatar_url: "",
  before_text: "",
  after_text: "",
  result_text: "",
  course_id: "",
  tags: "",
  quote: "",
  link_url: "",
  approval_status: "pending",
  is_featured: false,
  is_published: false,
  sort_order: 0,
};

function parseTags(json: string | null): string[] {
  if (!json) return [];
  try { return JSON.parse(json) as string[]; } catch { return []; }
}

export default function AdminSuccessStoriesPage() {
  const [rows, setRows] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [approvalFilter, setApprovalFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [courses, setCourses] = useState<CourseOption[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<Story | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (approvalFilter) params.set("approval", approvalFilter);
    if (search) params.set("search", search);
    api(`/api/admin/success-stories?${params.toString()}`)
      .then((res: any) => {
        if (res.success) {
          setRows(res.data || []);
          setTotalPages(res.pagination?.totalPages || Math.max(1, Math.ceil((res.pagination?.total || 0) / 50)));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, approvalFilter, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api("/api/admin/courses").then((res: any) => {
      if (res.success) setCourses((res.data || []).map((c: any) => ({ id: c.id, title: c.title })));
    }).catch(console.error);
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setFormOpen(true);
  };

  const openEdit = (story: Story) => {
    setEditingId(story.id);
    setForm({
      title: story.title,
      member_name: story.member_name,
      member_role: story.member_role || "",
      member_email: story.member_email || "",
      avatar_url: story.avatar_url || "",
      before_text: story.before_text || "",
      after_text: story.after_text || "",
      result_text: story.result_text || "",
      course_id: story.course_id || "",
      tags: parseTags(story.tags_json).join(", "),
      quote: story.quote || "",
      link_url: story.link_url || "",
      approval_status: story.approval_status,
      is_featured: !!story.is_featured,
      is_published: !!story.is_published,
      sort_order: story.sort_order || 0,
    });
    setFormOpen(true);
  };

  const saveForm = async () => {
    if (!form.title.trim() || !form.member_name.trim()) {
      toast.error("Judul dan nama member wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        course_id: form.course_id || null,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        sort_order: Number(form.sort_order) || 0,
      };
      const res = editingId
        ? await api(`/api/admin/success-stories/${editingId}`, { method: "PUT", body: JSON.stringify(payload) })
        : await api("/api/admin/success-stories", { method: "POST", body: JSON.stringify(payload) });
      if (res.success) {
        toast.success(editingId ? "Cerita diperbarui" : "Cerita dibuat");
        setFormOpen(false);
        load();
      } else {
        toast.error(res.error || "Gagal menyimpan cerita");
      }
    } finally {
      setSaving(false);
    }
  };

  const quickUpdate = async (story: Story, patch: Record<string, unknown>, message: string) => {
    const res = await api(`/api/admin/success-stories/${story.id}`, { method: "PUT", body: JSON.stringify(patch) });
    if (res.success) {
      toast.success(message);
      load();
    } else {
      toast.error(res.error || "Gagal memperbarui");
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      const res = await api(`/api/admin/success-stories/${deleting.id}`, { method: "DELETE" });
      if (res.success) {
        toast.success("Cerita dihapus");
        setDeleting(null);
        load();
      } else {
        toast.error(res.error || "Gagal menghapus");
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  const inputClass = "text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Manajemen Konten"
        title={<span className="inline-flex items-center gap-2"><Quote className="text-[#8B1414]" /> Success Stories</span>}
        description="CMS kisah sukses member. Cerita hanya bisa dipublikasikan setelah approval (dengan persetujuan member). Halaman user tetap coming soon."
        actions={
          <Button onClick={openCreate} className="rounded-full text-xs inline-flex items-center gap-1.5">
            <Plus size={13} /> Tulis Cerita
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Daftar Cerita</CardTitle>
          <CardToolbar>
            <div className="flex items-center gap-2">
              <select value={approvalFilter} onChange={(e) => { setApprovalFilter(e.target.value); setPage(1); }} className={inputClass}>
                <option value="">Semua approval</option>
                {APPROVAL_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); setPage(1); }}>
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Cari judul/member..."
                  className={inputClass}
                />
              </form>
            </div>
          </CardToolbar>
        </CardHeader>
        <CardContent className="space-y-4">
          <AdminTable
            columns={[
              { key: "title", label: "Judul Cerita" },
              { key: "member", label: "Member" },
              { key: "tags", label: "Kategori" },
              { key: "course", label: "Kelas Terkait" },
              { key: "approval", label: "Approval" },
              { key: "featured", label: "Featured" },
              { key: "published", label: "Publish" },
              { key: "actions", label: "Aksi", className: "text-right" },
            ]}
            loading={loading}
            empty={
              <div className="text-center py-10">
                <p className="text-sm text-gray-500 mb-1">Belum ada cerita.</p>
                <p className="text-xs text-gray-400">Klik &ldquo;Tulis Cerita&rdquo; untuk menambahkan kisah sukses member pertama.</p>
              </div>
            }
          >
            {rows.map((story) => {
              const badge = APPROVAL_BADGE[story.approval_status] || APPROVAL_BADGE.pending;
              const tags = parseTags(story.tags_json);
              return (
                <Tr key={story.id}>
                  <Td>
                    <p className="font-medium text-sm max-w-[220px] truncate">{story.title}</p>
                    {story.quote && <p className="text-[11px] text-gray-400 max-w-[220px] truncate italic">&ldquo;{story.quote}&rdquo;</p>}
                  </Td>
                  <Td>
                    <p className="text-sm">{story.member_name}</p>
                    {story.member_role && <p className="text-[11px] text-gray-400">{story.member_role}</p>}
                  </Td>
                  <Td>
                    {tags.length === 0 ? <span className="text-gray-300 text-xs">—</span> : (
                      <div className="flex flex-wrap gap-1 max-w-[140px]">
                        {tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="text-[10px] font-medium bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{tag}</span>
                        ))}
                        {tags.length > 2 && <span className="text-[10px] text-gray-400">+{tags.length - 2}</span>}
                      </div>
                    )}
                  </Td>
                  <Td className="text-xs max-w-[140px] truncate">{story.course_title || "—"}</Td>
                  <Td>
                    <select
                      value={story.approval_status}
                      onChange={(e) => quickUpdate(story, { approval_status: e.target.value }, `Approval → ${e.target.value}`)}
                      className={`text-xs font-semibold rounded-full px-2 py-1 border-0 cursor-pointer ${
                        badge.variant === "success" ? "bg-green-50 text-green-700"
                        : badge.variant === "error" ? "bg-red-50 text-red-700"
                        : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {APPROVAL_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </Td>
                  <Td>
                    <button
                      onClick={() => quickUpdate(story, { is_featured: !story.is_featured }, story.is_featured ? "Featured dilepas" : "Dijadikan featured")}
                      title={story.is_featured ? "Lepas featured" : "Jadikan featured"}
                      className="p-1"
                    >
                      <Star size={15} className={story.is_featured ? "text-amber-400 fill-amber-400" : "text-gray-300"} />
                    </button>
                  </Td>
                  <Td>
                    <button
                      onClick={() => {
                        if (!story.is_published && story.approval_status !== "approved") {
                          toast.error("Cerita harus approved dulu sebelum dipublish");
                          return;
                        }
                        quickUpdate(story, { is_published: !story.is_published }, story.is_published ? "Cerita di-unpublish" : "Cerita dipublish");
                      }}
                      title={story.is_published ? "Unpublish" : "Publish"}
                      className="p-1"
                    >
                      {story.is_published
                        ? <Eye size={15} className="text-[#8B1414]" />
                        : <EyeOff size={15} className="text-gray-300" />}
                    </button>
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    <button onClick={() => openEdit(story)} className="text-gray-400 hover:text-[#8B1414] p-1.5" title="Edit">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeleting(story)} className="text-gray-400 hover:text-red-500 p-1.5" title="Hapus">
                      <Trash2 size={14} />
                    </button>
                  </Td>
                </Tr>
              );
            })}
          </AdminTable>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          <p className="text-xs text-gray-400">
            Catatan: publish hanya bisa dilakukan pada cerita berstatus approved. Halaman user /success-stories masih coming soon — cerita published akan tampil saat halaman publik diaktifkan.
          </p>
        </CardContent>
      </Card>

      {/* Dialog create/edit */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Cerita" : "Tulis Cerita Baru"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input label="Judul cerita *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Dari Nol Sampai Kerja di Jepang" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Nama member *" value={form.member_name} onChange={(e) => setForm({ ...form, member_name: e.target.value })} />
              <Input label="Role member" value={form.member_role} onChange={(e) => setForm({ ...form, member_role: e.target.value })} placeholder="Fresh Graduate → Kerja di Jepang" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Email akun member (opsional)" type="email" value={form.member_email} onChange={(e) => setForm({ ...form, member_email: e.target.value })} />
              <Input label="URL avatar (opsional)" value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Kondisi sebelum (before)</label>
                <textarea rows={3} value={form.before_text} onChange={(e) => setForm({ ...form, before_text: e.target.value })} className={`${inputClass} w-full resize-none`} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Kondisi sesudah (after)</label>
                <textarea rows={3} value={form.after_text} onChange={(e) => setForm({ ...form, after_text: e.target.value })} className={`${inputClass} w-full resize-none`} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Hasil yang dicapai</label>
              <textarea rows={2} value={form.result_text} onChange={(e) => setForm({ ...form, result_text: e.target.value })} className={`${inputClass} w-full resize-none`} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Kutipan testimonial</label>
              <textarea rows={2} value={form.quote} onChange={(e) => setForm({ ...form, quote: e.target.value })} className={`${inputClass} w-full resize-none`} placeholder="Dulu saya butuh 3 hari..., sekarang 3 jam." />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Kelas terkait</label>
                <select value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })} className={`${inputClass} w-full`}>
                  <option value="">— Tidak ada —</option>
                  {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
                </select>
              </div>
              <Input label="Link portofolio/project" value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="https://..." />
            </div>
            <Input label={`Tags (pisahkan dengan koma)`} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder={TAG_SUGGESTIONS} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Approval</label>
                <select value={form.approval_status} onChange={(e) => setForm({ ...form, approval_status: e.target.value })} className={`${inputClass} w-full`}>
                  {APPROVAL_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <Input label="Urutan" type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none pb-2">
                <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} className="h-4 w-4 rounded accent-[#8B1414]" />
                Featured
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none pb-2">
                <input
                  type="checkbox"
                  checked={form.is_published}
                  disabled={form.approval_status !== "approved"}
                  onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                  className="h-4 w-4 rounded accent-[#8B1414] disabled:opacity-40"
                />
                Published
              </label>
            </div>
            {form.approval_status !== "approved" && (
              <p className="text-xs text-amber-600">Publish hanya tersedia setelah approval status = approved (consent member).</p>
            )}

            {/* Live preview kartu cerita */}
            {(form.quote || form.member_name) && (
              <div>
                <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase mb-2">Preview kartu</p>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 max-w-md">
                  <Quote size={16} className="text-[#8B1414] mb-2" />
                  <p className="text-sm text-gray-700 italic mb-3">&ldquo;{form.quote || "Kutipan testimonial akan tampil di sini."}&rdquo;</p>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#8B1414]/10 flex items-center justify-center text-[#8B1414] text-xs font-bold">
                      {(form.member_name || "M").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 inline-flex items-center gap-1.5">
                        {form.member_name || "Nama Member"}
                        {form.is_featured && <Star size={12} className="text-amber-400 fill-amber-400" />}
                      </p>
                      <p className="text-xs text-gray-400">{form.member_role || "Role member"}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="secondary" onClick={() => setFormOpen(false)}>Batal</Button>
              <Button onClick={saveForm} loading={saving}>{editingId ? "Simpan Perubahan" : "Buat Cerita"}</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi hapus */}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title="Hapus cerita?"
        description={`"${deleting?.title || ""}" akan dihapus permanen.`}
        confirmLabel="Hapus"
        variant="danger"
        loading={deleteLoading}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
