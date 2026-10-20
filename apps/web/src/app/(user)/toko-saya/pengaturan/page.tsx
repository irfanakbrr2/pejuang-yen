"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { UploadCloud, Code2 } from "lucide-react";
import { tokoApi } from "@/lib/api-client";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/toast";
import { SandboxedHtml } from "@/components/toko/SandboxedHtml";

interface StoreData {
  slug: string;
  name: string;
  description?: string | null;
  logo_url?: string | null;
  custom_html?: string | null;
  payout_account_holder?: string | null;
  payout_bank_name?: string | null;
  payout_bank_account?: string | null;
}

const inputClass =
  "w-full px-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors";
const labelClass = "block text-xs font-semibold mb-1.5 text-gray-600";

export default function TokoPengaturanPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [form, setForm] = useState({
    name: "", slug: "", description: "", logo_url: "", custom_html: "",
    payout_account_holder: "", payout_bank_name: "", payout_bank_account: "",
  });
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    tokoApi.me().then((res) => {
      if (res.success && res.data) {
        const s = res.data as StoreData;
        setForm({
          name: s.name || "",
          slug: s.slug || "",
          description: s.description || "",
          logo_url: s.logo_url || "",
          custom_html: s.custom_html || "",
          payout_account_holder: s.payout_account_holder || "",
          payout_bank_name: s.payout_bank_name || "",
          payout_bank_account: s.payout_bank_account || "",
        });
      }
      setLoading(false);
    });
  }, []);

  const uploadLogo = async (file: File) => {
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/toko/me/assets", { method: "POST", credentials: "include", body: fd });
      const data = await res.json();
      if (data.success) {
        setForm((f) => ({ ...f, logo_url: data.data.url }));
        toast.success("Logo terupload");
      } else {
        toast.error(data.error || "Upload gagal");
      }
    } finally {
      setUploadingLogo(false);
    }
  };

  const save = async () => {
    setSaving(true);
    const res = await tokoApi.update({
      name: form.name.trim(),
      slug: form.slug.trim().toLowerCase(),
      description: form.description.trim() || null,
      logo_url: form.logo_url || null,
      custom_html: form.custom_html.trim() || null,
      payout_account_holder: form.payout_account_holder.trim() || null,
      payout_bank_name: form.payout_bank_name.trim() || null,
      payout_bank_account: form.payout_bank_account.trim() || null,
    });
    setSaving(false);
    if (res.success) toast.success("Pengaturan disimpan");
    else toast.error(res.error || "Gagal menyimpan");
  };

  if (loading) return <p className="py-10 text-center text-sm text-gray-500">Memuat...</p>;

  return (
    <>
      <PageHeader title="Pengaturan Toko" description="Profil toko & rekening untuk penarikan saldo." />

      <div className="max-w-xl space-y-5">
        <div className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white p-5 space-y-3">
          <p className="text-sm font-bold text-warm-black">Profil Toko</p>
          <div>
            <label className={labelClass}>Nama Toko</label>
            <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>Slug (terkunci setelah ada penjualan)</label>
            <input className={`${inputClass} font-mono`} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} />
            <p className="mt-1 text-xs text-gray-400">app.pejuangyen.com/toko/<strong>{form.slug}</strong></p>
          </div>
          <div>
            <label className={labelClass}>Deskripsi</label>
            <textarea className={inputClass} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>Logo (JPG/PNG/WebP, maks 2MB)</label>
            {form.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.logo_url} alt={`Logo ${form.name || "toko"}`} className="mb-1.5 h-16 w-16 rounded-lg object-cover" />
            )}
            <label className={`inline-flex items-center gap-2 rounded-lg border border-dashed border-[rgba(12,12,10,0.2)] px-3 py-2 text-xs cursor-pointer hover:border-primary transition-colors ${uploadingLogo ? "opacity-50 pointer-events-none" : ""}`}>
              <UploadCloud className="h-3.5 w-3.5" />
              {uploadingLogo ? "Mengupload..." : "Upload logo"}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ""; }} />
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-primary" />
            <p className="text-sm font-bold text-warm-black">Section Custom (HTML)</p>
          </div>
          <p className="text-xs leading-relaxed text-gray-500">
            Mendukung HTML & embed (YouTube, form, dll) — tampil di halaman tokomu di antara
            header dan daftar produk. Dirender di area terisolasi yang aman. Maks 20.000 karakter.
          </p>
          <textarea
            className={`${inputClass} font-mono text-xs`}
            rows={8}
            value={form.custom_html}
            onChange={(e) => setForm({ ...form, custom_html: e.target.value })}
            placeholder={`<h2>Selamat datang di toko saya!</h2>\n<iframe width="100%" height="315" src="https://www.youtube.com/embed/VIDEO_ID"></iframe>`}
          />
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-gray-400 tabular-nums">{form.custom_html.length.toLocaleString("id-ID")}/20.000</p>
            {form.custom_html.trim() && (
              <button
                onClick={() => setShowPreview((v) => !v)}
                className="text-xs font-semibold text-primary hover:underline cursor-pointer"
              >
                {showPreview ? "Sembunyikan preview" : "Lihat preview"}
              </button>
            )}
          </div>
          {showPreview && form.custom_html.trim() && (
            <SandboxedHtml html={form.custom_html} minHeight={240} />
          )}
        </div>

        <div className="rounded-xl border border-[rgba(0,0,0,0.07)] bg-white p-5 space-y-3">
          <p className="text-sm font-bold text-warm-black">Rekening Penarikan</p>
          <div>
            <label className={labelClass}>Nama Pemilik Rekening</label>
            <input className={inputClass} value={form.payout_account_holder} onChange={(e) => setForm({ ...form, payout_account_holder: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Bank</label>
              <input className={inputClass} value={form.payout_bank_name} onChange={(e) => setForm({ ...form, payout_bank_name: e.target.value })} placeholder="BCA" />
            </div>
            <div>
              <label className={labelClass}>Nomor Rekening</label>
              <input className={inputClass} value={form.payout_bank_account} onChange={(e) => setForm({ ...form, payout_bank_account: e.target.value })} />
            </div>
          </div>
        </div>

        <Button onClick={save} disabled={saving}>{saving ? "Menyimpan..." : "Simpan Pengaturan"}</Button>
      </div>
    </>
  );
}
