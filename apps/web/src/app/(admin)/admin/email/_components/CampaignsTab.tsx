"use client";

import { Plus } from "lucide-react";
import { AdminTable, Tr, Td, StatusBadge } from "@/components/ui/AdminTable";
import { cn, formatRupiah, formatDate } from "@/lib/utils";
import type { Campaign } from "./types";

interface Props {
  data: Campaign[] | null;
  loading: boolean;
  error?: string | null;
  onCreateCampaign: () => void;
}

export function CampaignsTab({ data, loading, error, onCreateCampaign }: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-warm-black">Broadcast Campaigns</h3>
          <p className="text-xs text-[rgba(12,12,10,0.45)] mt-0.5">
            {data ? `${data.length} campaign` : "Memuat..."}
          </p>
        </div>
        <button
          onClick={onCreateCampaign}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#8B1414] text-white text-sm font-medium hover:bg-[#0d5f4a] transition-colors duration-150"
        >
          <Plus size={14} />
          Buat Campaign
        </button>
      </div>

      {error && <div className="text-center py-10 text-red-600 text-sm">{error}</div>}

      {!error && <AdminTable
        loading={loading}
        columns={[
          { key: "name", label: "Nama Campaign" },
          { key: "type", label: "Tipe" },
          { key: "status", label: "Status" },
          { key: "sent", label: "Terkirim" },
          { key: "open", label: "Open Rate" },
          { key: "click", label: "Click Rate" },
          { key: "revenue", label: "Revenue" },
          { key: "date", label: "Tanggal" },
        ]}
        empty={<div className="text-center py-10 text-[rgba(12,12,10,0.35)] text-sm">Belum ada campaign. Klik &ldquo;Buat Campaign&rdquo; untuk memulai.</div>}
      >
        {(data ?? []).map((cam) => (
          <Tr key={cam.id}>
            <Td>
              <div>
                <p className="font-medium text-warm-black">{cam.name}</p>
                <p className="text-xs text-[rgba(12,12,10,0.45)] truncate max-w-[200px]">{cam.subject}</p>
              </div>
            </Td>
            <Td>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 capitalize">{cam.campaign_type}</span>
            </Td>
            <Td><StatusBadge status={cam.status} /></Td>
            <Td className="font-medium">{cam.sent_count.toLocaleString("id-ID")}</Td>
            <Td>
              <span className={cn("font-semibold", Number(cam.openRate) >= 20 ? "text-green-600" : Number(cam.openRate) >= 10 ? "text-amber-600" : "text-red-500")}>
                {cam.openRate}%
              </span>
            </Td>
            <Td>
              <span className={cn("font-semibold", Number(cam.clickRate) >= 5 ? "text-green-600" : Number(cam.clickRate) >= 2 ? "text-amber-600" : "text-red-500")}>
                {cam.clickRate}%
              </span>
            </Td>
            <Td className="font-medium text-[#8B1414]">{cam.revenue_attributed > 0 ? formatRupiah(cam.revenue_attributed) : "—"}</Td>
            <Td className="text-[rgba(12,12,10,0.45)] text-xs">{formatDate(cam.created_at)}</Td>
          </Tr>
        ))}
      </AdminTable>
      }
    </div>
  );
}
