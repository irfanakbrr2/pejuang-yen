"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useRef } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  TABS,
  type TabKey,
  type OverviewData,
  type Campaign,
  type Sequence,
  type EmailEvent,
  type SuppressionEntry,
  type HotLead,
  type EmailSettings,
  type SequenceWithSteps,
  type TemplateStep,
  type EmailDiagnostics,
} from "./_components/types";
import { OverviewTab } from "./_components/OverviewTab";
import { CampaignsTab } from "./_components/CampaignsTab";
import { SequencesTab } from "./_components/SequencesTab";
import { EventsTab } from "./_components/EventsTab";
import { SuppressionTab } from "./_components/SuppressionTab";
import { HotLeadsTab } from "./_components/HotLeadsTab";
import { TemplatesTab } from "./_components/TemplatesTab";
import { EmailSettingsTab } from "./_components/EmailSettingsTab";
import { TemplateEditor } from "./_components/TemplateEditor";
import { CreateCampaignModal } from "./_components/CreateCampaignModal";
import { PageHeader } from "@/components/ui/dashboard-chrome";

async function adminFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { credentials: "include", ...init });
  const payload = await res.json().catch(() => null) as { success?: boolean; data?: T; error?: string } | null;
  if (!res.ok || !payload?.success) {
    throw new Error(payload?.error || "Request gagal");
  }
  return payload.data as T;
}

export default function AdminEmailPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [sequences, setSequences] = useState<Sequence[] | null>(null);
  const [events, setEvents] = useState<EmailEvent[] | null>(null);
  const [suppression, setSuppression] = useState<SuppressionEntry[] | null>(null);
  const [hotLeads, setHotLeads] = useState<HotLead[] | null>(null);
  const [templates, setTemplates] = useState<SequenceWithSteps[] | null>(null);
  const [diagnostics, setDiagnostics] = useState<EmailDiagnostics | null>(null);
  const [emailSettings, setEmailSettings] = useState<EmailSettings>({
    email_from_name: "",
    email_from_address: "",
    mailketing_api_token: "",
  });

  const [loadingOverview, setLoadingOverview] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [loadingSequences, setLoadingSequences] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingSuppression, setLoadingSuppression] = useState(false);
  const [loadingHotLeads, setLoadingHotLeads] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [tabErrors, setTabErrors] = useState<Record<string, string | null>>({});

  const [eventsTypeFilter, setEventsTypeFilter] = useState("");
  const [eventsEmailFilter, setEventsEmailFilter] = useState("");
  const [eventsPage, setEventsPage] = useState(1);
  const [suppressionPage, setSuppressionPage] = useState(1);
  const [suppressionTotal, setSuppressionTotal] = useState(0);
  const [minScore, setMinScore] = useState(30);
  const [expandedSequence, setExpandedSequence] = useState<string | null>(null);

  const [editingStep, setEditingStep] = useState<TemplateStep | null>(null);
  const [editingSeqName, setEditingSeqName] = useState("");
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [togglingSequenceId, setTogglingSequenceId] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (activeTab !== "overview" || overview !== null) return;
    setLoadingOverview(true);
    setTabErrors((prev) => ({ ...prev, overview: null }));
    adminFetch<OverviewData>("/api/admin/email/overview")
      .then(setOverview)
      .catch((err) => setTabErrors((prev) => ({ ...prev, overview: err instanceof Error ? err.message : "Gagal memuat overview" })))
      .finally(() => setLoadingOverview(false));
  }, [activeTab, overview]);

  useEffect(() => {
    if (activeTab !== "campaigns" || campaigns !== null) return;
    setLoadingCampaigns(true);
    setTabErrors((prev) => ({ ...prev, campaigns: null }));
    adminFetch<{ campaigns: Campaign[] }>("/api/admin/email/campaigns")
      .then((data) => setCampaigns(data.campaigns))
      .catch((err) => setTabErrors((prev) => ({ ...prev, campaigns: err instanceof Error ? err.message : "Gagal memuat campaign" })))
      .finally(() => setLoadingCampaigns(false));
  }, [activeTab, campaigns]);

  useEffect(() => {
    if (activeTab !== "sequences" || sequences !== null) return;
    setLoadingSequences(true);
    setTabErrors((prev) => ({ ...prev, sequences: null }));
    adminFetch<{ sequences: Sequence[] }>("/api/admin/email/sequences")
      .then((data) => setSequences(data.sequences))
      .catch((err) => setTabErrors((prev) => ({ ...prev, sequences: err instanceof Error ? err.message : "Gagal memuat sequence" })))
      .finally(() => setLoadingSequences(false));
  }, [activeTab, sequences]);

  useEffect(() => {
    if ((activeTab !== "overview" && activeTab !== "sequences") || diagnostics !== null) return;
    setLoadingDiagnostics(true);
    setTabErrors((prev) => ({ ...prev, diagnostics: null }));
    adminFetch<EmailDiagnostics>("/api/admin/email/diagnostics")
      .then(setDiagnostics)
      .catch((err) => setTabErrors((prev) => ({ ...prev, diagnostics: err instanceof Error ? err.message : "Gagal memuat diagnostics" })))
      .finally(() => setLoadingDiagnostics(false));
  }, [activeTab, diagnostics]);

  useEffect(() => {
    if (activeTab !== "events") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoadingEvents(true);
      setTabErrors((prev) => ({ ...prev, events: null }));
      const params = new URLSearchParams({ page: String(eventsPage) });
      if (eventsTypeFilter) params.set("type", eventsTypeFilter);
      if (eventsEmailFilter) params.set("email", eventsEmailFilter);
      adminFetch<{ events: EmailEvent[] }>(`/api/admin/email/events?${params}`)
        .then((data) => setEvents(data.events))
        .catch((err) => setTabErrors((prev) => ({ ...prev, events: err instanceof Error ? err.message : "Gagal memuat events" })))
        .finally(() => setLoadingEvents(false));
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [activeTab, eventsPage, eventsTypeFilter, eventsEmailFilter]);

  useEffect(() => {
    if (activeTab !== "suppression") return;
    setLoadingSuppression(true);
    setTabErrors((prev) => ({ ...prev, suppression: null }));
    adminFetch<{ suppressionList: SuppressionEntry[]; total: number }>(`/api/admin/email/suppression?page=${suppressionPage}`)
      .then((data) => { setSuppression(data.suppressionList); setSuppressionTotal(data.total); })
      .catch((err) => setTabErrors((prev) => ({ ...prev, suppression: err instanceof Error ? err.message : "Gagal memuat suppression" })))
      .finally(() => setLoadingSuppression(false));
  }, [activeTab, suppressionPage]);

  useEffect(() => {
    if (activeTab !== "hot-leads" || hotLeads !== null) return;
    setLoadingHotLeads(true);
    setTabErrors((prev) => ({ ...prev, hotLeads: null }));
    adminFetch<{ hotLeads: HotLead[] }>(`/api/admin/email/hot-leads?minScore=${minScore}`)
      .then((data) => setHotLeads(data.hotLeads))
      .catch((err) => setTabErrors((prev) => ({ ...prev, hotLeads: err instanceof Error ? err.message : "Gagal memuat hot leads" })))
      .finally(() => setLoadingHotLeads(false));
  }, [activeTab, hotLeads, minScore]);

  useEffect(() => {
    if (activeTab !== "templates" || templates !== null) return;
    setLoadingTemplates(true);
    setTabErrors((prev) => ({ ...prev, templates: null }));
    adminFetch<{ sequences: SequenceWithSteps[] }>("/api/admin/email/templates")
      .then((data) => setTemplates(data.sequences))
      .catch((err) => setTabErrors((prev) => ({ ...prev, templates: err instanceof Error ? err.message : "Gagal memuat templates" })))
      .finally(() => setLoadingTemplates(false));
  }, [activeTab, templates]);

  useEffect(() => {
    if (activeTab !== "settings") return;
    setTabErrors((prev) => ({ ...prev, settings: null }));
    adminFetch<Partial<EmailSettings>>("/api/admin/settings")
      .then((data) => setEmailSettings((prev) => ({ ...prev, ...data })))
      .catch((err) => setTabErrors((prev) => ({ ...prev, settings: err instanceof Error ? err.message : "Gagal memuat settings" })));
  }, [activeTab]);

  const handleToggleSequenceStatus = async (seqId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    setTogglingSequenceId(seqId);
    try {
      const res = await fetch(`/api/admin/email/sequences/${seqId}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.data.message);
        setTabErrors((prev) => ({ ...prev, sequences: null, diagnostics: null }));
        setSequences(null); // trigger refetch
        setDiagnostics(null);
      } else {
        toast.error(data.error || "Gagal mengubah status");
      }
    } catch {
      toast.error("Terjadi kesalahan koneksi");
    } finally {
      setTogglingSequenceId(null);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const keys: (keyof EmailSettings)[] = ["email_from_name", "email_from_address", "mailketing_api_token"];
      for (const key of keys) {
        const res = await fetch(`/api/admin/settings/${key}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ value: emailSettings[key] }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          throw new Error(data?.error || `Gagal menyimpan ${key}`);
        }
      }
      toast.success("Email settings berhasil disimpan");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan. Coba lagi.");
    }
    finally { setSavingSettings(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Marketing"
        title="Email Dashboard"
        description="Monitor subscriber, campaigns, dan email performance"
        actions={activeTab === "settings" && (
          <Button onClick={handleSaveSettings} loading={savingSettings} size="md">
            <Save size={15} />
            {savingSettings ? "Menyimpan..." : "Simpan Settings"}
          </Button>
        )}
      />

      {/* Tab bar */}
      <div className="glass-card flex items-center gap-0.5 overflow-x-auto p-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl whitespace-nowrap transition-all duration-150",
              activeTab === key
                ? "text-[#8B1414] bg-white/72 shadow-sm"
                : "text-[rgba(12,12,10,0.45)] hover:text-warm-black hover:bg-white/44"
            )}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <OverviewTab
          data={overview}
          loading={loadingOverview}
          error={tabErrors.overview}
          diagnostics={diagnostics}
          diagnosticsLoading={loadingDiagnostics}
          diagnosticsError={tabErrors.diagnostics}
        />
      )}
      {activeTab === "campaigns" && (
        <CampaignsTab
          data={campaigns}
          loading={loadingCampaigns}
          error={tabErrors.campaigns}
          onCreateCampaign={() => setShowCreateCampaign(true)}
        />
      )}
      {activeTab === "sequences" && (
        <SequencesTab
          data={sequences}
          loading={loadingSequences}
          error={tabErrors.sequences}
          expanded={expandedSequence}
          setExpanded={setExpandedSequence}
          onToggleStatus={handleToggleSequenceStatus}
          togglingId={togglingSequenceId}
        />
      )}
      {activeTab === "events" && (
        <EventsTab
          data={events}
          loading={loadingEvents}
          error={tabErrors.events}
          typeFilter={eventsTypeFilter}
          setTypeFilter={(v) => { setEventsTypeFilter(v); setEventsPage(1); }}
          emailFilter={eventsEmailFilter}
          setEmailFilter={(v) => { setEventsEmailFilter(v); setEventsPage(1); }}
          page={eventsPage}
          setPage={setEventsPage}
        />
      )}
      {activeTab === "suppression" && (
        <SuppressionTab data={suppression} loading={loadingSuppression} error={tabErrors.suppression} page={suppressionPage} setPage={setSuppressionPage} total={suppressionTotal} />
      )}
      {activeTab === "hot-leads" && (
        <HotLeadsTab
          data={hotLeads}
          loading={loadingHotLeads}
          error={tabErrors.hotLeads}
          minScore={minScore}
          setMinScore={setMinScore}
          onApply={() => setHotLeads(null)}
        />
      )}
      {activeTab === "templates" && (
        <TemplatesTab
          data={templates}
          loading={loadingTemplates}
          error={tabErrors.templates}
          onEdit={(step, seqName) => { setEditingStep(step); setEditingSeqName(seqName); }}
        />
      )}
      {activeTab === "settings" && <EmailSettingsTab settings={emailSettings} error={tabErrors.settings} setSettings={setEmailSettings} />}

      {/* Template editor slide-over */}
      {editingStep && (
        <TemplateEditor
          step={editingStep}
          seqName={editingSeqName}
          onClose={() => setEditingStep(null)}
          onSaved={() => setTemplates(null)}
        />
      )}

      {/* Create campaign slide-over */}
      {showCreateCampaign && (
        <CreateCampaignModal
          onClose={() => setShowCreateCampaign(false)}
          onSaved={() => setCampaigns(null)}
        />
      )}
    </div>
  );
}
