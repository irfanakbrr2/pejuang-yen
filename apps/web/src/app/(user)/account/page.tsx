"use client";
/* eslint-disable react-hooks/purity */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/toast";
import { userApi, invalidateCache } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { Star, Calendar, Zap, ShieldAlert, MapPin } from "lucide-react";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { DicebearCustomizer } from "@/components/ui/dicebear-customizer";
import { CityCombobox } from "@/components/member-map/CityCombobox";

type MapVisibility = "hidden" | "anonymous" | "name" | "full";

const VISIBILITY_OPTIONS: { value: MapVisibility; label: string; description: string }[] = [
  { value: "hidden", label: "Sembunyikan saya", description: "Tidak tampil di peta sama sekali (default)" },
  { value: "anonymous", label: "Anonim", description: "Hanya dihitung di titik kota, tanpa identitas" },
  { value: "name", label: "Nama & avatar", description: "Nama dan avatar kamu tampil di popup kota" },
  { value: "full", label: "Profil lengkap", description: "Nama, avatar, dan deskripsi tentang saya ikut tampil" },
];

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  role: string;
}

interface Membership {
  id: string;
  status: string;
  starts_at: string;
  expires_at?: string;
  plan_name: string;
  duration_type: string;
  plan_slug: string;
}

const inputClass =
  "w-full px-3.5 py-2.5 text-sm rounded-xl border border-black/[0.08] dark:border-white/[0.08] text-[#0D0D0D] dark:text-white placeholder:text-[#9CA3AF] dark:placeholder:text-slate-500 outline-none focus:bg-white/80 dark:focus:bg-white/5 focus:border-[#8B1414]/40 dark:focus:border-[#C0392B]/40 focus:ring-2 focus:ring-[#8B1414]/10 dark:focus:ring-[#C0392B]/10 transition-all duration-150";

export default function AccountPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [bio, setBio] = useState("");
  const [cityCode, setCityCode] = useState<string | null>(null);
  const [mapVisibility, setMapVisibility] = useState<MapVisibility>("hidden");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [membership, setMembership] = useState<Membership | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/auth/me`, { credentials: "include" })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            setUser(data.data.user);
            setName(data.data.user.name);
            setPhone(data.data.user.phone || "");
            setAvatarUrl(data.data.user.avatar_url || "");
          }
        }),
      userApi.profile()
        .then((res) => {
          if (res.success && res.data) {
            setBio(res.data.bio || "");
            setCityCode(res.data.city_code || null);
            setMapVisibility((res.data.map_visibility as MapVisibility) || "hidden");
          }
        }),
      userApi.membership()
        .then((res) => {
          if (res.success) {
            setMembership(res.data);
          }
        })
    ])
      .catch(() => {})
      .finally(() => setInitialLoading(false));
  }, []);

  const saveProfile = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/user/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.success) invalidateCache("/api/user");
    return data;
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      const data = await saveProfile({ name, phone, avatar_url: avatarUrl || undefined, bio: bio.trim() || null });
      if (data.success) toast.success("Profil berhasil diperbarui");
      else toast.error(data.error || "Gagal memperbarui profil");
    } catch {
      toast.error("Terjadi kesalahan. Coba lagi.");
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdateMapSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cityCode) {
      toast.error("Pilih kota dulu — wajib diisi untuk semua member");
      return;
    }
    setMapLoading(true);
    try {
      const data = await saveProfile({
        name,
        phone,
        avatar_url: avatarUrl || undefined,
        bio: bio.trim() || null,
        city_code: cityCode,
        map_visibility: mapVisibility,
      });
      if (data.success) { invalidateCache(); toast.success("Pengaturan Peta Member disimpan"); }
      else toast.error(data.error || "Gagal menyimpan pengaturan");
    } catch {
      toast.error("Terjadi kesalahan. Coba lagi.");
    } finally {
      setMapLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    try {
      const res = await fetch(`/api/user/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Password berhasil diubah");
        setCurrentPassword("");
        setNewPassword("");
      } else {
        toast.error(data.error || "Gagal mengubah password");
      }
    } catch {
      toast.error("Terjadi kesalahan. Coba lagi.");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="max-w-xl space-y-5">
      <PageHeader
        eyebrow="Akun"
        title="Pengaturan Akun"
        description="Kelola informasi profil dan keamanan akun"
      />

      {/* Membership Info Card */}
      <Card className="overflow-hidden border border-black/[0.06] dark:border-white/[0.05]">
        <CardHeader className="bg-gradient-to-r from-[#8B1414]/10 to-[#8B1414]/5 dark:from-[#C0392B]/10 dark:to-[#C0392B]/5 border-b border-black/[0.04] dark:border-white/[0.05] py-4">
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-[#8B1414] dark:text-[#C0392B] fill-[#8B1414]/20 dark:fill-[#C0392B]/20" />
            <CardTitle className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Informasi Layanan</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          {initialLoading ? (
            <div className="flex flex-col gap-2">
              <div className="skeleton h-4 w-1/3 rounded" />
              <div className="skeleton h-3 w-1/2 rounded" />
            </div>
          ) : membership ? (
            <div>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5 leading-snug mb-1">
                    {membership.plan_name}
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
                      Aktif
                    </span>
                  </h3>
                  <div className="flex flex-col gap-1.5 mt-3 text-xs text-gray-600 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                      <span>Tipe Tagihan: <span className="font-semibold capitalize">{membership.duration_type}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-blue-500" />
                      <span>
                        {membership.expires_at ? (
                          <>Berakhir pada <span className="font-semibold">{formatDate(membership.expires_at)}</span></>
                        ) : (
                          <span className="font-semibold">Akses Lifetime / Selamanya</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
                {membership.expires_at && (
                  <Button 
                    onClick={() => window.open("https://app.pejuangyen.com/premium/", "_blank")}
                    variant="secondary" 
                    size="sm"
                    className="border-[#8B1414] dark:border-[#C0392B] text-[#8B1414] dark:text-[#C0392B] hover:bg-[#F7E8E8] dark:hover:bg-[#C0392B]/10 shrink-0 active:scale-[0.98]"
                  >
                    Perpanjang Akses
                  </Button>
                )}
              </div>

              {/* Expiry Warning */}
              {(() => {
                if (!membership.expires_at) return null;
                const daysLeft = Math.ceil((new Date(membership.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                if (daysLeft > 0 && daysLeft <= 7) {
                  return (
                    <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-400">
                      <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5 animate-pulse" />
                      <div>
                        <p className="font-semibold">Membership Anda hampir berakhir!</p>
                        <p className="mt-0.5 opacity-90">Akses all-class Anda akan dinonaktifkan dalam {daysLeft} hari. Perbarui langganan Anda sekarang untuk terus belajar tanpa gangguan.</p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5 leading-snug">
                  Akses Terbatas (Free Plan)
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide uppercase bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-white/10">
                    Free
                  </span>
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-sm">
                  Dapatkan akses ke semua materi premium, sertifikasi resmi, modul praktek AI eksklusif, dan komunitas member Pro.
                </p>
              </div>
              <Button 
                onClick={() => window.open("https://app.pejuangyen.com/premium/", "_blank")}
                className="bg-[#8B1414] dark:bg-[#C0392B] hover:bg-[#6E0F0F] dark:hover:bg-[#A93226] text-white shrink-0 active:scale-[0.98]"
                size="sm"
              >
                Upgrade ke Pro
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile Form */}
      <Card>
        <CardHeader>
          <CardTitle>Informasi Profil</CardTitle>
        </CardHeader>
        <CardContent>
          {initialLoading ? (
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i}>
                  <div className="skeleton h-3 w-24 mb-2 rounded" />
                  <div className="skeleton h-10 w-full rounded-lg" />
                </div>
              ))}
              <div className="skeleton h-9 w-32 rounded-lg" />
            </div>
          ) : (
            <form onSubmit={handleUpdateProfile} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#6B7280] dark:text-slate-400 uppercase tracking-[0.06em]">Avatar Profile</label>
                <div className="p-4 rounded-xl border border-black/[0.06] dark:border-white/[0.05] bg-gray-50/50 dark:bg-white/[0.02]">
                  <DicebearCustomizer 
                    initialUrl={avatarUrl} 
                    defaultSeed={user?.name || "pejuangyen"} 
                    onSelect={(url) => setAvatarUrl(url)} 
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5 mt-2">
                <label className="text-xs font-semibold text-[#6B7280] dark:text-slate-400 uppercase tracking-[0.06em]">Email</label>
                <input
                  value={user?.email || ""}
                  disabled
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-black/[0.06] dark:border-white/[0.06] text-[#9CA3AF] dark:text-slate-500 cursor-not-allowed opacity-80"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#6B7280] dark:text-slate-400 uppercase tracking-[0.06em]">Nama Lengkap</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#6B7280] dark:text-slate-400 uppercase tracking-[0.06em]">
                  Nomor HP{" "}
                  <span className="text-[#9CA3AF] dark:text-slate-500 font-normal normal-case tracking-normal">(opsional)</span>
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+62..."
                  className={inputClass}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#6B7280] dark:text-slate-400 uppercase tracking-[0.06em]">
                  Deskripsi Tentang Saya{" "}
                  <span className="text-[#9CA3AF] dark:text-slate-500 font-normal normal-case tracking-normal">(opsional)</span>
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Ceritakan pekerjaan, kesibukan, atau social media kamu..."
                  className={`${inputClass} resize-none`}
                />
                <p className="text-[11px] text-[#9CA3AF] dark:text-slate-500 text-right">{bio.length}/500</p>
              </div>
              <Button type="submit" className="self-start" loading={profileLoading}>
                Simpan Perubahan
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Peta Member (fitur GWA) dinonaktifkan untuk PejuangYen */}
      {false && (
      <Card id="peta-member">
        <CardHeader>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#8B1414] dark:text-[#C0392B]" />
            <CardTitle>Peta Member</CardTitle>
          </div>
          <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-1">
            Tampilkan dirimu di Peta Persebaran User PejuangYen dan temukan teman baru sesama PejuangYen di dekatmu.
            Kamu yang menentukan apa saja yang terlihat.
          </p>
        </CardHeader>
        <CardContent>
          {initialLoading ? (
            <div className="flex flex-col gap-4">
              <div className="skeleton h-10 w-full rounded-lg" />
              <div className="skeleton h-24 w-full rounded-lg" />
            </div>
          ) : (
            <form onSubmit={handleUpdateMapSettings} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#6B7280] dark:text-slate-400 uppercase tracking-[0.06em]">Kota Kamu <span className="text-[#EF4444] font-normal normal-case tracking-normal">(wajib)</span></label>
                <CityCombobox value={cityCode} onChange={setCityCode} inputClassName={inputClass} />
                <p className="text-[11px] text-[#9CA3AF] dark:text-slate-500">
                  Pilih kota terdekat. Lokasi di peta selalu memakai titik pusat kota — bukan alamat aslimu.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-[#6B7280] dark:text-slate-400 uppercase tracking-[0.06em]">Privasi di Peta</label>
                <div className="flex flex-col gap-2">
                  {VISIBILITY_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150 ${
                        mapVisibility === opt.value
                          ? "border-[#8B1414]/50 dark:border-[#C0392B]/50 bg-[#8B1414]/[0.04] dark:bg-[#C0392B]/[0.06]"
                          : "border-black/[0.08] dark:border-white/[0.08] hover:border-black/[0.16] dark:hover:border-white/[0.16]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="map_visibility"
                        value={opt.value}
                        checked={mapVisibility === opt.value}
                        onChange={() => setMapVisibility(opt.value)}
                        className="mt-0.5 accent-[#8B1414] dark:accent-[#C0392B]"
                      />
                      <span className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold text-[#0D0D0D] dark:text-white">{opt.label}</span>
                        <span className="text-xs text-[#6B7280] dark:text-slate-400">{opt.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <Button type="submit" className="self-start" loading={mapLoading}>
                Simpan Pengaturan Peta
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
      )}

      {/* Password Form */}
      <Card>
        <CardHeader>
          <CardTitle>Ubah Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#6B7280] dark:text-slate-400 uppercase tracking-[0.06em]">Password Saat Ini</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#6B7280] dark:text-slate-400 uppercase tracking-[0.06em]">Password Baru</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Min. 8 karakter"
                className={inputClass}
              />
            </div>
            <Button
              type="submit"
              className="self-start bg-[#0D0D0D] dark:bg-white hover:bg-[#1a1a1a] dark:hover:bg-gray-200 dark:text-black"
              loading={passwordLoading}
            >
              Ubah Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
