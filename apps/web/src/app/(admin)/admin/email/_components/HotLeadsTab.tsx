"use client";

import { AdminTable, Tr, Td, StatusBadge } from "@/components/ui/AdminTable";
import { Button } from "@/components/ui/Button";
import { cn, formatDate } from "@/lib/utils";
import type { HotLead } from "./types";

interface Props {
  data: HotLead[] | null;
  loading: boolean;
  error?: string | null;
  minScore: number;
  setMinScore: (v: number) => void;
  onApply: () => void;
}

export function HotLeadsTab({ data, loading, error, minScore, setMinScore, onApply }: Props) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <label className="text-sm font-medium text-warm-black whitespace-nowrap">Min. Engagement Score:</label>
        <input
          type="number"
          value={minScore}
          onChange={(e) => setMinScore(Number(e.target.value))}
          className="w-20 px-3 py-2 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white outline-none focus:border-primary text-warm-black"
          min={0}
          max={100}
        />
        <Button variant="secondary" size="sm" onClick={onApply}>Apply</Button>
        {data && <span className="text-sm text-[rgba(12,12,10,0.45)]">{data.length} hot leads ditemukan</span>}
      </div>
      {error ? <div className="text-center py-10 text-red-600 text-sm">{error}</div> : <AdminTable
        loading={loading}
        columns={[
          { key: "name", label: "Nama" },
          { key: "email", label: "Email" },
          { key: "score", label: "Score" },
          { key: "membership", label: "Membership" },
          { key: "paid", label: "Paid" },
          { key: "last_click", label: "Last Click" },
        ]}
        empty={<div className="text-center py-10 text-[rgba(12,12,10,0.35)] text-sm">Tidak ada hot leads dengan score ≥ {minScore}</div>}
      >
        {(data ?? []).map((lead) => (
          <Tr key={lead.id}>
            <Td>
              <div>
                <p className="font-medium">{lead.name || "—"}</p>
                {lead.interest && <p className="text-xs text-[rgba(12,12,10,0.45)]">{lead.interest}</p>}
              </div>
            </Td>
            <Td className="text-sm">{lead.email}</Td>
            <Td>
              <span className={cn(
                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold",
                lead.engagement_score >= 70 ? "bg-green-100 text-green-800"
                  : lead.engagement_score >= 40 ? "bg-amber-100 text-amber-800"
                  : "bg-gray-100 text-gray-600"
              )}>
                {lead.engagement_score}
              </span>
            </Td>
            <Td><StatusBadge status={lead.membership_status || "inactive"} /></Td>
            <Td>
              {lead.is_paid_user
                ? <span className="text-xs font-semibold text-green-600">Ya</span>
                : <span className="text-xs text-[rgba(12,12,10,0.35)]">Tidak</span>
              }
            </Td>
            <Td className="text-xs text-[rgba(12,12,10,0.45)]">
              {lead.last_email_click_at ? formatDate(lead.last_email_click_at) : "—"}
            </Td>
          </Tr>
        ))}
      </AdminTable>
      }
    </div>
  );
}
