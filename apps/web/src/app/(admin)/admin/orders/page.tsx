"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { Search, Check, X, Mail } from "lucide-react";
import { AdminTable, Tr, Td, StatusBadge } from "@/components/ui/AdminTable";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/lottie/EmptyState";
import { formatRupiah } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { Pagination } from "@/components/ui/Pagination";

interface Order {
  id: string;
  order_number?: string;
  user_name: string;
  user_email: string;
  order_type: string;
  product_name?: string;
  amount: number;
  status: string;
  payment_url?: string;
  metadata_json?: string;
  created_at: string;
}

interface MembershipPlan {
  id: string;
  name: string;
  duration_type: string;
  status: string;
}

const typeBadge: Record<string, string> = {
  membership: "bg-[#F7E8E8] text-[#8B1414]",
  course:     "bg-purple-50 text-purple-700",
};

const STATUS_OPTIONS = ["pending", "paid", "failed", "cancelled"];

function AdminOrdersContent() {
  const [page, setPage] = useState(1);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [membershipPlanFilter, setMembershipPlanFilter] = useState("");
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlan[]>([]);
  const [search, setSearch] = useState("");
  const [totalPages, setTotalPages] = useState(1);


  // Inline status edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingStatus, setEditingStatus] = useState<string>("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = (
    currentPage = page,
    filter = statusFilter,
    type = typeFilter,
    membershipPlan = membershipPlanFilter,
    q = search
  ) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(currentPage), limit: "20" });
    if (filter) params.set("status", filter);
    if (type) params.set("order_type", type);
    if (membershipPlan) params.set("membership_plan_id", membershipPlan);
    if (q.trim()) params.set("search", q.trim());

    fetch(`/api/admin/orders?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setOrders(d.data);
          setTotalPages(d.pagination?.totalPages || 1);
        } else {
          setError(d.error || "Gagal memuat data");
        }
      })
      .catch(() => setError("Gagal memuat data. Periksa koneksi internet."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(page, statusFilter, typeFilter, membershipPlanFilter, search); }, [page, statusFilter, typeFilter, membershipPlanFilter]);

  useEffect(() => {
    fetch("/api/admin/memberships/plans", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setMembershipPlans(d.data || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (page !== 1) setPage(1);
      else loadData(1, statusFilter, typeFilter, membershipPlanFilter, search);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const startEdit = (order: Order) => {
    setEditingId(order.id);
    setEditingStatus(order.status);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingStatus("");
  };

  const saveStatus = async (order: Order) => {
    if (editingStatus === order.status) { cancelEdit(); return; }

    // Warn before marking paid — it provisions access
    if (editingStatus === "paid") {
      const ok = confirm(
        `Tandai order ${order.order_number || order.id.slice(0, 8)} sebagai PAID?\n\nAkses kelas/membership akan langsung diberikan ke user.`
      );
      if (!ok) return;
    }

    if (order.status === "paid" && editingStatus !== "paid") {
      const ok = confirm(
        `Ubah order ${order.order_number || order.id.slice(0, 8)} dari PAID ke ${editingStatus.toUpperCase()}?\n\nAkses kelas/membership yang berasal dari order ini akan dicabut.`
      );
      if (!ok) return;
    }

    setSavingId(order.id);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: editingStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status: editingStatus } : o));
        toast.success("Status order diperbarui");
        cancelEdit();
      } else {
        toast.error(data.error || "Gagal mengubah status");
      }
    } catch {
      toast.error("Gagal mengubah status");
    } finally {
      setSavingId(null);
    }
  };

  const sendFollowUp = async (order: Order) => {
    if (!confirm(`Kirim email pengingat pembayaran ke ${order.user_email}?`)) return;

    setSendingId(order.id);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/remind`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Email pengingat berhasil dikirim!");
      } else {
        toast.error(data.error || "Gagal mengirim email pengingat");
      }
    } catch {
      toast.error("Gagal mengirim email pengingat");
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Transaksi"
        title="Kelola Orders"
        description="Semua transaksi di platform"
      />

      {/* Filters row */}
      <div className="glass-card p-3 flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(12,12,10,0.35)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, email, order..."
            className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black placeholder:text-[rgba(12,12,10,0.35)] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black outline-none focus:border-primary transition-colors"
        >
          <option value="">Semua Status</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => {
            const nextType = e.target.value;
            setTypeFilter(nextType);
            if (nextType !== "membership") setMembershipPlanFilter("");
            setPage(1);
          }}
          className="px-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black outline-none focus:border-primary transition-colors"
        >
          <option value="">Semua Tipe</option>
          <option value="membership">Membership</option>
          <option value="course">Kelas</option>
        </select>
        <select
          value={membershipPlanFilter}
          onChange={(e) => {
            const planId = e.target.value;
            setMembershipPlanFilter(planId);
            if (planId) setTypeFilter("membership");
            setPage(1);
          }}
          className="px-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black outline-none focus:border-primary transition-colors"
        >
          <option value="">Semua Jenis Membership</option>
          {membershipPlans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} ({plan.duration_type})
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-sm text-red-500">{error}</p>
          <button onClick={() => loadData(page, statusFilter, typeFilter, membershipPlanFilter, search)} className="text-xs font-medium text-primary hover:underline">Coba Lagi</button>
        </div>
      ) : (
        <>
          <AdminTable
            columns={[
              { key: "order_number", label: "No. Order" },
              { key: "customer", label: "Customer" },
              { key: "type", label: "Tipe" },
              { key: "product", label: "Produk" },
              { key: "amount", label: "Amount" },
              { key: "date", label: "Tanggal" },
              { key: "status", label: "Status" },
              { key: "action", label: "Aksi" },
            ]}
            loading={loading}
            empty={
              <EmptyState
                title="Belum ada orders"
                description="Orders akan muncul di sini setelah ada transaksi masuk."
                size="sm"
                className="py-8"
              />
            }
          >
            {loading ? (
              <TableRowSkeleton cols={8} rows={5} />
            ) : (
              orders.map((o) => {
                const isEditing = editingId === o.id;
                const isSaving = savingId === o.id;

                return (
                  <Tr key={o.id}>
                    <Td>
                      <Link
                        href={`/admin/orders/${o.id}`}
                        prefetch={false}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {o.order_number || o.id.slice(0, 8) + "…"}
                      </Link>
                    </Td>
                    <Td>
                      <p className="font-medium text-warm-black">{o.user_name}</p>
                      <p className="text-xs text-[rgba(12,12,10,0.45)]">{o.user_email}</p>
                    </Td>
                    <Td>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold capitalize ${typeBadge[o.order_type] || "bg-gray-100 text-gray-600"}`}>
                        {o.order_type === "membership" ? "Member" : o.order_type || "—"}
                      </span>
                    </Td>
                    <Td>
                      <div className="text-[rgba(12,12,10,0.65)] max-w-[140px] truncate" title={o.product_name}>
                        {o.product_name || "—"}
                      </div>
                    </Td>
                    <Td className="font-semibold text-warm-black tabular-nums">{formatRupiah(o.amount)}</Td>
                    <Td className="text-[rgba(12,12,10,0.55)] text-xs">
                      {new Date(o.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </Td>
                    <Td>
                      {isEditing ? (
                        <select
                          value={editingStatus}
                          onChange={(e) => setEditingStatus(e.target.value)}
                          autoFocus
                          className="px-2 py-1 text-xs rounded-md border-2 border-primary bg-white text-warm-black outline-none"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      ) : (
                        <StatusBadge status={o.status} />
                      )}
                    </Td>
                    <Td>
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => saveStatus(o)}
                            disabled={isSaving}
                            className="w-7 h-7 flex items-center justify-center rounded-md bg-primary text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
                            title="Simpan"
                          >
                            {isSaving
                              ? <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                              : <Check size={13} />
                            }
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={isSaving}
                            className="w-7 h-7 flex items-center justify-center rounded-md border border-[rgba(12,12,10,0.12)] text-[rgba(12,12,10,0.5)] hover:bg-warm-cream transition-colors"
                            title="Batal"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => startEdit(o)}
                            className="px-2.5 py-1 text-xs font-medium text-warm-black border border-[rgba(12,12,10,0.12)] rounded-md hover:bg-warm-cream transition-colors"
                          >
                            Ubah Status
                          </button>
                          {o.status === "pending" && (
                            <button
                              onClick={() => sendFollowUp(o)}
                              disabled={sendingId === o.id}
                              className="w-7 h-7 flex items-center justify-center rounded-md border border-[rgba(12,12,10,0.12)] text-[rgba(12,12,10,0.5)] hover:bg-warm-cream transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Kirim Email Pengingat"
                            >
                              {sendingId === o.id ? (
                                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                              ) : (
                                <Mail size={13} />
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </Td>
                  </Tr>
                );
              })
            )}
          </AdminTable>

          {totalPages > 1 && (
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </>
      )}
    </div>
  );
}

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-[400px] bg-gray-100 rounded-xl animate-pulse" />
      </div>
    }>
      <AdminOrdersContent />
    </Suspense>
  );
}
