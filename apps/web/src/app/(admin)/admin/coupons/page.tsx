"use client";

import { useEffect, useState, Suspense } from "react";
import { Plus, Search, Trash2, Pencil, CalendarDays, Ticket } from "lucide-react";
import { AdminTable, StatusBadge, Td, Tr } from "@/components/ui/AdminTable";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { toast } from "@/components/ui/toast";
import { Pagination } from "@/components/ui/Pagination";

interface Coupon {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  max_discount_amount?: number | null;
  usage_limit_total?: number | null;
  usage_limit_per_user: number;
  starts_at?: string | null;
  expires_at?: string | null;
  is_active: boolean;
  total_used: number;
  plan_ids: string[];
}

interface MembershipPlan {
  id: string;
  name: string;
}

const EMPTY_FORM = {
  code: "",
  discount_type: "percentage",
  discount_value: "",
  max_discount_amount: "",
  usage_limit_total: "",
  usage_limit_per_user: "1",
  starts_at: "",
  expires_at: "",
  is_active: true,
  plan_ids: [] as string[],
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
  return value ? new Date(value).toISOString() : null;
}

function AdminCouponsContent() {
  const [page, setPage] = useState(1);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [saving, setSaving] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<Coupon | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [search, setSearch] = useState("");

  const loadPlans = async () => {
    const res = await fetch("/api/admin/memberships/plans", { credentials: "include" });
    const data = await res.json();
    if (data.success) {
      setPlans(data.data || []);
    }
  };

  const load = async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: "20" });
    if (search.trim()) p.set("search", search.trim());
    
    const res = await fetch(`/api/admin/coupons?${p}`, { credentials: "include" });
    const data = await res.json();
    if (data.success) {
      setCoupons(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } else {
      toast.error(data.error || "Gagal memuat kupon");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    load();
  }, [page, search]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditTarget(null);
    setModalMode("create");
  };

  const openEdit = (coupon: Coupon) => {
    setEditTarget(coupon);
    setForm({
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: String(coupon.discount_value),
      max_discount_amount: coupon.max_discount_amount ? String(coupon.max_discount_amount) : "",
      usage_limit_total: coupon.usage_limit_total ? String(coupon.usage_limit_total) : "",
      usage_limit_per_user: String(coupon.usage_limit_per_user || 1),
      starts_at: toLocalInputValue(coupon.starts_at),
      expires_at: toLocalInputValue(coupon.expires_at),
      is_active: coupon.is_active,
      plan_ids: coupon.plan_ids || [],
    });
    setModalMode("edit");
  };

  const save = async () => {
    if (!form.code.trim() || !form.discount_value.trim()) {
      toast.error("Kode kupon dan nilai diskon wajib diisi");
      return;
    }
    if (form.plan_ids.length === 0) {
      toast.error("Pilih minimal satu membership plan");
      return;
    }

    setSaving(true);
    const payload = {
      ...form,
      name: form.code, // coupons.name is NOT NULL; the UI labels coupons by code
      eligible_plans: form.plan_ids, // API reads `eligible_plans`, not `plan_ids`
      discount_value: Number(form.discount_value),
      max_discount_amount: form.max_discount_amount ? Number(form.max_discount_amount) : null,
      usage_limit_total: form.usage_limit_total ? Number(form.usage_limit_total) : null,
      usage_limit_per_user: Number(form.usage_limit_per_user),
      starts_at: fromLocalInputValue(form.starts_at),
      expires_at: fromLocalInputValue(form.expires_at),
    };
    
    const isEdit = modalMode === "edit" && editTarget;
    const url = isEdit ? `/api/admin/coupons/${editTarget!.id}` : "/api/admin/coupons";
    
    const res = await fetch(url, {
      method: isEdit ? "PUT" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    
    const data = await res.json();
    if (data.success) {
      toast.success(isEdit ? "Kupon diperbarui" : "Kupon dibuat");
      setModalMode(null);
      await load();
    } else {
      toast.error(data.error || "Gagal menyimpan kupon");
    }
    setSaving(false);
  };

  const remove = async (coupon: Coupon) => {
    if (!confirm(`Hapus kupon "${coupon.code}"?`)) return;
    const res = await fetch(`/api/admin/coupons/${coupon.id}`, { method: "DELETE", credentials: "include" });
    const data = await res.json();
    if (data.success) {
      toast.success("Kupon dihapus");
      load();
    } else {
      toast.error(data.error || "Gagal menghapus kupon");
    }
  };

  const togglePlanSelection = (planId: string) => {
    setForm(prev => {
      const isSelected = prev.plan_ids.includes(planId);
      return {
        ...prev,
        plan_ids: isSelected 
          ? prev.plan_ids.filter(id => id !== planId)
          : [...prev.plan_ids, planId]
      };
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bisnis"
        title="Kupon Diskon"
        description="Kelola kode kupon diskon untuk pembayaran membership PejuangYen."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Tambah Kupon
          </Button>
        }
      />

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(12,12,10,0.35)]" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari kode kupon..."
            className="w-full rounded-lg border border-[rgba(12,12,10,0.12)] bg-white py-2 pl-9 pr-3.5 text-sm outline-none transition-colors focus:border-primary"
          />
        </div>
      </div>

      <AdminTable
        columns={[
          { key: "code", label: "Kode Kupon" },
          { key: "discount", label: "Diskon" },
          { key: "usage", label: "Penggunaan" },
          { key: "status", label: "Status" },
          { key: "validity", label: "Masa Berlaku" },
          { key: "actions", label: "Aksi" },
        ]}
        loading={loading}
        empty={<div className="py-10 text-center text-sm text-gray-500">Belum ada kupon</div>}
      >
        {coupons.map((coupon) => (
          <Tr key={coupon.id}>
            <Td>
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-primary" />
                <span className="font-bold font-mono text-warm-black">{coupon.code}</span>
              </div>
            </Td>
            <Td>
              {coupon.discount_type === 'percentage' 
                ? <span className="font-semibold text-emerald-600">{coupon.discount_value}%</span>
                : <span className="font-semibold text-emerald-600">{formatCurrency(coupon.discount_value)}</span>
              }
              {coupon.discount_type === 'percentage' && coupon.max_discount_amount && (
                <p className="text-xs text-gray-500">Maks {formatCurrency(coupon.max_discount_amount)}</p>
              )}
            </Td>
            <Td>
              <span className="font-medium text-warm-black">{coupon.total_used}</span>
              {coupon.usage_limit_total && <span className="text-gray-500"> / {coupon.usage_limit_total}</span>}
              <p className="text-xs text-gray-400">Maks {coupon.usage_limit_per_user} per user</p>
            </Td>
            <Td>
              {coupon.is_active ? (
                <span className="inline-flex rounded-full bg-emerald-50 px-2 text-xs font-semibold leading-5 text-emerald-600">Aktif</span>
              ) : (
                <span className="inline-flex rounded-full bg-gray-100 px-2 text-xs font-semibold leading-5 text-gray-600">Nonaktif</span>
              )}
            </Td>
            <Td>
              {(!coupon.starts_at && !coupon.expires_at) && <span className="text-sm text-gray-500">Selamanya</span>}
              {coupon.starts_at && <p className="text-xs text-gray-600">Mulai: {new Date(coupon.starts_at).toLocaleDateString("id-ID")}</p>}
              {coupon.expires_at && <p className="text-xs text-gray-600">Berakhir: {new Date(coupon.expires_at).toLocaleDateString("id-ID")}</p>}
            </Td>
            <Td>
              <div className="flex gap-1.5">
                <button onClick={() => openEdit(coupon)} className="inline-flex items-center gap-1 rounded-md bg-warm-cream px-2.5 py-1 text-xs font-semibold text-warm-black">
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button onClick={() => remove(coupon)} className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{modalMode === "edit" ? "Edit Kupon" : "Tambah Kupon"}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium">Kode Kupon
                <input 
                  className={`${inputClass} font-mono uppercase`} 
                  placeholder="e.g. MERDEKA20" 
                  value={form.code} 
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} 
                />
              </label>
              
              <label className="space-y-1.5 text-sm font-medium">Status
                <select className={inputClass} value={form.is_active ? "true" : "false"} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value === "true" }))}>
                  <option value="true">Aktif</option>
                  <option value="false">Nonaktif</option>
                </select>
              </label>

              <label className="space-y-1.5 text-sm font-medium">Tipe Diskon
                <select className={inputClass} value={form.discount_type} onChange={(e) => setForm((f) => ({ ...f, discount_type: e.target.value as any }))}>
                  <option value="percentage">Persentase (%)</option>
                  <option value="fixed">Nominal Tetap (Rp)</option>
                </select>
              </label>

              <label className="space-y-1.5 text-sm font-medium">Nilai Diskon
                <input 
                  className={inputClass} 
                  type="number" 
                  min={0}
                  placeholder={form.discount_type === 'percentage' ? "e.g. 20" : "e.g. 50000"} 
                  value={form.discount_value} 
                  onChange={(e) => setForm((f) => ({ ...f, discount_value: e.target.value }))} 
                />
              </label>

              {form.discount_type === 'percentage' && (
                <label className="space-y-1.5 text-sm font-medium md:col-span-2">Maksimal Diskon (Rp) <span className="text-gray-400 font-normal">(Opsional)</span>
                  <input className={inputClass} type="number" min={0} value={form.max_discount_amount} onChange={(e) => setForm((f) => ({ ...f, max_discount_amount: e.target.value }))} />
                </label>
              )}

              <label className="space-y-1.5 text-sm font-medium">Batas Penggunaan Total <span className="text-gray-400 font-normal">(Opsional)</span>
                <input className={inputClass} type="number" min={1} placeholder="Kosongkan jika tak terbatas" value={form.usage_limit_total} onChange={(e) => setForm((f) => ({ ...f, usage_limit_total: e.target.value }))} />
              </label>

              <label className="space-y-1.5 text-sm font-medium">Batas Penggunaan Per User
                <input className={inputClass} type="number" min={1} value={form.usage_limit_per_user} onChange={(e) => setForm((f) => ({ ...f, usage_limit_per_user: e.target.value }))} />
              </label>

              <label className="space-y-1.5 text-sm font-medium">Mulai Berlaku <span className="text-gray-400 font-normal">(Opsional)</span>
                <input className={inputClass} type="datetime-local" value={form.starts_at} onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))} />
              </label>
              
              <label className="space-y-1.5 text-sm font-medium">Batas Kedaluwarsa <span className="text-gray-400 font-normal">(Opsional)</span>
                <input className={inputClass} type="datetime-local" value={form.expires_at} onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))} />
              </label>
            </div>
            
            <div className="space-y-2 mt-4 pt-4 border-t border-[rgba(12,12,10,0.08)]">
              <h4 className="text-sm font-medium">Berlaku untuk Membership Plan:</h4>
              <div className="grid gap-2 md:grid-cols-2">
                {plans.map(plan => (
                  <label key={plan.id} className="flex items-center gap-2 p-3 rounded-lg border border-[rgba(12,12,10,0.08)] bg-gray-50/50 cursor-pointer hover:bg-gray-100 transition-colors">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                      checked={form.plan_ids.includes(plan.id)}
                      onChange={() => togglePlanSelection(plan.id)}
                    />
                    <span className="text-sm font-medium text-warm-black">{plan.name}</span>
                  </label>
                ))}
                {plans.length === 0 && (
                  <p className="text-sm text-gray-500 italic col-span-2">Memuat membership plans...</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setModalMode(null)}>Batal</Button>
            <Button onClick={save} loading={saving}>Simpan Kupon</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminCouponsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-[400px] bg-gray-100 rounded-xl animate-pulse" />
      </div>
    }>
      <AdminCouponsContent />
    </Suspense>
  );
}
