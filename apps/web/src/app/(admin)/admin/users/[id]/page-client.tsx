"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldOff, ShieldCheck, BookOpen, Route, KeyRound } from "lucide-react";
import { StatusBadge } from "@/components/ui/AdminTable";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/toast";
import { PageHeader } from "@/components/ui/dashboard-chrome";

interface UserDetail {
  id: string; name: string; email: string; role: string; status: string;
  phone?: string; city_code?: string; city_name?: string; created_at: string; last_login_at?: string;
}

const inputClass =
  "w-full px-3.5 py-2.5 text-sm rounded-xl border border-[rgba(12,12,10,0.12)] text-warm-black placeholder:text-[rgba(12,12,10,0.35)] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors";

export default function AdminUserDetailClient() {
  const pathname = usePathname();
  const id = pathname.split("/").filter(Boolean)[2];
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [banConfirm, setBanConfirm] = useState(false);
  const [banning, setBanning] = useState(false);
  const [grantDialog, setGrantDialog] = useState(false);
  const [grantCourseId, setGrantCourseId] = useState("");
  const [granting, setGranting] = useState(false);
  const [resettingPw, setResettingPw] = useState(false);
  const [tempPw, setTempPw] = useState<string | null>(null);
  

  useEffect(() => {
    fetch(`/api/admin/users/${id}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { if (data.success) setUser(data.data); })
      .finally(() => setLoading(false));
  }, [id]);

  const handleBan = async () => {
    if (!user) return;
    setBanning(true);
    const newStatus = user.status === "active" ? "banned" : "active";
    try {
      const res = await fetch(`/api/admin/users/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setUser((u) => u ? { ...u, status: newStatus } : u);
        toast.success(newStatus === "banned" ? `${user.name} telah dibanned` : `${user.name} telah diaktifkan kembali`);
      } else {
        toast.error(data.error || "Gagal mengubah status user");
      }
    } catch {
      toast.error("Terjadi kesalahan. Coba lagi.");
    } finally {
      setBanning(false);
      setBanConfirm(false);
    }
  };

  const handleGrantAccess = async () => {
    if (!grantCourseId.trim()) return;
    setGranting(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/grant-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ resource_type: "course", resource_id: grantCourseId.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Akses kelas berhasil diberikan");
        setGrantDialog(false);
        setGrantCourseId("");
      } else {
        toast.error(data.error || "Gagal memberikan akses");
      }
    } catch {
      toast.error("Terjadi kesalahan. Coba lagi.");
    } finally {
      setGranting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user) return;
    if (!window.confirm(`Reset password ${user.name}? Password lama diganti password sementara & semua sesi login dicabut.`)) return;
    setResettingPw(true);
    setTempPw(null);
    try {
      const res = await fetch(`/api/admin/users/${id}/reset-password`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setTempPw(data.data.temp_password);
        toast.success("Password direset");
      } else {
        toast.error(data.error || "Gagal reset password");
      }
    } catch {
      toast.error("Terjadi kesalahan. Coba lagi.");
    } finally {
      setResettingPw(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-xl">
        <div className="skeleton h-5 w-20 mb-5 rounded" />
        <div className="skeleton h-6 w-32 mb-5 rounded" />
        <div className="bg-white rounded-xl border border-[rgba(12,12,10,0.08)] overflow-hidden mb-4">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3.5 border-b border-[rgba(12,12,10,0.05)] last:border-b-0">
              <div className="skeleton h-4 w-20 rounded" />
              <div className="skeleton h-4 w-32 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-red-600">User tidak ditemukan.</div>
    );
  }

  const rows: [string, React.ReactNode][] = [
    ["Nama", <span key="user-name" className="font-semibold">{user.name}</span>],
    ["Email", user.email],
    ["Role", <StatusBadge key="user-role" status={user.role} />],
    ["Phone", user.phone || "—"],
    ["Kota", user.city_name || user.city_code || "—"],
    ["Status", <StatusBadge key="user-status" status={user.status} />],
    ["Bergabung", new Date(user.created_at).toLocaleDateString("id-ID")],
    ["Login Terakhir", user.last_login_at ? new Date(user.last_login_at).toLocaleString("id-ID") : "—"],
  ];

  return (
    <div className="max-w-xl">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-[rgba(12,12,10,0.55)] hover:text-warm-black transition-colors mb-5"
      >
        <ArrowLeft size={14} />
        Kembali
      </button>

      <PageHeader title="Detail User" />

      <div className="glass-card overflow-hidden mb-4">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-5 py-3.5 border-b border-[rgba(12,12,10,0.05)] last:border-b-0">
            <span className="text-sm text-[rgba(12,12,10,0.55)]">{label}</span>
            <span className="text-sm font-medium text-warm-black text-right">{value}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setBanConfirm(true)}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            user.status === "active"
              ? "bg-red-50 text-red-700 hover:bg-red-100"
              : "bg-green-50 text-green-700 hover:bg-green-100"
          }`}
        >
          {user.status === "active" ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
          {user.status === "active" ? "Ban User" : "Unban User"}
        </button>
        <button
          onClick={() => { setGrantCourseId(""); setGrantDialog(true); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-[rgba(0,0,0,0.06)] text-warm-black hover:bg-[rgba(0,0,0,0.1)] transition-colors"
        >
          <BookOpen size={14} />
          Grant Akses Kelas
        </button>
        <button
          onClick={handleResetPassword}
          disabled={resettingPw}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-60"
        >
          <KeyRound size={14} />
          Reset Password
        </button>
        <Link
          href={`/admin/users/${user.id}/journey`}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-[#8B1414]/10 text-[#8B1414] hover:bg-[#8B1414]/15 transition-colors"
        >
          <Route size={14} />
          Lihat Journey
        </Link>
      </div>

      {tempPw && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Password sementara untuk <b>{user.email}</b>:{" "}
          <code className="font-mono font-bold text-base bg-white px-2 py-0.5 rounded border border-amber-200">{tempPw}</code>
          {" "}— salin & kirim ke user. Hanya tampil sekali.
        </div>
      )}

      {/* Ban/Unban Confirm */}
      <ConfirmDialog
        open={banConfirm}
        onOpenChange={setBanConfirm}
        title={user.status === "active" ? `Ban ${user.name}?` : `Unban ${user.name}?`}
        description={
          user.status === "active"
            ? "User akan kehilangan akses ke seluruh layanan PejuangYen."
            : "User akan dapat mengakses kembali akun mereka."
        }
        confirmLabel={user.status === "active" ? "Ban User" : "Unban User"}
        variant={user.status === "active" ? "danger" : "default"}
        loading={banning}
        onConfirm={handleBan}
      />

      {/* Grant Access Dialog */}
      <Dialog open={grantDialog} onOpenChange={(open) => { if (!open) setGrantDialog(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Akses Kelas</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[rgba(12,12,10,0.55)] -mt-2">
            Memberikan akses kelas untuk{" "}
            <span className="font-semibold text-warm-black">{user.name}</span>
          </p>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-warm-black">Course ID</label>
            <input
              value={grantCourseId}
              onChange={(e) => setGrantCourseId(e.target.value)}
              placeholder="Masukkan Course ID"
              className={inputClass}
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setGrantDialog(false)}>Batal</Button>
            <Button onClick={handleGrantAccess} disabled={granting || !grantCourseId.trim()} loading={granting}>
              Berikan Akses
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
