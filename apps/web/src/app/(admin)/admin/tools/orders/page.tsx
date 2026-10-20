"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { formatRupiah, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { AdminTable, Tr, Td, StatusBadge } from "@/components/ui/AdminTable";
import { EmptyState } from "@/components/ui/lottie/EmptyState";
import { AlertCircle } from "lucide-react";
import Link from "next/link";

interface Order {
  id: string;
  user_id: string;
  order_number: string;
  amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  user_name: string;
  user_email: string;
  package_name: string;
  package_credits: number;
}

// H3: Response format updated to match backend C5 fix
interface OrdersResponse {
  orders: Order[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  totalRevenue: number;
}

const STATUSES = [
  { value: "", label: "Semua Status" },
  { value: "paid", label: "Berhasil" },
  { value: "pending", label: "Menunggu" },
  { value: "cancelled", label: "Dibatalkan" },
];

export default function AdminToolsOrdersPage() {
  const [result, setResult] = useState<OrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [fetchError, setFetchError] = useState<string | null>(null);  // M5

  // H2: load function takes explicit status to avoid closure stale reference
  const load = (p: number, s: string) => {
    setLoading(true);
    setFetchError(null);
    const params = new URLSearchParams({ page: String(p), limit: "20" });
    if (s) params.set("status", s);
    api<OrdersResponse>(`/api/admin/tools/orders?${params}`, { cacheTtl: 0 })
      .then((res) => {
        if (res.success && res.data) {
          setResult(res.data);
        } else {
          setFetchError(res.error || "Gagal memuat data");  // M5
        }
      })
      .catch(() => setFetchError("Gagal memuat data. Periksa koneksi dan coba lagi."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(1, status);
  }, [status]);

  const handleStatusChange = (s: string) => {
    setStatus(s);
    setPage(1);
    // load called via useEffect
  };

  return (
    <>
      <PageHeader
        title="Orders Kredit"
        description="Daftar semua transaksi pembelian kredit tools."
      />

      {/* M5: Show error state */}
      {fetchError && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{fetchError}</p>
          <button onClick={() => load(page, status)} className="ml-auto text-xs font-medium text-red-600 underline">
            Coba Lagi
          </button>
        </div>
      )}

      {/* Aggregate */}
      {!loading && result && (
        <div className="mb-5 flex flex-wrap items-center gap-4">
          <div className="rounded-xl border bg-white px-4 py-3">
            <p className="text-xs text-gray-500">Total Transaksi</p>
            <p className="text-lg font-bold text-gray-900">{result.pagination?.total || 0}</p>
          </div>
          <div className="rounded-xl border bg-white px-4 py-3">
            <p className="text-xs text-gray-500">Total Revenue (Paid)</p>
            <p className="text-lg font-bold text-green-700">{formatRupiah(result.totalRevenue || 0)}</p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => handleStatusChange(s.value)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              status === s.value
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Memuat...</div>
      ) : !result?.orders?.length ? (
        <EmptyState title="Belum ada order kredit" />
      ) : (
        <>
          <AdminTable columns={[
            { key: "order_number", label: "Order #" },
            { key: "user", label: "User" },
            { key: "paket", label: "Paket" },
            { key: "credits", label: "Kredit" },
            { key: "total", label: "Total" },
            { key: "status", label: "Status" },
            { key: "tanggal", label: "Tanggal" },
          ]}>
            {result.orders.map((o) => (
              <Tr key={o.id}>
                <Td><span className="font-mono text-xs text-gray-600">{o.order_number}</span></Td>
                <Td>
                  {/* H1: use o.user_id not o.id for user link */}
                  <Link href={`/admin/users/${o.user_id}`} className="hover:underline">
                    <p className="text-xs font-medium text-gray-800">{o.user_name}</p>
                    <p className="text-[11px] text-gray-400">{o.user_email}</p>
                  </Link>
                </Td>
                <Td>{o.package_name || "—"}</Td>
                <Td>{o.package_credits ?? "—"}</Td>
                <Td className="font-semibold text-gray-800">{formatRupiah(o.amount)}</Td>
                <Td><StatusBadge status={o.status} /></Td>
                <Td>{formatDate(o.created_at)}</Td>
              </Tr>
            ))}
          </AdminTable>

          {/* Pagination */}
          {result.pagination && result.pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-gray-400">
                Halaman {result.pagination.page} dari {result.pagination.totalPages} ({result.pagination.total} total)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { const p = page - 1; setPage(p); load(p, status); }}  // H2
                  disabled={page <= 1}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  Sebelumnya
                </button>
                <button
                  onClick={() => { const p = page + 1; setPage(p); load(p, status); }}  // H2
                  disabled={page >= result.pagination.totalPages}
                  className="rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
