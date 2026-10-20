"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BookOpen, Sparkles, Users } from "lucide-react";
import { EmptyState } from "@/components/ui/lottie/EmptyState";
import { DashboardSection, PageHeader } from "@/components/ui/dashboard-chrome";
import { AvatarStack, ParticipantPreview } from "@/components/ui/AvatarStack";

// Katalog kelas dikelompokkan per 9 kategori utama (bukan lagi
// Kelas Saya / Gratis / Membership). Status diikuti + progress tampil
// di card. Kategori dengan >10 kelas menampilkan 10 + link katalog penuh.
const MAX_PER_CATEGORY = 10;

interface EnrolledCourse {
  id: string;
  slug: string;
  title: string;
  progress: number;
}

interface CatalogCourse {
  id: string;
  slug: string;
  title: string;
  category_name?: string | null;
  category_slug?: string | null;
  thumbnail_url?: string;
  access_type: string;
  price?: number;
  enrolled_count?: number;
  participants_preview?: ParticipantPreview[];
}

interface Category {
  slug: string;
  name: string;
}

// Baris kartu yang bisa di-scroll ke kanan (pengganti grid memanjang ke bawah)
function HScrollRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
      {children}
    </div>
  );
}

function HScrollItem({ children }: { children: React.ReactNode }) {
  return <div className="w-72 shrink-0 snap-start">{children}</div>;
}

function HScrollSkeleton() {
  return (
    <HScrollRow>
      {[1, 2, 3].map((i) => (
        <HScrollItem key={i}>
          <div className="glass-card overflow-hidden">
            <div className="skeleton aspect-video w-full" />
            <div className="p-4">
              <div className="skeleton mb-2 h-4 w-3/4" />
              <div className="skeleton h-1.5 w-full" />
            </div>
          </div>
        </HScrollItem>
      ))}
    </HScrollRow>
  );
}

function CatalogCard({ course, enrolledIds, progressById, hasActiveMembership }: {
course: CatalogCourse;
enrolledIds: Set<string>;
progressById: Map<string, number>;
hasActiveMembership: boolean;
}) {
  const isEnrolled = enrolledIds.has(course.id);
  const progress = progressById.get(course.id) ?? 0;
  const isFree = course.access_type === "free";
  const isPaid = course.access_type === "paid";
  // Sudah diikuti / gratis / member aktif → langsung belajar.
  // Kelas berbayar & belum punya akses → beli satuan (/order/{slug}).
  // Sisanya (membership_only) → arahkan ke pembelian membership.
  const href =
    isEnrolled || isFree || hasActiveMembership
      ? `/learn/${course.slug}/start`
      : isPaid
        ? `/order/${course.slug}`
        : "https://app.pejuangyen.com/premium/";

  return (
    <Link href={href} className="block group">
      <div className="glass-card glass-card-hover overflow-hidden">
        <div className="w-full aspect-video bg-white/42 dark:bg-white/5 relative overflow-hidden">
          {course.thumbnail_url ? (
            <Image
              src={course.thumbnail_url}
              alt={course.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              loading="lazy"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full">
              <BookOpen size={28} className="text-[#D1D5DB] dark:text-slate-600 group-hover:text-[#8B1414] dark:group-hover:text-[#C0392B] transition-colors duration-300" />
            </div>
          )}
          <div className="absolute top-2 left-2">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold shadow-sm ${
              isFree
                ? "bg-green-100 text-green-700"
                : "bg-amber-100 text-amber-700"
            }`}>
              {isFree ? "FREE" : "PREMIUM"}
            </span>
          </div>
          {isEnrolled && (
            <div className="absolute top-2 right-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#8B1414] text-white shadow-sm">
                Sudah Diikuti
              </span>
            </div>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-sm text-[#0D0D0D] dark:text-white leading-snug mb-3 line-clamp-2 heading-tight">
            {course.title}
          </h3>
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-white/62 dark:bg-white/5 px-2 py-1 text-[11px] font-semibold text-[rgba(12,12,10,0.55)] dark:text-slate-300">
            <Users className="h-3.5 w-3.5 text-[#8B1414] dark:text-[#C0392B]" />
            {course.participants_preview && course.participants_preview.length > 0 ? (
              <AvatarStack participants={course.participants_preview} total={course.enrolled_count || 0} />
            ) : (
              <>{course.enrolled_count || 0} peserta</>
            )}
          </div>
          {isEnrolled ? (
            <>
              <div className="h-1.5 bg-[#8B1414]/[0.08] dark:bg-white/[0.05] rounded-full overflow-hidden mb-1.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${progress === 100 ? "bg-[#22C55E] dark:bg-[#C0392B]" : "bg-[#8B1414] dark:bg-[#C0392B]"}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#9CA3AF] dark:text-slate-400 tabular-nums">{progress}% selesai</span>
                <span className={`text-xs font-semibold ${progress === 100 ? "text-[#22C55E] dark:text-[#C0392B]" : "text-[#8B1414] dark:text-[#C0392B]"}`}>
                  {progress === 100 ? "Selesai" : "Lanjutkan →"}
                </span>
              </div>
            </>
          ) : isFree ? (
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#8B1414] dark:text-[#C0392B]">Gratis</span>
              <span className="text-xs font-semibold text-[#8B1414] dark:text-[#C0392B]">Mulai Belajar →</span>
            </div>
          ) : hasActiveMembership ? (
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#0D0D0D] dark:text-white">Premium</span>
              <span className="text-xs font-semibold text-[#8B1414] dark:text-[#C0392B]">Mulai Belajar →</span>
            </div>
          ) : isPaid ? (
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#0D0D0D] dark:text-white">
                {course.price ? `Rp${course.price.toLocaleString("id-ID")}` : "Beli Kelas"}
              </span>
              <span className="text-xs font-semibold text-[#8B1414] dark:text-[#C0392B]">Beli Kelas →</span>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-[#0D0D0D] dark:text-white">Premium</span>
              <span className="text-xs font-semibold text-[#8B1414] dark:text-[#C0392B]">Upgrade →</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

function CategorySection({ name, slug, items, enrolledIds, progressById, hasActiveMembership }: {
name: string;
slug: string;
items: CatalogCourse[];
enrolledIds: Set<string>;
progressById: Map<string, number>;
hasActiveMembership: boolean;
}) {
  const visible = items.slice(0, MAX_PER_CATEGORY);
  const hasMore = items.length > MAX_PER_CATEGORY;
  return (
    <DashboardSection
      title={
        <span className="inline-flex items-center gap-2">
          {name}
          <span className="inline-flex items-center rounded-full bg-[#8B1414]/10 dark:bg-[#C0392B]/15 px-2 py-0.5 text-[10px] font-bold text-[#8B1414] dark:text-[#34D399]">
            {items.length} kelas
          </span>
        </span>
      }
      actions={
        hasMore ? (
          <Link
            href={`/kelas?category=${slug}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-[#8B1414] dark:text-[#C0392B] hover:underline"
          >
            Lihat Katalog ({items.length}) <ArrowRight className="h-3 w-3" />
          </Link>
        ) : undefined
      }
    >
      <div className="rounded-2xl bg-[#8B1414]/[0.04] p-4 ring-1 ring-[#8B1414]/10 dark:bg-[#C0392B]/[0.04] dark:ring-[#C0392B]/10">
        <HScrollRow>
          {visible.map((c) => (
            <HScrollItem key={c.id}>
              <CatalogCard course={c} enrolledIds={enrolledIds} progressById={progressById} hasActiveMembership={hasActiveMembership} />
            </HScrollItem>
          ))}
          {hasMore && (
            <HScrollItem>
              <Link
                href={`/kelas?category=${slug}`}
                className="glass-card glass-card-hover flex h-full min-h-[220px] flex-col items-center justify-center gap-2 text-center p-6"
              >
                <span className="text-2xl font-bold text-[#8B1414] dark:text-[#C0392B]">+{items.length - MAX_PER_CATEGORY}</span>
                <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">kelas lainnya</span>
                <span className="text-xs font-medium text-[#8B1414] dark:text-[#C0392B]">Lihat Katalog →</span>
              </Link>
            </HScrollItem>
          )}
        </HScrollRow>
      </div>
    </DashboardSection>
  );
}

export default function MyClassesPage() {
  const [enrolled, setEnrolled] = useState<EnrolledCourse[]>([]);
  const [hasActiveMembership, setHasActiveMembership] = useState(false);
  const [catalog, setCatalog] = useState<CatalogCourse[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    setError(null);

    const myClasses = fetch("/api/user/my-classes", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setEnrolled([...(d.data.enrolled || []), ...(d.data.membership || [])]);
          setHasActiveMembership(!!d.data.hasActiveMembership);
        } else {
          setError(d.error || "Gagal memuat data");
        }
      })
      .catch(() => setError("Gagal memuat data. Periksa koneksi internet."));

    const allCourses = fetch("/api/courses?limit=50", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.data)) setCatalog(d.data);
      })
      .catch(() => {});

    const cats = fetch("/api/categories", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.data)) setCategories(d.data);
      })
      .catch(() => {});

    return Promise.all([myClasses, allCourses, cats]).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const progressById = new Map(enrolled.map((c) => [c.id, c.progress]));
  const enrolledIds = new Set(enrolled.map((c) => c.id));

  // Kelompokkan katalog per kategori (urutan mengikuti taxonomy)
  const sections = categories
    .map((cat) => ({
      ...cat,
      items: catalog.filter((c) => c.category_slug === cat.slug),
    }))
    .filter((s) => s.items.length > 0);
  const uncategorized = catalog.filter((c) => !c.category_slug);

  const header = (
    <PageHeader
      eyebrow="Belajar"
      title="Kelas Saya"
      description="Jelajahi kelas per kategori — progress belajarmu tampil di setiap kelas yang diikuti"
    />
  );

  if (error) return (
    <div className="space-y-6">
      {header}
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
        <button onClick={loadData} className="text-xs font-medium text-[#8B1414] dark:text-[#C0392B] hover:underline">Coba Lagi</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {header}

      {/* Membership Upsell Banner */}
      {!loading && !hasActiveMembership && (
        <Link href="https://app.pejuangyen.com/premium/" target="_blank" rel="noopener noreferrer" className="block group">
          <div className="rounded-[var(--radius-lg,12px)] bg-[#8B1414] p-5 flex items-center justify-between gap-4 transition-all duration-300 shadow-[0_4px_16px_rgba(139,20,20,0.20)] hover:shadow-[0_6px_20px_rgba(139,20,20,0.28)]">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center mt-0.5">
                <Sparkles size={18} className="text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm leading-snug">Mau akses semua kelas jauh lebih hemat?</p>
                <p className="text-white/70 text-xs mt-0.5">Dapatkan Membership PejuangYen — akses semua kelas tanpa batas dengan harga yang lebih terjangkau.</p>
              </div>
            </div>
            <span className="flex-shrink-0 text-xs font-semibold text-white bg-white/15 px-3 py-1.5 rounded-lg group-hover:bg-white/25 transition-colors duration-200 whitespace-nowrap">
              Klik di sini →
            </span>
          </div>
        </Link>
      )}

      {loading ? (
        <DashboardSection title="Memuat kelas...">
          <div className="rounded-2xl bg-[#8B1414]/[0.04] p-4 ring-1 ring-[#8B1414]/10">
            <HScrollSkeleton />
          </div>
        </DashboardSection>
      ) : sections.length === 0 && uncategorized.length === 0 ? (
        <div className="glass-card">
          <EmptyState
            title="Belum ada kelas"
            description="Cek kembali nanti untuk kelas terbaru."
          />
        </div>
      ) : (
        <>
          {sections.map((section) => (
            <CategorySection key={section.slug} name={section.name} slug={section.slug} items={section.items} enrolledIds={enrolledIds} progressById={progressById} hasActiveMembership={hasActiveMembership} />
          ))}
          {uncategorized.length > 0 && (
            <CategorySection name="Lainnya" slug="" items={uncategorized} enrolledIds={enrolledIds} progressById={progressById} hasActiveMembership={hasActiveMembership} />
          )}
        </>
      )}
    </div>
  );
}
