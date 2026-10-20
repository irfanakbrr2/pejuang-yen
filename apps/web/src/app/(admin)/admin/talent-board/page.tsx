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
import { BadgeCheck, Download, Plus, Pencil, Trash2, Settings2, Sparkles } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

const STATUS_OPTIONS = [
  { value: "hidden", label: "Hidden" },
  { value: "pending", label: "Pending" },
  { value: "visible", label: "Visible" },
  { value: "featured", label: "Featured" },
] as const;

const STATUS_BADGE: Record<string, { variant: "gray" | "warning" | "success" | "purple"; label: string }> = {
  hidden: { variant: "gray", label: "Hidden" },
  pending: { variant: "warning", label: "Pending" },
  visible: { variant: "success", label: "Visible" },
  featured: { variant: "purple", label: "Featured" },
};

interface Candidate {
  id: string;
  user_id: string;
  name: string;
  email: string;
  status: string;
  skill_tags_json: string | null;
  portfolio_url: string | null;
  admin_notes: string | null;
  sort_order: number;
  avg_progress: number | null;
  courses_completed: number;
  webinar_count: number;
  active_days_30: number;
  certificates: number;
}

interface Settings {
  min_progress: number;
  min_courses_completed: number;
  min_webinar_attendance: number;
  public_enabled: boolean;
}

interface EligibleUser {
  id: string;
  name: string;
  email: string;
  avg_progress: number | null;
  courses_completed: number;
  webinar_count: number;
}

function parseTags(json: string | null): string[] {
  if (!json) return [];
  try { return JSON.parse(json) as string[]; } catch { return []; }
}

export default function AdminTalentBoardPage() {
  const [rows, setRows] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [settings, setSettings] = useState<Settings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [eligible, setEligible] = useState<EligibleUser[]>([]);

  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [adding, setAdding] = useState(false);

  const [editing, setEditing] = useState<Candidate | null>(null);
  const [editForm, setEditForm] = useState({ status: "pending", skill_tags: "", portfolio_url: "", admin_notes: "", sort_order: 0 });
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleting, setDeleting] = useState<Candidate | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("search", search);
    api(`/api/admin/talent-board?${params.toString()}`)
      .then((res: any) => {
        if (res.success) {
          setRows(res.data || []);
          setTotalPages(res.pagination?.totalPages || Math.max(1, Math.ceil((res.pagination?.total || 0) / 50)));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api("/api/admin/talent-board/settings").then((res) => { if (res.success) setSettings(res.data); }).catch(console.error);
    api("/api/admin/talent-board/eligible").then((res) => { if (res.success) setEligible(res.data.eligible || []); }).catch(console.error);
  }, []);

  const saveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    try {
      const res = await api("/api/admin/talent-board/settings", { method: "PUT", body: JSON.stringify(settings) });
      if (res.success) toast.success("Pengaturan disimpan");
      else toast.error(res.error || "Gagal menyimpan pengaturan");
    } finally {
      setSavingSettings(false);
    }
  };

  const addCandidate = async (email: string) => {
    setAdding(true);
    try {
      const res = await api("/api/admin/talent-board", { method: "POST", body: JSON.stringify({ email }) });
      if (res.success) {
        toast.success("Kandidat ditambahkan");
        setAddOpen(false);
        setAddEmail("");
        setEligible((prev) => prev.filter((u) => u.email !== email));
        load();
      } else {
        toast.error(res.error || "Gagal menambahkan kandidat");
      }
    } finally {
      setAdding(false);
    }
  };

  const updateStatus = async (candidate: Candidate, status: string) => {
    const res = await api(`/api/admin/talent-board/${candidate.id}`, { method: "PUT", body: JSON.stringify({ status }) });
    if (res.success) {
      setRows((prev) => prev.map((r) => (r.id === candidate.id ? { ...r, status } : r)));
      toast.success(`Status ${candidate.name} → ${status}`);
    } else {
      toast.error(res.error || "Gagal mengubah status");
    }
  };

  const openEdit = (candidate: Candidate) => {
    setEditing(candidate);
    setEditForm({
      status: candidate.status,
      skill_tags: parseTags(candidate.skill_tags_json).join(", "),
      portfolio_url: candidate.portfolio_url || "",
      admin_notes: candidate.admin_notes || "",
      sort_order: candidate.sort_order || 0,
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      const res = await api(`/api/admin/talent-board/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({
          status: editForm.status,
          skill_tags: editForm.skill_tags.split(",").map((t) => t.trim()).filter(Boolean),
          portfolio_url: editForm.portfolio_url,
          admin_notes: editForm.admin_notes,
          sort_order: Number(editForm.sort_order) || 0,
        }),
      });
      if (res.success) {
        toast.success("Kandidat diperbarui");
        setEditing(null);
        load();
      } else {
        toast.error(res.error || "Gagal memperbarui kandidat");
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    try {
      const res = await api(`/api/admin/talent-board/${deleting.id}`, { method: "DELETE" });
      if (res.success) {
        toast.success("Kandidat dihapus");
        setDeleting(null);
        load();
      } else {
        toast.error(res.error || "Gagal menghapus kandidat");
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
        title={<span className="inline-flex items-center gap-2"><BadgeCheck className="text-[#8B1414]" /> Talent Board</span>}
        description="Kurasi member terbaik untuk ditampilkan ke perusahaan dan recruiter. Halaman user tetap coming soon sampai visibilitas publik diaktifkan."
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.open(`${API_BASE}/api/admin/talent-board/export`, "_blank")}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-full px-3 py-1.5"
            >
              <Download size={13} /> Export CSV
            </button>
            <Button onClick={() => setAddOpen(true)} className="rounded-full text-xs inline-flex items-center gap-1.5">
              <Plus size={13} /> Tambah Kandidat
            </Button>
          </div>
        }
      />

      {/* Pengaturan kelayakan */}
      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2"><Settings2 size={15} className="text-[#8B1414]" /> Syarat Kelayakan & Visibilitas</CardTitle>
        </CardHeader>
        <CardContent>
          {!settings ? (
            <p className="text-sm text-gray-400">Memuat pengaturan...</p>
          ) : (
            <div className="flex flex-col lg:flex-row lg:items-end gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
                <Input
                  label="Min. rata-rata progress (%)"
                  type="number" min={0} max={100}
                  value={settings.min_progress}
                  onChange={(e) => setSettings({ ...settings, min_progress: Number(e.target.value) })}
                />
                <Input
                  label="Min. kelas selesai"
                  type="number" min={0}
                  value={settings.min_courses_completed}
                  onChange={(e) => setSettings({ ...settings, min_courses_completed: Number(e.target.value) })}
                />
                <Input
                  label="Min. kehadiran webinar"
                  type="number" min={0}
                  value={settings.min_webinar_attendance}
                  onChange={(e) => setSettings({ ...settings, min_webinar_attendance: Number(e.target.value) })}
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settings.public_enabled}
                    onChange={(e) => setSettings({ ...settings, public_enabled: e.target.checked })}
                    className="h-4 w-4 rounded accent-[#8B1414]"
                  />
                  Aktifkan halaman publik
                </label>
                <Button onClick={saveSettings} loading={savingSettings}>Simpan</Button>
              </div>
            </div>
          )}
          {settings && !settings.public_enabled && (
            <p className="text-xs text-amber-600 mt-3">
              Halaman user /talent-board masih menampilkan coming soon. Data kandidat di sini tidak terlihat publik.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Saran kandidat eligible */}
      {eligible.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2"><Sparkles size={15} className="text-amber-500" /> Member yang Memenuhi Syarat</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {eligible.slice(0, 10).map((u) => (
                <div key={u.id} className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  <div>
                    <p className="text-xs font-semibold text-gray-900">{u.name}</p>
                    <p className="text-[10px] text-gray-400">{u.courses_completed} kelas · {u.avg_progress || 0}% · {u.webinar_count} webinar</p>
                  </div>
                  <button
                    onClick={() => addCandidate(u.email)}
                    disabled={adding}
                    className="text-[#8B1414] hover:bg-[#8B1414]/10 rounded-lg p-1"
                    title="Tambahkan ke Talent Board"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabel kandidat */}
      <Card>
        <CardHeader>
          <CardTitle>Kandidat ({rows.length > 0 ? rows.length : 0})</CardTitle>
          <CardToolbar>
            <div className="flex items-center gap-2">
              <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className={inputClass}>
                <option value="">Semua status</option>
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <form onSubmit={(e) => { e.preventDefault(); setSearch(searchInput.trim()); setPage(1); }}>
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Cari nama/email..."
                  className={inputClass}
                />
              </form>
            </div>
          </CardToolbar>
        </CardHeader>
        <CardContent className="space-y-4">
          <AdminTable
            columns={[
              { key: "member", label: "Member" },
              { key: "progress", label: "Progress" },
              { key: "courses", label: "Kelas" },
              { key: "webinars", label: "Webinar" },
              { key: "active", label: "Aktif 30d" },
              { key: "skills", label: "Skill Tags" },
              { key: "status", label: "Status" },
              { key: "actions", label: "Aksi", className: "text-right" },
            ]}
            loading={loading}
            empty={
              <div className="text-center py-10">
                <p className="text-sm text-gray-500 mb-1">Belum ada kandidat.</p>
                <p className="text-xs text-gray-400">Tambahkan member via tombol &ldquo;Tambah Kandidat&rdquo; atau dari saran yang memenuhi syarat.</p>
              </div>
            }
          >
            {rows.map((row) => {
              const badge = STATUS_BADGE[row.status] || STATUS_BADGE.hidden;
              const tags = parseTags(row.skill_tags_json);
              return (
                <Tr key={row.id}>
                  <Td>
                    <p className="font-medium text-sm">{row.name}</p>
                    <p className="text-xs text-gray-400">{row.email}</p>
                  </Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#8B1414] rounded-full" style={{ width: `${row.avg_progress || 0}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{row.avg_progress || 0}%</span>
                    </div>
                  </Td>
                  <Td>{row.courses_completed}</Td>
                  <Td>{row.webinar_count}</Td>
                  <Td>{row.active_days_30}</Td>
                  <Td>
                    {tags.length === 0 ? <span className="text-gray-300 text-xs">—</span> : (
                      <div className="flex flex-wrap gap-1 max-w-[160px]">
                        {tags.map((tag) => (
                          <span key={tag} className="text-[10px] font-medium bg-gray-100 text-gray-600 rounded-full px-2 py-0.5">{tag}</span>
                        ))}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <select
                      value={row.status}
                      onChange={(e) => updateStatus(row, e.target.value)}
                      className={`text-xs font-semibold rounded-full px-2 py-1 border-0 cursor-pointer ${
                        badge.variant === "purple" ? "bg-purple-50 text-purple-700"
                        : badge.variant === "success" ? "bg-green-50 text-green-700"
                        : badge.variant === "warning" ? "bg-amber-50 text-amber-700"
                        : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    <button onClick={() => openEdit(row)} className="text-gray-400 hover:text-[#8B1414] p-1.5" title="Edit">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeleting(row)} className="text-gray-400 hover:text-red-500 p-1.5" title="Hapus">
                      <Trash2 size={14} />
                    </button>
                  </Td>
                </Tr>
              );
            })}
          </AdminTable>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </CardContent>
      </Card>

      {/* Dialog tambah kandidat */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Kandidat</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); if (addEmail.trim()) addCandidate(addEmail.trim()); }} className="space-y-3 pt-2">
            <Input
              label="Email member"
              type="email"
              placeholder="member@email.com"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              required
            />
            <DialogFooter>
              <Button variant="secondary" type="button" onClick={() => setAddOpen(false)}>Batal</Button>
              <Button type="submit" loading={adding} disabled={!addEmail.trim()}>Tambahkan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog edit kandidat */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Kandidat — {editing?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Status</label>
              <select
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                className={`${inputClass} w-full`}
              >
                {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <Input
              label="Skill tags (pisahkan dengan koma)"
              placeholder="Bahasa Jepang N4, SSW Kaigo, Manufaktur"
              value={editForm.skill_tags}
              onChange={(e) => setEditForm({ ...editForm, skill_tags: e.target.value })}
            />
            <Input
              label="Link portofolio"
              placeholder="https://..."
              value={editForm.portfolio_url}
              onChange={(e) => setEditForm({ ...editForm, portfolio_url: e.target.value })}
            />
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Catatan admin</label>
              <textarea
                value={editForm.admin_notes}
                onChange={(e) => setEditForm({ ...editForm, admin_notes: e.target.value })}
                rows={3}
                className={`${inputClass} w-full resize-none`}
                placeholder="Catatan internal..."
              />
            </div>
            <Input
              label="Urutan tampil"
              type="number"
              value={editForm.sort_order}
              onChange={(e) => setEditForm({ ...editForm, sort_order: Number(e.target.value) })}
            />
            <DialogFooter>
              <Button variant="secondary" onClick={() => setEditing(null)}>Batal</Button>
              <Button onClick={saveEdit} loading={savingEdit}>Simpan</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi hapus */}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        title="Hapus kandidat?"
        description={`${deleting?.name || ""} akan dihapus dari Talent Board. Data belajar member tidak terpengaruh.`}
        confirmLabel="Hapus"
        variant="danger"
        loading={deleteLoading}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
