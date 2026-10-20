# Load Test — Webinar Spike

Uji beban untuk skenario **webinar dengan ribuan pendaftar serentak** (2.000–10.000), mencakup tiga jalur risiko:

1. **Badai baca landing** — `GET /api/public/webinars/:slug` (no-auth). Memvalidasi **edge cache** (Cache API).
2. **Polling storm** — `GET /api/checkout/:orderId/status` (auth, read berat, berkelanjutan). Jalur risiko utama. Memvalidasi **session-cache KV**.
3. **Registrasi** — `POST /api/user/webinars/:id/register` (auth, write).

## ⚠️ Aturan keselamatan

- **JALANKAN DI STAGING / PREVIEW, BUKAN PRODUKSI.**
- **Jangan** uji `create-payment` massal — memanggil Pakasir sungguhan & membuat order asli. Skrip ini tidak melakukannya.
- Bersihkan user + session test setelah selesai (perintah di bawah).

## Penting: kenapa pakai SESSION ter-seed (bukan login)

`/login` di-**rate-limit 5/menit per-IP** ([auth/routes.ts](../../apps/api/src/domains/auth/routes.ts)). Itu **benar untuk produksi** (user nyata IP berbeda — tak terganggu), tapi load test dari satu IP **tak bisa login banyak user**. Karena itu `gen-seed.mjs` menyuntik **session siap-pakai** langsung ke DB dan menulis token-nya ke `tokens.json`; k6 memakai token itu sebagai cookie tanpa login. Ini juga lebih realistis — saat polling, user nyata memang sudah punya cookie.

## Prasyarat

```bash
brew install k6          # k6 v2+
node --version           # ≥ 20 (gen-seed.mjs)
```

## Langkah

### 1. Seed user + session (di staging)

```bash
cd scripts/loadtest
COUNT=2000 PREFIX=ltsess+ node gen-seed.mjs > seed.sql   # → tokens.json (2000 token)

cd ../../apps/api
npx wrangler d1 execute growwithai-db-staging --remote --file=../../scripts/loadtest/seed.sql
```

> `tokens.json` ditulis di `scripts/loadtest/` dan dibaca k6 otomatis (`TOKENS_FILE=tokens.json`).
> Untuk polling 200 (owner-match), buat **satu order pending** lewat UI checkout staging dengan salah satu user test, ambil `order_id`-nya untuk `ORDER_ID`. Tanpa itu, poll → 404 (tetap beban valid: auth + cek kepemilikan tetap jalan).

### 2. Jalankan test

**Mulai aman — landing read saja** (tak butuh seed/token):

```bash
k6 run -e BASE_URL=https://growwithai-api-staging.irfanakbrr.workers.dev \
  -e SLUG=ai-untuk-solopreneur-indonesia-2026 \
  -e LANDING_RPS=2000 -e SCENARIOS=landing webinar-spike.js
```

**Full spike** (landing + polling + registrasi):

```bash
k6 run \
  -e BASE_URL=https://growwithai-api-staging.irfanakbrr.workers.dev \
  -e SLUG=ai-untuk-solopreneur-indonesia-2026 \
  -e WEBINAR_ID=webinar-demo-ai-solopreneur-2026 \
  -e ORDER_ID=<uuid-order-pending-staging> \
  -e TOKENS_FILE=tokens.json -e TOKEN_POOL=2000 \
  -e LANDING_RPS=2000 -e POLL_RPS=800 -e DURATION=3m \
  -e SCENARIOS=landing,poll,register \
  webinar-spike.js
```

Naikkan `LANDING_RPS` / `POLL_RPS` bertahap (1000 → 2000 → 5000) sampai mendekati target hari-H, atau sampai `d1_overloaded_errors > 0`.

### 3. Bersihkan

```bash
cd apps/api
npx wrangler d1 execute growwithai-db-staging --remote \
  --command="DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'ltsess+%'); DELETE FROM webinar_registrations WHERE email LIKE 'ltsess+%'; DELETE FROM users WHERE email LIKE 'ltsess+%';"
```

## Environment staging (sudah dibuat)

Terisolasi penuh dari produksi (lihat blok `[env.staging]` di `apps/api/wrangler.toml`):

| Resource | Nilai |
|---|---|
| API URL | `https://growwithai-api-staging.irfanakbrr.workers.dev` |
| D1 | `growwithai-db-staging` (`118756f3-768a-4aaf-b05c-ffe0e328fcda`) |
| KV | `be6f18382d1e4ecdb71ddd193e6aec45` |
| Queues | `notifications-staging`, `email-sequences-staging`, `automation-runs-staging` (producer-only) |
| Cron | dimatikan; rate-limit namespace 2001–2004 |

**Re-deploy staging** setelah ubah kode API: `cd apps/api && npx wrangler deploy --env staging`

**Hapus staging total** setelah event:
```bash
npx wrangler d1 delete growwithai-db-staging
npx wrangler kv namespace delete --namespace-id be6f18382d1e4ecdb71ddd193e6aec45
npx wrangler queues delete notifications-staging   # + email-sequences-staging, automation-runs-staging
# lalu hapus blok [env.staging] + queue staging dari wrangler.toml
```

## Variabel env

| Env | Default | Keterangan |
|---|---|---|
| `BASE_URL` | `http://localhost:8787` | Base URL API staging |
| `SLUG` | `100m` | Slug webinar (landing read) |
| `WEBINAR_ID` | — | UUID/ID webinar (registrasi) |
| `ORDER_ID` | — | Order pending (polling); kosong → 404 |
| `TOKENS_FILE` | `tokens.json` | File token session ter-seed |
| `TOKEN_POOL` | `200` | Hint ukuran VU register (set = jumlah seed) |
| `LANDING_RPS` / `POLL_RPS` | `1000` / `400` | Target request/detik |
| `DURATION` | `3m` | Durasi fase sustain |
| `SCENARIOS` | `landing` | Subset: `landing,poll,register` |

## Threshold

| Metrik | Ambang | Arti |
|---|---|---|
| `http_req_failed` | < 1% | Error rate (200/201/404/409 dianggap sukses) |
| `http_req_duration` p95 / p99 | < 800ms / < 2s | Latency umum |
| `landing_latency` p95 | < 300ms | Landing (kalau lambat → cache edge mati) |
| `status_latency` p95 | < 500ms | Polling |
| **`d1_overloaded_errors`** | **= 0** | **D1 jenuh — toleransi NOL** |

## Hasil smoke test awal (staging, 16 Jun 2026)

Validasi pipeline pada skala kecil (LANDING 200 rps + POLL 100 rps, 25s):

- ✅ `checks_succeeded: 100%`, `d1_overloaded_errors: 0`
- ✅ `landing_cache_hits` dominan → **edge cache (Cache API) bekerja** (mayoritas tak menyentuh D1)
- ✅ session ter-seed valid (`/me`, `/status` 200), registrasi 201 OK
- latency p95: landing 125ms, status 173ms

Belum diuji pada skala target (2k–10k) — itu langkah berikutnya sebelum event.

## File

- `webinar-spike.js` — skrip k6 utama
- `gen-seed.mjs` — generator SQL user + session + `tokens.json`
- `README.md` — dokumen ini
