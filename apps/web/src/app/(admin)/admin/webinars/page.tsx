"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, Suspense } from "react";
import { CalendarDays, Pencil, Plus, Search, Trash2, Users, BarChart3 } from "lucide-react";
import Link from "next/link";
import { AdminTable, StatusBadge, Td, Tr } from "@/components/ui/AdminTable";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { toast } from "@/components/ui/toast";
import { AIFieldButton } from "@/components/ui/AIFieldButton";
import { AIBundleButton } from "@/components/ui/AIBundleButton";
import { Pagination } from "@/components/ui/Pagination";

interface Webinar {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  starts_at: string;
  timezone: string;
  status: string;
  replay_status: string;
  registered_count?: number;
  host_name?: string | null;
  capacity?: number | null;
  body_html?: string | null;
  thumbnail_url?: string | null;
  join_url?: string | null;
  calendar_url?: string | null;
  recording_url?: string | null;
  recording_embed_url?: string | null;
  replay_body_html?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  form_template_key?: string;
  sort_order?: number;
  free_registration_enabled?: number;
  paid_registration_enabled?: number;
  paid_registration_price?: number;
  share_required_count?: number;
  share_message_template?: string | null;
  short_link_enabled?: number;
  category?: string | null;
  format?: string | null;
  tags?: string | null;
}

interface Registration {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  coupon_code: string;
  affiliate_code?: string | null;
  registered_at: string;
}

const EMPTY_FORM = {
  title: "",
  slug: "",
  subtitle: "",
  body_html: "",
  thumbnail_url: "",
  host_name: "",
  starts_at: "",
  ends_at: "",
  timezone: "Asia/Jakarta",
  capacity: "",
  join_url: "",
  calendar_url: "",
  recording_url: "",
  recording_embed_url: "",
  replay_body_html: "",
  replay_status: "hidden",
  form_template_key: "webinar_free_default",
  seo_title: "",
  seo_description: "",
  status: "draft",
  sort_order: "0",
  free_registration_enabled: 1,
  paid_registration_enabled: 1,
  paid_registration_price: 99000,
  share_required_count: 2,
  share_message_template: "",
  short_link_enabled: 1,
  category: "",
  format: "",
  tags: "",
};

const inputClass =
  "w-full px-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors";

function toLocalInputValue(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function fromLocalInputValue(value: string) {
  return value ? new Date(value).toISOString() : "";
}

function autoSlug(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function validationDetailMessage(details: unknown): string {
  if (!Array.isArray(details)) return "";
  return details
    .map((item) => {
      const record = item as { path?: unknown[]; message?: string };
      const path = Array.isArray(record.path) ? record.path.join(".") : "field";
      return `${path}: ${record.message || "tidak valid"}`;
    })
    .filter(Boolean)
    .slice(0, 3)
    .join(" · ");
}

function formatEventDate(date: string, timezone = "Asia/Jakarta") {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: timezone,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function AdminWebinarsContent() {
  const [page, setPage] = useState(1);

  const [webinars, setWebinars] = useState<Webinar[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [saving, setSaving] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<Webinar | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [registrations, setRegistrations] = useState<Registration[] | null>(null);
  const [registrationsLoading, setRegistrationsLoading] = useState(false);
  const [registrationWebinar, setRegistrationWebinar] = useState<Webinar | null>(null);
  const [registrationTitle, setRegistrationTitle] = useState("");
  const [registrationSearch, setRegistrationSearch] = useState("");
  const [registrationPage, setRegistrationPage] = useState(1);
  const [registrationTotalPages, setRegistrationTotalPages] = useState(1);


  const load = async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: "20" });
    const res = await fetch(`/api/admin/webinars?${p}`, { credentials: "include" });
    const data = await res.json();
    if (data.success) {
      setWebinars(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
    }
    else toast.error(data.error || "Gagal memuat webinar");
    setLoading(false);
  };

  useEffect(() => { load(); }, [page]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditTarget(null);
    setModalMode("create");
  };

  const openEdit = (webinar: Webinar) => {
    setEditTarget(webinar);
    setForm({
      title: webinar.title || "",
      slug: webinar.slug || "",
      subtitle: webinar.subtitle || "",
      body_html: webinar.body_html || "",
      thumbnail_url: webinar.thumbnail_url || "",
      host_name: webinar.host_name || "",
      starts_at: toLocalInputValue(webinar.starts_at),
      ends_at: toLocalInputValue((webinar as Webinar & { ends_at?: string }).ends_at),
      timezone: webinar.timezone || "Asia/Jakarta",
      capacity: webinar.capacity ? String(webinar.capacity) : "",
      join_url: webinar.join_url || "",
      calendar_url: webinar.calendar_url || "",
      recording_url: webinar.recording_url || "",
      recording_embed_url: webinar.recording_embed_url || "",
      replay_body_html: webinar.replay_body_html || "",
      replay_status: webinar.replay_status || "hidden",
      form_template_key: webinar.form_template_key || "webinar_free_default",
      seo_title: webinar.seo_title || "",
      seo_description: webinar.seo_description || "",
      status: webinar.status || "draft",
      sort_order: String(webinar.sort_order || 0),
      free_registration_enabled: webinar.free_registration_enabled ?? 1,
      paid_registration_enabled: webinar.paid_registration_enabled ?? 1,
      paid_registration_price: webinar.paid_registration_price ?? 99000,
      share_required_count: webinar.share_required_count ?? 2,
      share_message_template: webinar.share_message_template || "",
      short_link_enabled: webinar.short_link_enabled ?? 1,
      category: webinar.category || "",
      format: webinar.format || "",
      tags: webinar.tags || "",
    });
    setModalMode("edit");
  };

  const save = async () => {
    if (!form.title.trim() || !form.slug.trim() || !form.starts_at) {
      toast.error("Judul, slug, dan jadwal mulai wajib diisi");
      return;
    }

    setSaving(true);
    const payload = {
      ...form,
      starts_at: fromLocalInputValue(form.starts_at),
      ends_at: fromLocalInputValue(form.ends_at),
      capacity: form.capacity ? Number(form.capacity) : null,
      sort_order: Number(form.sort_order || 0),
    };
    const isEdit = modalMode === "edit" && editTarget;
    const res = await fetch(isEdit ? `/api/admin/webinars/${editTarget!.id}` : "/api/admin/webinars", {
      method: isEdit ? "PUT" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.success) {
      toast.success(isEdit ? "Webinar diperbarui" : "Webinar dibuat");
      setModalMode(null);
      await load();
    } else {
      const details = validationDetailMessage(data.details);
      toast.error(details || data.error || "Gagal menyimpan webinar");
    }
    setSaving(false);
  };

  const aiContext = {
    title: form.title,
    host_name: form.host_name,
    starts_at: form.starts_at,
    timezone: form.timezone,
    replay_status: form.replay_status,
  };

  const remove = async (webinar: Webinar) => {
    if (!confirm(`Hapus/arsipkan webinar "${webinar.title}"?`)) return;
    const res = await fetch(`/api/admin/webinars/${webinar.id}`, { method: "DELETE", credentials: "include" });
    const data = await res.json();
    if (data.success) {
      toast.success(data.data?.message || "Webinar diperbarui");
      load();
    } else {
      toast.error(data.error || "Gagal menghapus webinar");
    }
  };

  const showRegistrations = async (webinar: Webinar, nextPage = 1, searchValue = registrationSearch) => {
    setRegistrationWebinar(webinar);
    setRegistrationTitle(webinar.title);
    setRegistrationsLoading(true);
    const params = new URLSearchParams({ page: String(nextPage), limit: "25" });
    if (searchValue.trim()) params.set("search", searchValue.trim());
    try {
      const res = await fetch(`/api/admin/webinars/${webinar.id}/registrations?${params}`, { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setRegistrations(data.data || []);
        setRegistrationPage(data.pagination?.page || nextPage);
        setRegistrationTotalPages(data.pagination?.totalPages || 1);
      } else {
        setRegistrations([]);
        toast.error(data.error || "Gagal memuat pendaftar");
      }
    } catch {
      setRegistrations([]);
      toast.error("Gagal memuat pendaftar");
    } finally {
      setRegistrationsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Konten"
        title="Kelola Webinar"
        description="Buat katalog webinar gratis, replay SEO, dan tracking affiliate lead."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Tambah Webinar
          </Button>
        }
      />

      <AdminTable
        columns={[
          { key: "title", label: "Webinar" },
          { key: "date", label: "Jadwal" },
          { key: "registrants", label: "Pendaftar" },
          { key: "status", label: "Status" },
          { key: "replay", label: "Replay" },
          { key: "actions", label: "Aksi" },
        ]}
        loading={loading}
        empty={<div className="py-10 text-center text-sm text-gray-500">Belum ada webinar</div>}
      >
        {webinars.map((webinar) => (
          <Tr key={webinar.id}>
            <Td>
              <p className="font-semibold text-warm-black">{webinar.title}</p>
              <p className="font-mono text-xs text-gray-400">/webinar/{webinar.slug}</p>
            </Td>
            <Td>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <CalendarDays className="h-4 w-4 text-gray-400" />
                {formatEventDate(webinar.starts_at, webinar.timezone)}
              </div>
            </Td>
            <Td>
              <button
                onClick={() => {
                  setRegistrationSearch("");
                  showRegistrations(webinar, 1, "");
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-[#8B1414] ring-1 ring-black/[0.08]"
              >
                <Users className="h-3.5 w-3.5" />
                {webinar.registered_count || 0}{webinar.capacity ? `/${webinar.capacity}` : ""}
              </button>
            </Td>
            <Td><StatusBadge status={webinar.status} /></Td>
            <Td><StatusBadge status={webinar.replay_status} /></Td>
            <Td>
              <div className="flex gap-1.5">
                <Link href={`/admin/webinars/${webinar.id}/analytics`} className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Analytics
                </Link>
                <button onClick={() => openEdit(webinar)} className="inline-flex items-center gap-1 rounded-md bg-warm-cream px-2.5 py-1 text-xs font-semibold text-warm-black">
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button onClick={() => remove(webinar)} className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                  Hapus
                </button>
              </div>
            </Td>
          </Tr>
        ))}
      </AdminTable>

      {totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      <Dialog open={!!modalMode} onOpenChange={(open) => { if (!open) setModalMode(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{modalMode === "edit" ? "Edit Webinar" : "Tambah Webinar"}</DialogTitle>
            <AIBundleButton
              label="Generate webinar copy"
              entityType="webinar"
              fields={["title", "subtitle", "body_html", "replay_body_html", "seo_title", "seo_description"]}
              context={aiContext}
              disabled={!form.title.trim()}
              onFill={(fields) => setForm((f) => ({ ...f, ...fields }))}
            />
          </DialogHeader>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5 text-sm font-medium">
                <div className="flex items-center gap-2">
                  <span>Judul</span>
                  <AIFieldButton
                    field="title"
                    fieldName="Judul"
                    entityType="webinar"
                    context={aiContext}
                    onFill={(content) => setForm((f) => ({ ...f, title: content, slug: f.slug || autoSlug(content) }))}
                  />
                </div>
                <input className={inputClass} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value, slug: f.slug || autoSlug(e.target.value) }))} />
              </div>
              <label className="space-y-1.5 text-sm font-medium">Slug
                <input className={inputClass} value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: autoSlug(e.target.value) }))} />
              </label>
              <label className="space-y-1.5 text-sm font-medium">Mulai
                <input className={inputClass} type="datetime-local" value={form.starts_at} onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))} />
              </label>
              <label className="space-y-1.5 text-sm font-medium">Selesai
                <input className={inputClass} type="datetime-local" value={form.ends_at} onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))} />
              </label>
              <label className="space-y-1.5 text-sm font-medium">Host
                <input className={inputClass} value={form.host_name} onChange={(e) => setForm((f) => ({ ...f, host_name: e.target.value }))} />
              </label>
              <label className="space-y-1.5 text-sm font-medium">Capacity
                <input className={inputClass} type="number" min={1} value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} />
              </label>
              <label className="space-y-1.5 text-sm font-medium">Thumbnail URL
                <input className={inputClass} value={form.thumbnail_url} onChange={(e) => setForm((f) => ({ ...f, thumbnail_url: e.target.value }))} />
              </label>
              <label className="space-y-1.5 text-sm font-medium">Timezone
                <input className={inputClass} value={form.timezone} onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))} />
              </label>
              <label className="space-y-1.5 text-sm font-medium">Status
                <select className={inputClass} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium">Replay Status
                <select className={inputClass} value={form.replay_status} onChange={(e) => setForm((f) => ({ ...f, replay_status: e.target.value }))}>
                  <option value="hidden">Hidden</option>
                  <option value="public">Public</option>
                  <option value="membership_only">Membership Only</option>
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium">Model Pendaftaran
                <select className={inputClass} value={form.paid_registration_enabled ? "2-step" : "1-step"} onChange={(e) => {
                  const mode = e.target.value;
                  if (mode === "1-step") {
                    setForm((f) => ({ ...f, free_registration_enabled: 1, paid_registration_enabled: 0 }));
                  } else {
                    setForm((f) => ({ ...f, free_registration_enabled: 1, paid_registration_enabled: 1 }));
                  }
                }}>
                  <option value="1-step">1-Step (Langsung Daftar Gratis)</option>
                  <option value="2-step">2-Step Gate (Gratis via Share / Bayar)</option>
                </select>
              </label>

              {form.paid_registration_enabled ? (
                <>
                  <label className="space-y-1.5 text-sm font-medium">Harga Registrasi Berbayar (Rp)
                    <input className={inputClass} type="number" min={0} value={form.paid_registration_price} onChange={(e) => setForm((f) => ({ ...f, paid_registration_price: Number(e.target.value) }))} />
                  </label>
                  <label className="space-y-1.5 text-sm font-medium">Jumlah Share Grup WA (Gratis)
                    <input className={inputClass} type="number" min={1} value={form.share_required_count} onChange={(e) => setForm((f) => ({ ...f, share_required_count: Number(e.target.value) }))} />
                  </label>
                </>
              ) : null}
              <label className="space-y-1.5 text-sm font-medium">Join URL
                <input className={inputClass} value={form.join_url} onChange={(e) => setForm((f) => ({ ...f, join_url: e.target.value }))} />
              </label>
              <label className="space-y-1.5 text-sm font-medium">Calendar URL
                <input className={inputClass} value={form.calendar_url} onChange={(e) => setForm((f) => ({ ...f, calendar_url: e.target.value }))} />
              </label>
              <label className="space-y-1.5 text-sm font-medium">Recording URL
                <input className={inputClass} value={form.recording_url} onChange={(e) => setForm((f) => ({ ...f, recording_url: e.target.value }))} />
              </label>
              <label className="space-y-1.5 text-sm font-medium">Recording Embed URL
                <input className={inputClass} value={form.recording_embed_url} onChange={(e) => setForm((f) => ({ ...f, recording_embed_url: e.target.value }))} />
              </label>
              <label className="space-y-1.5 text-sm font-medium">Kategori
                <input className={inputClass} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="Misal: Content Creation" />
              </label>
              <label className="space-y-1.5 text-sm font-medium">Format
                <input className={inputClass} value={form.format} onChange={(e) => setForm((f) => ({ ...f, format: e.target.value }))} placeholder="Misal: Video, Course" />
              </label>
              <label className="space-y-1.5 text-sm font-medium">Tags (pisahkan koma)
                <input className={inputClass} value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="Misal: jlpt, kerja-jepang" />
              </label>
              <div className="space-y-1.5 text-sm font-medium">
                <div className="flex items-center gap-2">
                  <span>SEO Title</span>
                  <AIFieldButton
                    field="seo_title"
                    fieldName="SEO Title"
                    entityType="webinar"
                    context={aiContext}
                    disabled={!form.title.trim()}
                    onFill={(content) => setForm((f) => ({ ...f, seo_title: content }))}
                  />
                </div>
                <input className={inputClass} value={form.seo_title} onChange={(e) => setForm((f) => ({ ...f, seo_title: e.target.value }))} />
              </div>
              <div className="space-y-1.5 text-sm font-medium">
                <div className="flex items-center gap-2">
                  <span>SEO Description</span>
                  <AIFieldButton
                    field="seo_description"
                    fieldName="SEO Description"
                    entityType="webinar"
                    context={aiContext}
                    disabled={!form.title.trim()}
                    onFill={(content) => setForm((f) => ({ ...f, seo_description: content }))}
                  />
                </div>
                <input className={inputClass} value={form.seo_description} onChange={(e) => setForm((f) => ({ ...f, seo_description: e.target.value }))} />
              </div>
            </div>
            {form.paid_registration_enabled ? (
              <div className="space-y-1.5 text-sm font-medium">
                <div className="flex items-center gap-2">
                  <span>Template Pesan Share WA/Telegram (Gunakan {'{{webinar_title}}'}, {'{{webinar_short_url}}'}, {'{{webinar_date}}'}, {'{{webinar_time}}'})</span>
                </div>
                <textarea className={inputClass} rows={4} value={form.share_message_template} onChange={(e) => setForm((f) => ({ ...f, share_message_template: e.target.value }))} placeholder="Contoh: Guys ada webinar gratis nih..." />
              </div>
            ) : null}
            <div className="space-y-1.5 text-sm font-medium">
              <div className="flex items-center gap-2">
                <span>Subtitle</span>
                <AIFieldButton
                  field="subtitle"
                  fieldName="Subtitle"
                  entityType="webinar"
                  context={aiContext}
                  disabled={!form.title.trim()}
                  onFill={(content) => setForm((f) => ({ ...f, subtitle: content }))}
                />
              </div>
              <textarea className={inputClass} rows={2} value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} />
            </div>
            <div className="space-y-1.5 text-sm font-medium">
              <div className="flex items-center gap-2">
                <span>Body HTML</span>
                <AIFieldButton
                  field="body_html"
                  fieldName="Body HTML"
                  entityType="webinar"
                  outputFormat="html"
                  context={aiContext}
                  disabled={!form.title.trim()}
                  onFill={(content) => setForm((f) => ({ ...f, body_html: content }))}
                />
              </div>
              <textarea className={`${inputClass} font-mono`} rows={8} value={form.body_html} onChange={(e) => setForm((f) => ({ ...f, body_html: e.target.value }))} />
            </div>
            <div className="space-y-1.5 text-sm font-medium">
              <div className="flex items-center gap-2">
                <span>Replay Body HTML</span>
                <AIFieldButton
                  field="replay_body_html"
                  fieldName="Replay Body HTML"
                  entityType="webinar"
                  outputFormat="html"
                  context={aiContext}
                  disabled={!form.title.trim()}
                  onFill={(content) => setForm((f) => ({ ...f, replay_body_html: content }))}
                />
              </div>
              <textarea className={`${inputClass} font-mono`} rows={5} value={form.replay_body_html} onChange={(e) => setForm((f) => ({ ...f, replay_body_html: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setModalMode(null)}>Batal</Button>
            <Button onClick={save} loading={saving}>Simpan Webinar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={registrations !== null} onOpenChange={(open) => { if (!open) { setRegistrations(null); setRegistrationWebinar(null); } }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Pendaftar: {registrationTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(12,12,10,0.35)]" />
                <input
                  value={registrationSearch}
                  onChange={(e) => setRegistrationSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && registrationWebinar) showRegistrations(registrationWebinar, 1, registrationSearch);
                  }}
                  placeholder="Cari nama, email, WhatsApp, affiliate..."
                  className="w-full rounded-lg border border-[rgba(12,12,10,0.12)] bg-white py-2.5 pl-9 pr-3.5 text-sm outline-none transition-colors focus:border-primary"
                />
              </div>
              <Button variant="secondary" onClick={() => registrationWebinar && showRegistrations(registrationWebinar, 1, registrationSearch)}>
                Cari
              </Button>
            </div>
            <div className="max-h-[58vh] overflow-y-auto">
              <AdminTable
                columns={[
                  { key: "name", label: "Nama" },
                  { key: "contact", label: "Kontak" },
                  { key: "coupon", label: "Coupon" },
                  { key: "date", label: "Daftar" },
                ]}
                loading={registrationsLoading}
                empty={<div className="py-8 text-center text-sm text-gray-500">Belum ada pendaftar</div>}
              >
                {(registrations || []).map((reg) => (
                  <Tr key={reg.id}>
                    <Td className="font-semibold">{reg.name}</Td>
                    <Td>
                      <p>{reg.email}</p>
                      {reg.phone && <p className="text-xs text-gray-500">{reg.phone}</p>}
                    </Td>
                    <Td>
                      <p className="font-mono font-semibold">{reg.coupon_code}</p>
                      {reg.affiliate_code && <p className="text-xs text-[#8B1414]">affiliate: {reg.affiliate_code}</p>}
                    </Td>
                    <Td>{new Date(reg.registered_at).toLocaleString("id-ID")}</Td>
                  </Tr>
                ))}
              </AdminTable>
            </div>
            {registrationTotalPages > 1 && (
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-[rgba(12,12,10,0.45)]">Halaman {registrationPage} dari {registrationTotalPages}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => registrationWebinar && showRegistrations(registrationWebinar, Math.max(1, registrationPage - 1), registrationSearch)}
                    disabled={registrationPage === 1 || registrationsLoading}
                    className="rounded-lg border border-[rgba(12,12,10,0.12)] px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-warm-cream disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Sebelumnya
                  </button>
                  <button
                    onClick={() => registrationWebinar && showRegistrations(registrationWebinar, Math.min(registrationTotalPages, registrationPage + 1), registrationSearch)}
                    disabled={registrationPage === registrationTotalPages || registrationsLoading}
                    className="rounded-lg border border-[rgba(12,12,10,0.12)] px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-warm-cream disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminWebinarsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-[400px] bg-gray-100 rounded-xl animate-pulse" />
      </div>
    }>
      <AdminWebinarsContent />
    </Suspense>
  );
}
