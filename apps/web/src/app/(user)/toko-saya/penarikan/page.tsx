"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { tokoApi } from "@/lib/api-client";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { toast } from "@/components/ui/toast";
import { formatRupiah, formatDate } from "@/lib/utils";

interface Balance {
  available: number;
  pending: number;
}

interface Payout {
  id: string;
  amount: number;
  status: string;
  bank_name: string;
  bank_account: string;
  transfer_ref?: string | null;
  requested_at: string;
  paid_at?: string | null;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: "Menunggu", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { label: "Disetujui", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  paid: { label: "Ditransfer", cls: "bg-green-50 text-green-700 border-green-200" },
  rejected: { label: "Ditolak", cls: "bg-red-50 text-red-600 border-red-200" },
};

export default function TokoPenarikanPage() {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const [balRes, payoutsRes] = await Promise.all([tokoApi.balance(), tokoApi.payouts()]);
    if (balRes.success && balRes.data) setBalance(balRes.data as Balance);
    if (payoutsRes.success && payoutsRes.data) setPayouts(payoutsRes.data as Payout[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const request = async () => {
    const value = Number(amount);
    if (!value) {
      toast.error("Masukkan nominal penarikan");
      return;
    }
    setSubmitting(true);
    const res = await tokoApi.requestPayout(value);
    setSubmitting(false);
    if (res.success) {
      toast.success("Penarikan diajukan — menunggu persetujuan admin");
      setAmount("");
      load();
    } else {
      toast.error(res.error || "Gagal mengajukan penarikan");
    }
  };

  if (loading) return <p className="py-10 text-center text-sm text-gray-500">Memuat...</p>;

  return (
    <>
      <PageHeader
        title="Penarikan Saldo"
        description="Minimal Rp100.000 per penarikan. Saldo penjualan tersedia setelah masa penahanan 7 hari."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 max-w-xl">
        <div className="rounded-xl border border-primary/30 bg-[#F7E8E8] p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Saldo Tersedia</p>
          <p className="mt-1 text-2xl font-bold text-primary">{formatRupiah(balance?.available ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Saldo Tertahan</p>
          <p className="mt-1 text-2xl font-bold text-warm-black">{formatRupiah(balance?.pending ?? 0)}</p>
        </div>
      </div>

      <div className="mb-6 max-w-xl rounded-xl border border-[rgba(0,0,0,0.07)] bg-white p-5">
        <p className="mb-3 text-sm font-bold text-warm-black">Ajukan Penarikan</p>
        <div className="flex gap-2">
          <input
            type="number"
            className="flex-1 px-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white outline-none focus:border-primary transition-colors"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="100000"
          />
          <button
            onClick={request}
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover transition-colors disabled:opacity-60"
          >
            <Wallet className="h-4 w-4" /> {submitting ? "Mengajukan..." : "Tarik"}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Transfer ke rekening yang terdaftar di <Link href="/toko-saya/pengaturan" className="text-primary">Pengaturan Toko</Link>.
        </p>
      </div>

      <div className="max-w-xl rounded-xl border border-[rgba(0,0,0,0.07)] bg-white p-5">
        <p className="mb-3 text-sm font-bold text-warm-black">Riwayat Penarikan</p>
        {payouts.length === 0 ? (
          <p className="text-sm text-gray-500">Belum ada penarikan.</p>
        ) : (
          <div className="space-y-2">
            {payouts.map((p) => {
              const st = STATUS_LABEL[p.status] || STATUS_LABEL.pending;
              return (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-[rgba(0,0,0,0.05)] px-3 py-2.5 text-sm">
                  <div>
                    <p className="font-bold text-warm-black">{formatRupiah(p.amount)}</p>
                    <p className="text-xs text-gray-400">
                      {formatDate(p.requested_at)} · {p.bank_name} {p.bank_account}
                      {p.transfer_ref ? ` · ref ${p.transfer_ref}` : ""}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
