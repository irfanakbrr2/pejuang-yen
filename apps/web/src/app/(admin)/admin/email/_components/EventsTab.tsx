"use client";

import { AdminTable, Tr, Td } from "@/components/ui/AdminTable";
import { Button } from "@/components/ui/Button";
import { cn, formatDate } from "@/lib/utils";
import { EVENT_TYPES, eventBadgeClass } from "./types";
import type { EmailEvent } from "./types";

interface Props {
  data: EmailEvent[] | null;
  loading: boolean;
  error?: string | null;
  typeFilter: string;
  setTypeFilter: (v: string) => void;
  emailFilter: string;
  setEmailFilter: (v: string) => void;
  page: number;
  setPage: (p: number) => void;
}

export function EventsTab({ data, loading, error, typeFilter, setTypeFilter, emailFilter, setEmailFilter, page, setPage }: Props) {
  return (
    <div>
      <div className="flex gap-3 mb-4 flex-wrap">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white outline-none focus:border-primary text-warm-black"
        >
          <option value="">Semua Tipe</option>
          {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input
          value={emailFilter}
          onChange={(e) => setEmailFilter(e.target.value)}
          placeholder="Filter email..."
          className="px-3.5 py-2 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white outline-none focus:border-primary text-warm-black min-w-[200px]"
        />
      </div>
      {error ? <div className="text-center py-10 text-red-600 text-sm">{error}</div> : <AdminTable
        loading={loading}
        columns={[
          { key: "time", label: "Waktu" },
          { key: "email", label: "Email" },
          { key: "type", label: "Event" },
          { key: "subject", label: "Subject" },
        ]}
        empty={<div className="text-center py-10 text-[rgba(12,12,10,0.35)] text-sm">Tidak ada event</div>}
      >
        {(data ?? []).map((ev) => (
          <Tr key={ev.id}>
            <Td className="text-xs text-[rgba(12,12,10,0.45)] whitespace-nowrap">{formatDate(ev.created_at)}</Td>
            <Td>
              <div>
                <p className="font-medium text-sm">{ev.email}</p>
                {ev.user_name && <p className="text-xs text-[rgba(12,12,10,0.45)]">{ev.user_name}</p>}
              </div>
            </Td>
            <Td>
              <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize", eventBadgeClass[ev.event_type] ?? "bg-gray-100 text-gray-600")}>
                {ev.event_type}
              </span>
            </Td>
            <Td className="text-xs text-[rgba(12,12,10,0.55)] max-w-[260px] truncate">{ev.email_subject ?? "—"}</Td>
          </Tr>
        ))}
      </AdminTable>
      }
      {!error && <div className="flex items-center justify-between mt-4">
        <span className="text-sm text-[rgba(12,12,10,0.45)]">Halaman {page}</span>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>Sebelumnya</Button>
          <Button variant="secondary" size="sm" onClick={() => setPage(page + 1)} disabled={!data || data.length < 100}>Berikutnya</Button>
        </div>
      </div>}
    </div>
  );
}
