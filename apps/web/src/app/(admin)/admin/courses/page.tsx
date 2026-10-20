"use client";
/* eslint-disable react-hooks/immutability, react-hooks/exhaustive-deps */

import { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { Search, Plus, Users } from "lucide-react";
import { AdminTable, Tr, Td, StatusBadge } from "@/components/ui/AdminTable";
import { EmptyState } from "@/components/ui/lottie/EmptyState";
import { formatRupiah } from "@/lib/utils";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/Pagination";

interface Course {
  id: string;
  slug: string;
  title: string;
  category?: string;
  access_type: string;
  price: number;
  status: string;
  created_at: string;
  enrolled_count?: number;
  completed_count?: number;
}

interface Enrollment {
  id: string;
  status: string;
  enrolled_at: string;
  progress_percent?: number | null;
  completed_at?: string | null;
  name: string;
  email: string;
  phone?: string | null;
}

function AdminCoursesContent() {
  const [page, setPage] = useState(1);

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [totalPages, setTotalPages] = useState(1);

  const [enrollmentCourse, setEnrollmentCourse] = useState<Course | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [enrollmentsLoading, setEnrollmentsLoading] = useState(false);
  const [enrollmentPage, setEnrollmentPage] = useState(1);
  const [enrollmentTotalPages, setEnrollmentTotalPages] = useState(1);
  const [enrollmentSearch, setEnrollmentSearch] = useState("");

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { 
      if (page !== 1) setPage(1);
      else fetchCourses(); 
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, statusFilter]);

  useEffect(() => {
    fetchCourses();
  }, [page]);

  const fetchCourses = async () => {
    setLoading(true);
    setError(null);
    const p = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) p.set("search", search);
    if (statusFilter) p.set("status", statusFilter);
    try {
      const res = await fetch(`/api/admin/courses?${p}`, { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setCourses(data.data);
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

  const togglePublish = async (course: Course) => {
    const action = course.status === "published" ? "unpublish" : "publish";
    await fetch(`/api/admin/courses/${course.id}/${action}`, {
      method: "POST",
      credentials: "include",
    });
    fetchCourses();
  };

  const archiveCourse = async (id: string) => {
    if (!confirm("Yakin ingin mengarsipkan kelas ini?")) return;
    await fetch(`/api/admin/courses/${id}`, { method: "DELETE", credentials: "include" });
    fetchCourses();
  };

  const hardDeleteCourse = async (id: string, title: string) => {
    if (!confirm(`HAPUS PERMANEN: "${title}"?\n\nSemua data kelas, modul, lesson, dan progress siswa akan dihapus selamanya. Aksi ini TIDAK BISA dibatalkan.`)) return;
    const res = await fetch(`/api/admin/courses/${id}/hard`, { method: "DELETE", credentials: "include" });
    const data = await res.json();
    if (!data.success) { alert(data.error || "Gagal menghapus"); return; }
    fetchCourses();
  };

  const fetchEnrollments = async (course: Course, nextPage = 1, searchValue = enrollmentSearch) => {
    setEnrollmentCourse(course);
    setEnrollmentsLoading(true);
    const params = new URLSearchParams({ page: String(nextPage), limit: "25" });
    if (searchValue.trim()) params.set("search", searchValue.trim());
    try {
      const res = await fetch(`/api/admin/courses/${course.id}/enrollments?${params}`, { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setEnrollments(data.data || []);
        setEnrollmentPage(data.pagination?.page || nextPage);
        setEnrollmentTotalPages(data.pagination?.totalPages || 1);
      } else {
        alert(data.error || "Gagal memuat peserta kelas");
      }
    } catch {
      alert("Gagal memuat peserta kelas. Periksa koneksi internet.");
    } finally {
      setEnrollmentsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Konten"
        title="Kelola Kelas"
        description={loading ? "" : `${courses.length} kelas total`}
        actions={
        <Link
          href="/admin/courses/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl shadow-[0_10px_24px_rgba(139,20,20,0.22)] hover:bg-primary-hover transition-colors"
        >
          <Plus size={15} />
          Tambah Kelas
        </Link>
        }
      />

      {/* Filters */}
      <div className="glass-card p-3 flex gap-2.5 flex-wrap">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(12,12,10,0.35)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kelas..."
            className="pl-9 pr-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black placeholder:text-[rgba(12,12,10,0.35)] outline-none focus:border-primary focus:ring-2 focus:ring-primary-light transition-colors w-64"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black outline-none focus:border-primary transition-colors"
        >
          <option value="">Semua Status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {error && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-sm text-red-500">{error}</p>
          <button onClick={fetchCourses} className="text-xs font-medium text-primary hover:underline">Coba Lagi</button>
        </div>
      )}

      {!error && (
        <>
          <AdminTable
            columns={[
              { key: "title", label: "Kelas" },
              { key: "category", label: "Kategori" },
              { key: "access", label: "Tipe Akses" },
              { key: "students", label: "Peserta" },
              { key: "price", label: "Harga" },
              { key: "status", label: "Status" },
              { key: "action", label: "Aksi" },
            ]}
            loading={loading}
            empty={
              <EmptyState
                title="Belum ada kelas"
                description="Klik Tambah Kelas untuk membuat kelas pertama."
                size="sm"
                className="py-8"
              />
            }
          >
            {courses.map((c) => (
              <Tr key={c.id}>
                <Td>
                  <Link
                    href={`/admin/courses/${c.id}`}
                    className="font-semibold text-warm-black hover:text-primary"
                  >
                    {c.title}
                  </Link>
                  <p className="text-xs text-[rgba(12,12,10,0.35)] font-mono">/{c.slug}</p>
                </Td>
                <Td className="text-[rgba(12,12,10,0.65)]">{c.category || "—"}</Td>
                <Td><StatusBadge status={c.access_type} /></Td>
                <Td>
                  <button
                    onClick={() => {
                      setEnrollmentSearch("");
                      fetchEnrollments(c, 1, "");
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-[#8B1414] ring-1 ring-black/[0.08] transition-colors hover:bg-[#F7E8E8]"
                  >
                    <Users className="h-3.5 w-3.5" />
                    {c.enrolled_count || 0}
                    {c.completed_count ? <span className="text-gray-400">/{c.completed_count} selesai</span> : null}
                  </button>
                </Td>
                <Td className="font-medium text-warm-black">
                  {c.access_type === "free" ? "Gratis" : formatRupiah(c.price)}
                </Td>
                <Td><StatusBadge status={c.status} /></Td>
                <Td>
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/admin/courses/${c.id}`}
                      className="px-2.5 py-1 text-xs font-medium text-warm-black bg-warm-cream rounded-md hover:bg-[#e8e7d3] transition-colors"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => togglePublish(c)}
                      className="px-2.5 py-1 text-xs font-medium text-warm-black bg-warm-cream rounded-md hover:bg-[#e8e7d3] transition-colors"
                    >
                      {c.status === "published" ? "Unpublish" : "Publish"}
                    </button>
                    {c.status !== "archived" && (
                      <button
                        onClick={() => archiveCourse(c.id)}
                        className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
                      >
                        Arsip
                      </button>
                    )}
                    {c.status === "archived" && (
                      <button
                        onClick={() => hardDeleteCourse(c.id, c.title)}
                        className="px-2.5 py-1 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
                      >
                        Hapus Permanen
                      </button>
                    )}
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

      <Dialog open={!!enrollmentCourse} onOpenChange={(open) => { if (!open) setEnrollmentCourse(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Peserta: {enrollmentCourse?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(12,12,10,0.35)]" />
                <input
                  value={enrollmentSearch}
                  onChange={(e) => setEnrollmentSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && enrollmentCourse) fetchEnrollments(enrollmentCourse, 1, enrollmentSearch);
                  }}
                  placeholder="Cari nama, email, WhatsApp..."
                  className="w-full rounded-lg border border-[rgba(12,12,10,0.12)] bg-white py-2.5 pl-9 pr-3.5 text-sm outline-none transition-colors focus:border-primary"
                />
              </div>
              <button
                onClick={() => enrollmentCourse && fetchEnrollments(enrollmentCourse, 1, enrollmentSearch)}
                className="rounded-lg bg-primary px-3.5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
              >
                Cari
              </button>
            </div>
            <div className="max-h-[58vh] overflow-y-auto">
              <AdminTable
                columns={[
                  { key: "name", label: "Nama" },
                  { key: "contact", label: "Kontak" },
                  { key: "progress", label: "Progress" },
                  { key: "date", label: "Akses" },
                ]}
                loading={enrollmentsLoading}
                empty={<div className="py-8 text-center text-sm text-gray-500">Belum ada peserta</div>}
              >
                {enrollments.map((enrollment) => (
                  <Tr key={enrollment.id}>
                    <Td className="font-semibold">{enrollment.name}</Td>
                    <Td>
                      <p>{enrollment.email}</p>
                      {enrollment.phone && <p className="text-xs text-gray-500">{enrollment.phone}</p>}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{enrollment.progress_percent || 0}%</span>
                        {enrollment.completed_at && <span className="rounded-md bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">Selesai</span>}
                      </div>
                    </Td>
                    <Td>{new Date(enrollment.enrolled_at).toLocaleString("id-ID")}</Td>
                  </Tr>
                ))}
              </AdminTable>
            </div>
            {enrollmentTotalPages > 1 && (
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-[rgba(12,12,10,0.45)]">Halaman {enrollmentPage} dari {enrollmentTotalPages}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => enrollmentCourse && fetchEnrollments(enrollmentCourse, Math.max(1, enrollmentPage - 1), enrollmentSearch)}
                    disabled={enrollmentPage === 1 || enrollmentsLoading}
                    className="rounded-lg border border-[rgba(12,12,10,0.12)] px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-warm-cream disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Sebelumnya
                  </button>
                  <button
                    onClick={() => enrollmentCourse && fetchEnrollments(enrollmentCourse, Math.min(enrollmentTotalPages, enrollmentPage + 1), enrollmentSearch)}
                    disabled={enrollmentPage === enrollmentTotalPages || enrollmentsLoading}
                    className="rounded-lg border border-[rgba(12,12,10,0.12)] px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-warm-cream disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Berikutnya
                  </button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminCoursesPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-[400px] bg-gray-100 rounded-xl animate-pulse" />
      </div>
    }>
      <AdminCoursesContent />
    </Suspense>
  );
}
