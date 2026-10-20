"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { BarChart3 } from "lucide-react";
import { PillSelect } from "./_components/shared";
import { OverviewTab } from "./_components/OverviewTab";
import { CommerceTab } from "./_components/CommerceTab";
import { PaymentsTab } from "./_components/PaymentsTab";
import { AcquisitionTab } from "./_components/AcquisitionTab";
import { AffiliateTab } from "./_components/AffiliateTab";
import { RetentionTab } from "./_components/RetentionTab";
// Disembunyikan untuk PejuangYen (fitur GWA tak dipakai): Webinar, Email marketing, AI Tools.
// import { WebinarTab } from "./_components/WebinarTab";
import { EngagementTab } from "./_components/EngagementTab";
import { LearningTab } from "./_components/LearningTab";
// import { EmailTab } from "./_components/EmailTab";
// import { ToolsTab } from "./_components/ToolsTab";
import { EventsTab } from "./_components/EventsTab";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "commerce", label: "Penjualan" },
  { id: "payments", label: "Pembayaran" },
  { id: "acquisition", label: "Akuisisi" },
  { id: "affiliate", label: "Affiliate" },
  { id: "retention", label: "Retensi" },
  // Disembunyikan untuk PejuangYen (fitur GWA tak dipakai): Webinar, Email, AI Tools.
  // { id: "webinar", label: "Webinar" },
  { id: "engagement", label: "Engagement" },
  { id: "learning", label: "Learning" },
  // { id: "email", label: "Email" },
  // { id: "tools", label: "AI Tools" },
  { id: "events", label: "Events" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function AnalyticsHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab") || "overview";
  const activeTab: TabId = (TABS.some((t) => t.id === tabParam) ? tabParam : "overview") as TabId;
  const [days, setDays] = useState("30");

  const setTab = (tab: TabId) => {
    router.replace(tab === "overview" ? "/admin/analytics" : `/admin/analytics?tab=${tab}`, { scroll: false });
  };

  // Selector periode relevan untuk semua tab berbasis rentang waktu.
  // Learning & Retensi berbasis snapshot/bulan → sembunyikan selector.
  const showDays = activeTab !== "learning" && activeTab !== "retention";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analytics"
        title={<span className="inline-flex items-center gap-2"><BarChart3 className="text-[#8B1414]" /> Product & Growth Analytics</span>}
        description="Aktivitas, penjualan, akuisisi, learning, dan event log dari first-party tracking. Tanggal memakai bucket UTC."
        actions={
          showDays ? (
            <PillSelect
              value={days}
              onChange={setDays}
              options={[
                { label: "7 Hari", value: "7" },
                { label: "30 Hari", value: "30" },
                { label: "90 Hari", value: "90" },
              ]}
            />
          ) : undefined
        }
      />

      {/* Tab bar — deep-linkable via ?tab= */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-full bg-gray-100 p-1 w-fit max-w-full [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setTab(tab.id)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-150 cursor-pointer ${
              activeTab === tab.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && <OverviewTab days={days} />}
      {activeTab === "commerce" && <CommerceTab days={days} />}
      {activeTab === "payments" && <PaymentsTab days={days} />}
      {activeTab === "acquisition" && <AcquisitionTab days={days} />}
      {activeTab === "affiliate" && <AffiliateTab days={days} />}
      {activeTab === "retention" && <RetentionTab days={days} />}
      {/* Disembunyikan untuk PejuangYen (fitur GWA tak dipakai): Webinar, Email, AI Tools. */}
      {/* {activeTab === "webinar" && <WebinarTab days={days} />} */}
      {activeTab === "engagement" && <EngagementTab days={days} />}
      {activeTab === "learning" && <LearningTab />}
      {/* {activeTab === "email" && <EmailTab days={days} />} */}
      {/* {activeTab === "tools" && <ToolsTab days={days} />} */}
      {activeTab === "events" && <EventsTab days={days} />}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  return (
    <Suspense fallback={<p className="py-10 text-center text-sm text-gray-400">Memuat analytics...</p>}>
      <AnalyticsHubContent />
    </Suspense>
  );
}
