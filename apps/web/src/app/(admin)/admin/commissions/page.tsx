"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useState, useEffect, Suspense } from "react";
import { Clock, DollarSign, ListChecks } from "lucide-react";
import { AdminTable, Tr, Td, StatusBadge } from "@/components/ui/AdminTable";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/lottie/EmptyState";
import { BentoStatCard } from "@/components/ui/bento-stat-card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { formatRupiah } from "@/lib/utils";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { Pagination } from "@/components/ui/Pagination";

interface Comm {
  id: string;
  affiliate_name: string;
  affiliate_code: string;
  affiliate_email?: string;
  affiliate_phone?: string | null;
  payout_name?: string | null;
  payout_bank_name?: string | null;
  payout_bank_account?: string | null;
  buyer_name: string;
  buyer_email?: string;
  buyer_phone?: string | null;
  product_name: string;
  amount: number;
  commission_rate: number;
  commission_amount: number;
  withdrawal_fee?: number;
  net_amount?: number;
  status: string;
  created_at: string;
  approved_at?: string;
  rejected_at?: string;
  paid_at?: string;
  notes?: string;
}

const WITHDRAWAL_ADMIN_FEE = 2500;

type ActionType = "approve" | "reject" | "mark-paid";

const ACTION_CONFIG: Record<ActionType, { title: string; description: string; confirmLabel: string; variant: "default" | "danger" }> = {
  approve: {
    title: "Approve Komisi?",
    description: "Komisi akan disetujui dan siap untuk dibayarkan ke affiliate.",
    confirmLabel: "Approve",
    variant: "default",
  },
  reject: {
    title: "Reject Komisi?",
    description: "Komisi akan ditolak. Tindakan ini tidak dapat dibatalkan.",
    confirmLabel: "Reject",
    variant: "danger",
  },
  "mark-paid": {
    title: "Tandai Sudah Dibayar?",
    description: "Pastikan pembayaran ke affiliate sudah dilakukan sebelum mengkonfirmasi.",
    confirmLabel: "Tandai Dibayar",
    variant: "default",
  },
};

function AdminCommissionsContent() {
  const [page, setPage] = useState(1);

  const [comms, setComms] = useState<Comm[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [totalPages, setTotalPages] = useState(1);
  const [processing, setProcessing] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: ActionType; commId: string } | null>(null);


  const fetchComms = async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: "20" });
    if (statusFilter) p.set("status", statusFilter);
    try {
      const res = await fetch(`/api/admin/commissions?${p}`, { credentials: "include" });
      const d = await res.json();
      if (d.success) {
        setComms(d.data || []);
        setTotalPages(d.pagination?.totalPages || 1);
      }
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchComms(); }, [page, statusFilter]);

  const doAction = async () => {
    if (!confirmAction) return;
    const { type, commId } = confirmAction;
    setProcessing(commId + type);
    setConfirmAction(null);
    try {
      const res = await fetch(`/api/admin/commissions/${commId}/${type}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        const labels: Record<ActionType, string> = {
          approve: "Komisi berhasil diapprove",
          reject: "Komisi berhasil direject",
          "mark-paid": "Komisi ditandai sudah dibayar",
        };
        toast.success(labels[type]);
        fetchComms();
      } else {
        toast.error(data.error || "Gagal memproses komisi");
      }
    } catch {
      toast.error("Terjadi kesalahan. Coba lagi.");
    } finally {
      setProcessing(null);
    }
  };

  const totalPending = comms.filter((c) => c.status === "pending").reduce((s, c) => s + c.commission_amount, 0);
  const totalApproved = comms.filter((c) => c.status === "approved").reduce((s, c) => s + c.commission_amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Affiliate"
        title="Komisi Affiliate"
        description="Kelola dan proses pembayaran komisi"
      />

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {loading ? (
          [1, 2, 3].map((i) => (
            <div key={i} className="glass-card p-5 min-h-[140px]">
              <div className="skeleton h-3 w-24 mb-3 rounded" />
              <div className="skeleton h-7 w-32 rounded" />
            </div>
          ))
        ) : (
          <>
            <BentoStatCard
              title="Pending Review"
              value={formatRupiah(totalPending)}
              icon={Clock}
              accentColor="orange"
            />
            <BentoStatCard
              title="Siap Dibayar"
              value={formatRupiah(totalApproved)}
              icon={DollarSign}
              accentColor="teal"
            />
            <BentoStatCard
              title="Total Entri"
              value={`${comms.length} entri`}
              icon={ListChecks}
              accentColor="blue"
            />
          </>
        )}
      </div>

      {/* Filter */}
      <div className="mb-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black outline-none focus:border-primary transition-colors"
        >
          <option value="">Semua Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      <AdminTable
        columns={[
          { key: "date", label: "Tanggal" },
          { key: "affiliate", label: "Affiliate" },
          { key: "rekening", label: "Rekening" },
          { key: "buyer", label: "Buyer" },
          { key: "order", label: "Order" },
          { key: "rate", label: "Rate" },
          { key: "commission", label: "Komisi" },
          { key: "status", label: "Status" },
          { key: "action", label: "Aksi" },
        ]}
        loading={loading}
        empty={
          <EmptyState
            title="Belum ada komisi"
            description="Komisi affiliate akan muncul di sini setelah ada referral pembelian."
            size="sm"
            className="py-8"
          />
        }
      >
        {loading ? (
          <TableRowSkeleton cols={9} rows={4} />
        ) : (
          comms.map((c) => (
            <Tr key={c.id}>
              <Td className="text-[rgba(12,12,10,0.55)] text-xs">
                {new Date(c.created_at).toLocaleDateString("id-ID")}
              </Td>
              <Td>
                <p className="font-medium text-warm-black text-sm">{c.affiliate_name}</p>
                <p className="text-xs text-[rgba(12,12,10,0.45)]">{c.affiliate_code}</p>
                {c.affiliate_phone && (
                  <p className="text-xs text-[rgba(12,12,10,0.55)]">{c.affiliate_phone}</p>
                )}
                {c.affiliate_email && (
                  <p className="text-[11px] text-[rgba(12,12,10,0.35)]">{c.affiliate_email}</p>
                )}
              </Td>
              <Td>
                {c.payout_bank_account ? (
                  <>
                    <p className="font-semibold text-warm-black text-sm">{c.payout_bank_name || "—"}</p>
                    <p className="text-xs font-mono text-[rgba(12,12,10,0.65)] select-all">{c.payout_bank_account}</p>
                    {c.payout_name && (
                      <p className="text-[11px] text-[rgba(12,12,10,0.45)]">a.n. {c.payout_name}</p>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-amber-600">Belum diisi</span>
                )}
              </Td>
              <Td>
                <p className="text-sm text-warm-black">{c.buyer_name}</p>
                <p className="text-xs text-[rgba(12,12,10,0.45)]">{c.product_name}</p>
                {c.buyer_phone && (
                  <p className="text-xs text-[rgba(12,12,10,0.55)]">{c.buyer_phone}</p>
                )}
                {c.buyer_email && (
                  <p className="text-[11px] text-[rgba(12,12,10,0.35)]">{c.buyer_email}</p>
                )}
              </Td>
              <Td className="font-medium text-warm-black tabular-nums">{formatRupiah(c.amount)}</Td>
              <Td className="text-[rgba(12,12,10,0.65)]">{c.commission_rate}%</Td>
              <Td className="tabular-nums">
                <p className="font-semibold text-green-700">{formatRupiah(c.commission_amount)}</p>
                <p className="text-[10px] text-[rgba(12,12,10,0.4)]">
                  −{formatRupiah(c.withdrawal_fee ?? WITHDRAWAL_ADMIN_FEE)} admin
                </p>
                <p className="text-xs font-semibold text-warm-black">
                  Transfer: {formatRupiah(c.net_amount ?? Math.max(0, c.commission_amount - WITHDRAWAL_ADMIN_FEE))}
                </p>
              </Td>
              <Td>
                <StatusBadge status={c.status} />
                {c.status === "approved" && c.approved_at && (
                  <p className="text-[10px] text-[rgba(12,12,10,0.4)] mt-0.5">
                    {new Date(c.approved_at).toLocaleDateString("id-ID")}
                  </p>
                )}
                {c.status === "rejected" && c.rejected_at && (
                  <p className="text-[10px] text-[rgba(12,12,10,0.4)] mt-0.5">
                    {new Date(c.rejected_at).toLocaleDateString("id-ID")}
                    {c.notes && <span> · {c.notes}</span>}
                  </p>
                )}
                {c.status === "paid" && c.paid_at && (
                  <p className="text-[10px] text-[rgba(12,12,10,0.4)] mt-0.5">
                    {new Date(c.paid_at).toLocaleDateString("id-ID")}
                  </p>
                )}
              </Td>
              <Td>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {c.status === "pending" && (
                    <>
                      <button
                        onClick={() => setConfirmAction({ type: "approve", commId: c.id })}
                        disabled={processing === c.id + "approve"}
                        className="px-2.5 py-1 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => setConfirmAction({ type: "reject", commId: c.id })}
                        disabled={processing === c.id + "reject"}
                        className="px-2.5 py-1 text-xs font-semibold bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {c.status === "approved" && (
                    <button
                      onClick={() => setConfirmAction({ type: "mark-paid", commId: c.id })}
                      disabled={processing === c.id + "mark-paid"}
                      className="px-2.5 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-60"
                    >
                      Tandai Dibayar
                    </button>
                  )}
                </div>
              </Td>
            </Tr>
          ))
        )}
      </AdminTable>

      {totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      {confirmAction && (
        <ConfirmDialog
          open={!!confirmAction}
          onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
          title={ACTION_CONFIG[confirmAction.type].title}
          description={ACTION_CONFIG[confirmAction.type].description}
          confirmLabel={ACTION_CONFIG[confirmAction.type].confirmLabel}
          variant={ACTION_CONFIG[confirmAction.type].variant}
          loading={processing !== null}
          onConfirm={doAction}
        />
      )}
    </div>
  );
}

export default function AdminCommissionsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-[400px] bg-gray-100 rounded-xl animate-pulse" />
      </div>
    }>
      <AdminCommissionsContent />
    </Suspense>
  );
}
