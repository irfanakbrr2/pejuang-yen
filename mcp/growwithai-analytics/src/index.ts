#!/usr/bin/env node
/**
 * Pejuang Yen Analytics MCP Server
 * Membungkus Pejuang Yen Analytics API (read-only) jadi MCP tools.
 * Auth: Bearer API key (generate di Admin → Developer → API Keys).
 *
 * Konfigurasi via env:
 *   GROWWITHAI_API_KEY        (wajib) — API key analytics (Bearer).
 *   GROWWITHAI_ANALYTICS_BASE (opsional) — default https://api.pejuangyen.com
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = (process.env.GROWWITHAI_ANALYTICS_BASE || "https://api.pejuangyen.com").replace(/\/+$/, "");
const API_KEY = process.env.GROWWITHAI_API_KEY || "";

// Endpoint analytics yang butuh API key (lihat CATALOG di domains/analytics/routes.ts).
const ENDPOINTS = [
  "summary", "courses", "users", "revenue", "orders", "enrollments",
  "certificates", "memberships", "affiliates", "traffic", "funnels",
  "webinars", "retention", "payments", "products", "gamification",
  "coupons", "community", "email", "member-health", "learning", "creator",
] as const;

// Param yang relevan per endpoint (untuk validasi ringan + dokumentasi).
const SUPPORTS_DAYS = new Set(["users", "revenue", "orders", "enrollments", "traffic", "funnels", "webinars", "payments", "products", "gamification", "coupons", "community", "email", "creator"]);
const SUPPORTS_FROM = new Set(["traffic", "funnels", "webinars", "payments", "products", "gamification", "coupons", "community", "email", "creator"]);
const SUPPORTS_PAGINATION = new Set(["orders"]);

async function callAnalytics(path: string, query: Record<string, string | number | undefined>): Promise<{ ok: boolean; status: number; body: unknown }> {
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  const url = `${BASE}/api/analytics/${path}${qs ? `?${qs}` : ""}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`;
  const res = await fetch(url, { headers });
  let body: unknown;
  try { body = await res.json(); } catch { body = await res.text().catch(() => ""); }
  return { ok: res.ok, status: res.status, body };
}

function errorResult(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

const server = new McpServer({ name: "growwithai-analytics-mcp-server", version: "1.0.0" });

// ─── Tool 1: catalog (discovery) ─────────────────────────────────────────────
server.registerTool(
  "growwithai_analytics_catalog",
  {
    title: "Pejuang Yen Analytics — katalog & kamus metrik",
    description:
      "Daftar semua endpoint analytics yang tersedia + kamus metrik (arti tiap field & satuannya: count/idr/ratio/percent). Panggil ini dulu untuk tahu data apa yang bisa diambil dan cara menafsirkannya. Tidak butuh API key.",
    inputSchema: {},
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async () => {
    const [ctx, metrics] = await Promise.all([
      callAnalytics("context", {}),
      callAnalytics("metrics", {}),
    ]);
    const out = { context: ctx.body, metrics: metrics.body };
    return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
  }
);

// ─── Tool 2: query (comprehensive) ───────────────────────────────────────────
server.registerTool(
  "growwithai_analytics_query",
  {
    title: "Pejuang Yen Analytics — ambil data",
    description:
      "Ambil data analytics Pejuang Yen dari satu endpoint. Mulai dari endpoint 'summary' untuk gambaran umum. " +
      "Param waktu: 'days' (1-730, default 30) ATAU 'from' (YYYY-MM-DD) untuk endpoint time-series. " +
      "Endpoint 'orders' mendukung 'limit'/'page'/'status'. Semua nilai uang dalam IDR. " +
      "Butuh GROWWITHAI_API_KEY (Bearer). Jika 401 → API key salah/dicabut; 429 → rate limit 60/menit.",
    inputSchema: {
      endpoint: z.enum(ENDPOINTS).describe("Endpoint analytics, mis. 'summary', 'revenue', 'traffic'."),
      days: z.number().int().min(1).max(730).optional().describe("Periode hari ke belakang (default 30). Untuk endpoint time-series."),
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Tanggal mulai YYYY-MM-DD (alternatif days). Hanya endpoint traffic/funnels/webinars/payments/products/gamification/coupons/community/email/creator."),
      limit: z.number().int().min(1).max(100).optional().describe("Hanya 'orders': item per halaman (maks 100)."),
      page: z.number().int().min(1).optional().describe("Hanya 'orders': nomor halaman."),
      status: z.string().optional().describe("Hanya 'orders': filter status, mis. 'paid' / 'pending'."),
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
  async ({ endpoint, days, from, limit, page, status }) => {
    if (!API_KEY) {
      return errorResult("GROWWITHAI_API_KEY belum diset. Generate API key di Admin → Developer → API Keys, lalu set env GROWWITHAI_API_KEY pada konfigurasi MCP.");
    }
    const query: Record<string, string | number | undefined> = {};
    if (SUPPORTS_DAYS.has(endpoint) && days !== undefined) query.days = days;
    if (SUPPORTS_FROM.has(endpoint) && from !== undefined) query.from = from;
    if (SUPPORTS_PAGINATION.has(endpoint)) {
      if (limit !== undefined) query.limit = limit;
      if (page !== undefined) query.page = page;
      if (status !== undefined) query.status = status;
    }

    let result;
    try {
      result = await callAnalytics(endpoint, query);
    } catch (err) {
      return errorResult(`Gagal menghubungi API: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (!result.ok) {
      const hint = result.status === 401
        ? " — periksa GROWWITHAI_API_KEY (salah/dicabut/kadaluarsa)."
        : result.status === 429
          ? " — rate limit terlampaui (maks 60 request/menit per key), coba lagi sebentar."
          : "";
      return errorResult(`HTTP ${result.status} dari /api/analytics/${endpoint}${hint}\n${JSON.stringify(result.body)}`);
    }
    return { content: [{ type: "text", text: JSON.stringify(result.body, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("growwithai-analytics-mcp-server siap (stdio).");
