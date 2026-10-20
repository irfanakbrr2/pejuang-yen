"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from "@/components/ui/card";
import { AdminTable, Tr, Td } from "@/components/ui/AdminTable";
import { Pagination } from "@/components/ui/Pagination";
import { Download, Search } from "lucide-react";
import { API_BASE, utcDateNDaysAgo } from "./shared";

const EVENT_NAMES = [
  "", "page_view", "signup_completed", "login", "onboarding_completed",
  "checkout_intent", "checkout_started", "payment_success", "membership_upgraded",
  "lesson_started", "lesson_progress", "lesson_completed", "course_completed",
  "certificate_generated", "webinar_viewed", "webinar_registered",
  "bonus_viewed", "recording_viewed",
];

interface TrackingEventRow {
  id: string;
  event_name: string;
  event_category: string | null;
  user_email: string | null;
  user_name: string | null;
  page_url: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  device_type: string | null;
  metadata_json: string | null;
  created_at: string;
}

function formatJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export function EventsTab({ days }: { days: string }) {
  const [rows, setRows] = useState<TrackingEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [eventName, setEventName] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [email, setEmail] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (eventName) params.set("event_name", eventName);
    if (email) params.set("email", email);
    api(`/api/admin/analytics/events?${params.toString()}`)
      .then((res: any) => {
        if (res.success) {
          setRows(res.data || []);
          setTotalPages(res.pagination?.totalPages || Math.max(1, Math.ceil((res.pagination?.total || 0) / 50)));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, eventName, email]);

  useEffect(() => { load(); }, [load]);

  const exportUrl = `${API_BASE}/api/admin/analytics/export?type=events&from=${utcDateNDaysAgo(Number(days) - 1)}&to=${utcDateNDaysAgo(0)}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Log</CardTitle>
        <CardToolbar>
          <button
            onClick={() => window.open(exportUrl, "_blank")}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-full px-3 py-1.5 cursor-pointer"
          >
            <Download size={13} /> Export CSV
          </button>
        </CardToolbar>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={eventName}
            onChange={(e) => { setEventName(e.target.value); setPage(1); }}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700"
          >
            {EVENT_NAMES.map((name) => (
              <option key={name || "all"} value={name}>{name || "Semua event"}</option>
            ))}
          </select>
          <form
            className="flex items-center gap-2 flex-1"
            onSubmit={(e) => { e.preventDefault(); setEmail(emailInput.trim()); setPage(1); }}
          >
            <input
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="Cari email user..."
              className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2"
            />
            <button type="submit" className="inline-flex items-center gap-1.5 text-xs font-medium text-white bg-[#8B1414] rounded-xl px-3 py-2 cursor-pointer">
              <Search size={13} /> Cari
            </button>
          </form>
        </div>

        <AdminTable
          columns={[
            { key: "time", label: "Waktu" },
            { key: "event", label: "Event" },
            { key: "user", label: "User" },
            { key: "page", label: "Page" },
            { key: "source", label: "Source" },
            { key: "device", label: "Device" },
            { key: "meta", label: "Metadata" },
          ]}
          loading={loading}
          empty={<p className="text-sm text-gray-400 py-6 text-center">Belum ada event yang cocok.</p>}
        >
          {rows.map((row) => (
            <Tr key={row.id}>
              <Td className="whitespace-nowrap text-xs text-gray-500">
                {new Date(row.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "medium" })}
              </Td>
              <Td>
                <span className="inline-flex text-xs font-semibold bg-gray-100 text-gray-700 rounded-full px-2 py-0.5">
                  {row.event_name}
                </span>
              </Td>
              <Td className="text-xs">{row.user_email || <span className="text-gray-400">anonim</span>}</Td>
              <Td className="text-xs max-w-[180px] truncate">{row.page_url || "—"}</Td>
              <Td className="text-xs">{row.utm_source || "—"}{row.utm_campaign ? ` / ${row.utm_campaign}` : ""}</Td>
              <Td className="text-xs">{row.device_type || "—"}</Td>
              <Td>
                {row.metadata_json ? (
                  <button
                    onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                    className="text-xs text-[#8B1414] font-medium hover:underline cursor-pointer"
                  >
                    {expanded === row.id ? "Tutup" : "Lihat"}
                  </button>
                ) : "—"}
                {expanded === row.id && row.metadata_json && (
                  <pre className="mt-1 text-[10px] bg-gray-900 text-gray-100 rounded-lg p-2 max-w-[280px] overflow-auto">
                    {formatJson(row.metadata_json)}
                  </pre>
                )}
              </Td>
            </Tr>
          ))}
        </AdminTable>

        <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
      </CardContent>
    </Card>
  );
}
