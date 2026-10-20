"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useState } from "react";
import { Landmark } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/toast";

interface PayoutSettingsProps {
  payoutName?: string | null;
  payoutBankName?: string | null;
  payoutBankAccount?: string | null;
}

const inputClass =
  "w-full px-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] dark:border-white/10 bg-white dark:bg-white/5 text-warm-black dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors";
const labelClass = "block text-xs font-semibold mb-1.5 text-gray-600 dark:text-slate-400";

export function PayoutSettings({ payoutName, payoutBankName, payoutBankAccount }: PayoutSettingsProps) {
  const [form, setForm] = useState({
    payout_name: payoutName || "",
    payout_bank_name: payoutBankName || "",
    payout_bank_account: payoutBankAccount || "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/affiliate/payout", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payout_name: form.payout_name.trim(),
          payout_bank_name: form.payout_bank_name.trim(),
          payout_bank_account: form.payout_bank_account.trim(),
        }),
      });
      const d = await res.json();
      if (d.success) toast.success("Rekening penarikan tersimpan");
      else toast.error(d.error || "Gagal menyimpan rekening");
    } catch {
      toast.error("Terjadi kesalahan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Landmark size={16} className="text-[#8B1414] dark:text-[#34D399]" />
        <p className="text-sm font-bold text-[#0D0D0D] dark:text-white">Rekening Penarikan Komisi</p>
      </div>
      <p className="text-xs leading-relaxed text-[#6B7280] dark:text-slate-400">
        Komisi yang sudah disetujui akan ditransfer ke rekening ini. Dikenakan biaya admin
        penarikan <strong>Rp 2.500</strong> per pembayaran.
      </p>
      <div>
        <label className={labelClass}>Nama Pemilik Rekening</label>
        <input
          className={inputClass}
          value={form.payout_name}
          onChange={(e) => setForm({ ...form, payout_name: e.target.value })}
          placeholder="Sesuai buku tabungan"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Bank</label>
          <input
            className={inputClass}
            value={form.payout_bank_name}
            onChange={(e) => setForm({ ...form, payout_bank_name: e.target.value })}
            placeholder="BCA"
          />
        </div>
        <div>
          <label className={labelClass}>Nomor Rekening</label>
          <input
            className={`${inputClass} font-mono`}
            inputMode="numeric"
            value={form.payout_bank_account}
            onChange={(e) => setForm({ ...form, payout_bank_account: e.target.value })}
            placeholder="1234567890"
          />
        </div>
      </div>
      <Button onClick={save} disabled={saving}>
        {saving ? "Menyimpan..." : "Simpan Rekening"}
      </Button>
    </div>
  );
}
