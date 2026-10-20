"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { MemberMapResponse } from "@growwithai/shared";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { userApi } from "@/lib/api-client";
import { usePageView } from "@/hooks/use-tracking";
import { MapPin, Users, Building2 } from "lucide-react";

// maplibre hanya boleh jalan di browser (static export) — muat client-only
const MemberMapView = dynamic(() => import("@/components/member-map/MemberMapView"), {
  ssr: false,
  loading: () => (
    <div className="skeleton h-[420px] md:h-[560px] w-full rounded-2xl" />
  ),
});

export default function MemberMapPage() {
  usePageView("member_map");

  const [data, setData] = useState<MemberMapResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userApi
      .memberMap()
      .then((res) => {
        if (res.success && res.data) setData(res.data as MemberMapResponse);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const notOnMap = !data?.me.city_code || data.me.map_visibility === "hidden";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Komunitas"
        title="Peta Persebaran User PejuangYen"
        description="Temukan teman baru sesama PejuangYen di dekatmu"
      />

      {!loading && data && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-[#6B7280] dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#8B1414]/[0.06] dark:bg-[#C0392B]/[0.08] text-[#8B1414] dark:text-[#C0392B] font-semibold">
            <Users className="h-3.5 w-3.5" />
            {data.total_members} member di peta
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] font-semibold">
            <Building2 className="h-3.5 w-3.5" />
            {data.cities.length} kota
          </span>
        </div>
      )}

      {!loading && notOnMap && (
        <Card className="border-dashed border-[#8B1414]/30 dark:border-[#C0392B]/30 bg-[#8B1414]/[0.03] dark:bg-[#C0392B]/[0.04]">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#8B1414]/10 dark:bg-[#C0392B]/10">
                <MapPin className="h-4.5 w-4.5 text-[#8B1414] dark:text-[#C0392B]" />
              </span>
              <div>
                <p className="text-sm font-bold text-[#0D0D0D] dark:text-white">Tampilkan dirimu di peta</p>
                <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-0.5">
                  Pilih kotamu dan atur privasi sesuai keinginan — bisa anonim, hanya nama, atau profil lengkap.
                </p>
              </div>
            </div>
            <Link href="/account#peta-member" className="shrink-0">
              <Button size="sm">Atur Lokasi Saya</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="skeleton h-[420px] md:h-[560px] w-full rounded-2xl" />
      ) : (
        <MemberMapView cities={data?.cities || []} />
      )}

      <p className="text-[11px] text-[#9CA3AF] dark:text-slate-500">
        Lokasi member ditampilkan di titik pusat kota, bukan alamat asli. Hanya member yang memilih
        tampil yang muncul di sini — atur kapan saja lewat{" "}
        <Link href="/account#peta-member" className="underline hover:text-[#8B1414] dark:hover:text-[#C0392B]">
          Pengaturan Akun
        </Link>
        .
      </p>
    </div>
  );
}
