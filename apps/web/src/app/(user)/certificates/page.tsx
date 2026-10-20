"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useState, useEffect } from "react";
import { Award, Download, Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/lottie/EmptyState";
import { DashboardSection, PageHeader } from "@/components/ui/dashboard-chrome";

interface Certificate {
  id: string;
  certificate_number: string;
  course_title: string;
  thumbnail_url?: string;
  issued_at: string;
}

interface EligibleCourse {
  enrollment_id: string;
  course_id: string;
  course_title: string;
  thumbnail_url?: string;
  access_type: string;
}

interface EligibleResponse {
  eligible: EligibleCourse[];
  membership_required: EligibleCourse[];
  completed_free_courses: EligibleCourse[];
  has_active_membership: boolean;
  certificate_message: string;
}

export default function CertificatesPage() {
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [eligible, setEligible] = useState<EligibleCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasActiveMembership, setHasActiveMembership] = useState(false);
  const [membershipRequired, setMembershipRequired] = useState<EligibleCourse[]>([]);
  const [completedFreeCourses, setCompletedFreeCourses] = useState<EligibleCourse[]>([]);
  const [certificateMessage, setCertificateMessage] = useState(
    "E-sertifikat hanya bisa didapatkan oleh user yang berlangganan membership aktif"
  );

  const loadData = () => {
    setLoading(true);
    setError(null);
    setHasActiveMembership(false);
    Promise.all([
      fetch("/api/user/certificates", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/user/certificates/eligible", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/user/my-classes", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([certsData, eligibleData, classesData]) => {
        if (certsData.success) setCerts(certsData.data);
        else setError(certsData.error || "Gagal memuat data");
        if (eligibleData.success) {
          if (Array.isArray(eligibleData.data)) {
            setEligible(eligibleData.data);
            setMembershipRequired([]);
            setCompletedFreeCourses([]);
          } else {
            const payload = eligibleData.data as EligibleResponse;
            setEligible(payload.eligible ?? []);
            setMembershipRequired(payload.membership_required ?? []);
            setCompletedFreeCourses(payload.completed_free_courses ?? []);
            setHasActiveMembership(payload.has_active_membership === true);
            setCertificateMessage(payload.certificate_message || certificateMessage);
          }
        }
        if (classesData.success) {
          const hasMembership = classesData.data?.hasActiveMembership === true;
          setHasActiveMembership((current) => current || hasMembership);
        }
      })
      .catch(() => setError("Gagal memuat data. Periksa koneksi internet."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleClaim = async (courseId: string) => {
    setClaiming(courseId);
    try {
      const res = await fetch("/api/user/certificates/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: courseId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Sertifikat berhasil diklaim!");
        loadData();
      } else {
        toast.error(data.error || "Gagal mengklaim sertifikat");
      }
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pencapaian"
        title="Sertifikat Saya"
        description="Bukti kelulusan resmi menyelesaikan kelas di PejuangYen"
      />

      {/* Membership notice */}
      {!loading && !hasActiveMembership && (
        <Link href="https://app.pejuangyen.com/premium/" target="_blank" rel="noopener noreferrer" className="block mb-6 group">
          <div className="glass-card glass-card-hover p-4 flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-[#8B1414]/10 dark:bg-[#C0392B]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Lock size={16} className="text-[#8B1414] dark:text-[#C0392B]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#0D0D0D] dark:text-white mb-0.5">
                E-Sertifikat hanya untuk Member Berbayar
              </p>
              <p className="text-xs text-[rgba(12,12,10,0.55)] dark:text-slate-400 leading-relaxed">
                {certificateMessage}. Bergabung dengan Membership PejuangYen untuk mendapatkan e-sertifikat resmi yang bisa diverifikasi dan dibagikan ke LinkedIn.
              </p>
            </div>
            <span className="flex-shrink-0 text-xs font-semibold text-[#8B1414] dark:text-[#C0392B] bg-[#8B1414]/10 dark:bg-[#C0392B]/10 px-3 py-1.5 rounded-lg group-hover:bg-[#8B1414]/20 dark:group-hover:bg-[#C0392B]/20 transition-colors whitespace-nowrap self-center">
              Lihat Membership →
            </span>
          </div>
        </Link>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="glass-card overflow-hidden">
              <div className="skeleton h-36 w-full" />
              <div className="p-4">
                <div className="skeleton h-4 w-1/2 mb-2" />
                <div className="skeleton h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
          <button onClick={loadData} className="text-xs font-medium text-[#8B1414] dark:text-[#C0392B] hover:underline">Coba Lagi</button>
        </div>
      ) : (
        <>
          {completedFreeCourses.length > 0 && (
            <div className="glass-card p-4 flex items-start gap-3.5 border-amber-500/20 bg-amber-500/10">
              <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Lock size={16} className="text-amber-700 dark:text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#0D0D0D] dark:text-white mb-0.5">
                  Kelas gratis selesai, sertifikat belum tersedia
                </p>
                <p className="text-xs text-[rgba(12,12,10,0.58)] dark:text-slate-400 leading-relaxed">
                  {completedFreeCourses.length} kelas gratis sudah 100% selesai. Kelas gratis tidak bisa mencetak e-sertifikat; sertifikat hanya bisa didapatkan oleh user yang berlangganan membership.
                </p>
              </div>
              {!hasActiveMembership && (
                <Link
                  href="https://app.pejuangyen.com/premium/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 text-xs font-semibold text-amber-800 dark:text-amber-400 bg-amber-500/15 dark:bg-amber-500/10 px-3 py-1.5 rounded-lg hover:bg-amber-500/25 dark:hover:bg-amber-500/20 transition-colors whitespace-nowrap self-center"
                >
                  Lihat Membership →
                </Link>
              )}
            </div>
          )}

          {!hasActiveMembership && membershipRequired.length > 0 && (
            <Link href="https://app.pejuangyen.com/premium/" target="_blank" rel="noopener noreferrer" className="block group">
              <div className="glass-card glass-card-hover p-4 flex items-start gap-3.5 border-[#8B1414]/15 dark:border-[#C0392B]/15 bg-[#8B1414]/5 dark:bg-[#C0392B]/5">
                <div className="w-9 h-9 rounded-lg bg-[#8B1414]/10 dark:bg-[#C0392B]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Sparkles size={16} className="text-[#8B1414] dark:text-[#C0392B]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#0D0D0D] dark:text-white mb-0.5">
                    {membershipRequired.length} kelas selesai menunggu membership
                  </p>
                  <p className="text-xs text-[rgba(12,12,10,0.55)] dark:text-slate-400 leading-relaxed">
                    Aktifkan membership untuk mengklaim e-sertifikat resmi dari kelas berbayar/member yang sudah kamu selesaikan.
                  </p>
                </div>
                <span className="flex-shrink-0 text-xs font-semibold text-[#8B1414] dark:text-[#C0392B] bg-[#8B1414]/10 dark:bg-[#C0392B]/10 px-3 py-1.5 rounded-lg group-hover:bg-[#8B1414]/20 dark:group-hover:bg-[#C0392B]/20 transition-colors whitespace-nowrap self-center">
                  Upgrade →
                </span>
              </div>
            </Link>
          )}

          {/* Section: Siap Diklaim (paid courses only) */}
          {eligible.length > 0 && (
            <DashboardSection
              title="Kelas Selesai - Klaim Sertifikat"
              actions={
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/14 dark:bg-amber-500/10 text-amber-800 dark:text-amber-400 ring-1 ring-amber-500/18 dark:ring-amber-500/20">
                  {eligible.length} siap diklaim
                </span>
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {eligible.map((course) => (
                  <div key={course.course_id} className="glass-card overflow-hidden border-amber-500/20 bg-amber-500/10">
                    <div className="p-6 bg-[#0D0D0D]/90 text-center">
                      <div className="w-10 h-10 rounded-full bg-amber-400/20 border border-amber-400/30 flex items-center justify-center mx-auto mb-3">
                        <Award size={18} className="text-amber-400" />
                      </div>
                      <h3 className="text-sm font-bold text-[#E1E0CC] leading-snug heading-tight">{course.course_title}</h3>
                      <p className="text-[10px] text-[rgba(225,224,204,0.5)] mt-1.5">100% Selesai</p>
                    </div>
                    <div className="p-4">
                      <button
                        onClick={() => handleClaim(course.course_id)}
                        disabled={claiming === course.course_id}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-60 transition-colors duration-150"
                      >
                        {claiming === course.course_id ? "Memproses..." : "Klaim Sertifikat"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </DashboardSection>
          )}

          {/* Section: Issued certs */}
          {certs.length === 0 && eligible.length === 0 ? (
            <div className="glass-card">
              {hasActiveMembership ? (
                <EmptyState
                  title="Belum Ada Sertifikat"
                  description="Selesaikan 100% materi pada kelas berbayar atau membership untuk mendapatkan sertifikat kelulusan."
                />
              ) : (
                <div className="flex flex-col items-center py-12 px-6 text-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#8B1414]/10 dark:bg-[#C0392B]/10 flex items-center justify-center">
                    <Sparkles size={20} className="text-[#8B1414] dark:text-[#C0392B]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#0D0D0D] dark:text-white mb-1">E-Sertifikat untuk Member Berbayar</p>
                    <p className="text-xs text-[rgba(12,12,10,0.5)] dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                      {certificateMessage}. Kelas gratis tetap bisa dipelajari, tetapi tidak menerbitkan e-sertifikat.
                    </p>
                  </div>
                  <Link
                    href="https://app.pejuangyen.com/premium/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#8B1414] dark:bg-[#C0392B] text-white dark:text-black text-xs font-semibold rounded-lg hover:bg-[#6E0F0F] dark:hover:bg-[#A93226] transition-colors"
                  >
                    <Sparkles size={12} />
                    Lihat Paket Membership
                  </Link>
                </div>
              )}
            </div>
          ) : certs.length > 0 && (
            <>
              <DashboardSection title="Sertifikat Diterbitkan">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {certs.map((c) => (
                  <div key={c.id} className="glass-card glass-card-hover overflow-hidden">
                    <div className="p-6 bg-[#0D0D0D] text-center">
                      <div className="w-10 h-10 rounded-full bg-[#8B1414]/20 border border-[#8B1414]/30 flex items-center justify-center mx-auto mb-3">
                        <Award size={18} className="text-[#4ade80]" />
                      </div>
                      <h3 className="text-sm font-bold text-[#E1E0CC] leading-snug heading-tight">{c.course_title}</h3>
                      <p className="text-[10px] text-[rgba(225,224,204,0.4)] mt-2 font-mono">No: {c.certificate_number}</p>
                    </div>
                    <div className="p-4 flex items-center justify-between">
                      <div>
                        <p className="label-uppercase" style={{ fontSize: "10px" }}>Tanggal Lulus</p>
                        <p className="text-sm font-semibold text-[#0D0D0D] dark:text-white mt-0.5">{formatDate(c.issued_at)}</p>
                      </div>
                      <Link
                        href={`/certificates/${c.id}`}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#0D0D0D] dark:bg-white text-white dark:text-black hover:bg-[#1a1a1a] dark:hover:bg-gray-200 transition-colors duration-150 active:scale-[0.97]"
                      >
                        <Download size={12} />
                        Unduh
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
              </DashboardSection>
            </>
          )}
        </>
      )}
    </div>
  );
}
