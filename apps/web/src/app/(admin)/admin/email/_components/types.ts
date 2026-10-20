import { BarChart2, Send, GitBranch, Activity, ShieldOff, Flame, Settings, FileText } from "lucide-react";

export type TabKey =
  | "overview"
  | "campaigns"
  | "sequences"
  | "events"
  | "suppression"
  | "hot-leads"
  | "templates"
  | "settings";

export interface OverviewData {
  totalSubscribers: number;
  activeSubscribers: number;
  unsubscribedUsers: number;
  paidUsers: number;
  emailsSentToday: number;
  emailAttributedRevenue: number;
  totalOpens: number;
  totalClicks: number;
  totalBounced: number;
  activeSequenceUsers: number;
  mailketingCredits: { balance: number; isWarning: boolean; isCritical: boolean; isEmpty: boolean };
}

export interface EmailSchemaColumnStatus {
  table: string;
  column: string;
  exists: boolean;
}

export interface EmailDiagnostics {
  generatedAt: string;
  schema: {
    ok: boolean;
    requiredColumns: EmailSchemaColumnStatus[];
    missingColumns: EmailSchemaColumnStatus[];
  };
  sequenceBacklog: {
    totalReady: number;
    breakdown: Array<{
      sequence_id: string;
      sequence_name: string;
      current_step: number;
      ready_count: number;
      oldest_next_send_at: string | null;
    }>;
  };
  sequenceFailures: Array<{
    status: string;
    failure_count: number;
    last_error: string;
    count: number;
  }>;
  lastSequenceRuns: Array<{
    id: string;
    started_at: string;
    finished_at: string;
    selected_count: number;
    sent_count: number;
    failed_count: number;
    retried_count: number;
    cancelled_count: number;
    completed_count: number;
    error_message: string | null;
  }>;
  failedQueueLogs: Array<{
    queue_name: string;
    count: number;
    last_failed_at: string | null;
  }>;
  recentEmailErrors: Array<{
    id: string;
    source: string;
    message: string;
    created_at: string;
  }>;
  mailketingCredits: { balance: number; isWarning: boolean; isCritical: boolean; isEmpty: boolean };
}

export interface Campaign {
  id: string;
  name: string;
  campaign_type: string;
  segment: string;
  status: string;
  subject: string;
  sent_count: number;
  open_count: number;
  click_count: number;
  bounce_count: number;
  revenue_attributed: number;
  openRate: string;
  clickRate: string;
  created_at: string;
}

export interface StepDropoff {
  step_id: string;
  step_order: number;
  subject: string;
  sent_count: number;
  unique_recipients: number;
  last_sent_at: string | null;
}

export interface Sequence {
  id: string;
  name: string;
  trigger_event: string;
  description: string;
  status: string;
  total_started: number;
  active_users: number;
  completed_users: number;
  cancelled_users: number;
  failed_users: number;
  completionRate: string;
  stepDropoff: StepDropoff[];
}

export interface EmailEvent {
  id: string;
  email: string;
  event_type: string;
  email_subject?: string;
  user_name?: string;
  created_at: string;
}

export interface SuppressionEntry {
  id: string;
  email: string;
  reason: string;
  source: string;
  created_at: string;
}

export interface HotLead {
  id: string;
  email: string;
  name: string;
  user_role: string;
  interest: string;
  engagement_score: number;
  last_email_click_at?: string;
  membership_status: string;
  is_paid_user: number;
}

export interface EmailSettings {
  email_from_name: string;
  email_from_address: string;
  mailketing_api_token: string;
}

export interface TemplateStep {
  id: string;
  stepOrder: number;
  delayMinutes: number;
  subject: string;
  previewText: string | null;
  templateKey: string;
  ctaUrl: string;
  hasCustomContent: boolean;
  content: string | null;
}

export interface SequenceWithSteps {
  id: string;
  name: string;
  triggerEvent: string;
  description: string;
  steps: TemplateStep[];
}

export const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: "overview", label: "Overview", icon: BarChart2 },
  { key: "campaigns", label: "Campaigns", icon: Send },
  { key: "sequences", label: "Sequences", icon: GitBranch },
  { key: "events", label: "Events Log", icon: Activity },
  { key: "suppression", label: "Suppression", icon: ShieldOff },
  { key: "hot-leads", label: "Hot Leads", icon: Flame },
  { key: "templates", label: "Templates", icon: FileText },
  { key: "settings", label: "Settings", icon: Settings },
];

export const EVENT_TYPES = ["sent", "opened", "clicked", "bounced", "unsubscribed", "complaint", "failed"];

export const eventBadgeClass: Record<string, string> = {
  sent: "bg-blue-100 text-blue-800",
  opened: "bg-green-100 text-green-800",
  clicked: "bg-teal-100 text-teal-800",
  bounced: "bg-red-100 text-red-800",
  unsubscribed: "bg-gray-100 text-gray-600",
  complaint: "bg-orange-100 text-orange-800",
  failed: "bg-rose-100 text-rose-800",
};

export const inputClass =
  "w-full px-3.5 py-2.5 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black outline-none focus:border-primary focus:ring-2 focus:ring-primary-light transition-colors";
