"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, Suspense } from "react";
import { Store, Ban, CheckCircle2, Wallet } from "lucide-react";
import { AdminTable, StatusBadge, Td, Tr } from "@/components/ui/AdminTable";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { toast } from "@/components/ui/toast";
import { formatRupiah, formatDate } from "@/lib/utils";

type Tab = "stores" | "products" | "payouts";

interface Stats {
  active_stores: number;
  active_products: number;
  gmv: number;
  fee_revenue: number;
  payout_liability: number;
  pending_payouts: number;
}

function AdminTokoContent() {
  const [tab, setTab] = useState<Tab>("stores");
  const [stats, setStats] = useState<Stats | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStats = () => {
    fetch("/api/admin/toko/stats", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => d.success && setStats(d.data));
  };

  const load = async (activeTab: Tab) => {
    setLoading(true);
    const path = activeTab === "stores" ? "stores" : activeTab === "products" ? "products" : "payouts";
    const res = await fetch(`/api/admin/toko/${path}?page=1&limit=50`, { credentials: "include" });
    const data = await res.json();
    setRows(data.success ? data.data || [] : []);
    setLoading(false);
  };

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    load(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const act = async (path: string, body?: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/toko/${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json();
    if (data.success) {
      toast.success("Berhasil");
      load(tab);
      loadStats();
    } else {
      toast.error(data.error || "Gagal");
    }
  };

  const suspend = (kind: "stores" | "products", id: string) => {
    const reason = prompt("Alasan penangguhan (opsional):") ?? undefined;
    act(`${kind}/${id}/suspend`, { reason });
  };

  return (
    <>
      <PageHeader title="Creator Store" description="Moderasi toko & produk creator, antrian penarikan saldo." />

      {/* Stats */}
      <div className="mb-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Toko Aktif", value: String(stats?.active_stores ?? "—") },
          { label: "Produk Aktif", value: String(stats?.active_products ?? "—") },
          { label: "GMV", value: stats ? formatRupiah(stats.gmv) : "—" },
          { label: "Fee Platform", value: stats ? formatRupiah(stats.fee_revenue) : "—" },
          { label: "Liabilitas Saldo", value: stats ? formatRupiah(stats.payout_liability) : "—" },
          { label: "Payout Pending", value: String(stats?.pending_payouts ?? "—") },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{s.label}</p>
            <p className="mt-0.5 text-sm font-bold text-warm-black">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        {([["stores", "Toko"], ["products", "Produk"], ["payouts", "Penarikan"]] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t ? "bg-primary text-white" : "bg-white border border-[rgba(0,0,0,0.07)] text-gray-600 hover:border-primary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "stores" && (
        <AdminTable
          columns={[
            { key: "store", label: "Toko" },
            { key: "owner", label: "Pemilik" },
            { key: "products", label: "Produk" },
            { key: "gmv", label: "GMV" },
            { key: "balance", label: "Saldo" },
            { key: "status", label: "Status" },
            { key: "actions", label: "" },
          ]}
          loading={loading}
          empty={<div className="py-10 text-center text-sm text-gray-500"><Store className="mx-auto mb-2 h-8 w-8 text-gray-300" />Belum ada toko.</div>}
        >
          {rows.map((s) => (
            <Tr key={s.id}>
              <Td>
                <a href={`/toko/${s.slug}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-warm-black hover:text-primary">{s.name}</a>
                <p className="text-xs text-gray-400 font-mono">/{s.slug}</p>
              </Td>
              <Td><p className="text-xs">{s.owner_name}<br /><span className="text-gray-400">{s.owner_email}</span></p></Td>
              <Td>{s.active_products}</Td>
              <Td>{formatRupiah(s.gmv || 0)}</Td>
              <Td>{formatRupiah(s.balance || 0)}</Td>
              <Td><StatusBadge status={s.status} /></Td>
              <Td>
                {s.status === "active" ? (
                  <button onClick={() => suspend("stores", s.id)} className="flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50">
                    <Ban className="h-3.5 w-3.5" /> Tangguhkan
                  </button>
                ) : (
                  <button onClick={() => act(`stores/${s.id}/activate`)} className="flex items-center gap-1 rounded-md border border-green-200 px-2.5 py-1.5 text-xs font-semibold text-green-600 hover:bg-green-50">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Aktifkan
                  </button>
                )}
              </Td>
            </Tr>
          ))}
        </AdminTable>
      )}

      {tab === "products" && (
        <AdminTable
          columns={[
            { key: "product", label: "Produk" },
            { key: "store", label: "Toko" },
            { key: "price", label: "Harga" },
            { key: "sales", label: "Terjual" },
            { key: "status", label: "Status" },
            { key: "actions", label: "" },
          ]}
          loading={loading}
          empty={<div className="py-10 text-center text-sm text-gray-500">Belum ada produk.</div>}
        >
          {rows.map((p) => (
            <Tr key={p.id}>
              <Td>
                <a href={`/toko/${p.store_slug}/${p.slug}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-warm-black hover:text-primary">{p.title}</a>
              </Td>
              <Td className="text-xs">{p.store_name}</Td>
              <Td>{formatRupiah(p.price)}</Td>
              <Td>{p.sales_count}</Td>
              <Td><StatusBadge status={p.status} /></Td>
              <Td>
                {p.status === "active" ? (
                  <button onClick={() => suspend("products", p.id)} className="flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50">
                    <Ban className="h-3.5 w-3.5" /> Tangguhkan
                  </button>
                ) : p.status === "suspended" ? (
                  <button onClick={() => act(`products/${p.id}/activate`)} className="flex items-center gap-1 rounded-md border border-green-200 px-2.5 py-1.5 text-xs font-semibold text-green-600 hover:bg-green-50">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Aktifkan
                  </button>
                ) : null}
              </Td>
            </Tr>
          ))}
        </AdminTable>
      )}

      {tab === "payouts" && (
        <AdminTable
          columns={[
            { key: "store", label: "Toko" },
            { key: "amount", label: "Nominal" },
            { key: "bank", label: "Rekening" },
            { key: "requested", label: "Diajukan" },
            { key: "status", label: "Status" },
            { key: "actions", label: "" },
          ]}
          loading={loading}
          empty={<div className="py-10 text-center text-sm text-gray-500"><Wallet className="mx-auto mb-2 h-8 w-8 text-gray-300" />Belum ada penarikan.</div>}
        >
          {rows.map((p) => (
            <Tr key={p.id}>
              <Td>
                <p className="font-semibold text-warm-black">{p.store_name}</p>
                <p className="text-xs text-gray-400">{p.owner_email}</p>
              </Td>
              <Td className="font-bold">{formatRupiah(p.amount)}</Td>
              <Td className="text-xs">{p.account_holder}<br />{p.bank_name} {p.bank_account}</Td>
              <Td className="text-xs">{formatDate(p.requested_at)}</Td>
              <Td><StatusBadge status={p.status} /></Td>
              <Td>
                <div className="flex justify-end gap-1.5">
                  {p.status === "pending" && (
                    <>
                      <Button onClick={() => act(`payouts/${p.id}/approve`)}>Setujui</Button>
                      <button
                        onClick={() => {
                          const reason = prompt("Alasan penolakan:") ?? undefined;
                          act(`payouts/${p.id}/reject`, { reason });
                        }}
                        className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50"
                      >
                        Tolak
                      </button>
                    </>
                  )}
                  {(p.status === "pending" || p.status === "approved") && (
                    <button
                      onClick={() => {
                        const ref = prompt("Referensi transfer (opsional):") ?? undefined;
                        act(`payouts/${p.id}/mark-paid`, { transfer_ref: ref });
                      }}
                      className="rounded-md border border-green-200 px-2.5 py-1.5 text-xs font-semibold text-green-600 hover:bg-green-50"
                    >
                      Tandai Dibayar
                    </button>
                  )}
                </div>
              </Td>
            </Tr>
          ))}
        </AdminTable>
      )}
    </>
  );
}

export default function AdminTokoPage() {
  return (
    <Suspense>
      <AdminTokoContent />
    </Suspense>
  );
}
