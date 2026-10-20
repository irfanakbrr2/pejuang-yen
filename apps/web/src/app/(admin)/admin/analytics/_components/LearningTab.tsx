"use client";


import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminTable, Tr, Td } from "@/components/ui/AdminTable";

interface CourseStat {
  id: string;
  title: string;
  enrollments: number;
  avg_progress: number | null;
  completed: number;
  in_progress: number;
  not_started: number;
}

interface AtRiskUser {
  id: string;
  name: string;
  email: string;
  progress_percent: number;
  course_title: string;
  paid_at: string;
}

interface EngagedUser {
  id: string;
  name: string;
  email: string;
  active_days_30: number;
  last_active: string;
}

interface LessonDropoff {
  course_id: string;
  course_title: string;
  lesson_id: string;
  lesson_title: string;
  lesson_order: number;
  avg_watch_percent: number | null;
  viewers: number;
}

const fmtInt = (n: number) => Number(n || 0).toLocaleString("id-ID");

export function LearningTab() {
  const [courses, setCourses] = useState<CourseStat[]>([]);
  const [atRisk, setAtRisk] = useState<AtRiskUser[]>([]);
  const [engaged, setEngaged] = useState<EngagedUser[]>([]);
  const [dropoff, setDropoff] = useState<LessonDropoff[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/api/admin/analytics/learning")
      .then((res) => {
        if (res.success) {
          setCourses(res.data.courses || []);
          setAtRisk(res.data.low_progress_paid_users || []);
          setEngaged(res.data.top_engaged_users || []);
          setDropoff(res.data.lesson_dropoff || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Daftar kelas unik yang punya data drop-off, untuk selector.
  const dropoffCourses = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of dropoff) {
      if (!seen.has(row.course_id)) seen.set(row.course_id, row.course_title);
    }
    return Array.from(seen, ([id, title]) => ({ id, title }));
  }, [dropoff]);

  // Pilih kelas pertama secara default setelah data masuk.
  useEffect(() => {
    if (!selectedCourse && dropoffCourses.length > 0) {
      setSelectedCourse(dropoffCourses[0].id);
    }
  }, [dropoffCourses, selectedCourse]);

  // Lesson dari kelas terpilih, urut sesuai lesson_order (sort_order).
  const selectedLessons = useMemo(
    () =>
      dropoff
        .filter((r) => r.course_id === selectedCourse)
        .sort((a, b) => a.lesson_order - b.lesson_order),
    [dropoff, selectedCourse]
  );

  // Titik drop terbesar = lesson dengan avg_watch_percent terendah (yang punya viewer).
  const worstLessonId = useMemo(() => {
    let worst: { id: string; pct: number } | null = null;
    for (const r of selectedLessons) {
      if (r.viewers <= 0) continue;
      const pct = r.avg_watch_percent ?? 0;
      if (worst === null || pct < worst.pct) worst = { id: r.lesson_id, pct };
    }
    return worst?.id ?? null;
  }, [selectedLessons]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Completion per Kelas</CardTitle></CardHeader>
        <CardContent>
          <AdminTable
            columns={[
              { key: "course", label: "Kelas" },
              { key: "enrollments", label: "Enrollments" },
              { key: "avg", label: "Rata-rata Progress" },
              { key: "completed", label: "Selesai" },
              { key: "in_progress", label: "Berjalan" },
              { key: "not_started", label: "Belum Mulai" },
              { key: "rate", label: "Completion Rate", className: "text-right" },
            ]}
            loading={loading}
            empty={<p className="text-sm text-gray-400 py-6 text-center">Belum ada data enrollment.</p>}
          >
            {courses.map((row) => {
              const rate = row.enrollments > 0 ? Math.round((row.completed / row.enrollments) * 100) : 0;
              return (
                <Tr key={row.id}>
                  <Td className="font-medium max-w-[260px] truncate">{row.title}</Td>
                  <Td>{fmtInt(row.enrollments)}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#8B1414] rounded-full" style={{ width: `${row.avg_progress || 0}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{row.avg_progress || 0}%</span>
                    </div>
                  </Td>
                  <Td>{fmtInt(row.completed)}</Td>
                  <Td>{fmtInt(row.in_progress)}</Td>
                  <Td>{fmtInt(row.not_started)}</Td>
                  <Td className="text-right font-semibold">{rate}%</Td>
                </Tr>
              );
            })}
          </AdminTable>
        </CardContent>
      </Card>

      {/* ── Drop-off Video per Lesson ───────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Drop-off Video per Lesson</CardTitle>
              <p className="text-xs text-gray-400 mt-1">
                Rata-rata persentase tontonan tiap lesson. Makin rendah = makin banyak yang berhenti di sana.
              </p>
            </div>
            {dropoffCourses.length > 0 && (
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-[#8B1414] focus:outline-none focus:ring-1 focus:ring-[#8B1414] cursor-pointer"
              >
                {dropoffCourses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-400 py-6 text-center">Memuat...</p>
          ) : selectedLessons.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">Belum ada data tontonan untuk kelas ini.</p>
          ) : (
            <ul className="space-y-3">
              {selectedLessons.map((row, i) => {
                const pct = row.avg_watch_percent ?? 0;
                const isWorst = row.lesson_id === worstLessonId;
                return (
                  <li key={row.lesson_id} className="flex items-center gap-3">
                    <span className="w-6 shrink-0 text-right text-xs tabular-nums text-gray-400">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="truncate text-sm text-gray-700">{row.lesson_title}</span>
                        <span className={`shrink-0 text-xs font-semibold tabular-nums ${isWorst ? "text-[#DC2626]" : "text-gray-900"}`}>
                          {pct}%
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${isWorst ? "bg-[#DC2626]" : "bg-[#8B1414]"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-400">
                        <span>{fmtInt(row.viewers)} penonton</span>
                        {isWorst && row.viewers > 0 && (
                          <span className="font-medium text-[#DC2626]">• drop-off terbesar</span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Paid User Macet (progress &lt; 20%)</CardTitle></CardHeader>
          <CardContent>
            <AdminTable
              columns={[
                { key: "user", label: "User" },
                { key: "course", label: "Kelas" },
                { key: "progress", label: "Progress", className: "text-right" },
              ]}
              loading={loading}
              empty={<p className="text-sm text-gray-400 py-6 text-center">Tidak ada paid user yang macet. 🎉</p>}
            >
              {atRisk.map((row, i) => (
                <Tr key={`${row.id}-${i}`}>
                  <Td>
                    <Link href={`/admin/users/${row.id}`} className="text-[#8B1414] hover:underline font-medium text-sm">
                      {row.name}
                    </Link>
                    <p className="text-xs text-gray-400">{row.email}</p>
                  </Td>
                  <Td className="text-xs max-w-[160px] truncate">{row.course_title}</Td>
                  <Td className="text-right font-semibold">{row.progress_percent}%</Td>
                </Tr>
              ))}
            </AdminTable>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>User Paling Aktif (30 hari)</CardTitle></CardHeader>
          <CardContent>
            <AdminTable
              columns={[
                { key: "user", label: "User" },
                { key: "days", label: "Hari Aktif" },
                { key: "last", label: "Terakhir Aktif", className: "text-right" },
              ]}
              loading={loading}
              empty={<p className="text-sm text-gray-400 py-6 text-center">Belum ada data aktivitas.</p>}
            >
              {engaged.map((row) => (
                <Tr key={row.id}>
                  <Td>
                    <Link href={`/admin/users/${row.id}`} className="text-[#8B1414] hover:underline font-medium text-sm">
                      {row.name}
                    </Link>
                    <p className="text-xs text-gray-400">{row.email}</p>
                  </Td>
                  <Td className="font-semibold">{fmtInt(row.active_days_30)}</Td>
                  <Td className="text-right text-xs text-gray-500">{row.last_active}</Td>
                </Tr>
              ))}
            </AdminTable>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
