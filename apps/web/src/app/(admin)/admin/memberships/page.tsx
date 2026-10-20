"use client";
/* eslint-disable react-hooks/immutability, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps, react-hooks/purity, @typescript-eslint/no-explicit-any */

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Minus, Plus, Search, Users, Trash2, Copy, Check } from "lucide-react";
import { AdminTable, Tr, Td, StatusBadge } from "@/components/ui/AdminTable";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/lottie/EmptyState";
import { formatRupiah, formatDate } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { Pagination } from "@/components/ui/Pagination";

// ─── Types ───────────────────────────────────────────────────────────────

interface Plan {
  id: string;
  slug: string;
  name: string;
  duration_type: string;
  duration_days?: number;
  price: number;
  compare_at_price?: number;
  status: string;
  sort_order: number;
  features_json?: string | null;
}

// Benefit disimpan sbg JSON array string. Helper konversi ke/dari textarea (1 baris = 1 benefit).
const featuresToText = (json?: string | null): string => {
  if (!json) return "";
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr.join("\n") : "";
  } catch {
    return "";
  }
};
const textToFeatures = (text: string): string =>
  JSON.stringify(text.split("\n").map((s) => s.trim()).filter(Boolean));

interface UserMembership {
  id: string;
  status: string;
  starts_at: string;
  expires_at?: string;
  created_at: string;
  cancelled_at?: string;
  user_id: string;
  user_name: string;
  user_email: string;
  plan_name: string;
  duration_type: string;
}

// ─── Shared input class ──────────────────────────────────────────────────

const inputClass =
  "w-full px-3.5 py-2.5 text-sm rounded-xl border border-[rgba(12,12,10,0.12)] text-warm-black outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors";

// ─── Main Page ───────────────────────────────────────────────────────────

function AdminMembershipsContent() {
  const [mbPage, setMbPage] = useState(1);
  // Plans state
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Partial<Plan> | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [featuresText, setFeaturesText] = useState("");

  // User memberships state
  const [memberships, setMemberships] = useState<UserMembership[]>([]);
  const [membershipsLoading, setMembershipsLoading] = useState(true);
  const [mbTotalPages, setMbTotalPages] = useState(1);
  const [mbSearch, setMbSearch] = useState("");
  const [mbStatusFilter, setMbStatusFilter] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  // Revoke/Extend dialogs
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [extendTarget, setExtendTarget] = useState<string | null>(null);
  const [reduceTarget, setReduceTarget] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState(30);
  const [reduceDays, setReduceDays] = useState(30);
  const [processing, setProcessing] = useState(false);

  // ─── Active tab ─────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"plans" | "members">("plans");

  // ─── Plans CRUD ─────────────────────────────────────────────────────────

  useEffect(() => { fetchPlans(); }, []);

  const fetchPlans = async () => {
    setPlansLoading(true);
    const res = await fetch("/api/admin/memberships/plans", { credentials: "include" });
    const data = await res.json();
    if (data.success) setPlans(data.data);
    setPlansLoading(false);
  };

  const handleSavePlan = async () => {
    if (!selectedPlan?.name || !selectedPlan?.duration_type) return;
    setSaving(true);
    const isNew = !selectedPlan.id;
    const res = await fetch(
      isNew ? "/api/admin/memberships/plans" : `/api/admin/memberships/plans/${selectedPlan.id}`,
      {
        method: isNew ? "POST" : "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...selectedPlan, features_json: textToFeatures(featuresText) }),
      }
    );
    const data = await res.json();
    setSaving(false);
    if (data.success) {
      setSelectedPlan(null);
      fetchPlans();
    } else {
      alert(data.error || "Gagal menyimpan plan");
    }
  };

  // Link order membership. Halaman /order/[productSlug] mengenali prefix "membership-"
  // lalu mencocokkan sisanya ke slug plan — jadi bentuk ini valid untuk slug apa pun.
  const membershipLink = (slug: string) =>
    `${typeof window !== "undefined" ? window.location.origin : "https://app.pejuangyen.com"}/order/membership-${slug}`;

  const handleCopyLink = async (p: Plan) => {
    const url = membershipLink(p.slug);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(p.id);
      toast.success("Link membership disalin");
      setTimeout(() => setCopiedId((c) => (c === p.id ? null : c)), 2000);
    } catch {
      toast.error("Gagal menyalin link");
    }
  };

  const handleDeletePlan = async () => {
    if (!deleteTarget) return;
    setDeletingPlan(true);
    try {
      const res = await fetch(`/api/admin/memberships/plans/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Paket langganan dihapus");
        setDeleteTarget(null);
        fetchPlans();
      } else {
        toast.error(data.error || "Gagal menghapus paket");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setDeletingPlan(false);
    }
  };

  // ─── User Memberships ──────────────────────────────────────────────────

  const fetchMemberships = (page = mbPage, search = mbSearch, status = mbStatusFilter) => {
    setMembershipsLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search.trim()) params.set("search", search.trim());
    if (status) params.set("status", status);

    fetch(`/api/admin/memberships?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setMemberships(d.data || []);
          setMbTotalPages(d.pagination?.totalPages || 1);
        }
      })
      .catch(() => {})
      .finally(() => setMembershipsLoading(false));
  };

  useEffect(() => {
    if (activeTab === "members") fetchMemberships(mbPage, mbSearch, mbStatusFilter);
  }, [activeTab, mbPage, mbStatusFilter]);

  // Debounced search for members
  useEffect(() => {
    if (activeTab !== "members") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (mbPage !== 1) setMbPage(1);
      else fetchMemberships(1, mbSearch, mbStatusFilter);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [mbSearch]);

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/admin/memberships/${revokeTarget}/revoke`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (data.success) { toast.success("Membership dicabut"); fetchMemberships(); }
      else toast.error(data.error || "Gagal mencabut membership");
    } catch { toast.error("Terjadi kesalahan"); }
    finally { setProcessing(false); setRevokeTarget(null); }
  };

  const handleExtend = async () => {
    if (!extendTarget || extendDays <= 0) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/admin/memberships/${extendTarget}/extend`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: extendDays }),
      });
      const data = await res.json();
      if (data.success) { toast.success(`Membership diperpanjang ${extendDays} hari`); fetchMemberships(); }
      else toast.error(data.error || "Gagal memperpanjang membership");
    } catch { toast.error("Terjadi kesalahan"); }
    finally { setProcessing(false); setExtendTarget(null); }
  };

  const handleReduce = async () => {
    if (!reduceTarget || reduceDays <= 0) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/admin/memberships/${reduceTarget}/reduce`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: reduceDays }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Membership dikurangi ${reduceDays} hari`);
        fetchMemberships();
      } else {
        toast.error(data.error || "Gagal mengurangi periode membership");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setProcessing(false);
      setReduceTarget(null);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Langganan"
        title="Membership"
        description="Atur paket langganan dan kelola member"
        actions={activeTab === "plans" && (
          <Button
            onClick={() => {
              setFeaturesText("");
              setSelectedPlan({
                slug: "",
                name: "",
                duration_type: "monthly",
                price: 0,
                status: "active",
                sort_order: plans.length + 1,
              });
            }}
          >
            <Plus size={15} />
            Tambah Plan
          </Button>
        )}
      />

      {/* Tab switcher */}
      <div className="flex items-center rounded-full p-0.5 gap-0.5 w-fit">
        {[
          { key: "plans" as const, label: "Plans", icon: null },
          { key: "members" as const, label: "Members", icon: Users },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all duration-150 ${
              activeTab === key
                ? "bg-white/84 text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {Icon && <Icon size={14} />}
            {label}
          </button>
        ))}
      </div>

      {/* ── Plans Tab ─────────────────────────────────────────────────── */}
      {activeTab === "plans" && (
        <>
          {plansLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => <div key={i} className="skeleton h-48 rounded-xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((p) => (
                <div key={p.id} className="glass-card glass-card-hover p-5">
                  <div className="flex items-center justify-between mb-3">
                    <StatusBadge status={p.status} />
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => { setFeaturesText(featuresToText(p.features_json)); setSelectedPlan(p); }}
                        className="text-xs font-medium text-[rgba(12,12,10,0.55)] hover:text-primary transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteTarget(p)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[rgba(12,12,10,0.55)] hover:text-red-600 transition-colors"
                        aria-label={`Hapus paket ${p.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Hapus
                      </button>
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-warm-black heading-tight">{p.name}</h3>
                  <p className="text-xs text-[rgba(12,12,10,0.45)] capitalize mb-3">{p.duration_type}</p>
                  <div className="mb-4">
                    <span className="text-2xl font-bold text-primary">{formatRupiah(p.price)}</span>
                    {p.compare_at_price ? (
                      <span className="text-sm text-[rgba(12,12,10,0.35)] line-through ml-2">
                        {formatRupiah(p.compare_at_price)}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-[rgba(12,12,10,0.45)] font-mono">/{p.slug}</p>

                  <button
                    onClick={() => handleCopyLink(p)}
                    title={membershipLink(p.slug)}
                    className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[rgba(12,12,10,0.12)] px-3 py-2 text-xs font-semibold text-warm-black transition-colors hover:border-primary hover:text-primary"
                  >
                    {copiedId === p.id ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        Tersalin
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Salin Link Membership
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Members Tab ───────────────────────────────────────────────── */}
      {activeTab === "members" && (
        <>
          {/* Filters */}
          <div className="glass-card p-3 flex flex-wrap items-center gap-3">
            <div className="relative max-w-xs flex-1 min-w-[200px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(12,12,10,0.35)]" />
              <input
                value={mbSearch}
                onChange={(e) => setMbSearch(e.target.value)}
                placeholder="Cari nama atau email..."
                className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black placeholder:text-[rgba(12,12,10,0.35)] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
              />
            </div>
            <select
              value={mbStatusFilter}
              onChange={(e) => { setMbStatusFilter(e.target.value); setMbPage(1); }}
              className="px-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black outline-none focus:border-primary transition-colors"
            >
              <option value="">Semua Status</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="revoked">Revoked</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <AdminTable
            columns={[
              { key: "user", label: "User" },
              { key: "plan", label: "Plan" },
              { key: "type", label: "Durasi" },
              { key: "status", label: "Status" },
              { key: "expires", label: "Berakhir" },
              { key: "created", label: "Mulai" },
              { key: "actions", label: "Aksi" },
            ]}
            loading={membershipsLoading}
            empty={
              <EmptyState
                title="Tidak ada member"
                description="Member akan muncul di sini setelah ada membership aktif."
                size="sm"
                className="py-8"
              />
            }
          >
            {membershipsLoading ? (
              <TableRowSkeleton cols={7} rows={5} />
            ) : (
              memberships.map((m) => {
                const isExpiringSoon = m.expires_at && new Date(m.expires_at).getTime() - Date.now() < 7 * 24 * 3600 * 1000 && m.status === "active";
                return (
                  <Tr key={m.id}>
                    <Td>
                      <p className="font-medium text-warm-black">{m.user_name}</p>
                      <p className="text-xs text-[rgba(12,12,10,0.45)]">{m.user_email}</p>
                    </Td>
                    <Td className="font-medium text-warm-black">{m.plan_name}</Td>
                    <Td className="text-[rgba(12,12,10,0.65)] capitalize">{m.duration_type}</Td>
                    <Td><StatusBadge status={m.status} /></Td>
                    <Td className={`text-xs ${isExpiringSoon ? "text-amber-600 font-semibold" : "text-[rgba(12,12,10,0.55)]"}`}>
                      {m.expires_at ? formatDate(m.expires_at) : "Lifetime"}
                      {isExpiringSoon && " ⚠️"}
                    </Td>
                    <Td className="text-[rgba(12,12,10,0.55)] text-xs">{formatDate(m.created_at)}</Td>
                    <Td>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {m.status === "active" && (
                          <>
                            <button
                              onClick={() => { setExtendTarget(m.id); setExtendDays(30); }}
                              className="px-2.5 py-1 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
                            >
                              Perpanjang
                            </button>
                            {m.expires_at && (
                              <button
                                onClick={() => { setReduceTarget(m.id); setReduceDays(30); }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors"
                              >
                                <Minus className="h-3 w-3" />
                                Kurangi
                              </button>
                            )}
                            <button
                              onClick={() => setRevokeTarget(m.id)}
                              className="px-2.5 py-1 text-xs font-semibold bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                            >
                              Cabut
                            </button>
                          </>
                        )}
                      </div>
                    </Td>
                  </Tr>
                );
              })
            )}
          </AdminTable>

          {mbTotalPages > 1 && (
            <Pagination currentPage={mbPage} totalPages={mbTotalPages} onPageChange={setMbPage} />
          )}
        </>
      )}

      {/* ── Edit Plan Dialog ──────────────────────────────────────────── */}
      <Dialog open={!!selectedPlan} onOpenChange={(open) => { if (!open) setSelectedPlan(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedPlan?.id ? "Edit Plan" : "Tambah Plan"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {[
              { label: "Slug (URL)", key: "slug", type: "text" },
              { label: "Nama Paket", key: "name", type: "text" },
              { label: "Harga (IDR)", key: "price", type: "number" },
              { label: "Harga Coret (IDR)", key: "compare_at_price", type: "number" },
              { label: "Durasi (Hari) — kosong = unlimited", key: "duration_days", type: "number" },
            ].map(({ label, key, type }) => (
              <div key={key} className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">{label}</label>
                <input
                  type={type}
                  value={(selectedPlan as any)?.[key] || ""}
                  onChange={(e) =>
                    setSelectedPlan({
                      ...selectedPlan,
                      [key]: type === "number" ? parseInt(e.target.value) || 0 : e.target.value,
                    })
                  }
                  className={inputClass}
                />
              </div>
            ))}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-warm-black">Tipe Durasi</label>
              <select
                value={selectedPlan?.duration_type || "monthly"}
                onChange={(e) => setSelectedPlan({ ...selectedPlan, duration_type: e.target.value })}
                className={inputClass}
              >
                <option value="monthly">Bulanan</option>
                <option value="yearly">Tahunan</option>
                <option value="lifetime">Lifetime</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-warm-black">Status</label>
              <select
                value={selectedPlan?.status || "active"}
                onChange={(e) => setSelectedPlan({ ...selectedPlan, status: e.target.value })}
                className={inputClass}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-warm-black">Benefit / Fitur</label>
              <textarea
                value={featuresText}
                onChange={(e) => setFeaturesText(e.target.value)}
                rows={6}
                placeholder={"Satu benefit per baris, contoh:\nAkses semua kelas Bahasa Jepang\nLatihan soal JLPT & JFT\nGrup komunitas member"}
                className={`${inputClass} resize-y leading-relaxed`}
              />
              <p className="text-xs text-[rgba(12,12,10,0.45)]">Satu baris = satu benefit. Tampil di halaman /premium. Kosongkan untuk pakai default.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setSelectedPlan(null)}>Batal</Button>
            <Button onClick={handleSavePlan} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Plan Dialog ────────────────────────────────────────── */}
      {deleteTarget && (
        <ConfirmDialog
          open={!!deleteTarget}
          onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
          title="Hapus Paket Langganan?"
          description={`Paket "${deleteTarget.name}" akan dihapus permanen. Paket yang masih dipakai member tidak bisa dihapus — nonaktifkan saja.`}
          confirmLabel="Hapus Paket"
          variant="danger"
          loading={deletingPlan}
          onConfirm={handleDeletePlan}
        />
      )}

      {/* ── Revoke Dialog ─────────────────────────────────────────────── */}
      {revokeTarget && (
        <ConfirmDialog
          open={!!revokeTarget}
          onOpenChange={(open) => { if (!open) setRevokeTarget(null); }}
          title="Cabut Membership?"
          description="Membership user ini akan dinonaktifkan dan akses membership-only akan dicabut."
          confirmLabel="Cabut Membership"
          variant="danger"
          loading={processing}
          onConfirm={handleRevoke}
        />
      )}

      {/* ── Extend Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!extendTarget} onOpenChange={(open) => { if (!open) setExtendTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Perpanjang Membership</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-warm-black">Tambah berapa hari?</label>
            <input
              type="number"
              value={extendDays}
              onChange={(e) => setExtendDays(parseInt(e.target.value) || 0)}
              min={1}
              className={inputClass}
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setExtendTarget(null)}>Batal</Button>
            <Button onClick={handleExtend} disabled={processing || extendDays <= 0}>
              {processing ? "Memproses..." : `Perpanjang ${extendDays} Hari`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reduce Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!reduceTarget} onOpenChange={(open) => { if (!open) setReduceTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kurangi Periode Membership</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-warm-black">Kurangi berapa hari?</label>
              <input
                type="number"
                value={reduceDays}
                onChange={(e) => setReduceDays(parseInt(e.target.value) || 0)}
                min={1}
                className={inputClass}
              />
            </div>
            <p className="text-xs leading-5 text-[rgba(12,12,10,0.55)]">
              Jika pengurangan melewati hari ini, membership akan langsung menjadi expired.
            </p>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setReduceTarget(null)}>Batal</Button>
            <Button variant="danger" onClick={handleReduce} disabled={processing || reduceDays <= 0}>
              {processing ? "Memproses..." : `Kurangi ${reduceDays} Hari`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminMembershipsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-[400px] bg-gray-100 rounded-xl animate-pulse" />
      </div>
    }>
      <AdminMembershipsContent />
    </Suspense>
  );
}
