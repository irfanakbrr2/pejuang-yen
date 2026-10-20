"use client";

import { useState, useEffect } from "react";
import { formatRupiah } from "@/lib/utils";
import { EmptyState } from "@/components/ui/lottie/EmptyState";
import { Card, CardHeader, CardTitle, CardToolbar } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Commission {
  id: string;
  order_amount: number;
  amount: number;
  status: string;
  buyer_name: string;
  created_at: string;
}

interface CommissionsPage {
  commissions: Commission[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const statusBadge: Record<string, { bg: string; text: string }> = {
  paid:    { bg: "bg-[#F0FDF4] dark:bg-[#C0392B]/10", text: "text-[#16A34A] dark:text-[#34D399]" },
  pending: { bg: "bg-[#FFF7ED] dark:bg-[#F59E0B]/10", text: "text-[#D97706] dark:text-[#FCD34D]" },
};

export function CommissionHistory() {
  const [data, setData] = useState<CommissionsPage | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/affiliate/commissions?page=${page}&limit=10`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setData({
            commissions: d.data,
            page: d.pagination.page,
            limit: d.pagination.limit,
            total: d.pagination.total,
            totalPages: d.pagination.totalPages,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Riwayat Komisi</CardTitle>
        <CardToolbar>
          <span className="label-uppercase" style={{ fontSize: "10px" }}>
            {data ? data.total : 0} entri
          </span>
        </CardToolbar>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/30 dark:bg-white/5 border-b border-black/[0.04] dark:border-white/[0.05]">
              {["Tanggal", "Pembeli", "Total Pembelian", "Komisi Anda", "Status"].map((h) => (
                <th key={h} className="text-left px-4 py-3 label-uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="py-8">
                  <div className="flex flex-col gap-2 items-center justify-center">
                    <div className="skeleton h-4 w-32 rounded" />
                    <div className="skeleton h-4 w-24 rounded" />
                  </div>
                </td>
              </tr>
            ) : !data || data.commissions.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <EmptyState
                    title="Belum ada riwayat komisi"
                    description="Komisi akan muncul di sini setiap kali ada pembelian melalui link referral Anda."
                    size="sm"
                    className="py-8"
                  />
                </td>
              </tr>
            ) : (
              data.commissions.map((c) => {
                const badge = statusBadge[c.status] || { bg: "bg-[#F2F2F7] dark:bg-white/10", text: "text-[#6B7280] dark:text-slate-400" };
                return (
                  <tr key={c.id} className="border-b border-black/[0.04] dark:border-white/[0.05] hover:bg-white/46 dark:hover:bg-white/[0.02] transition-colors duration-100 last:border-0">
                    <td className="px-4 py-3 text-[#6B7280] dark:text-slate-400 text-xs">
                      {new Date(c.created_at).toLocaleDateString("id-ID", { year: "numeric", month: "short", day: "numeric" })}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#0D0D0D] dark:text-white">{c.buyer_name}</td>
                    <td className="px-4 py-3 text-[#6B7280] dark:text-slate-400 tabular-nums">{formatRupiah(c.order_amount)}</td>
                    <td className="px-4 py-3 font-semibold text-[#16A34A] dark:text-[#34D399] tabular-nums">{formatRupiah(c.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold capitalize ${badge.bg} ${badge.text}`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="px-5 py-3 border-t border-[rgba(12,12,10,0.06)] dark:border-white/[0.05] flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 text-xs font-medium text-[rgba(12,12,10,0.5)] dark:text-slate-400 disabled:opacity-30 hover:text-[#0D0D0D] dark:hover:text-white transition-colors"
          >
            <ChevronLeft size={14} /> Sebelumnya
          </button>
          <span className="text-xs text-[rgba(12,12,10,0.4)] dark:text-slate-500">
            {((page - 1) * data.limit) + 1}–{Math.min(page * data.limit, data.total)} dari {data.total}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page === data.totalPages}
            className="flex items-center gap-1 text-xs font-medium text-[rgba(12,12,10,0.5)] dark:text-slate-400 disabled:opacity-30 hover:text-[#0D0D0D] dark:hover:text-white transition-colors"
          >
            Berikutnya <ChevronRight size={14} />
          </button>
        </div>
      )}
    </Card>
  );
}
