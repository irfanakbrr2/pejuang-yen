"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api-client";
import { formatRupiah } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { StatusBadge } from "@/components/ui/AdminTable";
import {
  ArrowLeft, Route, UserPlus, CreditCard, Crown, GraduationCap,
  Activity, MousePointerClick, Video, Award,
} from "lucide-react";

interface JourneyData {
  user: { id: string; name: string; email: string; role: string; phone: string | null; status: string; created_at: string; last_login_at: string | null };
  profile: { role: string | null; primary_goal: string | null; ai_level: string | null; onboarding_completed: number } | null;
  attribution: Record<string, string | null> | null;
  orders: any[];
  memberships: any[];
  enrollments: any[];
  activity: { active_days_30: number; last_active: string | null };
  events: any[];
}

const EVENT_ICON: Record<string, any> = {
  signup_completed: UserPlus,
  login: Activity,
  onboarding_completed: UserPlus,
  page_view: MousePointerClick,
  checkout_intent: CreditCard,
  checkout_started: CreditCard,
  payment_success: CreditCard,
  membership_upgraded: Crown,
  lesson_started: GraduationCap,
  lesson_progress: GraduationCap,
  lesson_completed: GraduationCap,
  course_completed: Award,
  certificate_generated: Award,
  webinar_viewed: Video,
  webinar_registered: Video,
  bonus_viewed: MousePointerClick,
  recording_viewed: Video,
};

function AttrRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm border-b border-gray-50 last:border-0">
      <span className="text-gray-400 text-xs">{label}</span>
      <span className="text-gray-800 font-medium text-xs text-right max-w-[60%] truncate">{value || "—"}</span>
    </div>
  );
}

export default function AdminUserJourneyClient() {
  const pathname = usePathname();
  const userId = pathname.split("/").filter(Boolean)[2] ?? "_";

  const [data, setData] = useState<JourneyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!userId || userId === "_") return;
    api(`/api/admin/users/${userId}/journey`)
      .then((res) => {
        if (res.success) setData(res.data);
        else setError(res.error || "Gagal memuat journey");
      })
      .catch(() => setError("Terjadi kesalahan saat memuat journey"))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return <p className="text-sm text-gray-400 py-16 text-center">Memuat user journey...</p>;
  }
  if (error || !data) {
    return <p className="text-sm text-red-500 py-16 text-center">{error || "Data tidak ditemukan"}</p>;
  }

  const attr = data.attribution;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="User Journey"
        title={<span className="inline-flex items-center gap-2"><Route className="text-[#8B1414]" /> {data.user.name}</span>}
        description={data.user.email}
        actions={
          <Link href={`/admin/users/${data.user.id}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-full px-3 py-1.5">
            <ArrowLeft size={13} /> Detail User
          </Link>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase mb-1">Signup</p>
            <p className="text-sm font-semibold text-gray-900">
              {new Date(data.user.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
            </p>
            <p className="text-xs text-gray-400 mt-1">Sumber: {attr?.signup_source || "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase mb-1">Membership</p>
            <p className="text-sm font-semibold text-gray-900">
              {data.memberships[0]?.plan_name || "Free"}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {data.memberships[0]?.expires_at
                ? `s/d ${new Date(data.memberships[0].expires_at).toLocaleDateString("id-ID")}`
                : data.memberships[0] ? "Lifetime" : "Belum upgrade"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase mb-1">Aktivitas 30 Hari</p>
            <p className="text-sm font-semibold text-gray-900">{data.activity.active_days_30} hari aktif</p>
            <p className="text-xs text-gray-400 mt-1">Terakhir: {data.activity.last_active || "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase mb-1">Status</p>
            <StatusBadge status={data.user.status} />
            <p className="text-xs text-gray-400 mt-1.5">Role: {data.user.role}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Attribution */}
        <Card>
          <CardHeader><CardTitle>Attribution</CardTitle></CardHeader>
          <CardContent>
            {!attr ? (
              <p className="text-sm text-gray-400 py-4 text-center">Belum ada data attribution (user lama / belum tertangkap).</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-bold tracking-wider text-[#8B1414] uppercase mb-1">First Touch</p>
                  <AttrRow label="Source / Medium" value={[attr.first_source, attr.first_medium].filter(Boolean).join(" / ")} />
                  <AttrRow label="Campaign" value={attr.first_campaign} />
                  <AttrRow label="Landing Page" value={attr.first_landing_page} />
                  <AttrRow label="Referrer" value={attr.first_referrer} />
                  <AttrRow label="Affiliate" value={attr.first_affiliate_code} />
                  <AttrRow label="Waktu" value={attr.first_touch_at ? new Date(attr.first_touch_at).toLocaleString("id-ID") : null} />
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-wider text-gray-400 uppercase mb-1">Last Touch</p>
                  <AttrRow label="Source / Medium" value={[attr.last_source, attr.last_medium].filter(Boolean).join(" / ")} />
                  <AttrRow label="Campaign" value={attr.last_campaign} />
                  <AttrRow label="Landing Page" value={attr.last_landing_page} />
                  <AttrRow label="Affiliate" value={attr.last_affiliate_code} />
                </div>
                <div>
                  <p className="text-[10px] font-bold tracking-wider text-amber-600 uppercase mb-1">Upgrade</p>
                  <AttrRow label="Source" value={attr.upgrade_source} />
                  <AttrRow label="Campaign" value={attr.upgrade_campaign} />
                  <AttrRow label="Page" value={attr.upgrade_page} />
                  <AttrRow label="Waktu" value={attr.upgraded_at ? new Date(attr.upgraded_at).toLocaleString("id-ID") : null} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Timeline Event (100 terakhir)</CardTitle></CardHeader>
          <CardContent>
            {data.events.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Belum ada event untuk user ini.</p>
            ) : (
              <ol className="relative border-l border-gray-100 ml-2 space-y-4 max-h-[560px] overflow-y-auto pr-2">
                {data.events.map((evt: any) => {
                  const Icon = EVENT_ICON[evt.event_name] || MousePointerClick;
                  return (
                    <li key={evt.id} className="ml-5">
                      <span className="absolute -left-[9px] flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#8B1414]/10">
                        <Icon size={10} className="text-[#8B1414]" />
                      </span>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-gray-900">{evt.event_name}</p>
                        <p className="text-[11px] text-gray-400 whitespace-nowrap">
                          {new Date(evt.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {[
                          evt.page_url,
                          evt.payment_amount ? formatRupiah(evt.payment_amount) : null,
                          evt.plan_after ? `→ ${evt.plan_after}` : null,
                          evt.utm_source ? `src: ${evt.utm_source}` : null,
                          evt.affiliate_code ? `aff: ${evt.affiliate_code}` : null,
                        ].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Payment history */}
        <Card>
          <CardHeader><CardTitle>Riwayat Pembayaran</CardTitle></CardHeader>
          <CardContent>
            {data.orders.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Belum ada order.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {data.orders.map((order: any) => (
                  <li key={order.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{order.product_name}</p>
                      <p className="text-xs text-gray-400">
                        {order.order_number} · {new Date(order.created_at).toLocaleDateString("id-ID")}
                        {order.affiliate_code ? ` · aff: ${order.affiliate_code}` : ""}
                        {order.coupon_code ? ` · kupon: ${order.coupon_code}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">{formatRupiah(order.amount)}</p>
                      <StatusBadge status={order.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Course progress */}
        <Card>
          <CardHeader><CardTitle>Progress Kelas</CardTitle></CardHeader>
          <CardContent>
            {data.enrollments.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Belum ada enrollment.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {data.enrollments.map((enr: any) => (
                  <li key={enr.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-3 mb-1.5">
                      <p className="text-sm font-medium text-gray-900 truncate">{enr.course_title}</p>
                      <p className="text-xs font-semibold text-gray-700">{enr.progress_percent}%</p>
                    </div>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#8B1414] rounded-full" style={{ width: `${enr.progress_percent}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
