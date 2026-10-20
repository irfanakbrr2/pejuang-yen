"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import { api, invalidateCache } from "@/lib/api-client";
import { formatRupiah } from "@/lib/utils";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { AdminTable, Tr, Td, StatusBadge } from "@/components/ui/AdminTable";
import { EmptyState } from "@/components/ui/lottie/EmptyState";
import { Package, Plus, Pencil, X } from "lucide-react";

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  is_active: number;
  sort_order: number;
}

interface FormState {
  id: string | null;
  name: string;
  credits: string;
  price: string;
  sort_order: string;
  is_active: boolean;
}

const emptyForm = (): FormState => ({ id: null, name: "", credits: "", price: "", sort_order: "99", is_active: true });

export default function AdminToolsPackagesPage() {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api<CreditPackage[]>("/api/admin/tools/packages", { cacheTtl: 0 })
      .then((res) => { if (res.success && res.data) setPackages(res.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(emptyForm()); setError(null); setShowModal(true); };
  const openEdit = (pkg: CreditPackage) => {
    setForm({ id: pkg.id, name: pkg.name, credits: String(pkg.credits), price: String(pkg.price), sort_order: String(pkg.sort_order), is_active: pkg.is_active === 1 });
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.credits || !form.price) {
      setError("Nama, kredit, dan harga wajib diisi.");
      return;
    }
    setSaving(true);
    setError(null);

    const body = {
      name: form.name.trim(),
      credits: parseInt(form.credits, 10),
      price: parseInt(form.price, 10),
      sort_order: parseInt(form.sort_order, 10),
      is_active: form.is_active ? 1 : 0,
    };

    const res = form.id
      ? await api(`/api/admin/tools/packages/${form.id}`, { method: "PATCH", body, cacheTtl: 0 })
      : await api("/api/admin/tools/packages", { method: "POST", body, cacheTtl: 0 });

    setSaving(false);

    if (!res.success) {
      setError(res.error || "Gagal menyimpan paket.");
      return;
    }

    invalidateCache("/api/admin/tools");
    invalidateCache("/api/tools/credits");
    setShowModal(false);
    load();
  };

  const handleToggle = async (pkg: CreditPackage) => {
    await api(`/api/admin/tools/packages/${pkg.id}`, {
      method: "PATCH",
      body: { is_active: pkg.is_active === 1 ? 0 : 1 },
      cacheTtl: 0,
    });
    invalidateCache("/api/admin/tools");
    invalidateCache("/api/tools/credits");
    load();
  };

  return (
    <>
      <PageHeader
        title="Paket Kredit"
        description="Kelola paket kredit yang tersedia untuk dibeli user."
        actions={
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" />
            Tambah Paket
          </button>
        }
      />

      {loading ? (
        <div className="text-sm text-gray-400">Memuat...</div>
      ) : !packages.length ? (
        <EmptyState title="Belum ada paket kredit" />
      ) : (
        <AdminTable columns={[
          { key: "nama", label: "Nama" },
          { key: "credits", label: "Kredit" },
          { key: "harga", label: "Harga" },
          { key: "per_credit", label: "Per Kredit" },
          { key: "sort", label: "Urutan" },
          { key: "status", label: "Status" },
          { key: "aksi", label: "Aksi" },
        ]}>
          {packages.map((pkg) => (
            <Tr key={pkg.id}>
              <Td>
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-violet-400" />
                  <span className="font-medium text-gray-800">{pkg.name}</span>
                </div>
              </Td>
              <Td>{pkg.credits}</Td>
              <Td>{formatRupiah(pkg.price)}</Td>
              <Td>{formatRupiah(Math.round(pkg.price / pkg.credits))}</Td>
              <Td>{pkg.sort_order}</Td>
              <Td>
                <button onClick={() => handleToggle(pkg)}>
                  <StatusBadge status={pkg.is_active === 1 ? "active" : "cancelled"} />
                </button>
              </Td>
              <Td>
                <button
                  onClick={() => openEdit(pkg)}
                  className="flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </button>
              </Td>
            </Tr>
          ))}
        </AdminTable>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                {form.id ? "Edit Paket" : "Tambah Paket Baru"}
              </h2>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1 hover:bg-gray-100">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {[
                { label: "Nama Paket", key: "name", placeholder: "Contoh: Starter", type: "text" },
                { label: "Jumlah Kredit", key: "credits", placeholder: "Contoh: 10", type: "number" },
                { label: "Harga (IDR)", key: "price", placeholder: "Contoh: 19000", type: "number" },
                { label: "Urutan Tampil", key: "sort_order", placeholder: "1, 2, 3...", type: "number" },
              ].map((field) => (
                <div key={field.key}>
                  <label className="mb-1 block text-xs font-medium text-gray-700">{field.label}</label>
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    value={(form as any)[field.key]}
                    onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                  />
                </div>
              ))}

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Aktifkan paket ini</span>
              </label>
            </div>

            {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

            <div className="mt-5 flex gap-2 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="rounded-xl border px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
              >
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
