"use client";

import { useState, useEffect } from "react";
import { Users, Calendar, Ticket, ChevronLeft, ChevronRight } from "lucide-react";

interface Lead {
  name: string;
  type: "registration" | "webinar";
  created_at: string;
  detail?: string | null;
}

interface LeadsPage {
  leads: Lead[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const typeConfig = {
  registration: { label: "Akun Baru", icon: Users, bg: "bg-blue-50 dark:bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" },
  webinar: { label: "Webinar", icon: Ticket, bg: "bg-emerald-50 dark:bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
} as const;

export function LeadsList() {
  const [data, setData] = useState<LeadsPage | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/affiliate/leads?page=${page}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { if (d.success) setData(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  if (loading) {
    return (
      <div className="glass-card p-5 space-y-3">
        <div className="skeleton h-4 w-32 rounded" />
        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-12 rounded" />)}
      </div>
    );
  }

  if (!data || data.total === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <Users size={32} className="mx-auto mb-3 text-[rgba(12,12,10,0.2)] dark:text-white/20" />
        <p className="text-sm text-[rgba(12,12,10,0.45)] dark:text-slate-400">
          Belum ada leads. Share link affiliatemu untuk mulai tracking.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-5 py-4 border-b border-[rgba(12,12,10,0.06)] dark:border-white/[0.05] flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#0D0D0D] dark:text-white">
            Semua Leads <span className="text-[rgba(12,12,10,0.4)] dark:text-slate-500 font-normal">({data.total})</span>
          </h3>
          <p className="text-xs text-[rgba(12,12,10,0.45)] dark:text-slate-400 mt-0.5">Nama disensor sebagian untuk privasi</p>
        </div>
        {data.totalPages > 1 && (
          <span className="text-xs text-[rgba(12,12,10,0.4)] dark:text-slate-500">
            Hal {data.page} / {data.totalPages}
          </span>
        )}
      </div>

      <div className="divide-y divide-[rgba(12,12,10,0.06)] dark:divide-white/[0.05]">
        {data.leads.map((lead, i) => {
          const cfg = typeConfig[lead.type] ?? typeConfig.registration;
          const Icon = cfg.icon;
          return (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5">
              <div className={`flex-shrink-0 w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center`}>
                <Icon size={14} className={cfg.text} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#0D0D0D] dark:text-white truncate">{lead.name}</p>
                {lead.detail && (
                  <p className="text-xs text-[rgba(12,12,10,0.45)] dark:text-slate-400 truncate">{lead.detail}</p>
                )}
              </div>
              <div className="flex-shrink-0 text-right">
                <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} mb-1`}>
                  {cfg.label}
                </span>
                <p className="text-xs text-[rgba(12,12,10,0.4)] dark:text-slate-500 flex items-center gap-1 justify-end">
                  <Calendar size={10} />
                  {formatDate(lead.created_at)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {data.totalPages > 1 && (
        <div className="px-5 py-3 border-t border-[rgba(12,12,10,0.06)] dark:border-white/[0.05] flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 text-xs font-medium text-[rgba(12,12,10,0.5)] dark:text-slate-400 disabled:opacity-30 hover:text-[#0D0D0D] dark:hover:text-white transition-colors"
          >
            <ChevronLeft size={14} /> Sebelumnya
          </button>
          <span className="text-xs text-[rgba(12,12,10,0.4)] dark:text-slate-500">
            {((page - 1) * data.limit) + 1}–{Math.min(page * data.limit, data.total)} dari {data.total}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={page === data.totalPages}
            className="flex items-center gap-1 text-xs font-medium text-[rgba(12,12,10,0.5)] dark:text-slate-400 disabled:opacity-30 hover:text-[#0D0D0D] dark:hover:text-white transition-colors"
          >
            Berikutnya <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
