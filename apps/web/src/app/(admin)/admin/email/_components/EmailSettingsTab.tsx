"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { inputClass } from "./types";
import type { EmailSettings } from "./types";

interface Props {
  settings: EmailSettings;
  error?: string | null;
  setSettings: React.Dispatch<React.SetStateAction<EmailSettings>>;
}

export function EmailSettingsTab({ settings, error, setSettings }: Props) {
  const handleChange = (key: keyof EmailSettings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      <Card>
        <CardHeader>
          <CardTitle>Sender Identity</CardTitle>
          <p className="text-sm text-[rgba(12,12,10,0.45)] mt-1">Nama dan alamat pengirim email ke subscriber</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-warm-black">From Name</label>
              <input className={inputClass} value={settings.email_from_name} onChange={(e) => handleChange("email_from_name", e.target.value)} placeholder="PejuangYen" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-warm-black">From Address</label>
              <input className={inputClass} type="email" value={settings.email_from_address} onChange={(e) => handleChange("email_from_address", e.target.value)} placeholder="hello@pejuangyen.com" />
              <span className="text-xs text-[rgba(12,12,10,0.45)]">Alamat ini harus sudah terkonfigurasi di Mailketing</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mailketing.co.id</CardTitle>
          <p className="text-sm text-[rgba(12,12,10,0.45)] mt-1">Token untuk email transaksional, notifikasi admin, marketing campaigns, dan lifecycle sequences</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-warm-black">API Token</label>
            <input className={inputClass} type="password" value={settings.mailketing_api_token} onChange={(e) => handleChange("mailketing_api_token", e.target.value)} placeholder="Mailketing API Token" />
            <span className="text-xs text-[rgba(12,12,10,0.45)]">Dari dashboard Mailketing → Pengaturan → API</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
