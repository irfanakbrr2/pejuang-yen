"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminTable, Tr, Td } from "@/components/ui/AdminTable";
import {
  AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";
import {
  Activity, GraduationCap, Award, PlayCircle, Gift, Video, FileText,
  Globe, Smartphone, Flame, MessageSquare,
} from "lucide-react";
import { StatCard, SERIES_COLORS } from "./shared";

interface LearningEvent {
  event_name: string;
  count: number;
  unique_users: number;
}
interface GeoRow { country: string; events: number }
interface DeviceRow { device_type: string; count: number }
interface StreakBucket { bucket: string; users: number }
interface BadgeRow { badge_key: string; count: number }
interface ContributorRow { user_id: string; name: string | null; posts: number; comments: number; total: number }

interface EngagementData {
  active_trend: { activity_date: string; active_users: number }[];
  learning_events: LearningEvent[];
  top_courses: { course_id: string | null; course_title: string | null; completions: number; users: number }[];
  top_landing_pages: { landing_page: string; views: number }[];
  geo: GeoRow[];
  devices: DeviceRow[];
  gamification: {
    checkins: number;
    streak_distribution: StreakBucket[];
    top_badges: BadgeRow[];
  };
  community: {
    posts: number;
    comments: number;
    likes: number;
    top_contributors: ContributorRow[];
  };
}

const fmt = (n: number | undefined | null) => (n ?? 0).toLocaleString("id-ID");

const STREAK_LABELS: Record<string, string> = {
  "0": "Tidak ada (0)",
  "1-6": "1-6 hari",
  "7-29": "7-29 hari",
  "30+": "30+ hari",
};

const BADGE_LABELS: Record<string, string> = {
  beginner: "Beginner",
  course_graduate: "Course Graduate",
  consistent_7: "Consistent 7",
  consistent_30: "Consistent 30",
  champion: "Champion",
};

export function EngagementTab({ days }: { days: string }) {
  const [data, setData] = useState<EngagementData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api(`/api/admin/analytics/engagement?days=${days}`)
      .then((res) => { if (res.success) setData(res.data as EngagementData); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  const ev = (name: string) => data?.learning_events.find((e) => e.event_name === name)?.count ?? 0;

  const trend = (data?.active_trend || []).map((r) => ({
    label: new Date(r.activity_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
    active_users: Number(r.active_users) || 0,
  }));

  const geo = data?.geo || [];
  const devices = data?.devices || [];
  const deviceDonut = devices.map((d) => ({ name: d.device_type, count: Number(d.count) || 0 }));
  const gam = data?.gamification;
  const streakDist = gam?.streak_distribution || [];
  const maxStreakUsers = Math.max(1, ...streakDist.map((b) => Number(b.users) || 0));
  const topBadges = gam?.top_badges || [];
  const community = data?.community;
  const contributors = community?.top_contributors || [];

  return (
    <div className="space-y-6">
      {/* KPI dari learning_events */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Page Views" value={fmt(ev("page_view"))} hint={`${days} hari`} icon={FileText} accent />
        <StatCard label="Lesson Dimulai" value={fmt(ev("lesson_started"))} hint={`${days} hari`} icon={PlayCircle} />
        <StatCard label="Lesson Selesai" value={fmt(ev("lesson_completed"))} hint={`${days} hari`} icon={GraduationCap} />
        <StatCard label="Kelas Selesai" value={fmt(ev("course_completed"))} hint={`${days} hari`} icon={Award} accent />
        <StatCard label="Bonus Dilihat" value={fmt(ev("bonus_viewed"))} hint={`${days} hari`} icon={Gift} />
        <StatCard label="Rekaman Ditonton" value={fmt(ev("recording_viewed"))} hint={`${days} hari`} icon={Video} />
      </div>

      {/* Tren active users harian */}
      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <Activity size={16} className="text-[#8B1414]" /> Active Users Harian
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trend.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">
              {loading ? "Memuat data..." : "Belum ada data aktivitas pada periode ini."}
            </p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="eng-au" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8B1414" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#8B1414" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="active_users" name="Active Users" stroke="#8B1414" fill="url(#eng-au)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top kelas berdasarkan penyelesaian lesson */}
        <Card>
          <CardHeader><CardTitle>Top Kelas (lesson selesai)</CardTitle></CardHeader>
          <CardContent>
            <AdminTable
              columns={[
                { key: "course", label: "Kelas" },
                { key: "completions", label: "Lesson Selesai" },
                { key: "users", label: "User", className: "text-right" },
              ]}
              loading={loading}
              empty={<p className="text-sm text-gray-400 py-6 text-center">Belum ada penyelesaian lesson pada periode ini.</p>}
            >
              {(data?.top_courses || []).map((row, i) => (
                <Tr key={`${row.course_id ?? "unknown"}-${i}`}>
                  <Td className="font-medium max-w-[260px] truncate">{row.course_title || "(tanpa judul)"}</Td>
                  <Td>{fmt(row.completions)}</Td>
                  <Td className="text-right">{fmt(row.users)}</Td>
                </Tr>
              ))}
            </AdminTable>
          </CardContent>
        </Card>

        {/* Top landing pages */}
        <Card>
          <CardHeader><CardTitle>Top Landing Pages</CardTitle></CardHeader>
          <CardContent>
            <AdminTable
              columns={[
                { key: "page", label: "Halaman" },
                { key: "views", label: "Views", className: "text-right" },
              ]}
              loading={loading}
              empty={<p className="text-sm text-gray-400 py-6 text-center">Belum ada page view pada periode ini.</p>}
            >
              {(data?.top_landing_pages || []).map((row, i) => (
                <Tr key={`${row.landing_page}-${i}`}>
                  <Td className="max-w-[280px] truncate text-sm text-gray-700">{row.landing_page}</Td>
                  <Td className="text-right font-semibold">{fmt(row.views)}</Td>
                </Tr>
              ))}
            </AdminTable>
          </CardContent>
        </Card>
      </div>

      {/* ─── Geo + Device ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Geo: page views per negara */}
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <Globe size={16} className="text-[#8B1414]" /> Page Views per Negara
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AdminTable
              columns={[
                { key: "country", label: "Negara" },
                { key: "events", label: "Page Views", className: "text-right" },
              ]}
              loading={loading}
              empty={<p className="text-sm text-gray-400 py-6 text-center">Belum ada data geo pada periode ini.</p>}
            >
              {geo.map((row, i) => (
                <Tr key={`${row.country}-${i}`}>
                  <Td className="font-medium max-w-[220px] truncate">{row.country}</Td>
                  <Td className="text-right font-semibold tabular-nums">{fmt(row.events)}</Td>
                </Tr>
              ))}
            </AdminTable>
          </CardContent>
        </Card>

        {/* Device donut */}
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <Smartphone size={16} className="text-[#8B1414]" /> Perangkat
            </CardTitle>
          </CardHeader>
          <CardContent>
            {deviceDonut.length === 0 ? (
              <p className="text-sm text-gray-400 py-10 text-center">
                {loading ? "Memuat..." : "Belum ada data perangkat pada periode ini."}
              </p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={deviceDonut} dataKey="count" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2}>
                      {deviceDonut.map((entry, i) => (
                        <Cell key={entry.name} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => fmt(Number(value))} />
                    <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Gamification + Community ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gamification */}
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <Flame size={16} className="text-[#8B1414]" /> Gamifikasi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl bg-[#8B1414]/5 border border-[#8B1414]/10 p-4">
              <p className="text-[10px] font-bold tracking-wider uppercase text-[#8B1414]">Daily Check-in</p>
              <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{fmt(gam?.checkins)}</p>
              <p className="text-xs text-gray-400 mt-1">{days} hari terakhir</p>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Distribusi Streak (semua user)</p>
              {streakDist.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">{loading ? "Memuat..." : "Belum ada data streak."}</p>
              ) : (
                <ul className="space-y-2">
                  {streakDist.map((b) => {
                    const users = Number(b.users) || 0;
                    const pct = Math.round((users / maxStreakUsers) * 100);
                    return (
                      <li key={b.bucket}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-600">{STREAK_LABELS[b.bucket] || b.bucket}</span>
                          <span className="font-semibold text-gray-900 tabular-nums">{fmt(users)}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full bg-[#8B1414]" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Top Badge</p>
              {topBadges.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">{loading ? "Memuat..." : "Belum ada badge."}</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {topBadges.map((b, i) => (
                    <li key={`${b.badge_key}-${i}`} className="flex items-center justify-between py-2 text-sm">
                      <span className="inline-flex items-center gap-2 text-gray-700">
                        <Award size={14} className="text-[#D97706]" />
                        {BADGE_LABELS[b.badge_key] || b.badge_key}
                      </span>
                      <span className="font-semibold text-gray-900 tabular-nums">{fmt(b.count)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Community */}
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <MessageSquare size={16} className="text-[#8B1414]" /> Komunitas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-[rgba(0,0,0,0.07)] p-3 text-center">
                <p className="text-[10px] font-bold tracking-wider uppercase text-gray-400">Postingan</p>
                <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">{fmt(community?.posts)}</p>
              </div>
              <div className="rounded-xl border border-[rgba(0,0,0,0.07)] p-3 text-center">
                <p className="text-[10px] font-bold tracking-wider uppercase text-gray-400">Komentar</p>
                <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">{fmt(community?.comments)}</p>
              </div>
              <div className="rounded-xl border border-[rgba(0,0,0,0.07)] p-3 text-center">
                <p className="text-[10px] font-bold tracking-wider uppercase text-gray-400">Likes</p>
                <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">{fmt(community?.likes)}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2">Top Kontributor ({days} hari)</p>
              <AdminTable
                columns={[
                  { key: "name", label: "User" },
                  { key: "posts", label: "Post", className: "text-right" },
                  { key: "comments", label: "Komentar", className: "text-right" },
                  { key: "total", label: "Total", className: "text-right" },
                ]}
                loading={loading}
                empty={<p className="text-sm text-gray-400 py-6 text-center">Belum ada aktivitas komunitas pada periode ini.</p>}
              >
                {contributors.map((row, i) => (
                  <Tr key={`${row.user_id}-${i}`}>
                    <Td className="font-medium max-w-[180px] truncate">{row.name || "(tanpa nama)"}</Td>
                    <Td className="text-right tabular-nums">{fmt(row.posts)}</Td>
                    <Td className="text-right tabular-nums">{fmt(row.comments)}</Td>
                    <Td className="text-right font-semibold tabular-nums">{fmt(row.total)}</Td>
                  </Tr>
                ))}
              </AdminTable>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
