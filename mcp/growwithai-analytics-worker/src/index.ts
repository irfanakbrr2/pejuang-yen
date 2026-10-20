/**
 * Pejuang Yen Analytics — Remote MCP Server (Cloudflare Worker, Streamable HTTP).
 * Untuk dipakai sebagai Custom Connector di claude.ai.
 *
 * Auth: API key analytics dibawa di URL (?key=XXX) atau header Authorization: Bearer.
 * Worker meneruskannya sebagai Bearer ke Pejuang Yen Analytics API (read-only).
 *
 * Endpoint MCP: POST /mcp?key=XXX  (JSON-RPC 2.0, stateless JSON).
 */
interface Env {
  ANALYTICS_BASE?: string;
}

const ENDPOINTS = [
  "summary", "courses", "users", "revenue", "orders", "enrollments",
  "certificates", "memberships", "affiliates", "traffic", "funnels",
  "webinars", "retention", "payments", "products", "gamification",
  "coupons", "community", "email", "member-health", "learning", "creator",
];
const SUPPORTS_DAYS = new Set(["users", "revenue", "orders", "enrollments", "traffic", "funnels", "webinars", "payments", "products", "gamification", "coupons", "community", "email", "creator"]);
const SUPPORTS_FROM = new Set(["traffic", "funnels", "webinars", "payments", "products", "gamification", "coupons", "community", "email", "creator"]);
const SUPPORTS_PAGINATION = new Set(["orders"]);

const TOOLS = [
  {
    name: "growwithai_analytics_catalog",
    title: "Pejuang Yen Analytics — katalog & kamus metrik",
    description:
      "Daftar semua endpoint analytics + kamus metrik (arti tiap field & satuan: count/idr/ratio/percent). Panggil ini dulu untuk tahu data apa yang tersedia dan cara menafsirkannya.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "growwithai_analytics_query",
    title: "Pejuang Yen Analytics — ambil data",
    description:
      "Ambil data analytics Pejuang Yen dari satu endpoint. Mulai dari 'summary'. Param waktu: 'days' (1-730, default 30) ATAU 'from' (YYYY-MM-DD). Endpoint 'orders' mendukung 'limit'/'page'/'status'. Semua nilai uang IDR.",
    inputSchema: {
      type: "object",
      properties: {
        endpoint: { type: "string", enum: ENDPOINTS, description: "Endpoint analytics, mis. 'summary', 'revenue', 'traffic'." },
        days: { type: "integer", minimum: 1, maximum: 730, description: "Periode hari ke belakang (default 30)." },
        from: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Tanggal mulai YYYY-MM-DD (alternatif days)." },
        limit: { type: "integer", minimum: 1, maximum: 100, description: "Hanya 'orders': item per halaman." },
        page: { type: "integer", minimum: 1, description: "Hanya 'orders': nomor halaman." },
        status: { type: "string", description: "Hanya 'orders': filter status, mis. 'paid'." },
      },
      required: ["endpoint"],
      additionalProperties: false,
    },
  },
];

const SERVER_INFO = { name: "growwithai-analytics-mcp-server", version: "1.0.0" };
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version, Mcp-Session-Id",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}
const ok = (id: unknown, result: unknown) => ({ jsonrpc: "2.0", id, result });
const err = (id: unknown, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

async function callAnalytics(
  base: string,
  path: string,
  query: Record<string, string | number | undefined>,
  key: string
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const qs = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  const url = `${base}/api/analytics/${path}${qs ? `?${qs}` : ""}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (key) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(url, { headers });
  let body: unknown;
  try { body = await res.json(); } catch { body = await res.text().catch(() => ""); }
  return { ok: res.ok, status: res.status, body };
}

function textResult(text: string, isError = false) {
  return { content: [{ type: "text", text }], ...(isError ? { isError: true } : {}) };
}

async function runTool(name: string, args: Record<string, unknown>, base: string, key: string) {
  if (name === "growwithai_analytics_catalog") {
    const [ctx, metrics] = await Promise.all([
      callAnalytics(base, "context", {}, key),
      callAnalytics(base, "metrics", {}, key),
    ]);
    return textResult(JSON.stringify({ context: ctx.body, metrics: metrics.body }, null, 2));
  }

  if (name === "growwithai_analytics_query") {
    const endpoint = String(args.endpoint || "");
    if (!ENDPOINTS.includes(endpoint)) return textResult(`Endpoint tidak valid: ${endpoint}. Pilihan: ${ENDPOINTS.join(", ")}`, true);
    if (!key) return textResult("API key belum diset. Tambahkan ?key=<API_KEY> di URL connector.", true);

    const query: Record<string, string | number | undefined> = {};
    if (SUPPORTS_DAYS.has(endpoint) && args.days !== undefined) query.days = Number(args.days);
    if (SUPPORTS_FROM.has(endpoint) && args.from !== undefined) query.from = String(args.from);
    if (SUPPORTS_PAGINATION.has(endpoint)) {
      if (args.limit !== undefined) query.limit = Number(args.limit);
      if (args.page !== undefined) query.page = Number(args.page);
      if (args.status !== undefined) query.status = String(args.status);
    }

    const r = await callAnalytics(base, endpoint, query, key);
    if (!r.ok) {
      const hint = r.status === 401 ? " — API key salah/dicabut/kadaluarsa."
        : r.status === 429 ? " — rate limit (maks 60/menit), coba lagi sebentar." : "";
      return textResult(`HTTP ${r.status} dari /api/analytics/${endpoint}${hint}\n${JSON.stringify(r.body)}`, true);
    }
    return textResult(JSON.stringify(r.body, null, 2));
  }

  return textResult(`Tool tidak dikenal: ${name}`, true);
}

async function handleMessage(m: any, base: string, key: string): Promise<unknown | null> {
  const { id, method, params } = m || {};
  switch (method) {
    case "initialize":
      return ok(id, {
        protocolVersion: params?.protocolVersion || "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: TOOLS });
    case "tools/call": {
      try {
        const result = await runTool(params?.name, params?.arguments || {}, base, key);
        return ok(id, result);
      } catch (e) {
        return ok(id, textResult(`Error: ${e instanceof Error ? e.message : String(e)}`, true));
      }
    }
    default:
      if (typeof method === "string" && method.startsWith("notifications/")) return null; // notif: no response
      if (id === undefined) return null; // notification tanpa method dikenal
      return err(id, -32601, `Method not found: ${method}`);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);
    const base = (env.ANALYTICS_BASE || "https://api.pejuangyen.com").replace(/\/+$/, "");
    const key = url.searchParams.get("key") || (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

    if (request.method === "GET") {
      // Info ringan; juga membantu cek kesehatan.
      return jsonResponse({ server: SERVER_INFO, transport: "streamable-http", endpoint: "POST /mcp", tools: TOOLS.map((t) => t.name) });
    }
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: CORS });

    let payload: any;
    try { payload = await request.json(); } catch { return jsonResponse(err(null, -32700, "Parse error"), 400); }

    if (Array.isArray(payload)) {
      const responses = (await Promise.all(payload.map((m) => handleMessage(m, base, key)))).filter((r) => r !== null);
      if (responses.length === 0) return new Response(null, { status: 202, headers: CORS });
      return jsonResponse(responses);
    }

    const resp = await handleMessage(payload, base, key);
    if (resp === null) return new Response(null, { status: 202, headers: CORS });
    return jsonResponse(resp);
  },
};
