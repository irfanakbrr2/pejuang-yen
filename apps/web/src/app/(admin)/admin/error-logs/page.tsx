"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useState, useEffect, Suspense } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { Pagination } from "@/components/ui/Pagination";

interface ErrorLog {
  id: string;
  source: string;
  message: string;
  stack?: string;
  created_at: string;
}

function AdminErrorLogsContent() {
  const [page, setPage] = useState(1);

  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);


  const loadData = (currentPage = page) => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/error-logs?page=${currentPage}&limit=50`, { credentials: "include" })
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

  useEffect(() => { loadData(page); }, [page]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="System" title="Error Logs" description="Error dan exception yang terjadi di platform" />

      {loading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-sm text-red-500">{error}</p>
          <button onClick={() => loadData(page)} className="text-xs font-medium text-primary hover:underline">Coba Lagi</button>
        </div>
      ) : logs.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <p className="text-sm text-[rgba(12,12,10,0.35)]">Tidak ada error log. Platform berjalan baik!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="glass-card overflow-hidden"
            >
              <button
                onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                className="w-full flex items-start justify-between gap-3 px-5 py-3.5 text-left hover:bg-warm-cream/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-red-100 text-red-700">
                      {log.source}
                    </span>
                    <span className="text-xs text-[rgba(12,12,10,0.35)]">
                      {new Date(log.created_at).toLocaleString("id-ID")}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-warm-black truncate">{log.message}</p>
                </div>
                {expanded === log.id ? (
                  <ChevronUp size={16} className="text-[rgba(12,12,10,0.35)] flex-shrink-0 mt-0.5" />
                ) : (
                  <ChevronDown size={16} className="text-[rgba(12,12,10,0.35)] flex-shrink-0 mt-0.5" />
                )}
              </button>
              {expanded === log.id && log.stack && (
                <div className="px-5 pb-4">
                  <pre className="bg-warm-black text-cream p-3 rounded-lg text-xs overflow-auto whitespace-pre-wrap break-all leading-relaxed">
                    {log.stack}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      )}
    </div>
  );
}

export default function AdminErrorLogsPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-[400px] bg-gray-100 rounded-xl animate-pulse" />
      </div>
    }>
      <AdminErrorLogsContent />
    </Suspense>
  );
}
