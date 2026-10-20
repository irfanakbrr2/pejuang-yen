"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/static-components */

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2, Circle, ChevronLeft, ChevronRight,
  Menu, X, Play, FileText, HelpCircle, Download, ExternalLink,
  Lock, Sparkles,
} from "lucide-react";
import YouTubePlayer from "@/components/course/YouTubePlayer";
import { cn } from "@/lib/utils";
import { LessonContentFrame } from "@/components/learn/lesson-content-frame";
import { toast } from "@/components/ui/toast";
import { track } from "@/lib/tracking/client";
import { useScrollReset } from "@/hooks/use-scroll-reset";

interface Lesson {
  id: string;
  title: string;
  slug: string;
  lesson_type: string;
  video_url?: string;
  content_markdown?: string;
  content_html?: string;
  content_embed?: string;
  description?: string;
  resources_json?: string;
  is_completed: boolean;
}

interface ResourceLink {
  title: string;
  url: string;
}

interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

interface CourseProgress {
  id: string;
  title: string;
  access_type: string;
}

const LESSON_TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  video:    Play,
  text:     FileText,
  quiz:     HelpCircle,
  resource: Download,
};

const LESSON_TYPE_LABEL: Record<string, string> = {
  video:    "Video",
  text:     "Bacaan",
  quiz:     "Kuis",
  resource: "Resource",
};

function isSafeResourceUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) || (url.startsWith("/") && !url.startsWith("//"));
}

function parseResources(json?: string): ResourceLink[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const raw = item as Record<string, unknown>;
        const title = typeof raw.title === "string" ? raw.title.trim() : "";
        const url = typeof raw.url === "string" ? raw.url.trim() : "";
        return title && url && isSafeResourceUrl(url) ? { title, url } : null;
      })
      .filter((item): item is ResourceLink => Boolean(item));
  } catch {
    return [];
  }
}

export default function LearnClient() {
  const pathname = usePathname();
  const router = useRouter();
  const [data, setData] = useState<{
    course: CourseProgress;
    enrollment_id: string;
    modules: Module[];
    access_reason?: string;
    has_active_membership?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [quizResult, setQuizResult] = useState<{ score: number; maxScore: number } | null>(null);

  const parts = pathname.split("/").filter(Boolean);
  const courseSlug = parts[1];
  const lessonSlug = parts[2];

  // Reset scroll konten ke atas tiap ganti lesson (komponen tetap mount,
  // jadi div overflow-y-auto-nya tidak otomatis kembali ke atas).
  const contentRef = useRef<HTMLDivElement>(null);
  useScrollReset(contentRef, lessonSlug);

  // Reset quiz result when navigating to a different lesson
  useEffect(() => { setQuizResult(null); }, [lessonSlug]);

  // Disable right-click across the lesson page (deterrent against casual
  // copying/saving). Note: this cannot reach inside the cross-origin video
  // iframe — that is handled by the shield overlay in YouTubePlayer.
  useEffect(() => {
    const block = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", block);
    return () => document.removeEventListener("contextmenu", block);
  }, []);

  // ── First-party tracking: lesson_started + throttled watch progress ──────
  const watchStateRef = useRef<{
    lessonId: string | null;
    lastPostAt: number;
    milestonesSent: Set<number>;
    latest: { lessonId: string; position: number; duration: number } | null;
  }>({ lessonId: null, lastPostAt: 0, milestonesSent: new Set(), latest: null });

  useEffect(() => {
    if (!data || !lessonSlug || lessonSlug === "start") return;
    const lesson = data.modules.flatMap((m) => m.lessons).find((l) => l.slug === lessonSlug);
    if (!lesson || watchStateRef.current.lessonId === lesson.id) return;
    watchStateRef.current = { lessonId: lesson.id, lastPostAt: 0, milestonesSent: new Set(), latest: null };
    track("lesson_started", { course_id: data.course.id, lesson_id: lesson.id });
  }, [data, lessonSlug]);

  const postWatchProgress = (lessonId: string, position: number, duration: number, milestone?: number) => {
    if (!data) return;
    fetch("/api/user/progress/watch", {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enrollment_id: data.enrollment_id,
        lesson_id: lessonId,
        position_seconds: Math.floor(position),
        duration_seconds: Math.floor(duration),
        ...(milestone ? { milestone } : {}),
      }),
    }).catch(() => {});
  };

  const handleWatchProgress = (lessonId: string, position: number, duration: number) => {
    const state = watchStateRef.current;
    if (state.lessonId !== lessonId) return;
    state.latest = { lessonId, position, duration };

    const percent = duration > 0 ? (position / duration) * 100 : 0;
    const milestone = [75, 50, 25].find((m) => percent >= m && !state.milestonesSent.has(m));
    const nowMs = Date.now();

    if (milestone) {
      state.milestonesSent.add(milestone);
      state.lastPostAt = nowMs;
      postWatchProgress(lessonId, position, duration, milestone);
    } else if (nowMs - state.lastPostAt >= 30_000) {
      state.lastPostAt = nowMs;
      postWatchProgress(lessonId, position, duration);
    }
  };

  // Flush last known watch position when the tab is hidden/closed
  useEffect(() => {
    const flushPosition = () => {
      const latest = watchStateRef.current.latest;
      if (latest) postWatchProgress(latest.lessonId, latest.position, latest.duration);
    };
    window.addEventListener("pagehide", flushPosition);
    return () => window.removeEventListener("pagehide", flushPosition);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.enrollment_id]);

  useEffect(() => {
    fetch(`/api/user/progress/${courseSlug}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setData(d.data);
          const allLessons = d.data.modules.flatMap((m: Module) => m.lessons);
          if (lessonSlug === "start" && allLessons.length > 0) {
            router.replace(`/learn/${courseSlug}/${allLessons[0].slug}`);
          } else if (lessonSlug !== "start" && allLessons.length > 0) {
            const found = allLessons.find((l: Lesson) => l.slug === lessonSlug);
            if (!found) router.replace(`/learn/${courseSlug}/${allLessons[0].slug}`);
          }
        } else {
          setError(d.error || "Gagal memuat kelas");
        }
      })
      .finally(() => setLoading(false));
  }, [courseSlug, lessonSlug, router]);

  const markComplete = async (lessonId: string, isCompleted: boolean, score?: number, maxScore?: number) => {
    if (!data) return;
    await fetch("/api/user/progress/complete", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enrollment_id: data.enrollment_id,
        lesson_id: lessonId,
        is_completed: isCompleted,
        ...(score !== undefined ? { score, max_score: maxScore } : {}),
      }),
    });

    const updatedLessons = data.modules.flatMap((m) => m.lessons).map((l) =>
      l.id === lessonId ? { ...l, is_completed: isCompleted } : l
    );

    setData({
      ...data,
      modules: data.modules.map((m) => ({
        ...m,
        lessons: m.lessons.map((l) =>
          l.id === lessonId ? { ...l, is_completed: isCompleted } : l
        ),
      })),
    });

    if (isCompleted && updatedLessons.every((l) => l.is_completed)) {
      if (data.course.access_type === "free") {
        toast.info("Kelas gratis tidak menerbitkan e-sertifikat. Sertifikat hanya bisa didapatkan oleh user yang berlangganan membership.");
        return;
      }

      if (!data.has_active_membership) {
        toast.info("E-sertifikat hanya bisa didapatkan oleh user yang berlangganan membership aktif.");
        return;
      }

      fetch("/api/user/certificates/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: data.course.id }),
      })
        .then((r) => r.json())
        .then((res) => {
          if (!res.success) toast.error(res.error || "Gagal membuat sertifikat");
        })
        .catch(() => toast.error("Gagal membuat sertifikat"));
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#8B1414]/30 border-t-[#8B1414] rounded-full animate-spin" />
          <p className="text-sm text-gray-400">Memuat kelas...</p>
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────

  if (error) {
    const isAccessError = /access|membership|enroll|akses/i.test(error);

    if (isAccessError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12">
          <div className="w-full max-w-sm text-center">
            {/* Lock icon */}
            <div className="relative mx-auto w-20 h-20 mb-6">
              <div className="w-20 h-20 rounded-2xl bg-[#8B1414] flex items-center justify-center shadow-[0_4px_16px_rgba(139,20,20,0.20)]">
                <Lock className="h-9 w-9 text-white" />
              </div>
              <div className="absolute -top-1.5 -right-1.5 w-7 h-7 bg-amber-400 rounded-full flex items-center justify-center shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Konten Member Eksklusif
            </h2>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Kelas ini hanya tersedia untuk member aktif PejuangYen. Upgrade sekarang dan buka akses penuh ke semua materi.
            </p>

            {/* Benefits */}
            <div className="bg-[#F7E8E8] border border-[#8B1414]/10 rounded-2xl p-4 mb-6 text-left space-y-2.5">
              {[
                "Akses 20+ kelas AI & bisnis digital",
                "Update materi seumur hidup",
                "Komunitas member eksklusif",
                "Sertifikat penyelesaian kelas",
              ].map((benefit) => (
                <div key={benefit} className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-[#8B1414] shrink-0" />
                  <span className="text-sm text-gray-700">{benefit}</span>
                </div>
              ))}
            </div>

            <a
              href="https://app.pejuangyen.com/premium/"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3.5 bg-[#8B1414] text-white text-sm font-bold rounded-2xl hover:bg-[#6E0F0F] transition-colors shadow-[0_4px_16px_rgba(139,20,20,0.3)] mb-3"
            >
              Lihat Paket Membership →
            </a>
            <Link
              href="/dashboard"
              className="block w-full py-3 bg-gray-50 text-gray-600 text-sm font-medium rounded-2xl hover:bg-gray-100 transition-colors"
            >
              Kembali ke Dashboard
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <X className="h-6 w-6 text-red-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">Gagal memuat kelas</h2>
          <p className="text-sm text-gray-500 max-w-sm">{error}</p>
        </div>
        <Link
          href="/dashboard"
          className="px-5 py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors"
        >
          Kembali ke Dashboard
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const allLessons = data.modules.flatMap((m) => m.lessons);
  const currentIdx = allLessons.findIndex((l) => l.slug === lessonSlug);
  const currentLesson = currentIdx >= 0 ? allLessons[currentIdx] : null;
  const prevLesson = currentIdx > 0 ? allLessons[currentIdx - 1] : null;
  const nextLesson =
    currentIdx >= 0 && currentIdx < allLessons.length - 1
      ? allLessons[currentIdx + 1]
      : null;

  const totalLessons = allLessons.length;
  const completedCount = allLessons.filter((l) => l.is_completed).length;
  const progressPct = totalLessons === 0 ? 0 : Math.round((completedCount / totalLessons) * 100);
  const currentContentRaw = currentLesson?.content_embed || currentLesson?.content_html || currentLesson?.content_markdown || "";
  const currentResources = parseResources(currentLesson?.resources_json);

  // ── Sidebar Content ──────────────────────────────────────────────────────

  const SidebarContent = () => (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-black/[0.06] dark:border-white/[0.06] shrink-0">
        <Link
          href="/my-classes"
          onClick={() => setSidebarOpen(false)}
          className="inline-flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-300 transition-colors mb-4"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Kelas Saya
        </Link>

        <h2 className="text-sm font-bold text-gray-900 dark:text-white leading-snug mb-4">
          {data.course.title}
        </h2>

        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-gray-400 dark:text-slate-500 font-medium">Progress</span>
          <span
            className={cn(
              "font-bold tabular-nums",
              progressPct === 100 ? "text-[#8B1414] dark:text-[#C0392B]" : "text-gray-700 dark:text-slate-300"
            )}
          >
            {progressPct}%
          </span>
        </div>
        <div className="bg-gray-100 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#8B1414] dark:bg-[#C0392B] transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1.5">
          {completedCount} dari {totalLessons} lesson selesai
        </p>
      </div>

      {/* Module + Lesson list */}
      <nav className="flex-1 overflow-y-auto py-2">
        {data.modules.map((mod, mi) => (
          <div key={mod.id} className="mb-1">
            {/* Module header */}
            <div className="px-5 pt-3 pb-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                Modul {mi + 1}
              </p>
              <p className="text-xs font-semibold text-gray-600 dark:text-slate-300 mt-0.5 leading-snug">
                {mod.title}
              </p>
            </div>

            {/* Lessons */}
            <ul className="px-2">
              {mod.lessons.map((lesson) => {
                const isActive = lesson.slug === lessonSlug;
                const TypeIcon = LESSON_TYPE_ICON[lesson.lesson_type] ?? Play;

                return (
                  <li key={lesson.id}>
                    <Link
                      href={`/learn/${courseSlug}/${lesson.slug}`}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-0.5",
                        "transition-colors duration-100 group",
                        isActive
                          ? "bg-[#F7E8E8] dark:bg-[#C0392B]/10 text-[#8B1414] dark:text-[#C0392B] ring-1 ring-[#8B1414]/15 dark:ring-[#C0392B]/20"
                          : "text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-white"
                      )}
                    >
                      {/* Completion icon */}
                      {lesson.is_completed ? (
                        <CheckCircle2
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isActive ? "text-[#8B1414] dark:text-[#C0392B]" : "text-[#8B1414] dark:text-[#C0392B]"
                          )}
                        />
                      ) : (
                        <Circle
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isActive ? "text-[#8B1414] dark:text-[#C0392B]" : "text-gray-300 dark:text-slate-600 group-hover:text-gray-400 dark:group-hover:text-slate-400"
                          )}
                        />
                      )}

                      {/* Title */}
                      <span
                        className={cn(
                          "text-xs leading-snug flex-1 line-clamp-2",
                          isActive ? "font-semibold" : "font-normal"
                        )}
                      >
                        {lesson.title}
                      </span>

                      <TypeIcon
                        className={cn(
                          "h-3 w-3 shrink-0 transition-colors",
                          isActive
                            ? "text-white"
                            : "text-gray-200 group-hover:text-gray-300 dark:text-slate-500 dark:group-hover:text-slate-400"
                        )}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex w-72 shrink-0 bg-white dark:bg-[#0D0D0D] h-full flex-col shadow-[1px_0_0_rgba(0,0,0,0.06)] dark:shadow-[1px_0_0_rgba(255,255,255,0.06)]">
        <SidebarContent />
      </aside>

      {/* ── Mobile Drawer Overlay ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Mobile Drawer ── */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full w-72 bg-white dark:bg-[#0D0D0D] z-50 flex flex-col",
          "transition-transform duration-250 ease-in-out md:hidden",
          "shadow-[4px_0_24px_rgba(0,0,0,0.12)]",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Mobile drawer header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-black/[0.06] dark:border-white/[0.06] shrink-0">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">Daftar Materi</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-400 dark:text-slate-400 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <SidebarContent />
        </div>
      </aside>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* ── Topbar ── */}
        <header className="h-14 bg-white/80 dark:bg-[#0D0D0D]/80 backdrop-blur-sm border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between px-4 md:px-6 gap-3 shrink-0 sticky top-0 z-20">
          {/* Left */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-1 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 dark:text-slate-400 transition-colors md:hidden shrink-0"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
            <Link
              href="/my-classes"
              className="hidden md:inline-flex items-center gap-1 text-xs text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white transition-colors shrink-0"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Kelas Saya
            </Link>
            <span className="hidden md:block text-gray-200 dark:text-slate-600 text-sm shrink-0">/</span>
            <span className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">
              {currentLesson?.title || "Pilih Lesson"}
            </span>
          </div>

          {/* Right: mark complete */}
          {currentLesson && (
            <button
              onClick={() => markComplete(currentLesson.id, !currentLesson.is_completed)}
              className={cn(
                "shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5",
                "text-xs font-semibold rounded-xl transition-all duration-150 whitespace-nowrap",
                currentLesson.is_completed
                  ? "bg-[#F7E8E8] dark:bg-[#C0392B]/10 text-[#8B1414] dark:text-[#C0392B] hover:bg-[#d5ede5] dark:hover:bg-[#C0392B]/20"
                  : "bg-[#8B1414] dark:bg-[#C0392B] text-white dark:text-black hover:bg-[#6E0F0F] dark:hover:bg-[#A93226] shadow-[0_2px_8px_rgba(139,20,20,0.3)] dark:shadow-none"
              )}
            >
              {currentLesson.is_completed ? (
                <><CheckCircle2 className="h-3.5 w-3.5" /> Selesai</>
              ) : (
                <><Circle className="h-3.5 w-3.5" /> Tandai Selesai</>
              )}
            </button>
          )}
        </header>

        {/* ── Lesson Content ── */}
        <div ref={contentRef} className="flex-1 overflow-y-auto bg-[#F2F2F7] dark:bg-black">
          {currentLesson ? (
            <div key={lessonSlug} className="page-enter max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-5">

              {/* Video Player */}
              {currentLesson.lesson_type === "video" && currentLesson.video_url && (
                <YouTubePlayer
                  videoUrl={currentLesson.video_url}
                  title={currentLesson.title}
                  onEnded={() => {
                    if (!currentLesson.is_completed) {
                      markComplete(currentLesson.id, true);
                    }
                  }}
                  onProgress={(position, duration) =>
                    handleWatchProgress(currentLesson.id, position, duration)
                  }
                />
              )}

              {/* Lesson info card */}
              <div className="bg-white dark:bg-white/5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),_0_4px_16px_rgba(0,0,0,0.04)] dark:shadow-none dark:border dark:border-white/[0.05] px-6 py-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                    {data.course.title}
                  </span>
                  <span className="text-gray-200 dark:text-slate-600 text-xs">•</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                    {(() => {
                      const Icon = LESSON_TYPE_ICON[currentLesson.lesson_type] ?? Play;
                      return <Icon className="h-3 w-3" />;
                    })()}
                    {LESSON_TYPE_LABEL[currentLesson.lesson_type] ?? currentLesson.lesson_type}
                  </span>
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white leading-snug">
                  {currentLesson.title}
                </h1>
                {currentLesson.description && (
                  <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed mt-3">
                    {currentLesson.description}
                  </p>
                )}
              </div>

              {currentContentRaw && (
                <article className="bg-white dark:bg-white/5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),_0_4px_16px_rgba(0,0,0,0.04)] dark:shadow-none dark:border dark:border-white/[0.05] overflow-hidden">
                  <LessonContentFrame
                    html={currentContentRaw}
                    onQuizComplete={currentLesson.lesson_type === "quiz" ? (score, maxScore) => {
                      setQuizResult({ score, maxScore });
                      markComplete(currentLesson.id, true, score, maxScore);
                    } : undefined}
                  />
                </article>
              )}

              {/* Quiz score card — shown after quiz is submitted */}
              {currentLesson.lesson_type === "quiz" && quizResult && (
                <div className={`rounded-2xl px-6 py-5 flex items-center gap-4 shadow-[0_1px_3px_rgba(0,0,0,0.06),_0_4px_16px_rgba(0,0,0,0.04)] dark:shadow-none dark:border ${quizResult.score >= quizResult.maxScore * 0.6 ? "bg-[#ecfdf5] dark:bg-[#10b981]/10 border-[#bbf7d0] dark:border-[#10b981]/20" : "bg-[#fff7ed] dark:bg-[#f59e0b]/10 border-[#fed7aa] dark:border-[#f59e0b]/20"}`}>
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0 ${quizResult.score >= quizResult.maxScore * 0.6 ? "bg-[#10b981] text-white" : "bg-[#f59e0b] text-white"}`}>
                    {quizResult.maxScore > 0 ? Math.round((quizResult.score / quizResult.maxScore) * 100) : quizResult.score}%
                  </div>
                  <div>
                    <p className={`font-semibold text-sm ${quizResult.score >= quizResult.maxScore * 0.6 ? "text-[#047857] dark:text-[#34d399]" : "text-[#92400e] dark:text-[#fbbf24]"}`}>
                      {quizResult.score >= quizResult.maxScore * 0.6 ? "Selamat! Kamu lulus kuis." : "Belum lulus, tapi tetap semangat!"}
                    </p>
                    <p className={`text-xs mt-0.5 ${quizResult.score >= quizResult.maxScore * 0.6 ? "text-[#065f46] dark:text-[#6ee7b7]" : "text-[#b45309] dark:text-[#fcd34d]"}`}>
                      Skor kamu: <strong>{quizResult.score}</strong> dari <strong>{quizResult.maxScore}</strong> poin
                    </p>
                  </div>
                </div>
              )}

              {currentResources.length > 0 && (
                <div className="bg-white dark:bg-white/5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),_0_4px_16px_rgba(0,0,0,0.04)] dark:shadow-none dark:border dark:border-white/[0.05] px-6 py-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Download className="h-4 w-4 text-[#8B1414] dark:text-[#C0392B]" />
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">Resource</h2>
                  </div>
                  <div className="grid gap-2">
                    {currentResources.map((resource) => (
                      <a
                        key={`${resource.title}-${resource.url}`}
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-3 rounded-xl border border-black/[0.06] dark:border-white/[0.05] px-4 py-3 text-sm text-gray-700 dark:text-slate-300 hover:border-[#8B1414]/30 dark:hover:border-[#C0392B]/30 hover:bg-[#F7E8E8] dark:hover:bg-[#C0392B]/10 transition-colors"
                      >
                        <span className="font-medium truncate">{resource.title}</span>
                        <ExternalLink className="h-4 w-4 shrink-0 text-gray-300 dark:text-slate-500" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {!currentContentRaw && currentResources.length === 0 && currentLesson.lesson_type !== "video" && (
                <div className="bg-white dark:bg-white/5 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),_0_4px_16px_rgba(0,0,0,0.04)] dark:shadow-none dark:border dark:border-white/[0.05] px-6 py-8 text-center">
                  <p className="text-sm text-gray-400 dark:text-slate-500">Konten lesson belum tersedia.</p>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between gap-4 pb-6">
                {prevLesson ? (
                  <Link
                    href={`/learn/${courseSlug}/${prevLesson.slug}`}
                    className={cn(
                      "flex items-center gap-2 px-4 py-3 min-w-0",
                      "bg-white dark:bg-white/5 rounded-2xl",
                      "shadow-[0_1px_3px_rgba(0,0,0,0.06),_0_4px_16px_rgba(0,0,0,0.04)] dark:shadow-none dark:border dark:border-white/[0.05]",
                      "text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white",
                      "hover:shadow-[0_4px_12px_rgba(0,0,0,0.10)] dark:hover:shadow-[0_4px_12px_rgba(0,0,0,0.30)] hover:scale-[1.01]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1414]/40",
                      "transition-all duration-150 max-w-[48%]"
                    )}
                  >
                    <ChevronLeft className="h-4 w-4 shrink-0 text-gray-400 dark:text-slate-500" />
                    <span className="text-xs font-medium truncate">{prevLesson.title}</span>
                  </Link>
                ) : (
                  <div />
                )}

                {nextLesson ? (
                  <Link
                    href={`/learn/${courseSlug}/${nextLesson.slug}`}
                    className={cn(
                      "flex items-center gap-2 px-4 py-3 min-w-0",
                      "bg-[#8B1414] dark:bg-[#C0392B] text-white dark:text-black rounded-2xl",
                      "shadow-[0_4px_12px_rgba(139,20,20,0.25)] dark:shadow-none",
                      "hover:bg-[#6E0F0F] dark:hover:bg-[#A93226] hover:scale-[1.01]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1414]/40 focus-visible:ring-offset-2",
                      "transition-all duration-150 max-w-[48%]"
                    )}
                  >
                    <span className="text-xs font-semibold truncate">{nextLesson.title}</span>
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  </Link>
                ) : (
                  <Link
                    href="/my-classes"
                    className={cn(
                      "inline-flex items-center gap-2 px-5 py-3",
                      "bg-[#8B1414] dark:bg-[#C0392B] text-white dark:text-black rounded-2xl",
                      "shadow-[0_4px_12px_rgba(139,20,20,0.25)] dark:shadow-none",
                      "hover:bg-[#6E0F0F] dark:hover:bg-[#A93226] hover:scale-[1.01]",
                      "transition-all duration-150"
                    )}
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-semibold whitespace-nowrap">Kelas Selesai!</span>
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center py-24">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-white dark:bg-white/5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:shadow-none dark:border dark:border-white/[0.05] flex items-center justify-center mx-auto mb-3">
                  <Play className="h-6 w-6 text-gray-300 dark:text-slate-600" />
                </div>
                <p className="text-sm text-gray-400 dark:text-slate-500">
                  Pilih lesson dari sidebar untuk mulai belajar
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
