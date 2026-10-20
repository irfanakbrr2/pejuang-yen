# GrowWithAI Analytics — Remote MCP (Cloudflare Worker)

Remote MCP server (Streamable HTTP) untuk dipakai sebagai **Custom Connector di claude.ai**.
Membungkus `/api/analytics/*` (read-only). Auth: API key dibawa di URL (`?key=`), diteruskan sebagai Bearer.

**URL deploy:** `https://growwithai-mcp-analytics.irfanakbrr.workers.dev`
**Endpoint MCP:** `POST /mcp`

## Pakai di claude.ai (web)

1. Generate API key analytics: **Admin → Developer → API Keys**.
2. claude.ai → **Settings → Connectors → Add custom connector**.
3. Isi:
   - **Name:** GrowWithAI Analytics
   - **URL:** `https://growwithai-mcp-analytics.irfanakbrr.workers.dev/mcp?key=PASTE_API_KEY`
   - Authentication: **kosongkan** (tidak pakai OAuth).
4. Simpan → Claude akan connect & menampilkan 2 tools (`growwithai_analytics_catalog`, `growwithai_analytics_query`).

> ⚠️ API key ada di URL connector. Jaga kerahasiaannya. Cabut/rotasi key dari Admin → API Keys kalau bocor.

## Tools
- `growwithai_analytics_catalog` — daftar endpoint + kamus metrik (tanpa key).
- `growwithai_analytics_query` — ambil data (summary, revenue, traffic, orders, dst). Param `days`/`from`/`limit`/`page`/`status`.

## Deploy ulang
```bash
cd mcp/growwithai-analytics-worker
npx wrangler deploy
```
Var `ANALYTICS_BASE` (default `https://api.growwithai.id`) diatur di `wrangler.toml`.

## Catatan
- Read-only; rate limit 60 req/menit per key.
- Koneksi datang dari server Anthropic (bukan device-mu) — worker publik, jadi tidak perlu allowlist.
- Beda dgn `../growwithai-analytics/` (itu MCP **stdio lokal** untuk Claude Code). Yang ini **remote** untuk claude.ai.
