"use client";

import { PenLine, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SequenceWithSteps, TemplateStep } from "./types";

interface Props {
  data: SequenceWithSteps[] | null;
  loading: boolean;
  error?: string | null;
  onEdit: (step: TemplateStep, seqName: string) => void;
}

function formatDelay(minutes: number): string {
  if (minutes === 0) return "Langsung";
  if (minutes < 60) return `+${minutes} mnt`;
  if (minutes < 1440) return `+${Math.floor(minutes / 60)} jam`;
  return `+${Math.floor(minutes / 1440)} hari`;
}

export function TemplatesTab({ data, loading, error, onEdit }: Props) {
  if (error) {
    return <div className="text-center py-16 text-red-600 text-sm">{error}</div>;
  }

  if (loading || !data) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[140px] rounded-xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-16 text-[rgba(12,12,10,0.35)] text-sm">
        Belum ada template ditemukan
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {data.map((seq) => {
        const customCount = seq.steps.filter((s) => s.hasCustomContent).length;
        return (
          <Card key={seq.id}>
            <CardHeader className="items-start py-3.5">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-sm">{seq.name}</CardTitle>
                <p className="text-xs text-[rgba(12,12,10,0.4)] mt-0.5">
                  Trigger: <span className="font-medium">{seq.triggerEvent}</span>
                  {seq.description && ` · ${seq.description}`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-[rgba(12,12,10,0.35)]">{seq.steps.length} email</span>
                {customCount > 0 ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-600 border border-amber-200/60">
                    {customCount} kustom
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-[rgba(12,12,10,0.4)]">
                    default
                  </span>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="divide-y divide-[rgba(12,12,10,0.04)]">
                {seq.steps.map((step) => (
                  <div
                    key={step.id}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/80 transition-colors"
                  >
                    {/* Step number */}
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-[rgba(12,12,10,0.4)] tabular-nums">
                        {step.stepOrder}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-warm-black truncate leading-snug font-medium">
                        {step.subject}
                      </p>
                      {step.previewText && (
                        <p className="text-[11px] text-[rgba(12,12,10,0.42)] truncate mt-0.5">
                          {step.previewText}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex items-center gap-1 text-[11px] text-[rgba(12,12,10,0.4)]">
                          <Clock size={10} />
                          {formatDelay(step.delayMinutes)}
                        </div>
                        <span className="text-[rgba(12,12,10,0.2)] text-[10px]">·</span>
                        <code className="text-[10px] font-mono text-[rgba(12,12,10,0.35)]">
                          {step.templateKey}
                        </code>
                      </div>
                    </div>

                    {/* Badges + Edit */}
                    <div className="flex items-center gap-2 shrink-0">
                      {step.hasCustomContent && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-200/60">
                          Kustom
                        </span>
                      )}
                      <button
                        onClick={() => onEdit(step, seq.name)}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150",
                          "text-[rgba(12,12,10,0.55)] hover:text-[#8B1414] hover:bg-[#F7E8E8] border border-transparent hover:border-[#8B1414]/20"
                        )}
                      >
                        <PenLine size={12} />
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
