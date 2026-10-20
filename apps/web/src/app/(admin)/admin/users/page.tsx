"use client";
/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps */

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { Search, UserPlus, Pencil, ShieldCheck, Eye } from "lucide-react";
import { AdminTable, Tr, Td, StatusBadge } from "@/components/ui/AdminTable";
import { EmptyState } from "@/components/ui/lottie/EmptyState";
import { formatDate } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { Pagination } from "@/components/ui/Pagination";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  created_at: string;
}
interface Course {
  id: string;
  title: string;
}

const inputClass =
  "w-full px-3.5 py-2.5 text-sm rounded-xl border border-[rgba(12,12,10,0.12)] text-warm-black outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors";

function AdminUsersContent() {
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [grantUser, setGrantUser] = useState<User | null>(null);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [granting, setGranting] = useState(false);

  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "user" });
  const [saving, setSaving] = useState(false);

  const [membershipUser, setMembershipUser] = useState<User | null>(null);
  const [userMemberships, setUserMemberships] = useState<any[]>([]);
  const [loadingMb, setLoadingMb] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [grantPlanId, setGrantPlanId] = useState("");
  const [processingMb, setProcessingMb] = useState(false);

  useEffect(() => {
    fetch("/api/admin/courses", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.success) setCourses(d.data); });
    fetch("/api/admin/memberships/plans", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.success) setPlans(d.data); });
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { fetchUsers(); }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, page]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    const p = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) p.set("search", search);
    try {
      const res = await fetch(`/api/admin/users?${p}`, { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      } else {
        setError(data.error || "Gagal memuat data");
      }
    } catch {
      setError("Gagal memuat data. Periksa koneksi internet.");
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (u: User) => {
    setEditUser(u);
    setEditForm({ name: u.name, email: u.email, role: u.role });
  };

  const openMembership = (u: User) => {
    setMembershipUser(u);
    setGrantPlanId("");
    fetchUserMemberships(u.email);
  };

  const fetchUserMemberships = async (email: string) => {
    setLoadingMb(true);
    try {
      const res = await fetch(`/api/admin/memberships?search=${encodeURIComponent(email)}`, { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setUserMemberships(data.data.filter((m: any) => m.user_email === email));
      }
    } finally {
      setLoadingMb(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${editUser.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.success) {
        setEditUser(null);
        fetchUsers();
      } else {
        alert(data.error || "Gagal menyimpan perubahan");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleGrantAccess = async () => {
    if (!grantUser || !selectedCourse) return;
    setGranting(true);
    try {
      const res = await fetch(`/api/admin/users/${grantUser.id}/grant-access`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource_type: "course", resource_id: selectedCourse }),
      });
      const data = await res.json();
      if (data.success) {
        setGrantUser(null);
        setSelectedCourse("");
      } else {
        alert(data.error || "Gagal memberikan akses");
      }
    } catch {
      alert("Terjadi kesalahan");
    } finally {
      setGranting(false);
    }
  };

  const handleGrantMembership = async () => {
    if (!membershipUser || !grantPlanId) return;
    setProcessingMb(true);
    try {
      const res = await fetch(`/api/admin/memberships/grant`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: membershipUser.id, plan_id: grantPlanId }),
      });
      const data = await res.json();
      if (data.success) {
        setGrantPlanId("");
        fetchUserMemberships(membershipUser.email);
      } else {
        alert(data.error || "Gagal memberikan membership");
      }
    } finally {
      setProcessingMb(false);
    }
  };

  const handleRevokeMembership = async (mbId: string) => {
    if (!confirm("Cabut membership ini?")) return;
    setProcessingMb(true);
    try {
      const res = await fetch(`/api/admin/memberships/${mbId}/revoke`, { method: "POST", credentials: "include" });
      if ((await res.json()).success) fetchUserMemberships(membershipUser!.email);
    } finally {
      setProcessingMb(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Manajemen"
        title="Kelola Users"
        description={loading ? "" : `${total} users terdaftar`}
      />

      <div className="glass-card p-3 relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(12,12,10,0.35)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama atau email..."
          className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black placeholder:text-[rgba(12,12,10,0.35)] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
        />
      </div>

      {error && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-sm text-red-500">{error}</p>
          <button onClick={fetchUsers} className="text-xs font-medium text-primary hover:underline">Coba Lagi</button>
        </div>
      )}

      {!error && (
        <>
          <AdminTable
            columns={[
              { key: "name", label: "Nama" },
              { key: "email", label: "Email" },
              { key: "phone", label: "No. HP" },
              { key: "role", label: "Role" },
              { key: "created_at", label: "Terdaftar" },
              { key: "action", label: "Aksi" },
            ]}
            loading={loading}
            empty={
              <EmptyState
                title="Tidak ada user"
                description="Coba ubah kata kunci pencarian Anda."
                size="sm"
                className="py-8"
              />
            }
          >
            {users.map((u) => (
              <Tr key={u.id}>
                <Td>
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="font-medium text-warm-black hover:text-primary transition-colors"
                  >
                    {u.name}
                  </Link>
                </Td>
                <Td className="text-[rgba(12,12,10,0.65)]">{u.email}</Td>
                <Td className="text-[rgba(12,12,10,0.65)]">{u.phone || "-"}</Td>
                <Td><StatusBadge status={u.role} /></Td>
                <Td className="text-[rgba(12,12,10,0.55)] text-xs">{formatDate(u.created_at)}</Td>
                <Td>
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/admin/users/${u.id}`}
                      aria-label={`Lihat detail ${u.name}`}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-warm-black bg-[rgba(0,0,0,0.06)] rounded-lg hover:bg-[rgba(0,0,0,0.1)] transition-colors"
                    >
                      <Eye size={12} />
                      Detail
                    </Link>
                    <button
                      onClick={() => openEdit(u)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-warm-black bg-[rgba(0,0,0,0.06)] rounded-lg hover:bg-[rgba(0,0,0,0.1)] transition-colors"
                    >
                      <Pencil size={12} />
                      Edit
                    </button>
                    <button
                      onClick={() => { setGrantUser(u); setSelectedCourse(""); }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg hover:bg-primary-hover transition-colors"
                    >
                      <UserPlus size={12} />
                      Beri Akses
                    </button>
                    <button
                      onClick={() => openMembership(u)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 bg-yellow-500 text-white text-xs font-semibold rounded-lg hover:bg-yellow-600 transition-colors"
                    >
                      <ShieldCheck size={12} />
                      Membership
                    </button>
                  </div>
                </Td>
              </Tr>
            ))}
          </AdminTable>

          {totalPages > 1 && (
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          )}
        </>
      )}

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-warm-black">Nama</label>
              <input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-warm-black">Email</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-warm-black">Role</label>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                className={inputClass}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditUser(null)}>Batal</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grant Access Dialog */}
      <Dialog open={!!grantUser} onOpenChange={(open) => { if (!open) { setGrantUser(null); setSelectedCourse(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Beri Akses Kelas</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[rgba(12,12,10,0.55)] -mt-2">
            Pilih kelas untuk{" "}
            <span className="font-semibold text-warm-black">{grantUser?.name}</span>
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-warm-black">Pilih Kelas</label>
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className={inputClass}
            >
              <option value="">-- Pilih Kelas --</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => { setGrantUser(null); setSelectedCourse(""); }}>Batal</Button>
            <Button onClick={handleGrantAccess} disabled={granting || !selectedCourse}>
              {granting ? "Memproses..." : "Berikan Akses"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Membership Dialog */}
      <Dialog open={!!membershipUser} onOpenChange={(open) => { if (!open) setMembershipUser(null); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Kelola Membership: {membershipUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {loadingMb ? (
              <p className="text-sm text-gray-500">Memuat data membership...</p>
            ) : userMemberships.length > 0 ? (
              <div className="flex flex-col gap-2">
                {userMemberships.map((m) => (
                  <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-gray-50 border border-gray-100 rounded-lg">
                    <div>
                      <p className="font-semibold text-sm text-warm-black">{m.plan_name}</p>
                      <p className="text-xs text-gray-500">Status: <StatusBadge status={m.status} /></p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {m.expires_at ? `Berakhir: ${formatDate(m.expires_at)}` : "Lifetime"}
                      </p>
                    </div>
                    {m.status === "active" && (
                      <Button variant="danger" size="sm" onClick={() => handleRevokeMembership(m.id)} disabled={processingMb}>
                        Cabut
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">User ini belum memiliki membership aktif.</p>
            )}

            <div className="border-t border-gray-100 my-2" />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-warm-black">Beri Membership Baru</label>
              <div className="flex gap-2">
                <select
                  value={grantPlanId}
                  onChange={(e) => setGrantPlanId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">-- Pilih Plan --</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <Button onClick={handleGrantMembership} disabled={processingMb || !grantPlanId}>
                  Berikan
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setMembershipUser(null)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-[400px] bg-gray-100 rounded-xl animate-pulse" />
      </div>
    }>
      <AdminUsersContent />
    </Suspense>
  );
}
