"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { Plus, Trash2, GitBranch, Settings2 } from "lucide-react";
import { AdminTable, StatusBadge, Td, Tr } from "@/components/ui/AdminTable";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { toast } from "@/components/ui/toast";
import { Pagination } from "@/components/ui/Pagination";
import { formatRupiah } from "@/lib/utils";

interface Funnel {
  id: string;
  name: string;
  trigger_product_type: string;
  trigger_product_id: string;
  trigger_label: string;
  status: "draft" | "active" | "archived";
  offer_window_minutes: number;
  enabled_steps: number;
  conversions: number;
  revenue: number;
}

interface ProductOption {
  id: string;
  name: string;
  price: number;
}

const TRIGGER_TYPES = [
  { value: "membership", label: "Membership" },
  { value: "webinar_registration", label: "Webinar Berbayar" },
  { value: "course", label: "Kelas" },
  { value: "digital_product", label: "Produk Digital" },
  { value: "tool_credits", label: "Paket Kredit" },
];

const inputClass =
  "w-full px-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors";

function AdminFunnelsContent() {
  const [page, setPage] = useState(1);
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", trigger_product_type: "membership", trigger_product_id: "*" });
  const [options, setOptions] = useState<ProductOption[]>([]);

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/funnels?page=${page}&limit=20`, { credentials: "include" });
    const data = await res.json();
    if (data.success) {
      setFunnels(data.data || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } else {
      toast.error(data.error || "Gagal memuat funnels");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // Opsi produk mengikuti tipe trigger terpilih
  useEffect(() => {
    fetch(`/api/admin/funnels/options/${form.trigger_product_type}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setOptions(d.success ? d.data || [] : []));
  }, [form.trigger_product_type]);

  const create = async () => {
    if (!form.name.trim()) {
      toast.error("Nama funnel wajib diisi");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/admin/funnels", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (data.success) {
      toast.success("Funnel dibuat — atur step-nya sekarang");
      setShowCreate(false);
      setForm({ name: "", trigger_product_type: "membership", trigger_product_id: "*" });
      load();
    } else {
      toast.error(data.error || "Gagal membuat funnel");
    }
  };

  const remove = async (f: Funnel) => {
    if (!confirm(`Hapus funnel "${f.name}"?`)) return;
    const res = await fetch(`/api/admin/funnels/${f.id}`, { method: "DELETE", credentials: "include" });
    const data = await res.json();
    if (data.success) {
      toast.success("Funnel dihapus");
      load();
    } else {
      toast.error(data.error || "Gagal menghapus");
    }
  };

  return (
    <>
      <PageHeader
        title="Sales Funnels"
        description="Order bump saat checkout + upsell/downsell setelah pembayaran — naikkan nilai transaksi dari customer yang sama."
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Buat Funnel
          </Button>
        }
      />

      <AdminTable
        columns={[
          { key: "name", label: "Funnel" },
          { key: "trigger", label: "Trigger" },
          { key: "steps", label: "Steps Aktif" },
          { key: "conversions", label: "Konversi" },
          { key: "revenue", label: "Revenue Uplift" },
          { key: "status", label: "Status" },
          { key: "actions", label: "" },
        ]}
        loading={loading}
        empty={
          <div className="py-10 text-center text-sm text-gray-500">
            <GitBranch className="mx-auto mb-2 h-8 w-8 text-gray-300" />
            Belum ada funnel. Contoh: trigger webinar → upsell Membership Lifetime → downsell Tahunan.
          </div>
        }
      >
        {funnels.map((f) => (
          <Tr key={f.id}>
            <Td>
              <Link href={`/admin/funnels/${f.id}`} className="font-semibold text-warm-black hover:text-primary">
                {f.name}
              </Link>
            </Td>
            <Td>
              <p className="text-sm">{f.trigger_label}</p>
              <p className="text-xs text-gray-400">{f.trigger_product_type}{f.trigger_product_id === "*" ? " · semua" : ""}</p>
            </Td>
            <Td>{f.enabled_steps}/3</Td>
            <Td>{f.conversions}</Td>
            <Td className="font-semibold">{formatRupiah(f.revenue || 0)}</Td>
            <Td><StatusBadge status={f.status} /></Td>
            <Td>
              <div className="flex items-center justify-end gap-1.5">
                <Link href={`/admin/funnels/${f.id}`} aria-label={`Atur funnel ${f.name}`} title="Atur" className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-gray-100 text-gray-500">
                  <Settings2 className="h-4 w-4" />
                </Link>
                <button onClick={() => remove(f)} aria-label={`Hapus funnel ${f.name}`} title="Hapus" className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-red-50 text-red-500 cursor-pointer">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Td>
          </Tr>
        ))}
      </AdminTable>

      <div className="mt-4">
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </div>

      <Dialog open={showCreate} onOpenChange={(open) => !open && setShowCreate(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Buat Funnel</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-gray-600">Nama Funnel *</label>
              <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Webinar → Premium" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-gray-600">Produk Trigger (pembelian yang memicu funnel)</label>
              <select
                className={inputClass}
                value={form.trigger_product_type}
                onChange={(e) => setForm({ ...form, trigger_product_type: e.target.value, trigger_product_id: "*" })}
              >
                {TRIGGER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <select
                className={inputClass}
                value={form.trigger_product_id}
                onChange={(e) => setForm({ ...form, trigger_product_id: e.target.value })}
              >
                <option value="*">Semua produk tipe ini</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Batal</Button>
            <Button onClick={create} disabled={saving}>{saving ? "Membuat..." : "Buat & Atur Steps"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AdminFunnelsPage() {
  return (
    <Suspense>
      <AdminFunnelsContent />
    </Suspense>
  );
}
