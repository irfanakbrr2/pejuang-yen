"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, @next/next/no-img-element */
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Save, Plus, Trash2, Play, FileText, Pencil, ArrowLeft, Link as LinkIcon, X, GripVertical } from "lucide-react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { AIFieldButton } from "@/components/ui/AIFieldButton";
import { AIBundleButton } from "@/components/ui/AIBundleButton";
import { CategorySelector } from "@/components/admin/CategorySelector";
import { SkillTagPicker } from "@/components/admin/SkillTagPicker";

interface ResourceLink { title: string; url: string; }
interface Lesson { id: string; title: string; slug: string; lesson_type: string; video_provider?: string; video_url?: string; content_markdown?: string; content_html?: string; content_embed?: string; content_format?: string; description?: string; resources_json?: string; is_preview: number; sort_order: number; status: string; }
interface Module { id: string; title: string; description?: string; sort_order: number; lessons: Lesson[]; }
interface Course { id: string; slug: string; title: string; subtitle?: string; description?: string; short_description?: string; thumbnail_url?: string; level?: string; category?: string; primary_category_id?: string | null; secondary_category_ids?: string[]; learning_outcome?: string; recommended_for?: string; duration_minutes?: number; instructor_name?: string; access_type: string; price: number; compare_at_price?: number; status: string; sort_order: number; }

type EditLessonState = { id: string; title: string; slug: string; lesson_type: string; video_provider: string; video_url: string; content_markdown: string; content_html: string; content_embed: string; description: string; resources: ResourceLink[]; is_preview: number; sort_order: number; status: string; };
type NewLessonState = { moduleId: string; title: string; slug: string; lesson_type: string; video_url: string; description: string; content_html: string };

const inputClass = "w-full px-3.5 py-2.5 text-sm rounded-xl border border-[rgba(12,12,10,0.12)] text-warm-black outline-none focus:border-primary focus:ring-2 focus:ring-primary-light transition-colors";

function isSafeResourceUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) || (url.startsWith("/") && !url.startsWith("//"));
}

function parseResources(json?: string): ResourceLink[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const raw = item as Record<string, unknown>;
        const title = typeof raw.title === "string" ? raw.title.trim() : "";
        const url = typeof raw.url === "string" ? raw.url.trim() : "";
        return title && url && isSafeResourceUrl(url) ? { title, url } : null;
      })
      .filter((item): item is ResourceLink => Boolean(item));
  } catch { return []; }
}

function serializeResources(resources: ResourceLink[]): string | undefined {
  const filtered = resources
    .map((r) => ({ title: r.title.trim(), url: r.url.trim() }))
    .filter((r) => r.title && r.url && isSafeResourceUrl(r.url));
  return filtered.length > 0 ? JSON.stringify(filtered) : undefined;
}

// ── Drag-and-drop components ─────────────────────────────────────────────────

function SortableLesson({
  lesson,
  onEdit,
  onDelete,
}: {
  lesson: Lesson;
  onEdit: (l: Lesson) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lesson.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };
  const resources = parseResources(lesson.resources_json);
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 px-4 py-3 border-b border-[rgba(12,12,10,0.05)] last:border-b-0 bg-white">
      <button
        {...attributes}
        {...listeners}
        type="button"
        tabIndex={-1}
        className="touch-none flex-shrink-0 cursor-grab active:cursor-grabbing text-[rgba(12,12,10,0.2)] hover:text-[rgba(12,12,10,0.5)] transition-colors"
      >
        <GripVertical size={14} />
      </button>
      <span className="text-[rgba(12,12,10,0.35)] w-4 flex-shrink-0">
        {lesson.lesson_type === "video" ? <Play size={13} /> : <FileText size={13} />}
      </span>
      <span className="text-sm font-medium text-warm-black flex-1 min-w-0 truncate">{lesson.title}</span>
      {resources.length > 0 && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 flex-shrink-0">
          <LinkIcon size={9} />{resources.length}
        </span>
      )}
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase flex-shrink-0 ${lesson.status === "published" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
        {lesson.status}
      </span>
      {lesson.is_preview ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700 flex-shrink-0">Preview</span>
      ) : null}
      <button onClick={() => onEdit(lesson)} className="p-1 text-[rgba(12,12,10,0.35)] hover:text-primary transition-colors flex-shrink-0" title="Edit">
        <Pencil size={13} />
      </button>
      <button onClick={() => onDelete(lesson.id)} className="p-1 text-[rgba(12,12,10,0.35)] hover:text-red-600 transition-colors flex-shrink-0">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function LessonDragOverlay({ lesson }: { lesson: Lesson }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-white border border-primary/20 rounded-xl shadow-lg opacity-95 max-w-md">
      <GripVertical size={14} className="text-[rgba(12,12,10,0.4)] flex-shrink-0" />
      <span className="text-[rgba(12,12,10,0.35)] w-4 flex-shrink-0">
        {lesson.lesson_type === "video" ? <Play size={13} /> : <FileText size={13} />}
      </span>
      <span className="text-sm font-medium text-warm-black truncate">{lesson.title}</span>
    </div>
  );
}

function ModuleDropZone({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`transition-colors rounded-b-xl ${isOver ? "bg-blue-50" : ""}`}>
      {children}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdminCourseDetailClient() {
  const pathname = usePathname();
  const id = pathname.split('/').filter(Boolean)[2];
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [tags, setTags] = useState<{tag_type: string, tag_value: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [savingTags, setSavingTags] = useState(false);

  const uploadCover = async (file: File) => {
    if (!course) return;
    if (!file.type.startsWith("image/")) { toast.error("File harus berupa gambar"); return; }
    setUploadingCover(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "Kelas");
      const up = await fetch("/api/admin/storage/upload", { method: "POST", credentials: "include", body: fd });
      const data = await up.json();
      if (!data.success) { toast.error(data.error || "Upload gagal"); return; }
      setCourse({ ...course, thumbnail_url: `https://file.pejuangyen.com/${data.data.key}` });
      toast.success("Sampul terunggah");
    } catch { toast.error("Upload gagal. Coba lagi."); } finally { setUploadingCover(false); }
  };
  const [newModule, setNewModule] = useState("");
  const [editModule, setEditModule] = useState<{ id: string; title: string } | null>(null);
  const [savingModule, setSavingModule] = useState(false);
  const [newLesson, setNewLesson] = useState<NewLessonState | null>(null);
  const [editLesson, setEditLesson] = useState<EditLessonState | null>(null);
  const [savingLesson, setSavingLesson] = useState(false);
  const [deleteModuleConfirm, setDeleteModuleConfirm] = useState<string | null>(null);
  const [deleteLessonConfirm, setDeleteLessonConfirm] = useState<string | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragStart = ({ active }: DragStartEvent) => setActiveLessonId(String(active.id));

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const activeContainerId = (active.data.current as { sortable?: { containerId?: string } } | undefined)?.sortable?.containerId;
    const overContainerId = (over.data.current as { sortable?: { containerId?: string } } | undefined)?.sortable?.containerId ?? overId;
    if (!activeContainerId || activeContainerId === overContainerId) return;
    setModules(prev => {
      const srcMod = prev.find(m => m.id === activeContainerId);
      const tgtMod = prev.find(m => m.id === overContainerId);
      if (!srcMod || !tgtMod) return prev;
      const lesson = srcMod.lessons.find(l => l.id === activeId);
      if (!lesson) return prev;
      const overIdx = tgtMod.lessons.findIndex(l => l.id === overId);
      return prev.map(m => {
        if (m.id === activeContainerId) return { ...m, lessons: m.lessons.filter(l => l.id !== activeId) };
        if (m.id === overContainerId) {
          const next = [...m.lessons];
          if (overIdx >= 0) next.splice(overIdx, 0, lesson); else next.push(lesson);
          return { ...m, lessons: next };
        }
        return m;
      });
    });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveLessonId(null);
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    setModules(prev => {
      const srcMod = prev.find(m => m.lessons.some(l => l.id === activeId));
      if (!srcMod) return prev;
      const overInSrc = srcMod.lessons.some(l => l.id === overId);
      let next = prev;
      if (overInSrc) {
        const oldIdx = srcMod.lessons.findIndex(l => l.id === activeId);
        const newIdx = srcMod.lessons.findIndex(l => l.id === overId);
        if (oldIdx !== newIdx) {
          next = prev.map(m => m.id === srcMod.id ? { ...m, lessons: arrayMove(m.lessons, oldIdx, newIdx) } : m);
        }
      }
      const payload = next.flatMap(m => m.lessons.map((l, i) => ({ id: l.id, module_id: m.id, sort_order: i })));
      fetch('/api/admin/lessons/reorder', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessons: payload }),
      }).catch(console.error);
      return next;
    });
  };

  // silent=true → refetch tanpa menampilkan skeleton penuh, sehingga pohon modul
  // tidak unmount dan posisi scroll tetap terjaga setelah tambah/edit/hapus.
  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [res, tagsRes] = await Promise.all([
        fetch(`/api/admin/courses/${id}`, { credentials: "include" }),
        fetch(`/api/admin/resources/${id}/tags?type=course`, { credentials: "include" })
      ]);
      const data = await res.json();
      const tagsData = await tagsRes.json();

      if (data.success) { setCourse(data.data.course); setModules(data.data.modules); }
      if (tagsData.success) { setTags(tagsData.data); }
    } catch (err) {
      console.error(err);
    }
    if (!silent) setLoading(false);
  };

  useEffect(() => { fetchData(); }, [id]);

  const saveCourse = async () => {
    if (!course) return;
    if (course.status === "published" && !course.primary_category_id) {
      toast.error("Kelas published wajib punya kategori utama");
      return;
    }
    setSaving(true);
    try {
      // Strip empty strings so Zod's .url() and .enum() validators don't reject them
      const payload = Object.fromEntries(
        Object.entries(course).filter(([, v]) => v !== "" && v !== null && v !== undefined)
      );
      // Kategori selalu ikut terkirim (boleh null/[] untuk menghapus)
      payload.primary_category_id = course.primary_category_id ?? null;
      payload.secondary_category_ids = course.secondary_category_ids ?? [];
      const res = await fetch(`/api/admin/courses/${course.id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) toast.success("Kelas berhasil disimpan");
      else toast.error(data.error || "Gagal menyimpan");
    } catch {
      toast.error("Terjadi kesalahan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  const saveTags = async () => {
    setSavingTags(true);
    try {
      const res = await fetch(`/api/admin/resources/${id}/tags`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource_type: "course", tags }),
      });
      const data = await res.json();
      if (data.success) toast.success("Tags berhasil disimpan");
      else toast.error(data.error || "Gagal menyimpan tags");
    } catch {
      toast.error("Terjadi kesalahan saat menyimpan tags.");
    } finally {
      setSavingTags(false);
    }
  };

  const addModule = async () => {
    if (!newModule.trim() || !course) return;
    try {
      await fetch(`/api/admin/modules`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: course.id, title: newModule, sort_order: modules.length + 1 }),
      });
      setNewModule("");
      fetchData(true);
      toast.success("Modul ditambahkan");
    } catch {
      toast.error("Gagal menambahkan modul");
    }
  };

  const updateModule = async () => {
    if (!editModule || !editModule.title.trim()) return;
    setSavingModule(true);
    try {
      const res = await fetch(`/api/admin/modules/${editModule.id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editModule.title.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setEditModule(null);
        fetchData(true);
        toast.success("Modul diperbarui");
      } else {
        toast.error(data.error || "Gagal memperbarui modul");
      }
    } catch {
      toast.error("Terjadi kesalahan. Coba lagi.");
    } finally {
      setSavingModule(false);
    }
  };

  const deleteModule = async (moduleId: string) => {
    try {
      await fetch(`/api/admin/modules/${moduleId}`, { method: "DELETE", credentials: "include" });
      fetchData(true);
      toast.success("Modul dihapus");
    } catch {
      toast.error("Gagal menghapus modul");
    }
  };

  const addLesson = async () => {
    if (!newLesson || !newLesson.title.trim()) return;
    const mod = modules.find(m => m.id === newLesson.moduleId);
    try {
      const html = newLesson.content_html.trim();
      const hasPublishableContent = newLesson.lesson_type === "video"
        ? Boolean(newLesson.video_url.trim() || html)
        : newLesson.lesson_type === "text"
          ? Boolean(html)
          : false;
      const res = await fetch(`/api/admin/lessons`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_id: course!.id, module_id: newLesson.moduleId,
          title: newLesson.title,
          slug: newLesson.slug || newLesson.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          lesson_type: newLesson.lesson_type || "video",
          video_url: newLesson.video_url || undefined,
          video_provider: newLesson.video_url ? "youtube" : undefined,
          content_html: html || undefined,
          content_format: "html",
          description: newLesson.description || undefined,
          sort_order: mod ? mod.lessons.length + 1 : 1,
          status: hasPublishableContent ? "published" : "draft",
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || "Gagal menambahkan lesson");
        return;
      }
      setNewLesson(null);
      fetchData(true);
      toast.success("Lesson ditambahkan");
    } catch {
      toast.error("Gagal menambahkan lesson");
    }
  };

  const openEditLesson = (lesson: Lesson) => {
    setEditLesson({
      id: lesson.id,
      title: lesson.title,
      slug: lesson.slug,
      lesson_type: lesson.lesson_type,
      video_provider: lesson.video_provider || "",
      video_url: lesson.video_url || "",
      content_markdown: lesson.content_markdown || "",
      content_html: lesson.content_html || lesson.content_markdown || "",
      content_embed: lesson.content_embed || "",
      description: lesson.description || "",
      resources: parseResources(lesson.resources_json),
      is_preview: lesson.is_preview,
      sort_order: lesson.sort_order,
      status: lesson.status,
    });
  };

  const saveLesson = async () => {
    if (!editLesson) return;
    setSavingLesson(true);
    try {
      const res = await fetch(`/api/admin/lessons/${editLesson.id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editLesson.title,
          slug: editLesson.slug,
          lesson_type: editLesson.lesson_type,
          video_provider: editLesson.video_provider || undefined,
          video_url: editLesson.video_url || undefined,
          content_markdown: editLesson.content_markdown || undefined,
          content_html: editLesson.content_html.trim() || undefined,
          content_embed: editLesson.content_embed.trim() || undefined,
          content_format: "html",
          description: editLesson.description || undefined,
          resources_json: serializeResources(editLesson.resources),
          is_preview: editLesson.is_preview,
          sort_order: editLesson.sort_order,
          status: editLesson.status,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Lesson berhasil disimpan");
        setEditLesson(null);
        fetchData(true);
      } else {
        toast.error(data.error || "Gagal menyimpan lesson");
      }
    } catch {
      toast.error("Terjadi kesalahan. Coba lagi.");
    } finally {
      setSavingLesson(false);
    }
  };

  const deleteLesson = async (lessonId: string) => {
    try {
      await fetch(`/api/admin/lessons/${lessonId}`, { method: "DELETE", credentials: "include" });
      fetchData(true);
      toast.success("Lesson dihapus");
    } catch {
      toast.error("Gagal menghapus lesson");
    }
  };

  const addResource = () => {
    if (!editLesson) return;
    setEditLesson({ ...editLesson, resources: [...editLesson.resources, { title: "", url: "" }] });
  };

  const updateResource = (idx: number, field: "title" | "url", value: string) => {
    if (!editLesson) return;
    const updated = editLesson.resources.map((r, i) => i === idx ? { ...r, [field]: value } : r);
    setEditLesson({ ...editLesson, resources: updated });
  };

  const removeResource = (idx: number) => {
    if (!editLesson) return;
    setEditLesson({ ...editLesson, resources: editLesson.resources.filter((_, i) => i !== idx) });
  };

  if (loading) return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="skeleton h-6 w-64 rounded mb-2" />
          <div className="skeleton h-4 w-32 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="skeleton h-9 w-24 rounded-lg" />
          <div className="skeleton h-9 w-24 rounded-lg" />
        </div>
      </div>
      <Card className="mb-5 max-w-2xl">
        <CardContent className="p-6">
          <div className="skeleton h-5 w-32 rounded mb-4" />
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="mb-4">
              <div className="skeleton h-3 w-20 rounded mb-2" />
              <div className="skeleton h-10 w-full rounded-lg" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );

  if (!course) return (
    <div className="flex items-center justify-center py-20 text-sm text-red-600">Course tidak ditemukan</div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit: ${course.title}`}
        description={
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-[rgba(12,12,10,0.45)]">/{course.slug}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${course.status === "published" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
              {course.status}
            </span>
          </div>
        }
        actions={
        <div className="flex items-center gap-2">
          <Button onClick={saveCourse} loading={saving} size="md">
            <Save size={14} />
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
          <Button variant="secondary" onClick={() => router.push("/admin/courses")} size="md">
            <ArrowLeft size={14} />
            Kembali
          </Button>
        </div>
        }
      />

      {/* Course Info */}
      <Card className="mb-5 max-w-2xl">
        <CardHeader>
          <CardTitle>Informasi Kelas</CardTitle>
          <AIBundleButton
            label="Generate copy"
            entityType="course"
            fields={["subtitle", "short_description", "description"]}
            context={{
              title: course.title,
              category: course.category,
              level: course.level,
              access_type: course.access_type,
              instructor_name: course.instructor_name,
            }}
            disabled={!course.title.trim()}
            onFill={(fields) => setCourse({ ...course, ...fields })}
          />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-warm-black">Judul</label>
              <input className={inputClass} value={course.title} onChange={e => setCourse({ ...course, title: e.target.value })} />
            </div>
            <CategorySelector
              primaryId={course.primary_category_id || null}
              secondaryIds={course.secondary_category_ids || []}
              onChange={(p, s) => setCourse({ ...course, primary_category_id: p, secondary_category_ids: s })}
              required={course.status === "published"}
            />
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">Level</label>
                <select className={inputClass} value={course.level || ""} onChange={e => setCourse({ ...course, level: e.target.value })}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">Tipe Akses</label>
                <select className={inputClass} value={course.access_type} onChange={e => setCourse({ ...course, access_type: e.target.value })}>
                  <option value="free">Free — semua user</option>
                  <option value="paid">Berbayar — beli satuan (kelas satuan)</option>
                  <option value="membership_only">Premium — membership aktif</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">Harga (IDR)</label>
                <input className={inputClass} type="number" value={course.price} onChange={e => setCourse({ ...course, price: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">Durasi (menit)</label>
                <input className={inputClass} type="number" min={0} value={course.duration_minutes || 0} onChange={e => setCourse({ ...course, duration_minutes: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-warm-black">Learning Outcome</label>
              <textarea className={inputClass} rows={2} value={course.learning_outcome || ""} onChange={e => setCourse({ ...course, learning_outcome: e.target.value })} placeholder="Setelah kelas ini, user bisa..." />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-warm-black">Recommended For</label>
              <input className={inputClass} value={course.recommended_for || ""} onChange={e => setCourse({ ...course, recommended_for: e.target.value })} placeholder="Pemula yang baru mulai belajar bahasa Jepang" />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-warm-black">Subtitle</label>
                <AIFieldButton
                  field="subtitle"
                  fieldName="Subtitle"
                  entityType="course"
                  context={{
                    title: course.title,
                    category: course.category,
                    level: course.level,
                    access_type: course.access_type,
                  }}
                  disabled={!course.title.trim()}
                  onFill={(content) => setCourse({ ...course, subtitle: content })}
                />
              </div>
              <input className={inputClass} value={course.subtitle || ""} onChange={e => setCourse({ ...course, subtitle: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-warm-black">Deskripsi Singkat</label>
                <AIFieldButton
                  field="short_description"
                  fieldName="Deskripsi Singkat"
                  entityType="course"
                  context={{
                    title: course.title,
                    category: course.category,
                    level: course.level,
                    access_type: course.access_type,
                  }}
                  disabled={!course.title.trim()}
                  onFill={(content) => setCourse({ ...course, short_description: content })}
                />
              </div>
              <textarea className={inputClass} rows={2} value={course.short_description || ""} onChange={e => setCourse({ ...course, short_description: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-warm-black">Deskripsi</label>
                <AIFieldButton
                  field="description"
                  fieldName="Deskripsi"
                  entityType="course"
                  context={{
                    title: course.title,
                    category: course.category,
                    level: course.level,
                    access_type: course.access_type,
                  }}
                  disabled={!course.title.trim()}
                  onFill={(content) => setCourse({ ...course, description: content })}
                />
              </div>
              <textarea className={inputClass} rows={3} value={course.description || ""} onChange={e => setCourse({ ...course, description: e.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-warm-black">Sampul Kelas</label>
              {course.thumbnail_url ? (
                <div className="relative w-48">
                  <div className="rounded-lg overflow-hidden border border-[rgba(12,12,10,0.12)]">
                    <img src={course.thumbnail_url} alt="Preview sampul" className="w-full aspect-video object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setCourse({ ...course, thumbnail_url: "" })}
                    className="absolute -right-2 -top-2 rounded-full bg-red-600 text-white w-6 h-6 text-xs font-bold shadow hover:bg-red-700"
                    title="Hapus sampul"
                  >×</button>
                </div>
              ) : (
                <label className={`flex flex-col items-center justify-center gap-1 w-48 aspect-video rounded-lg border-2 border-dashed border-[rgba(12,12,10,0.18)] cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors ${uploadingCover ? "opacity-60 pointer-events-none" : ""}`}>
                  <span className="text-2xl text-[rgba(12,12,10,0.35)]">＋</span>
                  <span className="text-xs font-medium text-[rgba(12,12,10,0.55)]">{uploadingCover ? "Mengunggah…" : "Upload gambar"}</span>
                  <input type="file" accept="image/*" className="hidden" disabled={uploadingCover}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = ""; }} />
                </label>
              )}
              <p className="text-xs text-[rgba(12,12,10,0.45)]">Rasio 16:9, maks 50MB. Tersimpan ke penyimpanan PejuangYen.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Skill & Tags (taxonomy baru) */}
      <SkillTagPicker contentId={`course:${id}`} />

      {/* Tags Info */}
      <Card className="mb-5 max-w-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Personalization Tags</CardTitle>
          <Button onClick={saveTags} loading={savingTags} size="sm">
            Simpan Tags
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-gray-500">
              Tambahkan tag untuk membantu sistem merekomendasikan course ini ke pengguna yang tepat.
            </p>
            <div className="space-y-3">
              {tags.map((tag, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <select
                    className={inputClass + " w-1/3"}
                    value={tag.tag_type}
                    onChange={(e) => {
                      const newTags = [...tags];
                      newTags[idx].tag_type = e.target.value;
                      setTags(newTags);
                    }}
                  >
                    <option value="role">Peran / Profesi</option>
                    <option value="goal">Tujuan</option>
                  </select>
                  <input
                    className={inputClass + " flex-1"}
                    placeholder="Nilai tag (mis. pemula, jlpt-n5)"
                    value={tag.tag_value}
                    onChange={(e) => {
                      const newTags = [...tags];
                      newTags[idx].tag_value = e.target.value;
                      setTags(newTags);
                    }}
                  />
                  <button
                    onClick={() => setTags(tags.filter((_, i) => i !== idx))}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setTags([...tags, { tag_type: 'role', tag_value: '' }])}
                className="w-full justify-center mt-2"
              >
                <Plus size={14} className="mr-1" /> Tambah Tag
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modules & Lessons */}
      <div>
        <h3 className="font-semibold text-warm-black mb-4">Modul & Lessons</h3>
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-col gap-3">
            {modules.map((mod, mi) => (
              <div key={mod.id} className="bg-white rounded-xl border border-[rgba(12,12,10,0.08)] overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 bg-warm-cream border-b border-[rgba(12,12,10,0.08)]">
                  <span className="font-semibold text-sm text-warm-black">Modul {mi + 1}: {mod.title}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setNewLesson({ moduleId: mod.id, title: "", slug: "", lesson_type: "video", video_url: "", description: "", content_html: "" })}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-primary bg-primary-light rounded-lg hover:bg-green-100 transition-colors"
                    >
                      <Plus size={11} />
                      Lesson
                    </button>
                    <button
                      onClick={() => setEditModule({ id: mod.id, title: mod.title })}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-warm-black bg-warm-cream rounded-lg hover:bg-[rgba(12,12,10,0.06)] transition-colors"
                      title="Edit judul modul"
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      onClick={() => setDeleteModuleConfirm(mod.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
                <SortableContext id={mod.id} items={mod.lessons.map(l => l.id)} strategy={verticalListSortingStrategy}>
                  <ModuleDropZone id={mod.id}>
                    {mod.lessons.length === 0 ? (
                      <div className="px-5 py-5 text-sm text-[rgba(12,12,10,0.3)] text-center">
                        Belum ada lesson — drag ke sini untuk memindahkan
                      </div>
                    ) : (
                      <div>
                        {mod.lessons.map(lesson => (
                          <SortableLesson
                            key={lesson.id}
                            lesson={lesson}
                            onEdit={openEditLesson}
                            onDelete={setDeleteLessonConfirm}
                          />
                        ))}
                      </div>
                    )}
                  </ModuleDropZone>
                </SortableContext>
              </div>
            ))}
          </div>
          <DragOverlay>
            {activeLessonId ? (
              <LessonDragOverlay
                lesson={modules.flatMap(m => m.lessons).find(l => l.id === activeLessonId)!}
              />
            ) : null}
          </DragOverlay>
        </DndContext>

        <div className="flex items-center gap-3 mt-4">
          <input
            className="px-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black outline-none focus:border-primary focus:ring-2 focus:ring-primary-light transition-colors max-w-xs w-full"
            placeholder="Nama modul baru..."
            value={newModule}
            onChange={e => setNewModule(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addModule()}
          />
          <Button variant="secondary" onClick={addModule} size="md">
            <Plus size={14} />
            Tambah Modul
          </Button>
        </div>
      </div>

      {/* Add Lesson Dialog */}
      <Dialog open={!!newLesson} onOpenChange={(open) => { if (!open) setNewLesson(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Tambah Lesson Baru</DialogTitle>
            {newLesson && (
              <AIBundleButton
                label="Generate lesson copy"
                entityType="lesson"
                fields={["description", "content_html"]}
                context={{
                  course_title: course.title,
                  lesson_title: newLesson.title,
                  lesson_type: newLesson.lesson_type,
                }}
                disabled={!newLesson.title.trim()}
                onFill={(fields) => setNewLesson({ ...newLesson, ...fields })}
              />
            )}
          </DialogHeader>
          {newLesson && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">Judul *</label>
                <input className={inputClass} value={newLesson.title} onChange={e => setNewLesson({ ...newLesson, title: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">Slug</label>
                <input className={inputClass} value={newLesson.slug} onChange={e => setNewLesson({ ...newLesson, slug: e.target.value })} placeholder="auto-generated" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">Tipe</label>
                <select className={inputClass} value={newLesson.lesson_type} onChange={e => setNewLesson({ ...newLesson, lesson_type: e.target.value })}>
                  <option value="video">Video</option>
                  <option value="text">Text</option>
                  <option value="quiz">Quiz</option>
                  <option value="resource">Resource</option>
                </select>
              </div>
              {newLesson.lesson_type === "video" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-warm-black">YouTube URL</label>
                  <input className={inputClass} value={newLesson.video_url} onChange={e => setNewLesson({ ...newLesson, video_url: e.target.value })} placeholder="https://youtube.com/watch?v=..." />
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-warm-black">Deskripsi Singkat</label>
                  <AIFieldButton
                    field="description"
                    fieldName="Deskripsi Singkat"
                    entityType="lesson"
                    context={{
                      course_title: course.title,
                      lesson_title: newLesson.title,
                      lesson_type: newLesson.lesson_type,
                    }}
                    disabled={!newLesson.title.trim()}
                    onFill={(content) => setNewLesson({ ...newLesson, description: content })}
                  />
                </div>
                <textarea
                  className={inputClass}
                  rows={2}
                  value={newLesson.description}
                  onChange={e => setNewLesson({ ...newLesson, description: e.target.value })}
                  placeholder="Ringkasan apa yang akan dipelajari di lesson ini..."
                />
              </div>
              {(newLesson.lesson_type === "text" || newLesson.lesson_type === "video" || newLesson.lesson_type === "quiz") && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-warm-black">
                      {newLesson.lesson_type === "quiz" ? "Konten Quiz HTML" : newLesson.lesson_type === "text" ? "Konten HTML" : "Catatan HTML"}
                    </label>
                    <AIFieldButton
                      field="content_html"
                      fieldName="Konten HTML"
                      entityType="lesson"
                      outputFormat="html"
                      context={{
                        course_title: course.title,
                        lesson_title: newLesson.title,
                        lesson_type: newLesson.lesson_type,
                      }}
                      disabled={!newLesson.title.trim()}
                      onFill={(content) => setNewLesson({ ...newLesson, content_html: content })}
                    />
                  </div>
                  <textarea
                    className={inputClass}
                    rows={5}
                    value={newLesson.content_html}
                    onChange={e => setNewLesson({ ...newLesson, content_html: e.target.value })}
                    placeholder="<p>Tulis pengumuman, bacaan, gambar, atau callout...</p>"
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setNewLesson(null)}>Batal</Button>
            <Button onClick={addLesson}>Simpan Lesson</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Lesson Dialog */}
      <Dialog open={!!editLesson} onOpenChange={(open) => { if (!open) setEditLesson(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Lesson</DialogTitle>
            {editLesson && (
              <AIBundleButton
                label="Generate lesson copy"
                entityType="lesson"
                fields={["description", "content_html"]}
                context={{
                  course_title: course.title,
                  lesson_title: editLesson.title,
                  lesson_type: editLesson.lesson_type,
                }}
                disabled={!editLesson.title.trim()}
                onFill={(fields) => setEditLesson({ ...editLesson, ...fields })}
              />
            )}
          </DialogHeader>
          {editLesson && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-sm font-medium text-warm-black">Judul *</label>
                  <input className={inputClass} value={editLesson.title} onChange={e => setEditLesson({ ...editLesson, title: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-warm-black">Slug</label>
                  <input className={inputClass} value={editLesson.slug} onChange={e => setEditLesson({ ...editLesson, slug: e.target.value })} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-warm-black">Tipe</label>
                  <select className={inputClass} value={editLesson.lesson_type} onChange={e => setEditLesson({ ...editLesson, lesson_type: e.target.value })}>
                    <option value="video">Video</option>
                    <option value="text">Text</option>
                    <option value="quiz">Quiz</option>
                    <option value="resource">Resource</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-warm-black">Status</label>
                  <select className={inputClass} value={editLesson.status} onChange={e => setEditLesson({ ...editLesson, status: e.target.value })}>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-warm-black">Urutan</label>
                  <input className={inputClass} type="number" value={editLesson.sort_order} onChange={e => setEditLesson({ ...editLesson, sort_order: parseInt(e.target.value) || 0 })} />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editLesson.is_preview === 1}
                  onChange={e => setEditLesson({ ...editLesson, is_preview: e.target.checked ? 1 : 0 })}
                  className="w-4 h-4 rounded border-[rgba(12,12,10,0.2)] accent-primary"
                />
                <span className="text-sm font-medium text-warm-black">Bisa dipreview gratis</span>
              </label>

              {editLesson.lesson_type === "video" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-warm-black">URL Video</label>
                  <input className={inputClass} value={editLesson.video_url} onChange={e => setEditLesson({ ...editLesson, video_url: e.target.value })} placeholder="https://youtube.com/watch?v=..." />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-warm-black">Deskripsi Singkat</label>
                  <AIFieldButton
                    field="description"
                    fieldName="Deskripsi Singkat"
                    entityType="lesson"
                    context={{
                      course_title: course.title,
                      lesson_title: editLesson.title,
                      lesson_type: editLesson.lesson_type,
                    }}
                    disabled={!editLesson.title.trim()}
                    onFill={(content) => setEditLesson({ ...editLesson, description: content })}
                  />
                </div>
                <textarea
                  className={inputClass}
                  rows={2}
                  placeholder="Ringkasan apa yang akan dipelajari di lesson ini..."
                  value={editLesson.description}
                  onChange={e => setEditLesson({ ...editLesson, description: e.target.value })}
                />
              </div>

              {(editLesson.lesson_type === "text" || editLesson.lesson_type === "video" || editLesson.lesson_type === "quiz") && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-warm-black">
                      {editLesson.lesson_type === "quiz" ? "Konten Quiz HTML" : editLesson.lesson_type === "text" ? "Konten HTML" : "Catatan HTML"}
                    </label>
                    <AIFieldButton
                      field="content_html"
                      fieldName="Konten HTML"
                      entityType="lesson"
                      outputFormat="html"
                      context={{
                        course_title: course.title,
                        lesson_title: editLesson.title,
                        lesson_type: editLesson.lesson_type,
                      }}
                      disabled={!editLesson.title.trim()}
                      onFill={(content) => setEditLesson({ ...editLesson, content_html: content })}
                    />
                  </div>
                  <textarea
                    className={inputClass}
                    rows={8}
                    placeholder="<p>Tulis konten lesson dalam format HTML...</p>"
                    value={editLesson.content_html}
                    onChange={e => setEditLesson({ ...editLesson, content_html: e.target.value })}
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">Embed HTML Interaktif</label>
                <p className="text-xs text-[rgba(12,12,10,0.45)]">
                  Untuk halaman HTML lengkap dengan &lt;style&gt; dan &lt;script&gt; (quiz interaktif, game, dll). Ditampilkan dalam iframe terisolasi. Jika diisi, ini yang ditampilkan ke peserta — bukan Konten HTML di atas.
                </p>
                <textarea
                  className={inputClass}
                  rows={10}
                  placeholder={"<!DOCTYPE html>\n<html>...\n</html>"}
                  value={editLesson.content_embed}
                  onChange={e => setEditLesson({ ...editLesson, content_embed: e.target.value })}
                />
              </div>

              {/* Resource Links */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-warm-black">Sumber / Resource Links</label>
                  <button
                    type="button"
                    onClick={addResource}
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    <Plus size={12} />
                    Tambah Link
                  </button>
                </div>
                {editLesson.resources.length === 0 ? (
                  <p className="text-xs text-[rgba(12,12,10,0.35)] py-2">Belum ada resource link. Tambahkan link ke GitHub, PDF, slides, dll.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {editLesson.resources.map((r, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                          <input
                            className={inputClass}
                            placeholder="Nama (mis. GitHub Repo, Slides)"
                            value={r.title}
                            onChange={e => updateResource(idx, "title", e.target.value)}
                          />
                          <input
                            className={inputClass}
                            placeholder="https://..."
                            value={r.url}
                            onChange={e => updateResource(idx, "url", e.target.value)}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeResource(idx)}
                          className="mt-2 p-1.5 text-[rgba(12,12,10,0.35)] hover:text-red-600 transition-colors rounded"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditLesson(null)}>Batal</Button>
            <Button onClick={saveLesson} loading={savingLesson}>
              {savingLesson ? "Menyimpan..." : "Simpan Lesson"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Module */}
      <Dialog open={!!editModule} onOpenChange={(open) => { if (!open) setEditModule(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Modul</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 py-2">
            <label className="text-sm font-medium text-warm-black">Judul Modul</label>
            <input
              className={inputClass}
              value={editModule?.title ?? ""}
              onChange={(e) => setEditModule((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
              onKeyDown={(e) => { if (e.key === "Enter") updateModule(); }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditModule(null)}>Batal</Button>
            <Button onClick={updateModule} loading={savingModule} disabled={!editModule?.title.trim()}>
              {savingModule ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Module Confirm */}
      <ConfirmDialog
        open={!!deleteModuleConfirm}
        onOpenChange={(open) => { if (!open) setDeleteModuleConfirm(null); }}
        title="Hapus Modul?"
        description="Semua lesson dalam modul ini juga akan dihapus. Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Hapus Modul"
        variant="danger"
        onConfirm={() => {
          if (deleteModuleConfirm) deleteModule(deleteModuleConfirm);
          setDeleteModuleConfirm(null);
        }}
      />

      {/* Delete Lesson Confirm */}
      <ConfirmDialog
        open={!!deleteLessonConfirm}
        onOpenChange={(open) => { if (!open) setDeleteLessonConfirm(null); }}
        title="Hapus Lesson?"
        description="Lesson ini akan dihapus secara permanen."
        confirmLabel="Hapus Lesson"
        variant="danger"
        onConfirm={() => {
          if (deleteLessonConfirm) deleteLesson(deleteLessonConfirm);
          setDeleteLessonConfirm(null);
        }}
      />
    </div>
  );
}
