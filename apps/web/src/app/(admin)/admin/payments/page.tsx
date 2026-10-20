"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { AdminTable, Tr, Td, StatusBadge } from "@/components/ui/AdminTable";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/lottie/EmptyState";
import { formatRupiah } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { Pagination } from "@/components/ui/Pagination";

interface Payment {
  id: string;
  order_id: string;
  order_number?: string;
  provider: string;
  provider_transaction_id?: string;
  amount: number;
  status: string;
  created_at: string;
}

function AdminPaymentsContent() {
  const [page, setPage] = useState(1);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [totalPages, setTotalPages] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);


  const loadData = (currentPage = page, filter = statusFilter) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(currentPage), limit: "20" });
    if (filter) params.set("status", filter);

    fetch(`/api/admin/payments?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setPayments(d.data || []);
          setTotalPages(d.pagination?.totalPages || 1);
        } else {
          setError(d.error || "Gagal memuat data");
        }
      })
      .catch(() => setError("Gagal memuat data. Periksa koneksi internet."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(page, statusFilter); }, [page, statusFilter]);

  const deletePayment = async (payment: Payment) => {
    const label = payment.provider_transaction_id || payment.id.slice(0, 12);
    const ok = confirm(
      `Hapus data payment ${label}?\n\nIni hanya menghapus record payment dari daftar admin. Akses user dan status order tidak akan berubah.`
    );
    if (!ok) return;

    setDeletingId(payment.id);
    try {
      const res = await fetch(`/api/admin/payments/${payment.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();

      if (data.success) {
        setPayments((prev) => prev.filter((p) => p.id !== payment.id));
        toast.success("Data payment dihapus tanpa mengubah akses user");
      } else {
        toast.error(data.error || "Gagal menghapus payment");
      }
    } catch {
      toast.error("Gagal menghapus payment");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Keuangan"
        title="Manajemen Pembayaran"
        description="Riwayat transaksi pembayaran"
      />

      <div className="glass-card p-3 w-fit">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black outline-none focus:border-primary transition-colors"
        >
          <option value="">Semua Status</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-sm text-red-500">{error}</p>
          <button onClick={() => loadData(page, statusFilter)} className="text-xs font-medium text-primary hover:underline">Coba Lagi</button>
        </div>
      ) : (
        <>
          <AdminTable
            columns={[
              { key: "txid", label: "ID Transaksi" },
              { key: "order", label: "Order" },
              { key: "provider", label: "Provider" },
              { key: "amount", label: "Jumlah" },
              { key: "status", label: "Status" },
              { key: "date", label: "Tanggal" },
              { key: "action", label: "Aksi" },
            ]}
            loading={loading}
            empty={
              <EmptyState
                title="Tidak ada data pembayaran"
                description="Riwayat pembayaran akan muncul di sini setelah ada transaksi."
                size="sm"
                className="py-8"
              />
            }
          >
            {loading ? (
              <TableRowSkeleton cols={7} rows={5} />
            ) : (
              payments.map((p) => (
                <Tr key={p.id}>
                  <Td className="font-mono text-xs">{p.provider_transaction_id || p.id.slice(0, 12)}</Td>
                  <Td>
                    <Link
                      href={`/admin/orders/${p.order_id}`}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {p.order_number || p.order_id.slice(0, 8) + "…"}
                    </Link>
                  </Td>
                  <Td className="text-[rgba(12,12,10,0.65)]">{p.provider}</Td>
                  <Td className="font-semibold text-warm-black">{formatRupiah(p.amount)}</Td>
                  <Td><StatusBadge status={p.status} /></Td>
                  <Td className="text-[rgba(12,12,10,0.55)]">
                    {new Date(p.created_at).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </Td>
                  <Td>
                    <button
                      onClick={() => deletePayment(p)}
                      disabled={deletingId === p.id}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      title="Hapus data payment"
                      aria-label="Hapus data payment"
                    >
                      <Trash2 size={14} />
                    </button>
                  </Td>
                </Tr>
              ))
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

export default function AdminPaymentsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-[400px] bg-gray-100 rounded-xl animate-pulse" />
      </div>
    }>
      <AdminPaymentsContent />
    </Suspense>
  );
}
