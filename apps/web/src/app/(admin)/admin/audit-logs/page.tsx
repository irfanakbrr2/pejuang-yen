"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useState, useEffect, Suspense } from "react";

import { AdminTable, Tr, Td } from "@/components/ui/AdminTable";
import { TableRowSkeleton } from "@/components/ui/Skeleton";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { Pagination } from "@/components/ui/Pagination";

interface AuditLog {
  id: string;
  actor_user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  created_at: string;
}

function AdminAuditLogsContent() {
  const [page, setPage] = useState(1);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState("");
  const [totalPages, setTotalPages] = useState(1);


  const loadData = (currentPage = page, currentAction = action) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(currentPage), limit: "50" });
    if (currentAction) params.set("action", currentAction);
    fetch(`/api/admin/audit-logs?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setLogs(d.data || []);
          setTotalPages(d.pagination?.totalPages || 1);
        } else {
          setError(d.error || "Gagal memuat data");
        }
      })
      .catch(() => setError("Gagal memuat data. Periksa koneksi internet."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(page, action); }, [page, action]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="System" title="Audit Logs" description="Riwayat semua aksi di platform" />

      <div className="glass-card p-3 w-fit">
        <input
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }}
          placeholder="Filter action..."
          className="px-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black placeholder:text-[rgba(12,12,10,0.35)] outline-none focus:border-primary focus:ring-2 focus:ring-primary-light transition-colors w-56"
        />
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-sm text-red-500">{error}</p>
          <button onClick={() => loadData(page, action)} className="text-xs font-medium text-primary hover:underline">Coba Lagi</button>
        </div>
      ) : (
        <AdminTable
          columns={[
            { key: "time", label: "Waktu" },
            { key: "actor", label: "Actor" },
            { key: "action", label: "Action" },
            { key: "entity", label: "Entity" },
            { key: "id", label: "Entity ID" },
          ]}
          loading={loading}
          empty={<div className="text-center py-10 text-[rgba(12,12,10,0.35)] text-sm">Tidak ada log</div>}
        >
          {loading ? (
            <TableRowSkeleton cols={5} rows={8} />
          ) : logs.map((log) => (
            <Tr key={log.id}>
              <Td className="text-[rgba(12,12,10,0.45)] text-xs whitespace-nowrap">
                {new Date(log.created_at).toLocaleString("id-ID")}
              </Td>
              <Td className="font-mono text-xs text-[rgba(12,12,10,0.55)]">
                {log.actor_user_id?.slice(0, 10) || "system"}
              </Td>
              <Td className="font-semibold text-warm-black">{log.action}</Td>
              <Td className="text-[rgba(12,12,10,0.65)]">{log.entity_type}</Td>
              <Td className="font-mono text-xs text-[rgba(12,12,10,0.35)]">
                {log.entity_id?.slice(0, 12) || "—"}
              </Td>
            </Tr>
          ))}
        </AdminTable>
      )}

      {totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}

export default function AdminAuditLogsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-[400px] bg-gray-100 rounded-xl animate-pulse" />
      </div>
    }>
      <AdminAuditLogsContent />
    </Suspense>
  );
}
