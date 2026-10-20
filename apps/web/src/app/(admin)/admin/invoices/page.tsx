"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search, FileText, Eye, Download, Trash2 } from "lucide-react";
import { AdminTable, StatusBadge, Td, Tr } from "@/components/ui/AdminTable";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { toast } from "@/components/ui/toast";

interface InvoiceRow {
  id: string;
  invoice_number: string;
  company_name: string;
  recipient_name: string;
  recipient_email: string;
  invoice_date: string;
  due_date: string | null;
  currency: string;
  total: number;
  status: string;
  pdf_url: string | null;
  created_by: string | null;
  created_at: string;
}

const STATUS_FILTERS = ["", "draft", "generated", "sent", "paid", "overdue", "cancelled"];

function formatRupiah(amount: number, currency = "IDR") {
  if (currency === "IDR") return `Rp ${amount.toLocaleString("id-ID")}`;
  return `${currency} ${amount.toLocaleString("id-ID")}`;
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function AdminInvoicesContent() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search.trim()) params.set("search", search.trim());
    if (status) params.set("status", status);
    try {
      const res = await fetch(`/api/admin/invoices?${params.toString()}`, { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setInvoices(data.data || []);
        setTotalPages(data.pagination?.totalPages || 1);
      } else {
        toast.error(data.error || "Gagal memuat invoice");
      }
    } catch {
      toast.error("Gagal memuat invoice");
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (inv: InvoiceRow) => {
    if (!confirm(`Hapus invoice ${inv.invoice_number}? Tindakan ini tidak bisa dibatalkan.`)) return;
    const res = await fetch(`/api/admin/invoices/${inv.id}`, { method: "DELETE", credentials: "include" });
    const data = await res.json();
    if (data.success) {
      toast.success("Invoice dihapus");
      load();
    } else {
      toast.error(data.error || "Gagal menghapus invoice");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Invoice"
        description="Buat invoice profesional untuk klien korporat, sponsor, agency, dan transaksi custom lainnya."
        actions={
          <Button onClick={() => router.push("/admin/invoices/new")}>
            <Plus className="h-4 w-4" /> Buat Invoice
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgba(12,12,10,0.35)]" />
          <input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Cari nomor, perusahaan, penerima, email..."
            className="w-full rounded-xl border border-[rgba(12,12,10,0.12)] bg-white py-2.5 pl-10 pr-3.5 text-sm text-warm-black outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          className="rounded-xl border border-[rgba(12,12,10,0.12)] bg-white px-3.5 py-2.5 text-sm text-warm-black outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : "Semua Status"}
            </option>
          ))}
        </select>
      </div>

      <AdminTable
        loading={loading}
        columns={[
          { key: "number", label: "No. Invoice" },
          { key: "company", label: "Perusahaan" },
          { key: "date", label: "Tanggal" },
          { key: "total", label: "Total" },
          { key: "status", label: "Status" },
          { key: "actions", label: "", className: "text-right" },
        ]}
        empty={
          <EmptyState
            icon={<FileText className="h-7 w-7" />}
            title="Belum ada invoice"
            description="Mulai buat invoice pertama untuk klien atau partner Anda."
          />
        }
      >
        {invoices.map((inv) => (
          <Tr key={inv.id}>
            <Td className="font-mono text-xs font-semibold">{inv.invoice_number}</Td>
            <Td>
              <div className="font-medium text-warm-black">{inv.company_name}</div>
              <div className="text-xs text-[rgba(12,12,10,0.5)]">{inv.recipient_name}</div>
            </Td>
            <Td className="text-xs">{formatDate(inv.invoice_date)}</Td>
            <Td className="font-semibold">{formatRupiah(inv.total, inv.currency)}</Td>
            <Td><StatusBadge status={inv.status} /></Td>
            <Td className="text-right">
              <div className="flex items-center justify-end gap-1.5">
                {inv.pdf_url && (
                  <a
                    href={inv.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Unduh PDF"
                    className="rounded-lg p-1.5 text-[rgba(12,12,10,0.5)] hover:bg-white/60 hover:text-warm-black"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                )}
                <Link
                  href={`/admin/invoices/${inv.id}`}
                  title="Lihat detail"
                  className="rounded-lg p-1.5 text-[rgba(12,12,10,0.5)] hover:bg-white/60 hover:text-warm-black"
                >
                  <Eye className="h-4 w-4" />
                </Link>
                <button
                  onClick={() => handleDelete(inv)}
                  title="Hapus"
                  className="rounded-lg p-1.5 text-[rgba(12,12,10,0.5)] hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Td>
          </Tr>
        ))}
      </AdminTable>

      <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}

export default function AdminInvoicesPage() {
  return (
    <Suspense fallback={null}>
      <AdminInvoicesContent />
    </Suspense>
  );
}
