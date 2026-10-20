"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Check, X, Merge, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Skill {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_active: number;
  content_count: number;
}

interface Tag {
  id: string;
  slug: string;
  name: string;
  usage_count: number;
}

const inputClass = "w-full px-3 py-2 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white outline-none focus:border-primary";

export default function AdminSkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", icon: "", sort_order: 0 });
  const [newSkill, setNewSkill] = useState({ name: "", description: "", icon: "" });
  const [showNew, setShowNew] = useState(false);
  const [deleteSkillId, setDeleteSkillId] = useState<string | null>(null);
  const [deleteTagId, setDeleteTagId] = useState<string | null>(null);
  const [mergeSource, setMergeSource] = useState<Tag | null>(null);
  const [mergeTarget, setMergeTarget] = useState("");
  const [renamingTagId, setRenamingTagId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [resyncing, setResyncing] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [skillsRes, tagsRes] = await Promise.all([
        fetch("/api/admin/skills", { credentials: "include" }).then((r) => r.json()),
        fetch("/api/admin/tags", { credentials: "include" }).then((r) => r.json()),
      ]);
      if (skillsRes.success) setSkills(skillsRes.data);
      if (tagsRes.success) setTags(tagsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const startEdit = (s: Skill) => {
    setEditingId(s.id);
    setEditForm({ name: s.name, description: s.description || "", icon: s.icon || "", sort_order: s.sort_order });
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const res = await fetch(`/api/admin/skills/${editingId}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    }).then((r) => r.json());
    if (res.success) {
      toast.success("Skill diperbarui");
      setEditingId(null);
      fetchAll();
    } else toast.error(res.error || "Gagal menyimpan");
  };

  const toggleActive = async (s: Skill) => {
    const res = await fetch(`/api/admin/skills/${s.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: s.is_active ? 0 : 1 }),
    }).then((r) => r.json());
    if (res.success) fetchAll();
    else toast.error(res.error || "Gagal mengubah status");
  };

  const createSkill = async () => {
    if (!newSkill.name.trim()) return;
    const res = await fetch("/api/admin/skills", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newSkill, sort_order: skills.length + 1 }),
    }).then((r) => r.json());
    if (res.success) {
      toast.success("Skill dibuat");
      setNewSkill({ name: "", description: "", icon: "" });
      setShowNew(false);
      fetchAll();
    } else toast.error(res.error || "Gagal membuat skill");
  };

  const deleteSkill = async () => {
    if (!deleteSkillId) return;
    const res = await fetch(`/api/admin/skills/${deleteSkillId}`, {
      method: "DELETE", credentials: "include",
    }).then((r) => r.json());
    if (res.success) { toast.success("Skill dihapus"); fetchAll(); }
    else toast.error(res.error || "Gagal menghapus");
    setDeleteSkillId(null);
  };

  const renameTag = async () => {
    if (!renamingTagId || !renameValue.trim()) return;
    const res = await fetch(`/api/admin/tags/${renamingTagId}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameValue.trim() }),
    }).then((r) => r.json());
    if (res.success) { toast.success("Tag diubah"); setRenamingTagId(null); fetchAll(); }
    else toast.error(res.error || "Gagal mengubah tag");
  };

  const mergeTag = async () => {
    if (!mergeSource || !mergeTarget) return;
    const res = await fetch(`/api/admin/tags/${mergeSource.id}/merge`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_tag_id: mergeTarget }),
    }).then((r) => r.json());
    if (res.success) { toast.success("Tag digabung"); setMergeSource(null); setMergeTarget(""); fetchAll(); }
    else toast.error(res.error || "Gagal menggabung tag");
  };

  const deleteTag = async () => {
    if (!deleteTagId) return;
    const res = await fetch(`/api/admin/tags/${deleteTagId}`, {
      method: "DELETE", credentials: "include",
    }).then((r) => r.json());
    if (res.success) { toast.success("Tag dihapus"); fetchAll(); }
    else toast.error(res.error || "Gagal menghapus tag");
    setDeleteTagId(null);
  };

  const resync = async () => {
    setResyncing(true);
    const res = await fetch("/api/admin/content/resync", {
      method: "POST", credentials: "include",
    }).then((r) => r.json()).catch(() => ({ success: false }));
    if (res.success) toast.success(`Registry disinkronkan (${res.data?.synced ?? "?"} konten)`);
    else toast.error("Gagal sinkronisasi registry");
    setResyncing(false);
  };

  return (
    <div>
      <PageHeader
        title="Skills & Tags"
        description="Kelola taksonomi skill (kategori utama) dan vocabulary tag bebas."
        actions={
          <Button variant="secondary" size="sm" onClick={resync} loading={resyncing}>
            <RefreshCw size={14} className="mr-1" /> Sync Registry
          </Button>
        }
      />

      {/* Skills */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Skill Categories ({skills.length})</CardTitle>
          <Button size="sm" onClick={() => setShowNew(!showNew)}>
            <Plus size={14} className="mr-1" /> Tambah Skill
          </Button>
        </CardHeader>
        <CardContent>
          {showNew && (
            <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl bg-gray-50 p-4">
              <div className="min-w-44 flex-1">
                <label className="mb-1 block text-xs font-semibold text-gray-500">Nama</label>
                <input className={inputClass} value={newSkill.name} onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })} placeholder="Misal: Data & Analitik" />
              </div>
              <div className="min-w-56 flex-1">
                <label className="mb-1 block text-xs font-semibold text-gray-500">Deskripsi</label>
                <input className={inputClass} value={newSkill.description} onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })} />
              </div>
              <div className="w-36">
                <label className="mb-1 block text-xs font-semibold text-gray-500">Icon (lucide)</label>
                <input className={inputClass} value={newSkill.icon} onChange={(e) => setNewSkill({ ...newSkill, icon: e.target.value })} placeholder="BarChart3" />
              </div>
              <Button size="sm" onClick={createSkill}>Simpan</Button>
            </div>
          )}

          {loading ? (
            <p className="py-6 text-center text-sm text-gray-400">Memuat…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
                    <th className="py-2 pr-3">Nama</th>
                    <th className="py-2 pr-3">Slug</th>
                    <th className="py-2 pr-3">Icon</th>
                    <th className="py-2 pr-3 text-center">Konten</th>
                    <th className="py-2 pr-3 text-center">Urutan</th>
                    <th className="py-2 pr-3 text-center">Aktif</th>
                    <th className="py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {skills.map((s) => (
                    <tr key={s.id} className="border-b border-gray-50 last:border-0">
                      {editingId === s.id ? (
                        <>
                          <td className="py-2 pr-3">
                            <input className={inputClass} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                            <input className={`${inputClass} mt-1`} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} placeholder="Deskripsi" />
                          </td>
                          <td className="py-2 pr-3 text-gray-400">{s.slug}</td>
                          <td className="py-2 pr-3">
                            <input className={`${inputClass} w-28`} value={editForm.icon} onChange={(e) => setEditForm({ ...editForm, icon: e.target.value })} />
                          </td>
                          <td className="py-2 pr-3 text-center text-gray-500">{s.content_count}</td>
                          <td className="py-2 pr-3 text-center">
                            <input type="number" className={`${inputClass} w-16 text-center`} value={editForm.sort_order} onChange={(e) => setEditForm({ ...editForm, sort_order: Number(e.target.value) })} />
                          </td>
                          <td className="py-2 pr-3 text-center">—</td>
                          <td className="py-2 text-right">
                            <button onClick={saveEdit} className="p-1.5 text-green-600 hover:text-green-700"><Check size={16} /></button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:text-gray-600"><X size={16} /></button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2 pr-3">
                            <span className="font-medium text-warm-black">{s.name}</span>
                            {s.description && <span className="block text-xs text-gray-400">{s.description}</span>}
                          </td>
                          <td className="py-2 pr-3 text-gray-400">{s.slug}</td>
                          <td className="py-2 pr-3 text-gray-500">{s.icon || "—"}</td>
                          <td className="py-2 pr-3 text-center text-gray-500">{s.content_count}</td>
                          <td className="py-2 pr-3 text-center text-gray-500">{s.sort_order}</td>
                          <td className="py-2 pr-3 text-center">
                            <button
                              onClick={() => toggleActive(s)}
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${s.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}
                            >
                              {s.is_active ? "Aktif" : "Nonaktif"}
                            </button>
                          </td>
                          <td className="py-2 text-right">
                            <button onClick={() => startEdit(s)} className="p-1.5 text-gray-400 hover:text-primary"><Pencil size={15} /></button>
                            <button
                              onClick={() => setDeleteSkillId(s.id)}
                              disabled={s.content_count > 0}
                              title={s.content_count > 0 ? "Masih ada konten dengan skill ini" : "Hapus"}
                              className="p-1.5 text-gray-400 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tags */}
      <Card>
        <CardHeader>
          <CardTitle>Tag Vocabulary ({tags.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {tags.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              Belum ada tag. Tag dibuat otomatis saat admin menambahkan tag di form konten.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((t) => (
                <span key={t.id} className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700">
                  {renamingTagId === t.id ? (
                    <>
                      <input
                        className="w-28 rounded border border-gray-300 px-1.5 py-0.5 text-xs outline-none"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && renameTag()}
                        autoFocus
                      />
                      <button onClick={renameTag} className="text-green-600"><Check size={12} /></button>
                      <button onClick={() => setRenamingTagId(null)} className="text-gray-400"><X size={12} /></button>
                    </>
                  ) : (
                    <>
                      {t.name}
                      <span className="text-gray-400">({t.usage_count})</span>
                      <button onClick={() => { setRenamingTagId(t.id); setRenameValue(t.name); }} className="text-gray-400 hover:text-primary"><Pencil size={11} /></button>
                      <button onClick={() => setMergeSource(t)} title="Gabungkan ke tag lain" className="text-gray-400 hover:text-primary"><Merge size={11} /></button>
                      <button onClick={() => setDeleteTagId(t.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={11} /></button>
                    </>
                  )}
                </span>
              ))}
            </div>
          )}

          {mergeSource && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 p-4 text-sm">
              <span>
                Gabungkan <strong>{mergeSource.name}</strong> ke:
              </span>
              <select className={`${inputClass} w-56`} value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)}>
                <option value="">Pilih tag target…</option>
                {tags.filter((t) => t.id !== mergeSource.id).map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.usage_count})</option>
                ))}
              </select>
              <Button size="sm" onClick={mergeTag} disabled={!mergeTarget}>Gabungkan</Button>
              <Button size="sm" variant="secondary" onClick={() => { setMergeSource(null); setMergeTarget(""); }}>Batal</Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteSkillId}
        onOpenChange={(open) => { if (!open) setDeleteSkillId(null); }}
        title="Hapus skill ini?"
        description="Skill akan dihapus permanen dari taksonomi."
        confirmLabel="Hapus"
        variant="danger"
        onConfirm={deleteSkill}
      />
      <ConfirmDialog
        open={!!deleteTagId}
        onOpenChange={(open) => { if (!open) setDeleteTagId(null); }}
        title="Hapus tag ini?"
        description="Tag akan dilepas dari semua konten lalu dihapus."
        confirmLabel="Hapus"
        variant="danger"
        onConfirm={deleteTag}
      />
    </div>
  );
}
