"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, FileCheck, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/AdminTable";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { toast } from "@/components/ui/toast";

const LOGO_URL = "data:image/png;base64,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";

interface InvoiceItem {
  id: string;
  item_name: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  company_name: string;
  recipient_name: string;
  recipient_email: string;
  recipient_phone: string | null;
  company_address: string | null;
  tax_number: string | null;
  invoice_date: string;
  due_date: string | null;
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: string;
  payment_method: string | null;
  payment_information: string | null;
  notes: string | null;
  pdf_url: string | null;
  created_by: string | null;
  created_at: string;
  items: InvoiceItem[];
}

const STATUS_OPTIONS = ["draft", "generated", "sent", "paid", "overdue", "cancelled"];

function formatRupiah(amount: number, currency = "IDR") {
  if (currency === "IDR") return `Rp ${amount.toLocaleString("id-ID")}`;
  return `${currency} ${amount.toLocaleString("id-ID")}`;
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

export default function InvoiceDetailClient() {
  const pathname = usePathname();
  const id = pathname.split("/").filter(Boolean)[2];

  const printRef = useRef<HTMLDivElement>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);

  const loadInvoice = async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/admin/invoices/${id}`, { credentials: "include" });
      const data = await res.json();
      if (data.success) setInvoice(data.data);
      else setError(data.error || "Invoice tidak ditemukan");
    } catch {
      setError("Gagal memuat invoice");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function buildPdf() {
    if (!printRef.current || !invoice) return null;
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const canvas = await html2canvas(printRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#FFFFFF",
      logging: false,
      scrollX: 0,
      scrollY: -window.scrollY,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = 210;
    const pageH = 297;
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    const imgData = canvas.toDataURL("image/png");

    let heightLeft = imgH;
    let position = 0;
    pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
    heightLeft -= pageH;
    while (heightLeft > 0) {
      position -= pageH;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgW, imgH);
      heightLeft -= pageH;
    }
    return pdf;
  }

  const handleGenerate = async () => {
    if (!invoice) return;
    setGenerating(true);
    try {
      const pdf = await buildPdf();
      if (!pdf) throw new Error("PDF build failed");

      const blob = pdf.output("blob");
      const res = await fetch(`/api/admin/invoices/${invoice.id}/pdf`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/pdf" },
        body: blob,
      });
      const data = await res.json();
      if (data.success) {
        toast.success("PDF dibuat & tersimpan");
        pdf.save(`${invoice.invoice_number}.pdf`);
        await loadInvoice();
      } else {
        toast.error(data.error || "Gagal menyimpan PDF");
      }
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("Gagal membuat PDF. Coba lagi.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!invoice) return;
    if (!invoice.pdf_url) {
      toast.error("Buat PDF terlebih dahulu");
      return;
    }
    if (!confirm(`Kirim invoice ke ${invoice.recipient_email}?`)) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/invoices/${invoice.id}/send`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (data.success) {
        toast.success("Invoice terkirim");
        await loadInvoice();
      } else {
        toast.error(data.error || "Gagal mengirim invoice");
      }
    } catch {
      toast.error("Gagal mengirim invoice");
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!invoice || status === invoice.status) return;
    setStatusSaving(true);
    try {
      const res = await fetch(`/api/admin/invoices/${invoice.id}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Status diperbarui");
        setInvoice((prev) => (prev ? { ...prev, status } : prev));
      } else {
        toast.error(data.error || "Gagal memperbarui status");
      }
    } catch {
      toast.error("Gagal memperbarui status");
    } finally {
      setStatusSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-7 w-7 animate-spin text-[rgba(12,12,10,0.3)]" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <p className="text-sm text-red-500">{error || "Invoice tidak ditemukan"}</p>
        <Link href="/admin/invoices" className="text-sm font-semibold text-primary underline">
          Kembali ke Invoice
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/invoices" className="inline-flex items-center gap-1.5 text-sm text-[rgba(12,12,10,0.55)] hover:text-warm-black">
        <ArrowLeft className="h-4 w-4" /> Kembali ke Invoice
      </Link>

      <PageHeader
        eyebrow="Finance"
        title={invoice.invoice_number}
        description={`${invoice.company_name} · ${invoice.recipient_email}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" loading={generating} onClick={handleGenerate}>
              <FileCheck className="h-4 w-4" /> {invoice.pdf_url ? "Buat Ulang PDF" : "Buat & Simpan PDF"}
            </Button>
            {invoice.pdf_url && (
              <a href={invoice.pdf_url} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost">
                  <Download className="h-4 w-4" /> Unduh
                </Button>
              </a>
            )}
            <Button loading={sending} disabled={!invoice.pdf_url} onClick={handleSend}>
              <Send className="h-4 w-4" /> Kirim Invoice
            </Button>
          </div>
        }
      />

      {/* Status bar */}
      <div className="glass-table flex flex-wrap items-center gap-3 rounded-2xl p-4">
        <span className="text-xs font-semibold text-[rgba(12,12,10,0.6)]">Status:</span>
        <StatusBadge status={invoice.status} />
        <div className="flex-1" />
        <label className="text-xs text-[rgba(12,12,10,0.55)]">Ubah status:</label>
        <select
          value={invoice.status}
          disabled={statusSaving}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="rounded-lg border border-[rgba(12,12,10,0.12)] bg-white px-3 py-1.5 text-sm text-warm-black outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {!invoice.pdf_url && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
          PDF belum dibuat. Klik <strong>Buat &amp; Simpan PDF</strong> sebelum mengirim email ke penerima.
        </p>
      )}

      {/* Invoice preview (A4) */}
      <div className="overflow-x-auto">
        <div
          ref={printRef}
          style={{
            width: 794,
            minHeight: 1123,
            margin: "0 auto",
            background: "#FFFFFF",
            color: "#0F172A",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
            padding: "56px 56px 48px",
            boxShadow: "0 4px 40px rgba(0,0,0,0.08)",
            boxSizing: "border-box",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 36 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img src={LOGO_URL} alt="PejuangYen" width={48} height={48} style={{ borderRadius: 10, display: "block" }} />
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.01em" }}>PejuangYen</div>
                <div style={{ fontSize: 12, color: "#64748B" }}>pejuangyen.com</div>
                <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>NPWP: 10.951.005.7-543.000</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "0.06em", color: "#0F172A" }}>INVOICE</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#8B1414", marginTop: 2 }}>{invoice.invoice_number}</div>
            </div>
          </div>

          <div style={{ height: 1, background: "#E2E8F0", marginBottom: 28 }} />

          {/* Meta: recipient + dates */}
          <div style={{ display: "flex", justifyContent: "space-between", gap: 32, marginBottom: 32 }}>
            <div style={{ maxWidth: 340 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94A3B8", marginBottom: 8 }}>Ditagihkan Kepada</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>{invoice.company_name}</div>
              <div style={{ fontSize: 13, color: "#334155", marginTop: 2 }}>{invoice.recipient_name}</div>
              <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>{invoice.recipient_email}</div>
              {invoice.recipient_phone && <div style={{ fontSize: 13, color: "#64748B" }}>{invoice.recipient_phone}</div>}
              {invoice.company_address && <div style={{ fontSize: 13, color: "#64748B", marginTop: 4, whiteSpace: "pre-line" }}>{invoice.company_address}</div>}
              {invoice.tax_number && <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 4 }}>NPWP: {invoice.tax_number}</div>}
            </div>
            <div style={{ textAlign: "right", minWidth: 200 }}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94A3B8" }}>Tanggal Invoice</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", marginTop: 2 }}>{formatDate(invoice.invoice_date)}</div>
              </div>
              {invoice.due_date && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94A3B8" }}>Jatuh Tempo</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", marginTop: 2 }}>{formatDate(invoice.due_date)}</div>
                </div>
              )}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94A3B8" }}>Mata Uang</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", marginTop: 2 }}>{invoice.currency}</div>
              </div>
            </div>
          </div>

          {/* Items table */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 24 }}>
            <thead>
              <tr style={{ background: "#0F172A" }}>
                <th style={{ textAlign: "left", padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#FFFFFF", letterSpacing: "0.04em" }}>Deskripsi</th>
                <th style={{ textAlign: "center", padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#FFFFFF", width: 60 }}>Qty</th>
                <th style={{ textAlign: "right", padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#FFFFFF", width: 130 }}>Harga</th>
                <th style={{ textAlign: "right", padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#FFFFFF", width: 140 }}>Jumlah</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((it, i) => (
                <tr key={it.id} style={{ borderBottom: "1px solid #E2E8F0", background: i % 2 ? "#F8FAFC" : "#FFFFFF" }}>
                  <td style={{ padding: "12px 14px", fontSize: 13, color: "#0F172A" }}>
                    <div style={{ fontWeight: 600 }}>{it.item_name}</div>
                    {it.description && <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{it.description}</div>}
                  </td>
                  <td style={{ padding: "12px 14px", fontSize: 13, color: "#334155", textAlign: "center" }}>{it.quantity}</td>
                  <td style={{ padding: "12px 14px", fontSize: 13, color: "#334155", textAlign: "right" }}>{formatRupiah(it.unit_price, invoice.currency)}</td>
                  <td style={{ padding: "12px 14px", fontSize: 13, color: "#0F172A", textAlign: "right", fontWeight: 600 }}>{formatRupiah(it.total, invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 32 }}>
            <table style={{ width: 300, borderCollapse: "collapse" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "6px 0", fontSize: 13, color: "#64748B" }}>Subtotal</td>
                  <td style={{ padding: "6px 0", fontSize: 13, color: "#0F172A", textAlign: "right", fontWeight: 600 }}>{formatRupiah(invoice.subtotal, invoice.currency)}</td>
                </tr>
                {invoice.discount > 0 && (
                  <tr>
                    <td style={{ padding: "6px 0", fontSize: 13, color: "#64748B" }}>Diskon</td>
                    <td style={{ padding: "6px 0", fontSize: 13, color: "#0F172A", textAlign: "right", fontWeight: 600 }}>− {formatRupiah(invoice.discount, invoice.currency)}</td>
                  </tr>
                )}
                {invoice.tax > 0 && (
                  <tr>
                    <td style={{ padding: "6px 0", fontSize: 13, color: "#64748B" }}>Pajak</td>
                    <td style={{ padding: "6px 0", fontSize: 13, color: "#0F172A", textAlign: "right", fontWeight: 600 }}>{formatRupiah(invoice.tax, invoice.currency)}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: "12px 0 0", borderTop: "2px solid #0F172A", fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Grand Total</td>
                  <td style={{ padding: "12px 0 0", borderTop: "2px solid #0F172A", fontSize: 17, fontWeight: 800, color: "#8B1414", textAlign: "right" }}>{formatRupiah(invoice.total, invoice.currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Payment + notes */}
          <div style={{ display: "flex", gap: 24, marginBottom: 36 }}>
            {invoice.payment_information && (
              <div style={{ flex: 1, background: "#F8FAFC", borderRadius: 10, padding: "16px 18px", border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94A3B8", marginBottom: 8 }}>Informasi Pembayaran</div>
                {invoice.payment_method && <div style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", marginBottom: 4 }}>{invoice.payment_method}</div>}
                <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.7, whiteSpace: "pre-line" }}>{invoice.payment_information}</div>
              </div>
            )}
            {invoice.notes && (
              <div style={{ flex: 1, padding: "16px 4px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#94A3B8", marginBottom: 8 }}>Catatan</div>
                <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.7, whiteSpace: "pre-line" }}>{invoice.notes}</div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ borderTop: "1px solid #E2E8F0", paddingTop: 16, textAlign: "center" }}>
            <div style={{ fontSize: 12, color: "#94A3B8" }}>Terima kasih telah bekerja sama dengan PejuangYen</div>
            <div style={{ fontSize: 11, color: "#CBD5E1", marginTop: 2 }}>PejuangYen — Lembaga Pelatihan Bahasa Jepang & Persiapan Kerja ke Jepang</div>
          </div>
        </div>
      </div>
    </div>
  );
}
