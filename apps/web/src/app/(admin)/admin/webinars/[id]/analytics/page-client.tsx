"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Users, UserCheck, TrendingUp, DollarSign } from "lucide-react";
import { AdminTable, StatusBadge, Td, Tr } from "@/components/ui/AdminTable";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { toast } from "@/components/ui/toast";
import { Pagination } from "@/components/ui/Pagination";

interface WebinarStats {
  total_registered: number;
  free_before: number;
  paid_before: number;
  converted_to_paid: number;
  gate?: {
    free_selected_count: number;
    free_confirmed_count: number;
    paid_selected_count: number;
    paid_confirmed_count: number;
    free_completion_rate: number;
    paid_completion_rate: number;
    dropoff_free_count: number;
    dropoff_paid_count: number;
    paid_registration_revenue: number;
    short_link_registration_count: number;
    short_link_paid_registration_count: number;
    total_short_link_clicks: number;
  };
}

interface Registrant {
  id: string;
  user_name: string;
  user_email: string;
  phone?: string | null;
  coupon_code: string;
  affiliate_code?: string | null;
  registered_at: string;
  membership_status_at_registration?: string | null;
  after_conversion_status?: string | null;
}

export default function WebinarAnalyticsPage() {
  const pathname = usePathname();
  const id = pathname.split('/').filter(Boolean)[2];
  const router = useRouter();
  
  const [stats, setStats] = useState<WebinarStats | null>(null);
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, regsRes] = await Promise.all([
        fetch(`/api/admin/webinars/${id}/analytics`, { credentials: "include" }),
        fetch(`/api/admin/webinars/${id}/analytics/registrants?page=${page}&limit=25`, { credentials: "include" })
      ]);
      
      const statsData = await statsRes.json();
      const regsData = await regsRes.json();
      
      if (statsData.success) {
        setStats(statsData.data);
      } else {
        toast.error("Gagal memuat statistik");
      }
      
      if (regsData.success) {
        setRegistrants(regsData.data || []);
        setTotalPages(regsData.pagination?.totalPages || 1);
      } else {
        toast.error("Gagal memuat pendaftar");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan saat memuat analitik");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, page]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(12,12,10,0.12)] bg-white text-warm-black transition-colors hover:bg-warm-cream"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <PageHeader
          eyebrow="Analitik"
          title="Webinar Analytics"
          description="Lacak pendaftaran dan konversi peserta webinar menjadi paid member (dalam 3 hari)."
        />
      </div>

      {loading && !stats ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 rounded-xl bg-gray-100" />
            ))}
          </div>
          <div className="h-[400px] rounded-xl bg-gray-100" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1 rounded-xl border border-[rgba(12,12,10,0.12)] bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                <Users className="h-4 w-4" />
                Total Pendaftar
              </div>
              <p className="text-3xl font-bold text-warm-black">{stats?.total_registered || 0}</p>
            </div>
            
            <div className="flex flex-col gap-1 rounded-xl border border-[rgba(12,12,10,0.12)] bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                <UserCheck className="h-4 w-4" />
                Member Aktif (Sebelum)
              </div>
              <p className="text-3xl font-bold text-warm-black">{stats?.paid_before || 0}</p>
            </div>
            
            <div className="flex flex-col gap-1 rounded-xl border border-[rgba(12,12,10,0.12)] bg-white p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                <Users className="h-4 w-4 text-gray-400" />
                Free / Expired (Sebelum)
              </div>
              <p className="text-3xl font-bold text-warm-black">{stats?.free_before || 0}</p>
            </div>
            
            <div className="flex flex-col gap-1 rounded-xl border border-[rgba(12,12,10,0.12)] bg-emerald-50 p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-[#8B1414]">
                <TrendingUp className="h-4 w-4" />
                Converted (3 Hari)
              </div>
              <p className="text-3xl font-bold text-[#8B1414]">{stats?.converted_to_paid || 0}</p>
              <p className="text-xs text-[#8B1414] opacity-80 mt-1">
                {(stats?.free_before || 0) > 0 
                  ? `${Math.round(((stats?.converted_to_paid || 0) / (stats?.free_before || 1)) * 100)}% Conversion Rate`
                  : '0% Conversion Rate'}
              </p>
            </div>
          </div>

          {stats?.gate && (stats.gate.free_selected_count > 0 || stats.gate.paid_selected_count > 0 || stats.gate.total_short_link_clicks > 0) && (
            <div className="rounded-xl border border-[rgba(12,12,10,0.12)] bg-white overflow-hidden p-5">
              <h3 className="font-semibold text-warm-black mb-4">Registration Gate (2-Step) Funnel</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1 border-r border-[rgba(12,12,10,0.08)] pr-4">
                  <div className="text-sm font-medium text-gray-500">Shortlink Clicks</div>
                  <p className="text-2xl font-bold text-warm-black">{stats.gate.total_short_link_clicks}</p>
                </div>
                <div className="flex flex-col gap-1 border-r border-[rgba(12,12,10,0.08)] px-4">
                  <div className="text-sm font-medium text-gray-500">Opsi Gratis Dipilih</div>
                  <p className="text-2xl font-bold text-warm-black">{stats.gate.free_selected_count}</p>
                  <p className="text-xs text-gray-500 mt-1">{stats.gate.free_confirmed_count} Selesai ({Math.round(stats.gate.free_completion_rate * 100)}%)</p>
                  {stats.gate.dropoff_free_count > 0 && <p className="text-xs text-red-500">{stats.gate.dropoff_free_count} Dropoff</p>}
                </div>
                <div className="flex flex-col gap-1 border-r border-[rgba(12,12,10,0.08)] px-4">
                  <div className="text-sm font-medium text-gray-500">Opsi Bayar Dipilih</div>
                  <p className="text-2xl font-bold text-warm-black">{stats.gate.paid_selected_count}</p>
                  <p className="text-xs text-gray-500 mt-1">{stats.gate.paid_confirmed_count} Selesai ({Math.round(stats.gate.paid_completion_rate * 100)}%)</p>
                  {stats.gate.dropoff_paid_count > 0 && <p className="text-xs text-red-500">{stats.gate.dropoff_paid_count} Dropoff</p>}
                </div>
                <div className="flex flex-col gap-1 pl-4">
                  <div className="text-sm font-medium text-emerald-600">Pendapatan Pendaftaran</div>
                  <p className="text-2xl font-bold text-emerald-600">Rp {stats.gate.paid_registration_revenue.toLocaleString('id-ID')}</p>
                  <p className="text-xs text-gray-500 mt-1">Hanya dari bayar webinar</p>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-[rgba(12,12,10,0.12)] bg-white overflow-hidden">
            <div className="p-5 border-b border-[rgba(12,12,10,0.08)]">
              <h3 className="font-semibold text-warm-black">Detail Peserta & Konversi</h3>
              <p className="text-sm text-gray-500 mt-1">Daftar peserta webinar beserta status membership sebelum dan setelah mengikuti webinar.</p>
            </div>
            <AdminTable
              columns={[
                { key: "name", label: "Peserta" },
                { key: "date", label: "Waktu Daftar" },
                { key: "before", label: "Status Sebelum" },
                { key: "after", label: "Status Setelah (3 Hari)" },
              ]}
              loading={loading}
              empty={<div className="py-10 text-center text-sm text-gray-500">Belum ada data pendaftar</div>}
            >
              {registrants.map((reg) => (
                <Tr key={reg.id}>
                  <Td>
                    <p className="font-semibold text-warm-black">{reg.user_name}</p>
                    <p className="text-sm text-gray-500">{reg.user_email}</p>
                    {reg.phone && <p className="text-xs text-gray-400 mt-0.5">{reg.phone}</p>}
                  </Td>
                  <Td>
                    <p className="text-sm">{new Date(reg.registered_at).toLocaleString("id-ID")}</p>
                  </Td>
                  <Td>
                    {reg.membership_status_at_registration === 'active' ? (
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                        Paid Member
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                        {reg.membership_status_at_registration || 'Free User'}
                      </span>
                    )}
                  </Td>
                  <Td>
                    {reg.after_conversion_status === 'paid' ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                        <TrendingUp className="h-3 w-3" />
                        Converted
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">Tidak Berubah</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </AdminTable>
            
            {totalPages > 1 && (
              <div className="p-4 border-t border-[rgba(12,12,10,0.08)]">
                <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
