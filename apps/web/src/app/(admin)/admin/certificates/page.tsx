"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, Suspense } from "react";
import { Search, Plus, ShieldOff } from "lucide-react";
import { AdminTable, Tr, Td } from "@/components/ui/AdminTable";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { Pagination } from "@/components/ui/Pagination";

interface Certificate {
  id: string;
  certificate_number: string;
  user_name?: string;
  user_id: string;
  course_title?: string;
  course_id: string;
  issued_at: string;
  revoked_at?: string;
}

const inputClass =
  "w-full px-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors";

function AdminCertificatesContent() {
  const [page, setPage] = useState(1);

  const [certs, setCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<Certificate | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ user_id: "", course_id: "" });

  const fetchCerts = () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), limit: "20" });
    if (search.trim()) p.set("search", search.trim());
    
    fetch(`/api/admin/certificates?${p}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setCerts(d.data || []);
          setTotalPages(d.pagination?.totalPages || 1);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCerts(); }, [page, search]);

  const handleCreate = async () => {
    if (!form.user_id || !form.course_id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/certificates`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreate(false);
        setForm({ user_id: "", course_id: "" });
        fetchCerts();
      } else {
        alert(data.error || "Gagal generate sertifikat");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/certificates/${revokeTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setRevokeTarget(null);
        fetchCerts();
      } else {
        alert(data.error || "Gagal mencabut sertifikat");
      }
    } finally {
      setSaving(false);
    }
  };

  const filtered = certs.filter(
    (c) =>
      c.certificate_number.toLowerCase().includes(search.toLowerCase()) ||
      (c.user_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pencapaian"
        title="Manajemen Sertifikat"
        description={`${certs.length} sertifikat diterbitkan`}
        actions={
        <Button onClick={() => { setForm({ user_id: "", course_id: "" }); setShowCreate(true); }}>
          <Plus size={15} />
          Generate Sertifikat
        </Button>
        }
      />

      <div className="glass-card p-3 relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(12,12,10,0.35)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nomor atau nama..."
          className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black placeholder:text-[rgba(12,12,10,0.35)] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
        />
      </div>

      <AdminTable
        columns={[
          { key: "num", label: "Nomor" },
          { key: "user", label: "User" },
          { key: "course", label: "Kelas" },
          { key: "status", label: "Status" },
          { key: "date", label: "Diterbitkan" },
          { key: "action", label: "Aksi" },
        ]}
        loading={loading}
        empty={<div className="text-center py-10 text-[rgba(12,12,10,0.35)] text-sm">Tidak ada data</div>}
      >
        {filtered.map((c) => (
          <Tr key={c.id}>
            <Td className="font-mono font-semibold text-xs text-warm-black">{c.certificate_number}</Td>
            <Td className="text-warm-black">{c.user_name || c.user_id.slice(0, 12)}</Td>
            <Td className="text-[rgba(12,12,10,0.65)]">{c.course_title || c.course_id.slice(0, 16)}</Td>
            <Td>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.revoked_at ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                {c.revoked_at ? "Dicabut" : "Aktif"}
              </span>
            </Td>
            <Td className="text-[rgba(12,12,10,0.55)]">
              {new Date(c.issued_at).toLocaleDateString("id-ID")}
            </Td>
            <Td>
              {!c.revoked_at && (
                <button
                  onClick={() => setRevokeTarget(c)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <ShieldOff size={12} />
                  Cabut
                </button>
              )}
            </Td>
          </Tr>
        ))}
      </AdminTable>

      {totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      )}

      {/* Generate Certificate Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Sertifikat</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-warm-black">User ID</label>
              <input
                value={form.user_id}
                onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                placeholder="ID user penerima sertifikat"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-warm-black">Course ID</label>
              <input
                value={form.course_id}
                onChange={(e) => setForm({ ...form, course_id: e.target.value })}
                placeholder="ID kelas yang diselesaikan"
                className={inputClass}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Batal</Button>
            <Button onClick={handleCreate} disabled={saving || !form.user_id || !form.course_id}>
              {saving ? "Memproses..." : "Generate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirm Dialog */}
      <Dialog open={!!revokeTarget} onOpenChange={(open) => { if (!open) setRevokeTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cabut Sertifikat</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[rgba(12,12,10,0.65)]">
            Yakin ingin mencabut sertifikat{" "}
            <span className="font-semibold text-warm-black">{revokeTarget?.certificate_number}</span>{" "}
            milik <span className="font-semibold text-warm-black">{revokeTarget?.user_name}</span>?
            Tindakan ini tidak dapat dibatalkan.
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRevokeTarget(null)}>Batal</Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={handleRevoke}
              disabled={saving}
            >
              {saving ? "Memproses..." : "Cabut Sertifikat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminCertificatesPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-[400px] bg-gray-100 rounded-xl animate-pulse" />
      </div>
    }>
      <AdminCertificatesContent />
    </Suspense>
  );
}
