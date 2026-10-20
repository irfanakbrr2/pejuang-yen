"use client";
/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-unused-vars */

import { useState, useEffect, Suspense } from "react";

import { Search, Settings, Percent, X, Check } from "lucide-react";
import Link from "next/link";
import { AdminTable, Tr, Td, StatusBadge } from "@/components/ui/AdminTable";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/lottie/EmptyState";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { formatRupiah } from "@/lib/utils";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { Pagination } from "@/components/ui/Pagination";

interface Affiliate {
  id: string;
  name: string;
  email: string;
  affiliate_code: string;
  public_ref_code?: string | null;
  status: string;
  default_commission_rate: number;
  payout_bank_name?: string;
  total_referrals: number;
  total_paid: number;
  created_at: string;
}

function AdminAffiliatesContent() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [globalRate, setGlobalRate] = useState<number>(10);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1 });

  const [page, setPage] = useState("1");

  // Toggle status
  const [confirmToggle, setConfirmToggle] = useState<{ id: string; status: string; name: string } | null>(null);
  const [processing, setProcessing] = useState(false);

  // Commission rate inline editor
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [editingRateValue, setEditingRateValue] = useState<string>("");
  const [savingRate, setSavingRate] = useState(false);

  const loadData = () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", page);
    params.set("limit", "20");
    if (search.trim()) params.set("search", search);

    const affiliatesFetch = fetch(`/api/admin/affiliates?${params.toString()}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { 
        if (d.success) {
          setAffiliates(d.data || []); 
          setPagination({
            currentPage: d.pagination?.page || 1,
            totalPages: d.pagination?.totalPages || 1
          });
        } else {
          setError(d.error || "Gagal memuat data"); 
        }
      })
      .catch(() => setError("Gagal memuat data. Periksa koneksi internet."))
      .finally(() => setLoading(false));

    const settingsFetch = fetch(`/api/admin/settings`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.success && d.data?.default_commission_rate) setGlobalRate(Number(d.data.default_commission_rate)); })
      .catch(() => {});

    return Promise.all([affiliatesFetch, settingsFetch]);
  };

  useEffect(() => { 
    const debounceTimer = setTimeout(() => {
      loadData(); 
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [page, search]);

  const filtered = affiliates; // Filtering handled by backend now

  const toggleStatus = async (id: string, current: string) => {
    const newStatus = current === "active" ? "inactive" : "active";
    setProcessing(true);
    try {
      const res = await fetch(`/api/admin/affiliates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setAffiliates((prev) => prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a)));
        toast.success("Status affiliate diperbarui");
      } else {
        toast.error(data.error || "Gagal mengubah status");
      }
    } catch {
      toast.error("Gagal mengubah status");
    } finally {
      setProcessing(false);
      setConfirmToggle(null);
    }
  };

  const startEditRate = (a: Affiliate) => {
    setEditingRateId(a.id);
    setEditingRateValue(String(a.default_commission_rate));
  };

  const cancelEditRate = () => {
    setEditingRateId(null);
    setEditingRateValue("");
  };

  const saveRate = async (id: string) => {
    const rate = parseInt(editingRateValue, 10);
    if (isNaN(rate) || rate < 0 || rate > 10) {
      toast.error("Rate affiliate biasa harus antara 0–10");
      return;
    }
    setSavingRate(true);
    try {
      const res = await fetch(`/api/admin/affiliates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ default_commission_rate: rate }),
      });
      const data = await res.json();
      if (data.success) {
        setAffiliates((prev) => prev.map((a) => (a.id === id ? { ...a, default_commission_rate: rate } : a)));
        toast.success("Komisi diperbarui");
        cancelEditRate();
      } else {
        toast.error(data.error || "Gagal menyimpan");
      }
    } catch {
      toast.error("Gagal menyimpan");
    } finally {
      setSavingRate(false);
    }
  };

  const resetToGlobal = async (id: string) => {
    setSavingRate(true);
    try {
      const res = await fetch(`/api/admin/affiliates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ default_commission_rate: globalRate }),
      });
      const data = await res.json();
      if (data.success) {
        setAffiliates((prev) => prev.map((a) => (a.id === id ? { ...a, default_commission_rate: globalRate } : a)));
        toast.success(`Rate direset ke default (${globalRate}%)`);
        cancelEditRate();
      } else {
        toast.error(data.error || "Gagal mereset");
      }
    } catch {
      toast.error("Gagal mereset");
    } finally {
      setSavingRate(false);
    }
  };

  const customCount = affiliates.filter((a) => a.default_commission_rate !== globalRate).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Affiliate"
        title="Manajemen Affiliates"
        description={loading ? "" : `${affiliates.length} affiliates terdaftar`}
        actions={
        <Link
          href="/admin/settings"
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl hover:bg-white/80 transition-colors text-warm-black"
        >
          <Settings size={13} />
          Pengaturan Global
        </Link>
        }
      />

      {/* Global Rate Banner */}
      <div className="glass-card flex items-center justify-between gap-4 px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#8B1414]/10 flex items-center justify-center flex-shrink-0">
            <Percent size={15} className="text-[#8B1414]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#0D0D0D]">
              Komisi Default Global: <span className="text-[#8B1414]">{globalRate}%</span>
            </p>
            <p className="text-xs text-[rgba(12,12,10,0.5)]">
              Berlaku untuk affiliate biasa, maksimal 20%. Order membership tetap menghasilkan komisi 40% otomatis.
            </p>
          </div>
        </div>
        <Link
          href="/admin/settings"
          className="flex-shrink-0 text-xs font-semibold text-[#8B1414] hover:underline"
        >
          Ubah →
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(12,12,10,0.35)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari kode, link, atau nama..."
          className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black placeholder:text-[rgba(12,12,10,0.35)] outline-none focus:border-primary focus:ring-2 focus:ring-primary-light transition-colors"
        />
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-sm text-red-500">{error}</p>
          <button onClick={loadData} className="text-xs font-medium text-primary hover:underline">Coba Lagi</button>
        </div>
      ) : (
        <AdminTable
          columns={[
            { key: "code", label: "Kode" },
            { key: "name", label: "Nama / Email" },
            { key: "rate", label: "Rate Komisi" },
            { key: "referrals", label: "Referral" },
            { key: "earned", label: "Total Earned" },
            { key: "bank", label: "Bank" },
            { key: "status", label: "Status" },
            { key: "action", label: "Aksi" },
          ]}
          loading={loading}
          empty={
            <EmptyState
              title="Tidak ada affiliate"
              description="Affiliate yang mendaftar akan muncul di sini."
              size="sm"
              className="py-8"
            />
          }
        >
          {loading ? (
            <TableRowSkeleton cols={8} rows={5} />
          ) : (
            filtered.map((a) => {
              const isCustomRate = a.default_commission_rate !== globalRate;
              const isEditing = editingRateId === a.id;

              return (
                <Tr key={a.id}>
                  <Td>
                    <p className="font-mono font-bold text-warm-black">{a.affiliate_code}</p>
                    {a.public_ref_code && (
                      <p className="mt-1 font-mono text-[11px] text-[rgba(12,12,10,0.45)]">
                        app.pejuangyen.com/r/{a.public_ref_code}
                      </p>
                    )}
                  </Td>
                  <Td>
                    <p className="text-sm font-medium text-warm-black">{a.name}</p>
                    <p className="text-xs text-[rgba(12,12,10,0.45)]">{a.email}</p>
                  </Td>

                  {/* Commission Rate Cell */}
                  <Td>
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <div className="relative">
                          <input
                            type="number"
                            min={0}
                            max={20}
                            value={editingRateValue}
                            onChange={(e) => setEditingRateValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveRate(a.id);
                              if (e.key === "Escape") cancelEditRate();
                            }}
                            autoFocus
                            className="w-16 px-2 py-1 text-sm font-semibold text-center rounded-lg border-2 border-[#8B1414] bg-white outline-none"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[rgba(12,12,10,0.4)] pointer-events-none">%</span>
                        </div>
                        <button
                          onClick={() => saveRate(a.id)}
                          disabled={savingRate}
                          className="w-6 h-6 flex items-center justify-center rounded-md bg-[#8B1414] text-white hover:bg-[#6E0F0F] transition-colors disabled:opacity-50"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          onClick={cancelEditRate}
                          className="w-6 h-6 flex items-center justify-center rounded-md border border-[rgba(12,12,10,0.12)] text-[rgba(12,12,10,0.5)] hover:bg-warm-cream transition-colors"
                        >
                          <X size={12} />
                        </button>
                        {isCustomRate && (
                          <button
                            onClick={() => resetToGlobal(a.id)}
                            disabled={savingRate}
                            className="text-[10px] text-[rgba(12,12,10,0.4)] hover:text-[#8B1414] hover:underline transition-colors whitespace-nowrap"
                          >
                            Reset ke {globalRate}%
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEditRate(a)}
                          className="flex items-center gap-1.5 group"
                          title="Klik untuk ubah rate komisi"
                        >
                          <span className="text-sm font-semibold text-warm-black group-hover:text-[#8B1414] transition-colors">
                            {a.default_commission_rate}%
                          </span>
                          <span className="text-[10px] text-[rgba(12,12,10,0.3)] group-hover:text-[#8B1414] transition-colors opacity-0 group-hover:opacity-100">
                            edit
                          </span>
                        </button>
                        {isCustomRate && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 uppercase tracking-wide">
                            Khusus
                          </span>
                        )}
                      </div>
                    )}
                  </Td>

                  <Td className="text-[rgba(12,12,10,0.55)]">{a.total_referrals || 0}</Td>
                  <Td className="text-[rgba(12,12,10,0.55)] text-xs">
                    {a.total_paid ? formatRupiah(a.total_paid) : "—"}
                  </Td>
                  <Td className="text-[rgba(12,12,10,0.55)]">{a.payout_bank_name || "—"}</Td>
                  <Td><StatusBadge status={a.status} /></Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => startEditRate(a)}
                        className="px-2.5 py-1 text-xs font-medium text-[#8B1414] bg-[#F7E8E8] rounded-md hover:bg-[#D1FAE5] transition-colors"
                      >
                        Atur Komisi
                      </button>
                      <button
                        onClick={() => setConfirmToggle({ id: a.id, status: a.status, name: a.name })}
                        className="px-2.5 py-1 text-xs font-medium border border-[rgba(12,12,10,0.12)] rounded-md hover:bg-warm-cream transition-colors text-warm-black"
                      >
                        {a.status === "active" ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                    </div>
                  </Td>
                </Tr>
              );
            })
          )}
        </AdminTable>
      )}

      {/* Pagination */}
      {!loading && !error && pagination.totalPages > 1 && (
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          onPageChange={(p) => setPage(String(p))}
        />
      )}

      {/* Confirm toggle status */}
      {confirmToggle && (
        <ConfirmDialog
          open={!!confirmToggle}
          onOpenChange={(open) => { if (!open) setConfirmToggle(null); }}
          title={confirmToggle.status === "active" ? "Nonaktifkan Affiliate?" : "Aktifkan Affiliate?"}
          description={
            confirmToggle.status === "active"
              ? `${confirmToggle.name} tidak akan bisa menggunakan kode referral-nya sementara waktu.`
              : `${confirmToggle.name} akan bisa kembali menggunakan kode referral-nya.`
          }
          confirmLabel={confirmToggle.status === "active" ? "Nonaktifkan" : "Aktifkan"}
          variant={confirmToggle.status === "active" ? "danger" : "default"}
          loading={processing}
          onConfirm={() => toggleStatus(confirmToggle.id, confirmToggle.status)}
        />
      )}
    </div>
  );
}

export default function AdminAffiliatesPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-[400px] bg-gray-100 rounded-xl animate-pulse" />
      </div>
    }>
      <AdminAffiliatesContent />
    </Suspense>
  );
}
