"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Route, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { AdminTable, StatusBadge, Td, Tr } from "@/components/ui/AdminTable";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface PathRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  level: string | null;
  status: string;
  is_featured: number;
  item_count: number;
}

const inputClass = "w-full px-3 py-2 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white outline-none focus:border-primary";

export default function AdminPathsPage() {
  const router = useRouter();
  const [paths, setPaths] = useState<PathRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchPaths = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/paths", { credentials: "include" }).then((r) => r.json());
      if (res.success) setPaths(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPaths(); }, []);

  const createPath = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/paths", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      }).then((r) => r.json());
      if (res.success) {
        toast.success("Learning path dibuat");
        router.push(`/admin/paths/${res.data.id}`);
      } else toast.error(res.error || "Gagal membuat learning path");
    } finally {
      setCreating(false);
    }
  };

  const deletePath = async () => {
    if (!deleteId) return;
    const res = await fetch(`/api/admin/paths/${deleteId}`, {
      method: "DELETE", credentials: "include",
    }).then((r) => r.json());
    if (res.success) { toast.success("Learning path dihapus"); fetchPaths(); }
    else toast.error(res.error || "Gagal menghapus");
    setDeleteId(null);
  };

  return (
    <div>
      <PageHeader
        title="Learning Path"
        description="Kurasi rute belajar campuran: kelas, rekaman, bonus, dan tools."
        actions={
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus size={14} className="mr-1" /> Buat Path
          </Button>
        }
      />

      <AdminTable
        columns={[
          { key: "title", label: "Judul" },
          { key: "items", label: "Langkah" },
          { key: "level", label: "Level" },
          { key: "status", label: "Status" },
          { key: "featured", label: "Featured" },
          { key: "actions", label: "Aksi" },
        ]}
        loading={loading}
        empty={<p className="py-10 text-center text-sm text-gray-400">Belum ada learning path. Buat yang pertama!</p>}
      >
        {paths.map((p) => (
          <Tr key={p.id}>
            <Td>
              <button onClick={() => router.push(`/admin/paths/${p.id}`)} className="text-left">
                <span className="flex items-center gap-2 font-medium text-warm-black hover:text-primary">
                  <Route size={14} className="text-gray-400" /> {p.title}
                </span>
                {p.subtitle && <span className="block text-xs text-gray-400">{p.subtitle}</span>}
              </button>
            </Td>
            <Td>{p.item_count}</Td>
            <Td>{p.level || "—"}</Td>
            <Td><StatusBadge status={p.status} /></Td>
            <Td>{p.is_featured ? "⭐" : "—"}</Td>
            <Td>
              <div className="flex items-center gap-1">
                <button onClick={() => router.push(`/admin/paths/${p.id}`)} className="p-1.5 text-gray-400 hover:text-primary"><Pencil size={15} /></button>
                <button onClick={() => setDeleteId(p.id)} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 size={15} /></button>
              </div>
            </Td>
          </Tr>
        ))}
      </AdminTable>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buat Learning Path Baru</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <label className="mb-1.5 block text-sm font-medium">Judul</label>
            <input
              className={inputClass}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createPath()}
              placeholder="Misal: Lolos JLPT N5 dalam 30 Hari"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowNew(false)}>Batal</Button>
            <Button onClick={createPath} loading={creating}>Buat & Edit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="Hapus learning path ini?"
        description="Path dan urutan langkahnya akan dihapus. Konten aslinya tidak terhapus."
        confirmLabel="Hapus"
        variant="danger"
        onConfirm={deletePath}
      />
    </div>
  );
}
