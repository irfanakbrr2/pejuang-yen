# GrowWithAI — MCP & Cakupan Data untuk AI Luar

> Dokumentasi: apa saja data GrowWithAI yang **sudah bisa dibaca AI luar** (Claude.ai / Claude Code) lewat MCP, dan **data apa yang belum terbaca**.
> Status per: 2026-06-18. Sumber kebenaran: `apps/api/src/domains/analytics/routes.ts` (CATALOG) vs. `apps/api/src/db/migrations/`.

---

## 1. Ringkasan

AI luar mengakses GrowWithAI **hanya** lewat API analytics read-only (`https://api.growwithai.id/api/analytics/*`), dibungkus jadi MCP. Saat ini AI bisa melihat **22 irisan data** dari **~100 tabel** yang dimiliki platform.

- ✅ **Aman**: semua akses read-only. AI tidak bisa menulis/mengubah data.
- 🔑 **Auth**: API key (Bearer) → hash SHA-256 dicek di tabel `analytics_api_keys`. Rate limit 60 req/menit/key.
- 🌐 **Discovery publik** (tanpa key): `/context`, `/metrics`, `/openapi.json`, `/docs`.

---

## 2. Server MCP yang tersedia

| # | Server | Lokasi | Transport | Konsumen | Cakupan |
|---|---|---|---|---|---|
| 1 | `growwithai-mcp` (lama) | `growwithai-mcp/index.js` | stdio | Claude Code lokal | 9 tool hardcode — **redundan** |
| 2 | `growwithai-analytics` | `growwithai-app/mcp/growwithai-analytics/` | stdio | Claude Code lokal | 22 endpoint (2 tool generik) |
| 3 | `growwithai-analytics-worker` | `growwithai-app/mcp/growwithai-analytics-worker/` | Streamable HTTP (Cloudflare Worker) | **claude.ai Custom Connector** | 22 endpoint (2 tool generik) |

### Detail tiap server

**1. `growwithai-mcp` (lama, stdio)**
- 9 tool hardcode: `get_summary`, `get_revenue`, `get_courses`, `get_users`, `get_enrollments`, `get_certificates`, `get_memberships`, `get_affiliates`, `get_context`.
- ⚠️ **Redundan** — seluruh tool-nya sudah tercakup server #2/#3. Kandidat untuk dihapus.

**2. `growwithai-analytics` (stdio, untuk Claude Code)**
- 2 tool: `growwithai_analytics_catalog` (discovery) + `growwithai_analytics_query` (ambil data, 22 endpoint).
- Env: `GROWWITHAI_API_KEY` (wajib), `GROWWITHAI_ANALYTICS_BASE` (opsional).

**3. `growwithai-analytics-worker` (remote HTTP, untuk claude.ai)** — ⭐ utama
- URL: `https://growwithai-mcp-analytics.irfanakbrr.workers.dev/mcp?key=<API_KEY>`
- Setup: claude.ai → Settings → Connectors → Add custom connector → tempel URL (auth dikosongkan).
- Tool sama dengan #2. Deploy ulang: `cd mcp/growwithai-analytics-worker && npx wrangler deploy`.

---

## 3. Data yang SUDAH terbaca AI (22 endpoint)

| Endpoint | Isi | Param waktu |
|---|---|---|
| `summary` | Gambaran bisnis: user, kelas, revenue, sertifikat, membership, DAU/WAU/MAU | — |
| `courses` | Per kelas: enrollment, completion %, progress, sertifikat, revenue | — |
| `users` | User baru/hari, breakdown role/status, conversion, top enroller | `days` |
| `revenue` | Revenue harian, per produk, per tipe, growth vs periode lalu | `days` |
| `orders` | Daftar transaksi (paginated): user, amount, status | `days`,`limit`,`page`,`status` |
| `enrollments` | Enrollment baru/hari, progress, breakdown status | `days` |
| `certificates` | Sertifikat terbit/aktif/dicabut, per kelas, tren bulanan | — |
| `memberships` | Aktif/expired/cancelled, per plan, tren bulanan | — |
| `affiliates` | Afiliator, klik, lead, konversi, revenue, top afiliator | — |
| `traffic` | DAU/WAU/MAU, page view, device/geo, sumber akuisisi | `days`,`from` |
| `funnels` | Funnel sales (viewed→converted), upsell/downsell, AOV uplift | `days`,`from` |
| `webinars` | Registrasi→hadir→konversi, per webinar | `days`,`from` |
| `retention` | Cohort retention 12 bulan, churn membership, time-to-first-purchase | — |
| `payments` | Success rate per metode/provider, retry recovery, fee gateway | `days`,`from` |
| `products` | Produk digital (sales/revenue) + kredit AI tools (beli/pakai/saldo) | `days`,`from` |
| `gamification` | Check-in, poin, distribusi streak, top badge | `days`,`from` |
| `coupons` | Top kupon, diskon vs revenue, kupon aktif | `days`,`from` |
| `community` | Post, komentar, like, top kontributor | `days`,`from` |
| `email` | Sent/open/click/bounce/unsub, kampanye, sequence, suppression | `days`,`from` |
| `member-health` | Member berbayar tersegmen: active / at-risk / dormant | — |
| `learning` | Drop-off kelas, watch % per lesson, user paid progress rendah | — |
| `creator` | Creator Store: GMV, fee platform, earning, payout, top creator | `days` |

---

## 4. Data yang BELUM terbaca AI (GAP)

Tabel berikut **ada di DB tapi tidak punya endpoint analytics** → tak terlihat AI sama sekali. Diurutkan per prioritas.

### 🔴 Prioritas 1 — Uang yang tak terlihat
| Data | Tabel | Dampak gap |
|---|---|---|
| **Invoice B2B** | `invoices`, `invoice_items`, `invoice_email_logs` | Revenue invoice (draft→paid→overdue) tidak masuk `revenue`/`orders`. Total omzet, piutang, invoice overdue tak terhitung AI. |
| **Checkout abandonment** | `checkout_events` (status `started`) vs `orders` paid | Checkout dimulai tapi tak dibayar tidak ada angkanya. `funnels` hanya soal upsell/downsell. Ini bocoran konversi paling mahal. |

### 🟠 Prioritas 2 — Produk inti tak terukur
| Data | Tabel | Dampak gap |
|---|---|---|
| **Automations** | `automations`, `automation_runs`, `automation_credentials`, `automation_topics` | Tak ada metrik run sukses/gagal, kredit terpakai, automation aktif vs paused. |
| **AI Tools (detail)** | `tool_usage_logs`, `tool_credit_transactions` | `products` cuma ringkasan kredit; pemakaian per-tool, error rate, tren eksekusi belum ada. |

### 🟡 Prioritas 3 — Aktivasi & segmentasi
| Data | Tabel | Dampak gap |
|---|---|---|
| **Onboarding funnel** | `user_milestones` | Tak ada corong onboarding (% selesai per milestone). |
| **Personalization** | `user_profiles` (role/goal/ai_level) | User tak bisa di-breakdown per persona. |

### 🟢 Prioritas 4 — Ops, growth & discovery
| Data | Tabel | Dampak gap |
|---|---|---|
| **Shortlinks** | `shortlinks`, `shortlink_clicks` | Klik link marketing tak terlihat. |
| **Notifications & Push** | `notifications`, `push_subscriptions` | Engagement notif in-app / web push tak terukur. |
| **Seasons & Challenges** | `seasons`, `season_winners`, `challenges`, `challenge_participants` | `gamification` cuma poin/badge/streak; partisipasi challenge & musim belum ada. |
| **Content & Search discovery** | `content_items`, `content_categories`, `learning_paths`, `skills`, `tags` | Tak ada analitik katalog / learning path / pencarian. |
| **Webinar recordings** | `webinar_recordings` | `webinars` hanya event live; tontonan rekaman library tak dihitung. |
| **Talent board & Success stories** | `talent_board_candidates`, `success_stories` | Tak ada di analytics. |
| **System health** | `webhook_events`, `error_logs`, `failed_queue_logs`, `audit_logs` | AI tak bisa bantu diagnosa webhook gagal, tren error, antrean macet. |
| **MAIL_DB terpisah** | DB `growwithai-email` | DB email kedua tak tersentuh analytics. |

### Terbaca tapi PARSIAL (tipis, bukan gap penuh)
- `payments`: rincian retry/fee gateway terbatas.
- `community`: data moderasi (pending/rejected) minim.
- `affiliates`: tier escalation (`affiliate_tiers`) belum tampil.

---

## 5. Cara menutup gap (jika nanti dibutuhkan)

Arsitektur sudah otomatis: **tambah endpoint baru di analytics API → langsung terbaca worker MCP tanpa ubah connector.**

Langkah pola:
1. Tambah handler endpoint baru di `apps/api/src/domains/analytics/routes.ts` (ikuti pola endpoint existing).
2. Daftarkan ke `CATALOG` (baris ~116–146) dan `METRICS_CATALOG` (baris ~150–182).
3. Tambah nama endpoint ke array `ENDPOINTS` di **kedua** file MCP:
   - `mcp/growwithai-analytics/src/index.ts`
   - `mcp/growwithai-analytics-worker/src/index.ts`
4. Deploy worker: `cd mcp/growwithai-analytics-worker && npx wrangler deploy`.

**Rekomendasi urutan:** mulai dari Prioritas 1 (endpoint `invoices` + `checkout` abandonment), karena dampak finansialnya paling besar dan paling sering ditanyakan ke AI.

---

## 6. Cara verifikasi cakupan saat ini

1. **Endpoint live ke AI**: panggil tool MCP `growwithai_analytics_catalog` → `context.endpoints` = 22 endpoint.
2. **Inventaris DB**: `ls apps/api/src/db/migrations/` lalu bandingkan `CREATE TABLE` vs array `ENDPOINTS` di `routes.ts`.
3. **Konfirmasi gap**: cari `CREATE TABLE invoices`, `checkout_events`, `automation_runs`, `shortlink_clicks` → ada di DB tapi tidak di CATALOG.
