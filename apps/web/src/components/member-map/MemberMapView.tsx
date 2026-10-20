"use client";

import { useEffect, useMemo, useState } from "react";
import type { MemberMapCity, MemberMapMember, MemberMapCityMembersResponse } from "@growwithai/shared";
import { Map, MapClusterLayer, MapPopup, MapControls, useMap } from "@/components/ui/map";
import { userApi } from "@/lib/api-client";
import { Crown, Users, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

const MEMBERS_PER_PAGE = 12;

// Tiap member = 1 titik di koordinat pusat kotanya. maplibre meng-cluster titik yang
// berdekatan → angka cluster = jumlah member; kota yang berdekatan menyatu saat zoom jauh.
const MAX_FEATURES_PER_CITY = 500;

// Palet pastel (bukan hijau/oranye/merah) untuk step jumlah member; teks angka gelap agar terbaca.
const CLUSTER_COLORS: [string, string, string] = ["#BAE6FD", "#DDD6FE", "#FBCFE8"]; // sky / lavender / pink
const CLUSTER_THRESHOLDS: [number, number] = [10, 50];
const CLUSTER_TEXT_COLOR = "#334155"; // slate-700
const POINT_COLOR = "#7DD3FC"; // sky-300 untuk titik tunggal

const LEGEND: { color: string; label: string }[] = [
  { color: CLUSTER_COLORS[0], label: "1–9" },
  { color: CLUSTER_COLORS[1], label: "10–49" },
  { color: CLUSTER_COLORS[2], label: "50+" },
];

interface CityPointProps {
  c: string;
}

function buildFeatureCollection(
  cities: MemberMapCity[]
): GeoJSON.FeatureCollection<GeoJSON.Point, CityPointProps> {
  const features: GeoJSON.Feature<GeoJSON.Point, CityPointProps>[] = [];
  for (const city of cities) {
    const n = Math.min(city.count, MAX_FEATURES_PER_CITY);
    for (let i = 0; i < n; i++) {
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [city.lng, city.lat] },
        properties: { c: city.code },
      });
    }
  }
  return { type: "FeatureCollection", features };
}

function avatarSrc(member: { name: string; avatar_url?: string | null }): string {
  return (
    member.avatar_url ||
    `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(member.name)}`
  );
}

function MemberRow({ member }: { member: MemberMapMember }) {
  return (
    <li className="flex items-start gap-3 px-4 py-2.5">
      <span
        className={`relative shrink-0 rounded-full p-[2px] ${
          member.tier === "premium"
            ? "bg-gradient-to-br from-amber-300 via-amber-500 to-yellow-600"
            : "bg-emerald-500"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={avatarSrc(member)}
          alt={member.name}
          className="h-10 w-10 rounded-full bg-white object-cover"
          loading="lazy"
        />
        {member.tier === "premium" && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 shadow-sm">
            <Crown className="h-2.5 w-2.5 text-white" />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1 flex flex-col gap-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-[#0D0D0D] leading-snug line-clamp-2">
            {member.name}
          </span>
          <span
            className={`shrink-0 inline-flex items-center px-1.5 py-px rounded text-[9px] font-bold tracking-wide uppercase ${
              member.tier === "premium"
                ? "bg-amber-50 text-amber-700 border border-amber-200"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
            }`}
          >
            {member.tier === "premium" ? "Premium" : "Free"}
          </span>
        </span>
        {member.bio && (
          <span className="text-[11px] text-[#6B7280] leading-snug line-clamp-2">{member.bio}</span>
        )}
      </span>
    </li>
  );
}

function CityPopup({ city, onClose }: { city: MemberMapCity; onClose: () => void }) {
  const [members, setMembers] = useState<MemberMapMember[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    userApi
      .memberMapCity(city.code, page)
      .then((res) => {
        if (!active) return;
        if (res.success && res.data) {
          const d = res.data as MemberMapCityMembersResponse;
          setMembers(d.members);
          setTotal(d.total);
        }
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [city.code, page]);

  const totalPages = Math.max(1, Math.ceil(total / MEMBERS_PER_PAGE));
  const changePage = (next: number) => {
    setLoading(true);
    setPage(next);
  };
  const anonCount = Math.max(0, city.count - total); // member anonim (tak masuk daftar)

  return (
    <MapPopup
      key={city.code}
      longitude={city.lng}
      latitude={city.lat}
      onClose={onClose}
      closeOnClick={false}
      focusAfterOpen={false}
      closeButton
      offset={20}
      // Netralkan box pembungkus bawaan MapPopup (max-w-62 + border + padding + shadow)
      // agar card detail di dalam tampil dengan ukuran penuh, tidak terpotong box luar.
      className="max-w-none border-0 bg-transparent p-0 shadow-none rounded-none"
    >
      <div className="w-[320px] max-w-[82vw] rounded-2xl border border-black/[0.08] bg-white shadow-xl overflow-hidden">
        <div className="px-4 py-3 pr-9 border-b border-black/[0.05] bg-gradient-to-r from-[#8B1414]/[0.08] to-transparent">
          <p className="text-sm font-bold text-[#0D0D0D] leading-tight">{city.name}</p>
          <p className="text-[11px] text-[#6B7280] mt-0.5 flex items-center gap-1">
            <Users className="h-3 w-3 shrink-0" />
            {city.count} member · {city.province}
          </p>
        </div>

        {loading && members.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-[#9CA3AF]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat member…
          </div>
        ) : total === 0 ? (
          <p className="px-4 py-4 text-xs text-[#6B7280]">
            {city.count} member belajar dari kota ini (memilih tampil anonim).
          </p>
        ) : (
          <>
            <ul className={`max-h-64 overflow-y-auto divide-y divide-black/[0.04] ${loading ? "opacity-60" : ""}`}>
              {members.map((member, i) => (
                <MemberRow key={`${member.name}-${i}`} member={member} />
              ))}
            </ul>

            {totalPages > 1 && (
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-black/[0.05]">
                <button
                  type="button"
                  disabled={loading || page <= 1}
                  onClick={() => changePage(Math.max(1, page - 1))}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-[#374151] enabled:hover:bg-black/[0.04] disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </button>
                <span className="text-[11px] text-[#6B7280]">
                  Halaman {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={loading || page >= totalPages}
                  onClick={() => changePage(Math.min(totalPages, page + 1))}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-[#374151] enabled:hover:bg-black/[0.04] disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {anonCount > 0 && (
              <p className="px-4 py-2 text-[11px] text-[#9CA3AF] border-t border-black/[0.04]">
                +{anonCount} member anonim
              </p>
            )}
          </>
        )}
      </div>
    </MapPopup>
  );
}

function MapLegend() {
  return (
    <div className="absolute bottom-3 left-3 z-[1] rounded-xl border border-black/[0.06] bg-white/90 backdrop-blur px-3 py-2 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7280] mb-1.5">Jumlah member</p>
      <div className="flex items-center gap-2.5">
        {LEGEND.map((l) => (
          <span key={l.label} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-full ring-1 ring-white shadow-sm" style={{ backgroundColor: l.color }} />
            <span className="text-[10px] text-[#374151]">{l.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ClusterLayerWithPopup({ cities }: { cities: MemberMapCity[] }) {
  const { map } = useMap();
  const [selected, setSelected] = useState<MemberMapCity | null>(null);

  const fc = useMemo(() => buildFeatureCollection(cities), [cities]);
  const cityByCode = useMemo(
    () => Object.fromEntries(cities.map((c) => [c.code, c])),
    [cities]
  );

  // Titik satu kota berbagi koordinat persis; cluster satu-kota berpusat tepat di kota itu.
  const openCityAt = (coordinates: [number, number]) => {
    const EPSILON = 1e-4;
    const match = cities.find(
      (c) =>
        Math.abs(c.lng - coordinates[0]) < EPSILON &&
        Math.abs(c.lat - coordinates[1]) < EPSILON
    );
    if (match) {
      setSelected(match);
      return true;
    }
    return false;
  };

  return (
    <>
      <MapClusterLayer<CityPointProps>
        data={fc}
        clusterRadius={45}
        // Anggota satu kota berkoordinat identik → biarkan selalu menyatu jadi cluster
        // berangka di zoom berapa pun, supaya tidak pernah bertumpuk/overlap.
        clusterMaxZoom={24}
        clusterColors={CLUSTER_COLORS}
        clusterThresholds={CLUSTER_THRESHOLDS}
        clusterTextColor={CLUSTER_TEXT_COLOR}
        pointColor={POINT_COLOR}
        onPointClick={(feature, coordinates) => {
          const city = cityByCode[feature.properties?.c as string];
          if (city) setSelected(city);
          else openCityAt(coordinates);
        }}
        onClusterClick={(_clusterId, coordinates) => {
          // Cluster satu kota → buka popup; cluster lintas kota → zoom mendekat
          if (!openCityAt(coordinates) && map) {
            map.flyTo({ center: coordinates, zoom: Math.min(map.getZoom() + 2.5, 11) });
          }
        }}
      />
      {selected && <CityPopup key={selected.code} city={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

export default function MemberMapView({ cities }: { cities: MemberMapCity[] }) {
  return (
    <div className="relative h-[420px] md:h-[560px] w-full overflow-hidden rounded-2xl border border-black/[0.06]">
      <Map center={[118, -2.5]} zoom={4} fadeDuration={0} attributionControl={false}>
        <ClusterLayerWithPopup cities={cities} />
        <MapControls />
      </Map>
      <MapLegend />
    </div>
  );
}
