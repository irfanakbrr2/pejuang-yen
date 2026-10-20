"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { toast } from "@/components/ui/toast";

interface ItemForm {
  item_name: string;
  description: string;
  quantity: string;
  unit_price: string;
}

const DEFAULT_PAYMENT_INFO = "Bank BCA\na.n. Irfan Akbar Wildani\nNo. Rekening: 6975472403";

const inputClass =
  "w-full px-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors";
const labelClass = "block text-xs font-semibold text-[rgba(12,12,10,0.6)] mb-1.5";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function toNum(v: string) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : 0;
}

function formatRupiah(amount: number) {
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Recipient
  const [companyName, setCompanyName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [taxNumber, setTaxNumber] = useState("");

  // Invoice info
  const [invoiceDate, setInvoiceDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState("");
  const [currency] = useState("IDR");

  // Items
  const [items, setItems] = useState<ItemForm[]>([
    { item_name: "", description: "", quantity: "1", unit_price: "" },
  ]);

  // Calculation
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");

  // Payment + notes
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer (BCA)");
  const [paymentInformation, setPaymentInformation] = useState(DEFAULT_PAYMENT_INFO);
  const [notes, setNotes] = useState("Mohon cantumkan nomor invoice pada keterangan transfer. Terima kasih telah bekerja sama dengan PejuangYen.");

  const { subtotal, total } = useMemo(() => {
    const sub = items.reduce((sum, it) => sum + toNum(it.quantity) * toNum(it.unit_price), 0);
    const tot = Math.max(0, sub - toNum(discount) + toNum(tax));
    return { subtotal: sub, total: tot };
  }, [items, discount, tax]);

  const updateItem = (idx: number, patch: Partial<ItemForm>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const addItem = () => setItems((prev) => [...prev, { item_name: "", description: "", quantity: "1", unit_price: "" }]);
  const removeItem = (idx: number) => setItems((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));

  const handleSubmit = async () => {
    if (!companyName.trim() || !recipientName.trim() || !recipientEmail.trim()) {
      toast.error("Nama perusahaan, nama penerima, dan email wajib diisi");
      return;
    }
    const validItems = items.filter((it) => it.item_name.trim());
    if (validItems.length === 0) {
      toast.error("Minimal satu item dengan nama harus diisi");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/invoices", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName.trim(),
          recipient_name: recipientName.trim(),
          recipient_email: recipientEmail.trim(),
          recipient_phone: recipientPhone.trim() || null,
          company_address: companyAddress.trim() || null,
          tax_number: taxNumber.trim() || null,
          invoice_date: invoiceDate,
          due_date: dueDate || null,
          currency,
          discount: toNum(discount),
          tax: toNum(tax),
          payment_method: paymentMethod.trim() || null,
          payment_information: paymentInformation.trim() || null,
          notes: notes.trim() || null,
          items: validItems.map((it) => ({
            item_name: it.item_name.trim(),
            description: it.description.trim() || null,
            quantity: toNum(it.quantity) || 1,
            unit_price: toNum(it.unit_price),
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Invoice ${data.data.invoice_number} dibuat`);
        router.push(`/admin/invoices/${data.data.id}`);
      } else {
        toast.error(data.error || "Gagal membuat invoice");
      }
    } catch {
      toast.error("Gagal membuat invoice");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link
        href="/admin/invoices"
        className="inline-flex items-center gap-1.5 text-sm text-[rgba(12,12,10,0.55)] hover:text-warm-black"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali ke Invoice
      </Link>

      <PageHeader eyebrow="Finance" title="Buat Invoice" description="Semua nilai diisi manual oleh admin. Nomor invoice dibuat otomatis." />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: form */}
        <div className="space-y-6 lg:col-span-2">
          {/* Recipient */}
          <section className="glass-table rounded-2xl p-5">
            <h2 className="mb-4 text-sm font-semibold text-warm-black">Informasi Penerima</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={labelClass}>Nama Perusahaan *</label>
                <input className={inputClass} value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="PT Contoh Indonesia" />
              </div>
              <div>
                <label className={labelClass}>Nama Penerima *</label>
                <input className={inputClass} value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Budi Santoso" />
              </div>
              <div>
                <label className={labelClass}>Email Penerima *</label>
                <input className={inputClass} type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="budi@perusahaan.com" />
              </div>
              <div>
                <label className={labelClass}>No. Telepon</label>
                <input className={inputClass} value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} placeholder="0812xxxxxxx" />
              </div>
              <div>
                <label className={labelClass}>NPWP / Tax Number</label>
                <input className={inputClass} value={taxNumber} onChange={(e) => setTaxNumber(e.target.value)} placeholder="00.000.000.0-000.000" />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Alamat Perusahaan</label>
                <textarea className={inputClass} rows={2} value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} placeholder="Jl. Contoh No. 1, Jakarta" />
              </div>
            </div>
          </section>

          {/* Invoice info */}
          <section className="glass-table rounded-2xl p-5">
            <h2 className="mb-4 text-sm font-semibold text-warm-black">Informasi Invoice</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className={labelClass}>Tanggal Invoice</label>
                <input className={inputClass} type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Jatuh Tempo</label>
                <input className={inputClass} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Mata Uang</label>
                <input className={`${inputClass} bg-gray-50`} value={currency} disabled />
              </div>
            </div>
          </section>

          {/* Items */}
          <section className="glass-table rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-warm-black">Item Invoice</h2>
              <Button variant="secondary" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4" /> Tambah Item
              </Button>
            </div>
            <div className="space-y-4">
              {items.map((it, idx) => {
                const lineTotal = toNum(it.quantity) * toNum(it.unit_price);
                return (
                  <div key={idx} className="rounded-xl border border-[rgba(12,12,10,0.08)] p-4">
                    <div className="grid gap-3 sm:grid-cols-12">
                      <div className="sm:col-span-6">
                        <label className={labelClass}>Nama Item</label>
                        <input className={inputClass} value={it.item_name} onChange={(e) => updateItem(idx, { item_name: e.target.value })} placeholder="Pelatihan Bahasa Jepang Korporat" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className={labelClass}>Qty</label>
                        <input className={inputClass} type="number" min="1" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: e.target.value })} />
                      </div>
                      <div className="sm:col-span-4">
                        <label className={labelClass}>Harga Satuan (Rp)</label>
                        <input className={inputClass} type="number" min="0" value={it.unit_price} onChange={(e) => updateItem(idx, { unit_price: e.target.value })} placeholder="0" />
                      </div>
                      <div className="sm:col-span-12">
                        <label className={labelClass}>Deskripsi (opsional)</label>
                        <input className={inputClass} value={it.description} onChange={(e) => updateItem(idx, { description: e.target.value })} placeholder="Detail layanan / catatan item" />
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-[rgba(12,12,10,0.55)]">Subtotal item: <strong className="text-warm-black">{formatRupiah(lineTotal)}</strong></span>
                      <button
                        onClick={() => removeItem(idx)}
                        disabled={items.length === 1}
                        className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600 disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Hapus
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Payment + notes */}
          <section className="glass-table rounded-2xl p-5">
            <h2 className="mb-4 text-sm font-semibold text-warm-black">Pembayaran &amp; Catatan</h2>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Metode Pembayaran</label>
                <input className={inputClass} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Informasi Pembayaran</label>
                <textarea className={inputClass} rows={3} value={paymentInformation} onChange={(e) => setPaymentInformation(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Catatan</label>
                <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
          </section>
        </div>

        {/* Right: summary */}
        <div className="lg:col-span-1">
          <div className="glass-table sticky top-20 rounded-2xl p-5">
            <h2 className="mb-4 text-sm font-semibold text-warm-black">Ringkasan</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[rgba(12,12,10,0.6)]">Subtotal</span>
                <span className="font-semibold text-warm-black">{formatRupiah(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[rgba(12,12,10,0.6)]">Diskon (Rp)</span>
                <input className={`${inputClass} max-w-[140px] text-right`} type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[rgba(12,12,10,0.6)]">Pajak (Rp)</span>
                <input className={`${inputClass} max-w-[140px] text-right`} type="number" min="0" value={tax} onChange={(e) => setTax(e.target.value)} />
              </div>
              <div className="border-t border-[rgba(12,12,10,0.08)] pt-3 flex items-center justify-between">
                <span className="font-semibold text-warm-black">Grand Total</span>
                <span className="text-lg font-bold text-primary">{formatRupiah(total)}</span>
              </div>
            </div>
            <Button className="mt-5 w-full" loading={saving} onClick={handleSubmit}>
              Simpan Invoice
            </Button>
            <p className="mt-3 text-center text-xs text-[rgba(12,12,10,0.45)]">
              Setelah disimpan, Anda dapat membuat PDF &amp; mengirim email.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
