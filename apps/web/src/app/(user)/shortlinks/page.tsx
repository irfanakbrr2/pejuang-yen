"use client";

import { useState, useEffect, useRef } from "react";
import { Link2, Copy, Check, Trash2, ToggleLeft, ToggleRight, Plus, RefreshCw, ExternalLink, QrCode, Tag } from "lucide-react";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/toast";
import { ShortlinkQrModal, type QrTarget } from "./ShortlinkQrModal";
import { UTM_SOURCE_ALLOWLIST, UTM_MEDIUM_ALLOWLIST } from "@growwithai/shared";

const SHORT_ORIGIN = "app.pejuangyen.com/l";
const SLUG_RE = /^[a-z0-9-]{3,50}$/;

interface Shortlink {
  id: string;
  slug: string;
  destination_url: string;
  title: string | null;
  click_count: number;
  is_active: 0 | 1;
  created_at: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
}

function randomSlug() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function truncateUrl(url: string, max = 48) {
  try {
    const { hostname, pathname } = new URL(url);
    const full = hostname + pathname;
    return full.length > max ? full.slice(0, max) + "…" : full;
  } catch {
    return url.length > max ? url.slice(0, max) + "…" : url;
  }
}

export default function ShortlinksPage() {
  const [links, setLinks] = useState<Shortlink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [qrTarget, setQrTarget] = useState<QrTarget | null>(null);

  const [form, setForm] = useState({
    slug: "", destination_url: "", title: "",
    utm_source: "", utm_medium: "", utm_campaign: "", promo_location: "",
  });
  const [showUtm, setShowUtm] = useState(false);
  const [slugError, setSlugError] = useState("");
  const slugInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchLinks();
  }, []);

  async function fetchLinks() {
    setLoading(true);
    try {
      const res = await fetch("/api/shortlinks", { credentials: "include" });
      const d = await res.json();
      if (d.success) setLinks(d.data ?? []);
    } catch {
      toast.error("Gagal memuat shortlinks");
    } finally {
      setLoading(false);
    }
  }

  function validateSlug(value: string) {
    if (!value) return "";
    if (!SLUG_RE.test(value)) return "Hanya huruf kecil, angka, dan (-) — minimal 3 karakter";
    return "";
  }

  function handleSlugChange(value: string) {
    const clean = value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setForm(f => ({ ...f, slug: clean }));
    setSlugError(validateSlug(clean));
  }

  function autoSlug() {
    const slug = randomSlug();
    setForm(f => ({ ...f, slug }));
    setSlugError("");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const err = validateSlug(form.slug);
    if (err) { setSlugError(err); return; }
    if (!form.destination_url.trim()) { toast.error("URL tujuan wajib diisi"); return; }

    setCreating(true);
    try {
      const res = await fetch("/api/shortlinks", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: form.slug || undefined,
          destination_url: form.destination_url.trim(),
          title: form.title.trim() || undefined,
          utm_source: form.utm_source.trim() || undefined,
          utm_medium: form.utm_medium.trim() || undefined,
          utm_campaign: form.utm_campaign.trim() || undefined,
          promo_location: form.promo_location.trim() || undefined,
        }),
      });
      const d = await res.json();
      if (d.success) {
        setLinks(prev => [d.data, ...prev]);
        setForm({ slug: "", destination_url: "", title: "", utm_source: "", utm_medium: "", utm_campaign: "", promo_location: "" });
        setShowUtm(false);
        setShowForm(false);
        toast.success("Shortlink berhasil dibuat!");
      } else {
        toast.error(d.error || "Gagal membuat shortlink");
      }
    } catch {
      toast.error("Gagal membuat shortlink");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(link: Shortlink) {
    setTogglingId(link.id);
    try {
      const res = await fetch(`/api/shortlinks/${link.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: link.is_active === 1 ? false : true }),
      });
      const d = await res.json();
      if (d.success) {
        setLinks(prev => prev.map(l => l.id === link.id ? { ...l, is_active: link.is_active === 1 ? 0 : 1 } : l));
      } else {
        toast.error(d.error || "Gagal mengubah status");
      }
    } catch {
      toast.error("Gagal mengubah status");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/shortlinks/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const d = await res.json();
      if (d.success) {
        setLinks(prev => prev.filter(l => l.id !== id));
        toast.success("Shortlink dihapus");
      } else {
        toast.error(d.error || "Gagal menghapus shortlink");
      }
    } catch {
      toast.error("Gagal menghapus shortlink");
    } finally {
      setDeletingId(null);
    }
  }

  function copyLink(slug: string, id: string) {
    navigator.clipboard.writeText(`https://${SHORT_ORIGIN}/${slug}`).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          eyebrow="Bisnis"
          title="Shortlink Manager"
          description="Buat link pendek branded dengan domain app.pejuangyen.com/l/…"
        />
        <Button
          size="sm"
          onClick={() => { setShowForm(v => !v); setTimeout(() => slugInputRef.current?.focus(), 100); }}
          className="shrink-0 mt-1"
        >
          <Plus size={15} className="mr-1.5" />
          Buat Link
        </Button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="glass-card p-5 space-y-4">
          <p className="text-sm font-semibold text-[#0D0D0D] dark:text-white">Shortlink baru</p>

          <div className="space-y-1">
            <label className="text-xs font-medium text-[#6B7280] dark:text-slate-400">Judul (opsional)</label>
            <input
              type="text"
              placeholder="mis. Promo Kelas Juni"
              maxLength={100}
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-white/5 px-3.5 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[#8B1414]/30 dark:focus:ring-[#C0392B]/30 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-[#6B7280] dark:text-slate-400">Slug URL</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#6B7280] dark:text-slate-400 whitespace-nowrap">
                  {SHORT_ORIGIN}/
                </span>
                <input
                  ref={slugInputRef}
                  type="text"
                  placeholder="nama-link"
                  value={form.slug}
                  onChange={e => handleSlugChange(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-white/5 py-2.5 pr-3.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[#8B1414]/30 dark:focus:ring-[#C0392B]/30 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  style={{ paddingLeft: `${SHORT_ORIGIN.length + 2.5}ch` }}
                />
              </div>
              <button
                type="button"
                onClick={autoSlug}
                title="Generate otomatis"
                className="flex items-center gap-1.5 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-white/5 px-3 text-xs text-[#6B7280] dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/10"
              >
                <RefreshCw size={13} />
                Auto
              </button>
            </div>
            {slugError && <p className="text-xs text-red-500">{slugError}</p>}
            {!slugError && form.slug && (
              <p className="text-xs text-[#6B7280] dark:text-slate-400">
                Preview:{" "}
                <span className="font-medium text-[#8B1414] dark:text-[#C0392B]">
                  https://{SHORT_ORIGIN}/{form.slug}
                </span>
              </p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-[#6B7280] dark:text-slate-400">URL Tujuan</label>
            <input
              type="url"
              placeholder="https://..."
              required
              value={form.destination_url}
              onChange={e => setForm(f => ({ ...f, destination_url: e.target.value }))}
              className="w-full rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-white/5 px-3.5 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[#8B1414]/30 dark:focus:ring-[#C0392B]/30 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>

          {/* Tag Promo / UTM (opsional) */}
          <div className="space-y-3 rounded-xl border border-dashed border-black/[0.1] dark:border-white/[0.1] p-3.5">
            <button
              type="button"
              onClick={() => setShowUtm(v => !v)}
              className="flex w-full items-center justify-between text-left"
            >
              <span className="flex items-center gap-1.5 text-xs font-semibold text-[#0D0D0D] dark:text-white">
                <Tag size={13} className="text-[#8B1414] dark:text-[#C0392B]" />
                Tag Promo / UTM <span className="font-normal text-[#9CA3AF] dark:text-slate-500">(opsional)</span>
              </span>
              <span className="text-xs text-[#6B7280] dark:text-slate-400">{showUtm ? "Tutup" : "Atur"}</span>
            </button>

            {showUtm && (
              <div className="space-y-3">
                <p className="text-[11px] leading-relaxed text-[#6B7280] dark:text-slate-400">
                  Nilai ini ditempel ke URL tujuan saat link diklik (mis. <code>?utm_source=ig</code>) supaya sumber & lokasi promo terlacak di analitik. Param yang sudah ada di URL tujuan tidak ditimpa.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[#6B7280] dark:text-slate-400">utm_source</label>
                    <select
                      value={form.utm_source}
                      onChange={e => setForm(f => ({ ...f, utm_source: e.target.value }))}
                      className="w-full rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-white/5 px-3.5 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[#8B1414]/30 dark:focus:ring-[#C0392B]/30"
                    >
                      <option value="">— pilih sumber —</option>
                      {UTM_SOURCE_ALLOWLIST.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[#6B7280] dark:text-slate-400">utm_medium</label>
                    <select
                      value={form.utm_medium}
                      onChange={e => setForm(f => ({ ...f, utm_medium: e.target.value }))}
                      className="w-full rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-white/5 px-3.5 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[#8B1414]/30 dark:focus:ring-[#C0392B]/30"
                    >
                      <option value="">— pilih medium —</option>
                      {UTM_MEDIUM_ALLOWLIST.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[#6B7280] dark:text-slate-400">utm_campaign</label>
                    <input
                      type="text" placeholder="mis. promo-juni" maxLength={80}
                      value={form.utm_campaign}
                      onChange={e => setForm(f => ({ ...f, utm_campaign: e.target.value }))}
                      className="w-full rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-white/5 px-3.5 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[#8B1414]/30 dark:focus:ring-[#C0392B]/30 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[#6B7280] dark:text-slate-400">Lokasi / Channel promo</label>
                    <input
                      type="text" placeholder="mis. banner-bandung" maxLength={80}
                      value={form.promo_location}
                      onChange={e => setForm(f => ({ ...f, promo_location: e.target.value }))}
                      className="w-full rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white/80 dark:bg-white/5 px-3.5 py-2.5 text-sm dark:text-white outline-none focus:ring-2 focus:ring-[#8B1414]/30 dark:focus:ring-[#C0392B]/30 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                    <p className="text-[10px] text-[#9CA3AF] dark:text-slate-500">Disimpan sebagai <code>utm_content</code></p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button type="submit" loading={creating} size="sm">Buat Shortlink</Button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-xl border border-black/[0.08] dark:border-white/[0.08] px-4 py-2 text-sm text-[#6B7280] dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/10"
            >
              Batal
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card p-4">
              <div className="skeleton h-4 w-40 mb-2 rounded" />
              <div className="skeleton h-3 w-64 rounded" />
            </div>
          ))}
        </div>
      ) : links.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#F7E8E8] dark:bg-[#C0392B]/10 flex items-center justify-center mb-4 mx-auto">
            <Link2 size={22} className="text-[#8B1414] dark:text-[#C0392B]" />
          </div>
          <h3 className="text-base font-bold text-[#0D0D0D] dark:text-white mb-1">Belum ada shortlink</h3>
          <p className="text-sm text-[#6B7280] dark:text-slate-400 mb-5">
            Buat shortlink pertama kamu dan bagikan dengan URL pendek yang branded.
          </p>
          <Button size="sm" onClick={() => { setShowForm(true); setTimeout(() => slugInputRef.current?.focus(), 100); }}>
            <Plus size={14} className="mr-1.5" /> Buat Shortlink
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {links.map(link => (
            <div
              key={link.id}
              className={`glass-card p-4 flex items-center gap-4 transition-opacity ${link.is_active === 0 ? "opacity-60" : ""}`}
            >
              {/* Icon */}
              <div className="hidden sm:flex w-9 h-9 shrink-0 rounded-xl bg-[#F7E8E8] dark:bg-[#C0392B]/10 items-center justify-center">
                <Link2 size={16} className="text-[#8B1414] dark:text-[#C0392B]" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                {link.title && (
                  <p className="text-sm font-semibold text-[#0D0D0D] dark:text-white truncate">{link.title}</p>
                )}
                <button
                  onClick={() => copyLink(link.slug, link.id)}
                  className="group flex items-center gap-1 text-sm font-medium text-[#8B1414] dark:text-[#C0392B] hover:underline truncate max-w-full"
                  title="Klik untuk copy"
                >
                  <span className="truncate">{SHORT_ORIGIN}/{link.slug}</span>
                  {copiedId === link.id ? (
                    <Check size={13} className="shrink-0 text-emerald-600" />
                  ) : (
                    <Copy size={13} className="shrink-0 opacity-0 group-hover:opacity-100" />
                  )}
                </button>
                <a
                  href={link.destination_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-[#6B7280] dark:text-slate-400 hover:text-[#8B1414] dark:hover:text-[#C0392B] truncate mt-0.5"
                >
                  <ExternalLink size={11} className="shrink-0" />
                  {truncateUrl(link.destination_url)}
                </a>
                {(link.utm_source || link.utm_medium || link.utm_campaign || link.utm_content) && (
                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    {[
                      ["src", link.utm_source],
                      ["med", link.utm_medium],
                      ["camp", link.utm_campaign],
                      ["lokasi", link.utm_content],
                    ].filter(([, v]) => v).map(([k, v]) => (
                      <span
                        key={k}
                        className="inline-flex items-center gap-1 rounded-md bg-[#F7E8E8] dark:bg-[#C0392B]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#8B1414] dark:text-[#C0392B]"
                      >
                        <Tag size={9} />{k}:{v}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Click count */}
              <div className="hidden sm:block shrink-0 text-right">
                <span className="text-sm font-semibold text-[#0D0D0D] dark:text-white">{link.click_count}</span>
                <p className="text-[10px] text-[#6B7280] dark:text-slate-400">klik</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Toggle active */}
                <button
                  onClick={() => handleToggle(link)}
                  disabled={togglingId === link.id}
                  title={link.is_active === 1 ? "Nonaktifkan" : "Aktifkan"}
                  className="p-2 rounded-lg text-[#6B7280] dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-40"
                >
                  {link.is_active === 1
                    ? <ToggleRight size={20} className="text-[#8B1414] dark:text-[#C0392B]" />
                    : <ToggleLeft size={20} />
                  }
                </button>

                {/* QR code */}
                <button
                  onClick={() =>
                    setQrTarget({
                      url: `https://${SHORT_ORIGIN}/${link.slug}`,
                      label: `${SHORT_ORIGIN}/${link.slug}`,
                      filename: `${link.slug}-qr`,
                    })
                  }
                  title="QR code"
                  className="p-2 rounded-lg text-[#6B7280] dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/10"
                >
                  <QrCode size={15} />
                </button>

                {/* Copy */}
                <button
                  onClick={() => copyLink(link.slug, link.id)}
                  title="Copy link"
                  className="p-2 rounded-lg text-[#6B7280] dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/10"
                >
                  {copiedId === link.id
                    ? <Check size={15} className="text-emerald-600" />
                    : <Copy size={15} />
                  }
                </button>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(link.id)}
                  disabled={deletingId === link.id}
                  title="Hapus"
                  className="p-2 rounded-lg text-[#6B7280] dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-40"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {links.length > 0 && (
        <p className="text-xs text-center text-[#9CA3AF] dark:text-slate-500">
          {links.length} / 20 shortlink terpakai
        </p>
      )}

      <ShortlinkQrModal target={qrTarget} onClose={() => setQrTarget(null)} />
    </div>
  );
}
