# GrowWithAI Analytics MCP Server

MCP server read-only yang membungkus **GrowWithAI Analytics API** jadi tools yang bisa dipanggil Claude (Claude Code / Claude Desktop). Auth pakai **Bearer API key** (bukan password).

## Tools

| Tool | Fungsi |
|---|---|
| `growwithai_analytics_catalog` | Daftar semua endpoint + kamus metrik (arti field & satuan). Panggil ini dulu. Tanpa key. |
| `growwithai_analytics_query` | Ambil data dari satu endpoint (`summary`, `revenue`, `traffic`, `orders`, dst). Param `days`/`from`/`limit`/`page`/`status`. Butuh key. |

Endpoint yang didukung: summary, courses, users, revenue, orders, enrollments, certificates, memberships, affiliates, traffic, funnels, webinars, retention, payments, products, gamification, coupons, community, email.

## Setup

### 1. Build (sekali)
```bash
cd mcp/growwithai-analytics
npm install
npm run build
```

### 2. Generate API key
Login admin → **Admin → Developer → API Keys** → buat key baru → salin (hanya tampil sekali).

### 3. Daftarkan ke Claude Code

**Cara A — `claude mcp add` (key tidak ikut ter-commit):**
```bash
claude mcp add growwithai-analytics \
  --env GROWWITHAI_API_KEY=PASTE_KEY_DISINI \
  --env GROWWITHAI_ANALYTICS_BASE=https://api.growwithai.id \
  -- node /Users/irfanakbrr/Documents/Growwithai.id/growwithai-app/mcp/growwithai-analytics/dist/index.js
```

**Cara B — file `.mcp.json` di root project** (lihat `.mcp.json.example`):
```json
{
  "mcpServers": {
    "growwithai-analytics": {
      "command": "node",
      "args": ["/Users/irfanakbrr/Documents/Growwithai.id/growwithai-app/mcp/growwithai-analytics/dist/index.js"],
      "env": {
        "GROWWITHAI_API_KEY": "PASTE_KEY_DISINI",
        "GROWWITHAI_ANALYTICS_BASE": "https://api.growwithai.id"
      }
    }
  }
}
```

> ⚠️ Jangan commit API key ke git. Pakai Cara A, atau taruh `.mcp.json` di lokasi yang di-gitignore.

### 4. Restart Claude Code
Setelah itu Claude bisa panggil tool, mis. "ambil ringkasan bisnis 30 hari" → `growwithai_analytics_query(endpoint: "summary")`.

## Env
- `GROWWITHAI_API_KEY` (wajib) — Bearer key analytics.
- `GROWWITHAI_ANALYTICS_BASE` (opsional) — default `https://api.growwithai.id`. Lokal: `http://localhost:8787`.

## Catatan
- Read-only — tidak ada operasi yang mengubah data.
- Rate limit 60 request/menit per key (HTTP 429 kalau lewat).
- Hanya mencakup `/api/analytics/*`. Endpoint automation pakai session auth, di luar cakupan MCP ini.
