"use client";

import { Users, Mail, Ban, DollarSign, Send, TrendingUp, Zap, Eye, MousePointer, AlertTriangle, GitBranch, CheckCircle2, Clock } from "lucide-react";
import { BentoStatCard } from "@/components/ui/bento-stat-card";
import { cn, formatDate, formatRupiah } from "@/lib/utils";
import type { EmailDiagnostics, OverviewData } from "./types";

interface Props {
  data: OverviewData | null;
  loading: boolean;
  error?: string | null;
  diagnostics: EmailDiagnostics | null;
  diagnosticsLoading: boolean;
  diagnosticsError?: string | null;
}

export function OverviewTab({ data, loading, error, diagnostics, diagnosticsLoading, diagnosticsError }: Props) {
  if (error) {
    return <div className="text-center py-16 text-red-600 text-sm">{error}</div>;
  }

  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-[140px] rounded-2xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  const credits = data.mailketingCredits;
  const creditsAccent = credits.isEmpty || credits.isCritical ? "rose" : credits.isWarning ? "orange" : "green";
  const creditsSubtitle = credits.isEmpty
    ? "Kredit habis!"
    : credits.isCritical
    ? "Kritis — isi segera"
    : credits.isWarning
    ? "Perlu diisi"
    : "Cukup";
  const lastRun = diagnostics?.lastSequenceRuns[0];
  const lastRunAgeMs = diagnostics && lastRun?.started_at
    ? new Date(diagnostics.generatedAt).getTime() - new Date(lastRun.started_at).getTime()
    : null;
  const lastRunStale = diagnostics ? !lastRun || (lastRunAgeMs !== null && lastRunAgeMs > 20 * 60 * 1000) : false;
  const lastRunError = lastRun?.error_message || null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[rgba(12,12,10,0.08)] bg-white/60 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-warm-black">Sequence Health</p>
            <p className="text-xs text-[rgba(12,12,10,0.45)] mt-0.5">Backlog, schema guard, dan run terakhir automation</p>
          </div>
          {diagnosticsLoading ? (
            <span className="text-xs text-[rgba(12,12,10,0.4)]">Memuat...</span>
          ) : diagnosticsError ? (
            <span className="text-xs font-medium text-red-600">{diagnosticsError}</span>
          ) : diagnostics ? (
            <span className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
              diagnostics.schema.ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            )}>
              {diagnostics.schema.ok ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
              {diagnostics.schema.ok ? "Schema OK" : "Schema drift"}
            </span>
          ) : null}
        </div>
        {diagnostics && (
          <>
            {(lastRunError || lastRunStale) && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                {lastRunError ? `Run terakhir error: ${lastRunError}` : "Sequence cron belum mencatat run terbaru."}
              </div>
            )}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xl font-bold text-[#8B1414]">{diagnostics.sequenceBacklog.totalReady.toLocaleString("id-ID")}</p>
                <p className="text-xs text-[rgba(12,12,10,0.45)]">ready backlog</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xl font-bold text-blue-600">{lastRun?.sent_count?.toLocaleString("id-ID") ?? "0"}</p>
                <p className="text-xs text-[rgba(12,12,10,0.45)]">sent run terakhir</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-xl font-bold text-rose-600">
                  {diagnostics.sequenceFailures.filter((f) => f.status === "failed" || f.failure_count > 0).reduce((sum, f) => sum + f.count, 0).toLocaleString("id-ID")}
                </p>
                <p className="text-xs text-[rgba(12,12,10,0.45)]">failed/retry states</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="flex items-center gap-1.5">
                  <Clock size={14} className="text-[rgba(12,12,10,0.35)]" />
                  <p className="text-sm font-semibold text-warm-black">
                    {lastRun?.started_at ? formatDate(lastRun.started_at) : "Belum ada run"}
                  </p>
                </div>
                <p className="text-xs text-[rgba(12,12,10,0.45)]">run terakhir</p>
              </div>
            </div>
          </>
        )}
      </div>

      <p className="text-xs font-medium text-[rgba(12,12,10,0.4)] uppercase tracking-wider">Subscriber & Users</p>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <BentoStatCard
          title="Total Terdaftar"
          value={data.totalSubscribers.toLocaleString("id-ID")}
          subtitle="user aktif di platform"
          icon={Users}
          accentColor="blue"
        />
        <BentoStatCard
          title="Subscriber Aktif"
          value={data.activeSubscribers.toLocaleString("id-ID")}
          subtitle="masih berlangganan email"
          icon={Mail}
          accentColor="green"
        />
        <BentoStatCard
          title="Berhenti Berlangganan"
          value={data.unsubscribedUsers.toLocaleString("id-ID")}
          subtitle="opt-out dari email"
          icon={Ban}
          accentColor="orange"
        />
        <BentoStatCard
          title="Pengguna Berbayar"
          value={data.paidUsers.toLocaleString("id-ID")}
          subtitle="sudah beli kelas"
          icon={DollarSign}
          accentColor="teal"
        />
        <BentoStatCard
          title="Sequence Aktif"
          value={data.activeSequenceUsers.toLocaleString("id-ID")}
          subtitle="user dalam automation"
          icon={GitBranch}
          accentColor="purple"
        />
        <BentoStatCard
          title="Kredit Mailketing"
          value={credits.balance.toLocaleString("id-ID")}
          subtitle={creditsSubtitle}
          icon={Zap}
          accentColor={creditsAccent}
        />
      </div>

      <p className="text-xs font-medium text-[rgba(12,12,10,0.4)] uppercase tracking-wider pt-2">Engagement Email (Total)</p>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <BentoStatCard
          title="Email Dibuka"
          value={data.totalOpens.toLocaleString("id-ID")}
          subtitle="total open events"
          icon={Eye}
          accentColor="green"
        />
        <BentoStatCard
          title="Link Diklik"
          value={data.totalClicks.toLocaleString("id-ID")}
          subtitle="total click events"
          icon={MousePointer}
          accentColor="teal"
        />
        <BentoStatCard
          title="Email Bounced"
          value={data.totalBounced.toLocaleString("id-ID")}
          subtitle="gagal terkirim"
          icon={AlertTriangle}
          accentColor={data.totalBounced > 0 ? "rose" : "green"}
        />
        <BentoStatCard
          title="Terkirim Hari Ini"
          value={data.emailsSentToday.toLocaleString("id-ID")}
          subtitle="dalam 24 jam terakhir"
          icon={Send}
          accentColor="blue"
        />
        <BentoStatCard
          title="Revenue dari Email"
          value={formatRupiah(data.emailAttributedRevenue)}
          subtitle="dari campaign email"
          icon={TrendingUp}
          accentColor="teal"
        />
      </div>
    </div>
  );
}
