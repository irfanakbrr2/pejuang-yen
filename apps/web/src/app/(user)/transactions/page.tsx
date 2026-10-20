"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, Suspense } from "react";
import { formatRupiah } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardToolbar } from "@/components/ui/card";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/lottie/EmptyState";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { Pagination } from "@/components/ui/Pagination";

interface Transaction {
  id: string;
  order_number: string;
  order_type: string;
  product_name?: string;
  amount: number;
  status: string;
  created_at: string;
}

const statusBadge: Record<string, { bg: string; text: string }> = {
  paid:      { bg: "bg-[#F0FDF4] dark:bg-[#C0392B]/10", text: "text-[#16A34A] dark:text-[#34D399]" },
  pending:   { bg: "bg-[#FFF7ED] dark:bg-[#F59E0B]/10", text: "text-[#D97706] dark:text-[#FCD34D]" },
  failed:    { bg: "bg-red-50 dark:bg-red-500/10",    text: "text-red-600 dark:text-red-400"    },
  cancelled: { bg: "bg-[#F2F2F7] dark:bg-white/10", text: "text-[#6B7280] dark:text-slate-400" },
};

function TransactionsContent() {
  const [page, setPage] = useState(1);

  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);

  const loadData = () => {
    setLoading(true);
    setError(null);
    fetch(`/api/user/transactions?page=${page}&limit=20`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setTxs(d.data || []);
          setTotalPages(d.pagination?.totalPages || 1);
        } else {
          setError(d.error || "Gagal memuat data");
        }
      })
      .catch(() => setError("Gagal memuat data. Periksa koneksi internet."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, [page]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Keuangan"
        title="Riwayat Transaksi"
        description="Daftar pembelian kelas dan membership Anda"
      />

      {error ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          <button onClick={loadData} className="text-xs font-medium text-[#8B1414] dark:text-[#C0392B] hover:underline">Coba Lagi</button>
        </div>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Transaksi</CardTitle>
            <CardToolbar>
              <span className="label-uppercase" style={{ fontSize: "10px" }}>
                {loading ? "" : `${txs.length} transaksi`}
              </span>
            </CardToolbar>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/30 dark:bg-white/5 border-b border-black/[0.04] dark:border-white/[0.05]">
                  {["No. Pesanan", "Tanggal", "Produk", "Total", "Status", "Aksi"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 label-uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <TableRowSkeleton cols={6} rows={4} />
                ) : txs.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        title="Belum ada transaksi"
                        description="Transaksi pembelian kelas dan membership akan muncul di sini."
                        size="sm"
                        className="py-8"
                      />
                    </td>
                  </tr>
                ) : (
                  txs.map((t) => {
                    const badge = statusBadge[t.status] || { bg: "bg-[#F2F2F7] dark:bg-white/10", text: "text-[#6B7280] dark:text-slate-400" };
                    return (
                      <tr
                        key={t.id}
                        className="border-b border-black/[0.04] dark:border-white/[0.05] hover:bg-white/46 dark:hover:bg-white/[0.02] transition-colors duration-100 last:border-0"
                      >
                        <td className="px-4 py-3 font-medium text-[#0D0D0D] dark:text-white font-mono text-xs">
                          {t.order_number || t.id.slice(0, 8)}
                        </td>
                        <td className="px-4 py-3 text-[#6B7280] dark:text-slate-400 text-xs">
                          {new Date(t.created_at).toLocaleDateString("id-ID", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3 text-[#374151] dark:text-slate-300 text-sm">
                          {t.product_name || <span className="text-[#D1D5DB] dark:text-slate-600">—</span>}
                        </td>
                        <td className="px-4 py-3 font-semibold text-[#0D0D0D] dark:text-white tabular-nums">
                          {formatRupiah(t.amount)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold capitalize ${badge.bg} ${badge.text}`}>
                            {t.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {t.status === "pending" && (
                            <a
                              href={`/checkout/${t.id}`}
                              className="px-3 py-1.5 bg-[#8B1414] dark:bg-[#C0392B] text-white dark:text-black text-xs font-semibold rounded-lg hover:bg-[#6E0F0F] dark:hover:bg-[#A93226] transition-colors duration-150 active:scale-[0.97]"
                            >
                              Bayar
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="p-4 border-t border-black/[0.04] dark:border-white/[0.05]">
              <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

export default function TransactionsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-20 bg-gray-100 dark:bg-white/5 rounded-xl animate-pulse" />
        <div className="h-[400px] bg-gray-100 dark:bg-white/5 rounded-xl animate-pulse" />
      </div>
    }>
      <TransactionsContent />
    </Suspense>
  );
}
