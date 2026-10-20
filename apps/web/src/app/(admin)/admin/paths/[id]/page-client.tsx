"use client";
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, Trash2, GripVertical, Search,
  BookOpen, Gift, PlayCircle, Wand2, AlertTriangle,
} from "lucide-react";
import {
  DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { toast } from "@/components/ui/toast";
import { AIFieldButton } from "@/components/ui/AIFieldButton";

interface PathInfo {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  thumbnail_url: string | null;
  level: string | null;
  status: string;
  is_featured: number;
  sort_order: number;
}

interface PathItem {
  id: string;
  content_id: string;
  section_label: string | null;
  sort_order: number;
  note: string | null;
  content_type: string;
  title: string | null;
  format: string | null;
  content_status: string | null;
  content_missing: number;
}

interface Skill {
  id: string;
  name: string;
  is_active?: number;
}

interface PickerItem {
  id: string;
  content_type: string;
  title: string;
  format: string;
  status: string;
}

const inputClass = "w-full px-3.5 py-2.5 text-sm rounded-xl border border-[rgba(12,12,10,0.12)] text-warm-black outline-none focus:border-primary focus:ring-2 focus:ring-primary-light transition-colors";

const TYPE_ICON: Record<string, typeof BookOpen> = {
  course: BookOpen,
  bonus: Gift,
  recording: PlayCircle,
  tool: Wand2,
};

const PICKER_TABS = [
  { key: "course", label: "Kelas" },
  { key: "recording", label: "Rekaman" },
  { key: "bonus", label: "Bonus" },
  { key: "tool", label: "Tool" },
];

function SortableStep({
  item, index, onDelete, onEditMeta,
}: {
  item: PathItem;
  index: number;
  onDelete: () => void;
  onEditMeta: (field: "section_label" | "note", value: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const Icon = TYPE_ICON[item.content_type] || BookOpen;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-start gap-3 rounded-xl border border-[rgba(12,12,10,0.08)] bg-white p-3 ${isDragging ? "opacity-50" : ""}`}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label={`Ubah urutan langkah ${index + 1}: ${item.title || ""} (gunakan Spasi lalu panah)`}
        className="mt-1 cursor-grab rounded p-0.5 text-gray-300 hover:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <GripVertical size={16} aria-hidden="true" />
      </button>
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Langkah {index + 1} · {item.format || item.content_type}
          </span>
          {item.content_missing === 1 && (
            <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
              <AlertTriangle size={10} /> konten dihapus
            </span>
          )}
          {item.content_status === "draft" && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600">draft</span>
          )}
        </div>
        <p className="truncate text-sm font-semibold text-warm-black">{item.title || "(konten tidak ditemukan)"}</p>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <input
            className="w-40 rounded-lg border border-[rgba(12,12,10,0.1)] px-2 py-1 text-xs outline-none focus:border-primary"
            placeholder="Section (opsional)"
            defaultValue={item.section_label || ""}
            onBlur={(e) => {
              if (e.target.value !== (item.section_label || "")) onEditMeta("section_label", e.target.value);
            }}
          />
          <input
            className="min-w-48 flex-1 rounded-lg border border-[rgba(12,12,10,0.1)] px-2 py-1 text-xs outline-none focus:border-primary"
            placeholder="Catatan kurator (opsional)"
            defaultValue={item.note || ""}
            onBlur={(e) => {
              if (e.target.value !== (item.note || "")) onEditMeta("note", e.target.value);
            }}
          />
        </div>
      </div>
      <button onClick={onDelete} className="mt-1 p-1.5 text-gray-300 hover:text-red-500">
        <Trash2 size={15} />
      </button>
    </div>
  );
}

export default function AdminPathBuilderClient() {
  const params = useParams();
  const router = useRouter();
  const [id, setId] = useState("");

  // Static export menyajikan placeholder /admin/paths/_/ — id asli dibaca dari URL browser
  useEffect(() => {
    if (typeof window !== "undefined") {
      const parts = window.location.pathname.split("/").filter(Boolean);
      const pathId = parts[parts.length - 1];
      if (pathId && pathId !== "_") {
        setId(pathId);
      } else if (params?.id && params.id !== "_") {
        setId(params.id as string);
      }
    }
  }, [params?.id]);

  const [path, setPath] = useState<PathInfo | null>(null);
  const [items, setItems] = useState<PathItem[]>([]);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [pathSkills, setPathSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTab, setPickerTab] = useState("course");
  const [pickerQ, setPickerQ] = useState("");
  const [pickerItems, setPickerItems] = useState<PickerItem[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pathRes, skillsRes] = await Promise.all([
        fetch(`/api/admin/paths/${id}`, { credentials: "include" }).then((r) => r.json()),
        fetch("/api/admin/skills", { credentials: "include" }).then((r) => r.json()),
      ]);
      if (pathRes.success) {
        setPath(pathRes.data.path);
        setItems(pathRes.data.items);
        setPathSkills((pathRes.data.skills as Skill[]).map((s) => s.id));
      }
      if (skillsRes.success) setAllSkills((skillsRes.data as Skill[]).filter((s) => s.is_active !== 0));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id) fetchData(); }, [id]);

  // Picker search
  useEffect(() => {
    if (!pickerOpen) return;
    setPickerLoading(true);
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ type: pickerTab });
      if (pickerQ.trim()) qs.set("q", pickerQ.trim());
      fetch(`/api/admin/content?${qs.toString()}`, { credentials: "include" })
        .then((r) => r.json())
        .then((res) => {
          if (res.success) setPickerItems(res.data);
        })
        .finally(() => setPickerLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [pickerOpen, pickerTab, pickerQ]);

  const savePath = async () => {
    if (!path) return;
    setSaving(true);
    try {
      const [infoRes, skillsRes] = await Promise.all([
        fetch(`/api/admin/paths/${id}`, {
          method: "PUT", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: path.title, slug: path.slug, subtitle: path.subtitle,
            description: path.description, thumbnail_url: path.thumbnail_url,
            level: path.level, status: path.status,
            is_featured: path.is_featured, sort_order: path.sort_order,
          }),
        }).then((r) => r.json()),
        fetch(`/api/admin/paths/${id}/skills`, {
          method: "PUT", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skill_ids: pathSkills }),
        }).then((r) => r.json()),
      ]);
      if (infoRes.success && skillsRes.success) toast.success("Learning path disimpan");
      else toast.error(infoRes.error || skillsRes.error || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const addItem = async (contentId: string) => {
    const res = await fetch(`/api/admin/paths/${id}/items`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content_id: contentId }),
    }).then((r) => r.json());
    if (res.success) {
      toast.success("Konten ditambahkan");
      fetchData();
    } else toast.error(res.error || "Gagal menambahkan konten");
  };

  const deleteItem = async () => {
    if (!deleteItemId) return;
    const res = await fetch(`/api/admin/paths/${id}/items/${deleteItemId}`, {
      method: "DELETE", credentials: "include",
    }).then((r) => r.json());
    if (res.success) {
      setItems((prev) => prev.filter((it) => it.id !== deleteItemId));
      toast.success("Langkah dihapus");
    } else toast.error(res.error || "Gagal menghapus item");
    setDeleteItemId(null);
  };

  const editItemMeta = async (itemId: string, field: "section_label" | "note", value: string) => {
    const res = await fetch(`/api/admin/paths/${id}/items/${itemId}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value || null }),
    }).then((r) => r.json());
    if (res.success) {
      setItems((prev) => prev.map((it) => (it.id === itemId ? { ...it, [field]: value || null } : it)));
      toast.success(field === "note" ? "Catatan disimpan" : "Section disimpan");
    } else {
      toast.error(res.error || "Gagal menyimpan perubahan");
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIdx = prev.findIndex((it) => it.id === active.id);
      const newIdx = prev.findIndex((it) => it.id === over.id);
      const next = arrayMove(prev, oldIdx, newIdx);
      fetch(`/api/admin/paths/${id}/items/reorder`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item_ids: next.map((it) => it.id) }),
      }).catch(console.error);
      return next;
    });
  };

  if (loading) return <p className="py-10 text-center text-sm text-gray-400">Memuat…</p>;
  if (!path) return <p className="py-10 text-center text-sm text-gray-400">Learning path tidak ditemukan.</p>;

  const inPathContentIds = new Set(items.map((it) => it.content_id));

  return (
    <div>
      <button
        onClick={() => router.push("/admin/paths")}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-primary"
      >
        <ArrowLeft size={15} /> Semua Learning Path
      </button>

      <PageHeader
        title={path.title}
        description={`/paths/${path.slug}`}
        actions={<Button onClick={savePath} loading={saving}>Simpan Path</Button>}
      />

      {/* Info */}
      <Card className="mb-5 max-w-2xl">
        <CardHeader><CardTitle>Info Path</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-sm font-medium text-warm-black">Judul</label>
                <input className={inputClass} value={path.title} onChange={(e) => setPath({ ...path, title: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">Slug</label>
                <input className={inputClass} value={path.slug} onChange={(e) => setPath({ ...path, slug: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">Level</label>
                <select className={inputClass} value={path.level || ""} onChange={(e) => setPath({ ...path, level: e.target.value || null })}>
                  <option value="">Semua level</option>
                  <option value="beginner">Pemula</option>
                  <option value="intermediate">Menengah</option>
                  <option value="advanced">Lanjutan</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">Status</label>
                <select className={inputClass} value={path.status} onChange={(e) => setPath({ ...path, status: e.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">Featured</label>
                <select className={inputClass} value={path.is_featured} onChange={(e) => setPath({ ...path, is_featured: Number(e.target.value) })}>
                  <option value={0}>Tidak</option>
                  <option value={1}>Ya (tampil di Jelajahi)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-warm-black">Subjudul</label>
              <input className={inputClass} value={path.subtitle || ""} onChange={(e) => setPath({ ...path, subtitle: e.target.value })} />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-warm-black">Deskripsi</label>
                <AIFieldButton
                  field="description"
                  fieldName="Deskripsi"
                  entityType="course"
                  context={{ title: path.title, subtitle: path.subtitle || "" }}
                  disabled={!path.title.trim()}
                  onFill={(content) => setPath({ ...path, description: content })}
                />
              </div>
              <textarea className={inputClass} rows={3} value={path.description || ""} onChange={(e) => setPath({ ...path, description: e.target.value })} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-warm-black">Thumbnail URL</label>
              <input className={inputClass} value={path.thumbnail_url || ""} onChange={(e) => setPath({ ...path, thumbnail_url: e.target.value })} placeholder="https://..." />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-warm-black">Skill terkait</label>
              <div className="flex flex-wrap gap-2">
                {allSkills.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      setPathSkills((prev) =>
                        prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]
                      )
                    }
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      pathSkills.includes(s.id)
                        ? "bg-primary text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Steps */}
      <Card className="max-w-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Langkah Path ({items.length})</CardTitle>
          <Button size="sm" onClick={() => setPickerOpen(true)}>
            <Plus size={14} className="mr-1" /> Tambah Konten
          </Button>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              Belum ada langkah. Tambahkan kelas, rekaman, bonus, atau tool.
            </p>
          ) : (
            <DndContext sensors={sensors} onDragEnd={onDragEnd}>
              <SortableContext items={items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2.5">
                  {items.map((item, index) => (
                    <SortableStep
                      key={item.id}
                      item={item}
                      index={index}
                      onDelete={() => setDeleteItemId(item.id)}
                      onEditMeta={(field, value) => editItemMeta(item.id, field, value)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={!!deleteItemId}
        onOpenChange={(open) => { if (!open) setDeleteItemId(null); }}
        title="Hapus langkah ini dari path?"
        description="Konten aslinya tidak terhapus — hanya dikeluarkan dari urutan path ini."
        confirmLabel="Hapus Langkah"
        variant="danger"
        onConfirm={deleteItem}
      />

      {/* Content picker */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Tambah Konten ke Path</DialogTitle>
          </DialogHeader>

          <div className="flex gap-2">
            {PICKER_TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setPickerTab(t.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  pickerTab === t.key ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              className={`${inputClass} pl-9`}
              value={pickerQ}
              onChange={(e) => setPickerQ(e.target.value)}
              placeholder="Cari judul…"
            />
          </div>

          <div className="mt-2 max-h-80 overflow-y-auto">
            {pickerLoading ? (
              <p className="py-6 text-center text-sm text-gray-400">Mencari…</p>
            ) : pickerItems.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">Tidak ada konten.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {pickerItems.map((pi) => {
                  const Icon = TYPE_ICON[pi.content_type] || BookOpen;
                  const already = inPathContentIds.has(pi.id);
                  return (
                    <li key={pi.id}>
                      <button
                        disabled={already}
                        onClick={() => addItem(pi.id)}
                        className="flex w-full items-center gap-3 px-2 py-2.5 text-left transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
                          <Icon size={14} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-warm-black">{pi.title}</span>
                          <span className="text-[11px] text-gray-400">
                            {pi.format}{pi.status === "draft" ? " · draft" : ""}
                          </span>
                        </span>
                        {already ? (
                          <span className="text-[11px] font-medium text-gray-400">Sudah ada</span>
                        ) : (
                          <Plus size={15} className="text-primary" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
