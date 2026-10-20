# Mail Hub Terpusat — Panduan Arsitektur & Implementasi

> Status: **rancangan** (belum dibangun). Prototipe dispatcher webhook-nya sudah ada
> di `apps/api/src/domains/webhooks/mailketing.routes.ts` (pejuangyen) dan bisa
> dijadikan cikal bakal hub ini.
>
> Konteks: **1 akun Mailketing** (irfanwill.co, ±2,88 juta kredit, 1 kredit = 1 email)
> dipakai **banyak website** (pejuangyen, growwithai, growclass, sahabatcuan, CFL, dst).

---

## 1. Masalah yang diselesaikan

Mailketing memberi **1 webhook URL per akun**. Event yang dilaporkan:

| Event | Guna |
|---|---|
| Email Bounce | tandai email mati → **suppress** (paling penting untuk reputasi) |
| Unsubscribe | hormati opt-out → suppress |
| Email Open | analitik engagement |
| Link Click | analitik + atribusi email→checkout |
| New Subscriber | sinkronisasi subscriber |

Karena **1 akun = 1 URL webhook**, kalau tiap website memasang webhook-nya sendiri
mereka **rebutan 1 slot** — hanya satu yang bisa terpasang. Selain itu tiap website
punya daftar suppression sendiri-sendiri, sehingga email yang bounce di web A tetap
dikirim oleh web B (menggunakan akun & reputasi Mailketing yang sama) → **reputasi
pengirim rusak bersama**.

**Solusi:** satu **Mail Hub** terpusat yang:
1. menjadi **satu-satunya** webhook URL yang didaftarkan di Mailketing;
2. memegang **suppression list global** (bounce/unsub di mana pun → blok di semua web);
3. (opsional) menjadi **proxy pengiriman** — semua web kirim lewat hub, bukan langsung
   ke Mailketing, sehingga from/tracking konsisten & kredit dikelola satu pintu.

---

## 2. Arsitektur

```
                              ┌──────────────────────────────────────┐
   pejuangyen-api  ──POST /send──▶                                   │
   growwithai-api  ──POST /send──▶     MAIL HUB (Cloudflare Worker)   │──▶ Mailketing /send
   growclass-api   ──POST /send──▶   ┌─────────────────────────────┐ │
   sahabatcuan-api ──POST /send──▶   │ • cek suppression (global)  │ │
                                 │   │ • kirim via Mailketing      │ │
                                 │   │ • catat email_log           │ │
                                 │   └─────────────────────────────┘ │
                                 │                                    │
   Mailketing  ──POST /webhook──────▶ dispatcher by event-type       │
   (1 URL saja)                  │   • bounce/unsub → suppression DB  │
                                 │   • open/click/newsub → event log  │
                                 └──────────────────────────────────┬─┘
                                                                    │
                                              D1: mail_hub (suppression, event_log, projects)
```

Dua permukaan (surface) hub:

- **Inbound dari Mailketing** — `POST /webhook` (1 URL). Terima semua event, update
  suppression global + event log.
- **Outbound dari website** — `POST /send`. Tiap web memanggil ini untuk mengirim.
  Hub cek suppression dulu, baru teruskan ke Mailketing.

> Untuk **proteksi bounce** (tujuan utama), yang wajib cuma: suppression global +
> tiap web mengeceknya sebelum kirim. Atribusi event per-web (open/click milik web mana)
> adalah fitur analitik lanjutan — **tidak wajib** di MVP.

---

## 3. Model data (D1 `mail_hub`)

```sql
-- Registry project (untuk auth & atribusi)
CREATE TABLE projects (
  id            TEXT PRIMARY KEY,          -- 'pejuangyen', 'growwithai', ...
  name          TEXT NOT NULL,
  api_key_hash  TEXT NOT NULL,             -- sha256(api_key) untuk auth /send
  from_email    TEXT NOT NULL,             -- 'noreply@pejuangyen.com'
  from_name     TEXT NOT NULL,
  mailketing_list_id TEXT,                 -- opsional, untuk atribusi event
  created_at    TEXT NOT NULL
);

-- Suppression list GLOBAL (satu email, berlaku semua project)
CREATE TABLE suppression (
  email         TEXT PRIMARY KEY,          -- lowercase
  reason        TEXT NOT NULL,             -- 'bounce' | 'unsubscribe' | 'complaint' | 'manual'
  source        TEXT,                      -- 'mailketing_webhook' | 'email_link' | 'api'
  project_id    TEXT,                      -- project yang memicu (informasi saja)
  raw_payload   TEXT,
  created_at    TEXT NOT NULL
);

-- Log semua event webhook (analitik + audit)
CREATE TABLE event_log (
  id            TEXT PRIMARY KEY,
  project_id    TEXT,                      -- hasil atribusi (boleh NULL)
  email         TEXT NOT NULL,
  event_type    TEXT NOT NULL,             -- 'bounced'|'unsubscribed'|'opened'|'clicked'|'new_subscriber'
  link_clicked  TEXT,
  reason        TEXT,
  raw_payload   TEXT,
  created_at    TEXT NOT NULL
);

-- Log pengiriman (audit kredit & debugging)
CREATE TABLE send_log (
  id            TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL,
  email         TEXT NOT NULL,
  subject       TEXT,
  email_type    TEXT,                      -- 'transactional' | 'marketing'
  status        TEXT NOT NULL,             -- 'sent' | 'suppressed' | 'failed'
  error         TEXT,
  created_at    TEXT NOT NULL
);

CREATE INDEX idx_event_log_email ON event_log(email);
CREATE INDEX idx_event_log_project ON event_log(project_id, created_at);
CREATE INDEX idx_send_log_project ON send_log(project_id, created_at);
```

---

## 4. Kontrak API

### 4.1 `POST /send` — dipakai semua website

Auth: header `Authorization: Bearer <PROJECT_API_KEY>`.

```jsonc
// Request
{
  "to": "budi@gmail.com",
  "subject": "Reset Password",
  "html": "<p>...</p>",
  "email_type": "transactional",   // 'transactional' selalu dikirim; 'marketing' dicek consent
  "from_email": "noreply@pejuangyen.com", // opsional; default dari registry project
  "from_name": "PejuangYen"
}

// Response 200
{ "status": "sent" }               // atau "suppressed" (email di daftar suppress)
```

Aturan penting:
- `email_type: "transactional"` (reset password, OTP, resi) → **selalu dikirim**,
  walau ada di suppression (orang harus tetap bisa reset password meski unsub marketing).
- `email_type: "marketing"` → **dicek suppression dulu**; kalau ada → `"suppressed"`,
  tidak dikirim, tidak buang kredit.

### 4.2 `POST /webhook` — 1 URL yang didaftarkan di Mailketing

Auth: query `?secret=<HUB_WEBHOOK_SECRET>`.
Dispatcher membaca tipe event dari payload (`event`/`type`/`event_type`) lalu:
- `bounce`/`unsubscribe` → tulis ke `suppression` (global) + `event_log`.
- `open`/`click`/`new_subscriber` → `event_log` saja.
- tipe tak dikenal → **log payload mentah** (untuk memetakan field asli Mailketing), balas 200.

> Pola dispatcher ini **sudah diimplementasikan** di pejuangyen:
> `apps/api/src/domains/webhooks/mailketing.routes.ts` (fungsi `EVENT_HANDLERS` +
> `POST /`). Tinggal diangkat ke hub, ganti target tulis ke tabel `suppression`/`event_log`
> milik hub, dan tambah atribusi project.

### 4.3 `GET /suppression/check?email=...` — opsional

Kalau sebuah web mau tetap kirim langsung ke Mailketing (tidak lewat `/send`),
minimal ia panggil ini sebelum kirim untuk menghormati suppression global.
Response: `{ "suppressed": true|false, "reason": "bounce" }`.

---

## 5. Atribusi event → project (analitik lanjutan)

Masalah: 1 webhook menerima event **semua** project. Bagaimana tahu event ini milik
web mana? Pilihan (dari termudah):

1. **Tidak usah (MVP).** Suppression global tidak butuh tahu project. Selesai.
2. **Per-list Mailketing.** Tiap web pakai `list_id` Mailketing berbeda; payload event
   biasanya menyertakan `list_id` → map ke `projects.mailketing_list_id`.
3. **Lookup by email.** Cari email di registry user tiap project (kurang akurat kalau
   email sama terdaftar di >1 web).
4. **Tag/campaign prefix.** Beri prefix campaign per web (mis. `PY_`, `GWA_`), baca dari payload.

Rekomendasi: mulai dengan **#1**, naik ke **#2** saat butuh dashboard analitik per-web.

---

## 6. Deliverability (WAJIB per domain pengirim)

Tiap domain pengirim (`pejuangyen.com`, `growwithai.id`, `growclass.id`, …) perlu
autentikasi email sendiri di DNS-nya (Cloudflare):

- **SPF** (TXT `@`): `v=spf1 include:spf.mailketing.id ~all`
- **DKIM** (TXT/CNAME): ambil selector + key dari dashboard Mailketing (Sending Domain).
- **DMARC** (TXT `_dmarc`): mulai `v=DMARC1; p=none; rua=mailto:dmarc@domain` (monitoring),
  naikkan ke `p=quarantine` setelah SPF+DKIM stabil.

> Hub tidak menghilangkan kebutuhan ini — autentikasi email menempel pada **domain
> pengirim**, bukan pada hub. Hub hanya menyatukan pengiriman & suppression.

Status pejuangyen.com saat ini: SPF ✅ ada, DKIM ❓ belum, DMARC ❌ belum.

---

## 7. Deployment

Worker terpisah (mis. repo `mail-hub/` atau subfolder), `wrangler.toml`:

```toml
name = "mail-hub"
main = "src/index.ts"
compatibility_date = "2025-05-19"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "mail-hub"
database_id = "<buat: wrangler d1 create mail-hub>"

[[routes]]
pattern = "mail.pejuangyen.com"   # atau domain hub tersendiri
custom_domain = true
```

Secret:
- `HUB_WEBHOOK_SECRET` — untuk `?secret=` di `POST /webhook`.
- `MAILKETING_API_TOKEN` — token akun Mailketing (yang sekarang dipakai pejuangyen).

Per-project API key: generate acak, simpan **hash-nya** di tabel `projects`, kasih
nilai aslinya ke tiap web sebagai secret (mis. `MAIL_HUB_API_KEY`).

---

## 8. Jalur migrasi per website (incremental, tanpa downtime)

Fase per web bisa jalan sendiri-sendiri:

1. **Daftarkan project** di tabel `projects` hub (api_key, from_email).
2. **Ganti pemanggilan kirim** di web: dari `sendMailketingEmail(...)` langsung →
   `POST https://mail.pejuangyen.com/send` dengan `MAIL_HUB_API_KEY`.
   (Di pejuangyen, titik ubahnya cuma `services/mailketing.ts` — semua domain sudah
   lewat `sendMailketingEmail`, jadi 1 file.)
3. Setelah **semua** web pindah, set **1 webhook URL** di Mailketing → `https://mail.pejuangyen.com/webhook?secret=...`.
4. Matikan webhook per-web lama (kalau ada).

Selama transisi, web yang belum pindah tetap kirim langsung — aman, hanya belum dapat
suppression global.

---

## 9. Fase rollout yang disarankan

| Fase | Isi | Hasil |
|---|---|---|
| **0 (sudah ada)** | Dispatcher webhook terpadu di pejuangyen | 1 URL, bounce protection utk pejuangyen |
| **1 — MVP hub** | Worker + D1 `mail_hub`, `POST /webhook`, `POST /send`, suppression global | 1 webhook, suppression lintas-web |
| **2 — migrasi** | Pindahkan tiap web ke `/send` satu per satu | semua kirim lewat hub |
| **3 — analitik** | Atribusi event per-project (list_id), dashboard | statistik open/click per web |
| **4 — hardening** | Rate limit, retry queue, DMARC quarantine, alert saldo kredit | produksi matang |

---

## 10. Keputusan yang perlu diambil sebelum bangun

- [ ] **Domain hub**: `mail.pejuangyen.com`? domain netral? (hindari domain yang bisa ganti brand)
- [ ] **Hub kirim atau cuma suppression?** Full proxy (`/send`) vs hanya webhook+`/suppression/check`.
- [ ] **1 akun Mailketing untuk semua** (sekarang) vs pisah akun per web (lebih mahal, tak perlu hub).
- [ ] **Repo**: worker baru terpisah, atau modul di salah satu app.
- [ ] **from_email per web** sudah punya SPF/DKIM masing-masing?

---

## 11. Referensi implementasi yang sudah ada (pejuangyen — bisa dijadikan benih)

- Dispatcher webhook terpadu: `apps/api/src/domains/webhooks/mailketing.routes.ts`
  - `EVENT_HANDLERS` (peta tipe event → handler, toleran ejaan)
  - `POST /` (dispatcher: baca `event`/`type`/`event_type`, log yang tak dikenal)
  - `process{NewSub,Open,Click,Bounce,Unsub}` (logika per event)
- Pengiriman: `apps/api/src/services/mailketing.ts` (`sendMailketingEmail`, satu pintu)
- Suppression & guard: `apps/api/src/lib/email-suppression.ts`, `email-guard.ts`
  (`canSendEmail` → cek `isEmailSuppressed` sebelum kirim marketing)
- Unsubscribe link footer (tanpa webhook): `app.ts` → `GET /api/unsubscribe`

Angkat pola-pola ini ke hub, ganti tulisan DB ke tabel `mail_hub`, tambah lapisan
auth per-project + atribusi. Selesai.
