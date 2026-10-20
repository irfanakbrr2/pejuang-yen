"use client";

import { ChevronDown, ChevronRight, Pause, Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/AdminTable";
import { cn, formatDate } from "@/lib/utils";
import type { Sequence } from "./types";

interface Props {
  data: Sequence[] | null;
  loading: boolean;
  error?: string | null;
  expanded: string | null;
  setExpanded: (id: string | null) => void;
  onToggleStatus: (seqId: string, currentStatus: string) => void;
  togglingId: string | null;
}

export function SequencesTab({ data, loading, error, expanded, setExpanded, onToggleStatus, togglingId }: Props) {
  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-[160px] rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-16 text-red-600 text-sm">{error}</div>;
  }

  if (!data || data.length === 0) {
    return <div className="text-center py-16 text-[rgba(12,12,10,0.35)] text-sm">Belum ada email sequence</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      {data.map((seq) => (
        <Card key={seq.id}>
          <CardHeader className="items-start">
            <div className="flex-1 min-w-0">
              <CardTitle>{seq.name}</CardTitle>
              <p className="text-xs text-[rgba(12,12,10,0.45)] mt-0.5">
                Trigger: <span className="font-medium">{seq.trigger_event}</span>
                {seq.description && ` • ${seq.description}`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              <StatusBadge status={seq.status} />
              <span className="text-sm font-bold text-[#8B1414]">{seq.completionRate}% selesai</span>
              <button
                onClick={() => onToggleStatus(seq.id, seq.status)}
                disabled={togglingId === seq.id}
                className={cn(
                  "flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg transition-colors border",
                  seq.status === "active"
                    ? "text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100"
                    : "text-green-700 bg-green-50 border-green-200 hover:bg-green-100",
                  togglingId === seq.id && "opacity-50 cursor-not-allowed"
                )}
              >
                {seq.status === "active" ? <Pause size={12} /> : <Play size={12} />}
                {togglingId === seq.id ? "..." : seq.status === "active" ? "Pause" : "Aktifkan"}
              </button>
              <button
                onClick={() => setExpanded(expanded === seq.id ? null : seq.id)}
                className="flex items-center gap-1 text-xs text-[rgba(12,12,10,0.45)] hover:text-warm-black transition-colors px-2 py-1 rounded-lg hover:bg-gray-100"
              >
                {expanded === seq.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {expanded === seq.id ? "Tutup" : "Steps"}
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Started", value: seq.total_started, color: "text-blue-600" },
                { label: "Active", value: seq.active_users, color: "text-amber-600" },
                { label: "Completed", value: seq.completed_users, color: "text-green-600" },
                { label: "Cancelled", value: seq.cancelled_users, color: "text-gray-500" },
              ].map((s) => (
                <div key={s.label} className="text-center p-3 bg-gray-50 rounded-xl">
                  <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
                  <p className="text-xs text-[rgba(12,12,10,0.45)]">{s.label}</p>
                </div>
              ))}
            </div>
            {expanded === seq.id && seq.stepDropoff.length > 0 && (
              <div className="border-t border-[rgba(12,12,10,0.06)] pt-4 mt-4">
                <p className="text-xs font-semibold text-[rgba(12,12,10,0.45)] uppercase tracking-wider mb-3">Step Drop-off</p>
                <div className="flex flex-col gap-2">
                  {seq.stepDropoff.map((step, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-[rgba(12,12,10,0.35)] w-6 shrink-0">#{step.step_order}</span>
                      <span className="text-xs text-warm-black flex-1 truncate">{step.subject}</span>
                      <span className="text-xs text-[rgba(12,12,10,0.45)] shrink-0">
                        {step.unique_recipients.toLocaleString("id-ID")} recipients
                      </span>
                      <span className="text-xs text-[rgba(12,12,10,0.35)] shrink-0">
                        {step.last_sent_at ? formatDate(step.last_sent_at) : "belum terkirim"}
                      </span>
                      <span className="text-xs font-semibold text-[#8B1414] shrink-0">{step.sent_count.toLocaleString("id-ID")} sent events</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
