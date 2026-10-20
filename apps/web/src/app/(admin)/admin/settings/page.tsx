"use client";

import { useState, useEffect } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { PageHeader } from "@/components/ui/dashboard-chrome";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState({
    affiliate_cookie_days: "30",
    default_commission_rate: "20",
    site_name: "PejuangYen",
    site_description: "Platform belajar bahasa Jepang & persiapan kerja ke Jepang",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          setSettings((prev) => ({ ...prev, ...d.data }));
        }
      })
      .catch(() => { /* use default values on error */ });
  }, []);

  const handleChange = (key: string, value: string) => {
    setSettings({ ...settings, [key]: value });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(settings)) {
        if (key.endsWith("_configured")) continue;
        await fetch(`/api/admin/settings/${key}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ value }),
        });
      }
      toast.success("Settings berhasil disimpan");
    } catch {
      toast.error("Gagal menyimpan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full px-3.5 py-2.5 text-sm rounded-xl border border-[rgba(12,12,10,0.12)] text-warm-black outline-none focus:border-primary focus:ring-2 focus:ring-primary-light transition-colors";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Platform"
        title="Settings"
        description="Konfigurasi platform PejuangYen"
        actions={
        <Button onClick={handleSave} loading={saving} size="md">
          <Save size={15} />
          {saving ? "Menyimpan..." : "Simpan Settings"}
        </Button>
        }
      />

      <div className="flex flex-col gap-5 max-w-2xl">
        {/* Affiliate Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Affiliate Settings</CardTitle>
            <p className="text-sm text-[rgba(12,12,10,0.45)] mt-1">Konfigurasi program affiliate</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">Cookie Duration (hari)</label>
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  value={settings.affiliate_cookie_days}
                  onChange={(e) => handleChange("affiliate_cookie_days", e.target.value)}
                />
                <span className="text-xs text-[rgba(12,12,10,0.45)]">
                  Berapa lama cookie referral disimpan di browser pembeli
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">
                  Default Commission Rate (%)
                </label>
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  max={20}
                  value={settings.default_commission_rate}
                  onChange={(e) => handleChange("default_commission_rate", e.target.value)}
                />
                <span className="text-xs text-[rgba(12,12,10,0.45)]">
                  Maksimal 20% untuk affiliate biasa. Komisi order membership tetap 40% otomatis.
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Site Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Site Settings</CardTitle>
            <p className="text-sm text-[rgba(12,12,10,0.45)] mt-1">Informasi dasar platform</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">Nama Platform</label>
                <input
                  className={inputClass}
                  value={settings.site_name}
                  onChange={(e) => handleChange("site_name", e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-warm-black">Deskripsi</label>
                <textarea
                  className={inputClass}
                  value={settings.site_description}
                  onChange={(e) => handleChange("site_description", e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
