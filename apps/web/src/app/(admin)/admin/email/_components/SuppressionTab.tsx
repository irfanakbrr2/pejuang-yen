"use client";

import { AdminTable, Tr, Td } from "@/components/ui/AdminTable";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/utils";
import type { SuppressionEntry } from "./types";

interface Props {
  data: SuppressionEntry[] | null;
  loading: boolean;
  error?: string | null;
  page: number;
  setPage: (p: number) => void;
  total: number;
}

export function SuppressionTab({ data, loading, error, page, setPage, total }: Props) {
  const totalPages = Math.ceil(total / 100);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <span className="text-sm text-[rgba(12,12,10,0.55)]">
          Total: <span className="font-semibold text-warm-black">{total.toLocaleString("id-ID")}</span> email tersuppresi
        </span>
      </div>
      {error ? <div className="text-center py-10 text-red-600 text-sm">{error}</div> : <AdminTable
        loading={loading}
        columns={[
          { key: "email", label: "Email" },
          { key: "reason", label: "Alasan" },
          { key: "source", label: "Sumber" },
          { key: "date", label: "Tanggal" },
        ]}
        empty={<div className="text-center py-10 text-[rgba(12,12,10,0.35)] text-sm">Tidak ada email tersuppresi</div>}
      >
        {(data ?? []).map((entry) => (
          <Tr key={entry.id}>
            <Td className="font-medium">{entry.email}</Td>
            <Td>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 capitalize">{entry.reason}</span>
            </Td>
            <Td className="text-sm text-[rgba(12,12,10,0.55)]">{entry.source ?? "—"}</Td>
            <Td className="text-xs text-[rgba(12,12,10,0.45)]">{formatDate(entry.created_at)}</Td>
          </Tr>
        ))}
      </AdminTable>
      }
      {!error && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-[rgba(12,12,10,0.45)]">Halaman {page} dari {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>Sebelumnya</Button>
            <Button variant="secondary" size="sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>Berikutnya</Button>
          </div>
        </div>
      )}
    </div>
  );
}
