"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { formatRupiah } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from "@/components/ui/card";
import { AdminTable, Tr, Td } from "@/components/ui/AdminTable";
import { Download } from "lucide-react";
import { SourceList, API_BASE, utcDateNDaysAgo } from "./shared";

interface SourcesData {
  from: string;
  to: string;
  acquisition: { source: string; medium: string; campaign: string; signups: number; checkouts: number; payments: number; revenue: number }[];
  first_touch: { source: string; users: number }[];
  signup_sources: { source: string; users: number }[];
  upgrade_sources: { source: string; upgrades: number; revenue: number }[];
}

export function AcquisitionTab({ days }: { days: string }) {
  const [sources, setSources] = useState<SourcesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api(`/api/admin/analytics/sources?from=${utcDateNDaysAgo(Number(days) - 1)}&to=${utcDateNDaysAgo(0)}`)
      .then((res) => {
        if (res.success) setSources(res.data as SourcesData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [days]);

  const exportUrl = `${API_BASE}/api/admin/analytics/export?type=sources&from=${utcDateNDaysAgo(Number(days) - 1)}&to=${utcDateNDaysAgo(0)}`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Akuisisi per Source / Campaign ({sources?.from} → {sources?.to})</CardTitle>
          <CardToolbar>
            <button
              onClick={() => window.open(exportUrl, "_blank")}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-full px-3 py-1.5 cursor-pointer"
            >
              <Download size={13} /> CSV
            </button>
          </CardToolbar>
        </CardHeader>
        <CardContent>
          <AdminTable
            columns={[
              { key: "source", label: "Source" },
              { key: "medium", label: "Medium" },
              { key: "campaign", label: "Campaign" },
              { key: "signups", label: "Signups" },
              { key: "checkouts", label: "Checkouts" },
              { key: "payments", label: "Payments" },
              { key: "revenue", label: "Revenue", className: "text-right" },
            ]}
            loading={loading}
            empty={<p className="text-sm text-gray-400 py-6 text-center">Belum ada data akuisisi (terisi oleh rollup harian).</p>}
          >
            {(sources?.acquisition || []).map((row, i) => (
              <Tr key={`${row.source}-${row.medium}-${row.campaign}-${i}`}>
                <Td className="font-medium">{row.source}</Td>
                <Td>{row.medium}</Td>
                <Td>{row.campaign}</Td>
                <Td>{row.signups}</Td>
                <Td>{row.checkouts}</Td>
                <Td>{row.payments}</Td>
                <Td className="text-right font-semibold">{formatRupiah(row.revenue)}</Td>
              </Tr>
            ))}
          </AdminTable>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle>First-Touch Source</CardTitle></CardHeader>
          <CardContent>
            <SourceList rows={(sources?.first_touch || []).map((r) => ({ label: r.source, value: String(r.users) }))} loading={loading} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Signup Source (form)</CardTitle></CardHeader>
          <CardContent>
            <SourceList rows={(sources?.signup_sources || []).map((r) => ({ label: r.source, value: String(r.users) }))} loading={loading} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Upgrade Source</CardTitle></CardHeader>
          <CardContent>
            <SourceList
              rows={(sources?.upgrade_sources || []).map((r) => ({ label: r.source, value: `${r.upgrades} · ${formatRupiah(r.revenue)}` }))}
              loading={loading}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
