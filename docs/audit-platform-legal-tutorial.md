# Audit Platform GrowWithAI — Bahan Legal & Tutorial

> **Disclaimer:** Dokumen ini adalah **audit teknis berbasis kode** untuk menyiapkan halaman legal (Syarat & Ketentuan, Kebijakan Privasi, Refund, Affiliate Terms) dan halaman bantuan (FAQ/tutorial/onboarding). **Ini BUKAN nasihat hukum.** Sebelum dipublikasikan, draf hukum apa pun yang diturunkan dari dokumen ini **wajib direview pengacara/DPO**, khususnya untuk kepatuhan **UU PDP No. 27/2022** dan **UU ITE**.
>
> **Metode:** Setiap baris **FAKTA** dapat dilacak ke file nyata (kolom *Bukti*). Hal yang tidak ada di kode ditandai **"TIDAK DITEMUKAN DI KODE"**. Rekomendasi auditor dipisah sebagai **ASUMSI/REKOMENDASI**. Hal yang menunggu keputusan founder ditandai **`[TODO — KEPUTUSAN BISNIS]`**.
>
> **Tanggal audit:** 14 Juni 2026 · **Repo:** `growwithai-app` (path bukti relatif ke root repo) · **Bahasa & yurisdiksi:** Indonesia.

---

## 0. Ringkasan Eksekutif

**Arsitektur:** Monorepo Turborepo. `apps/api` = Hono di Cloudflare Workers (binding D1 SQLite, R2, KV, Queues, Workers AI). `apps/web` = Next.js (static export). `packages/shared` = skema Zod. Pembayaran via **Pakasir** (integrasi Mayar lama sudah dihapus dari kode), email via **Mailketing**, AI tools via **Sumopod**, proteksi bot via **Cloudflare Turnstile**.

### 5 temuan paling penting (untuk founder)

1. **Aplikasi belum punya halaman legal/bantuan sama sekali.** `apps/web` tidak punya `/terms`, `/privacy`, `/refund`, `/faq`, `/help`. (Situs `growwithai-landing` terpisah punya `/terms`, `/privacy`, `/faq`, tapi isinya boilerplate generik.)

2. **⚠️ Kontradiksi REFUND.** Halaman landing `terms` & `faq` menjanjikan *"garansi refund 7 hari, diproses 3-5 hari kerja"*, **padahal tidak ada mekanisme refund pembayaran di kode** (terverifikasi). Satu-satunya refund adalah auto-refund **1 kredit** saat eksekusi AI gagal (`apps/api/src/domains/tools/tools.routes.ts:586`). → **Keputusan bisnis wajib:** apakah refund 7 hari benar dijalankan manual, atau janji itu dihapus. Jangan menulis Terms baru yang menjanjikan refund yang sistem tak dukung.

3. **Privasi belum sesuai sistem & UU PDP.** Sistem nyata mengumpulkan tracking perilaku first-party (IP & user-agent di-hash), mengirim data ke **Pakasir, Mailketing, Sumopod (prompt user → model AI eksternal)** — tidak satu pun dijelaskan di halaman privacy lama. Lebih kritis: **TIDAK ADA endpoint hapus akun / export data** → gap hak subjek data UU PDP (hak mengakhiri pemrosesan / menghapus / portabilitas — nomor pasal pastikan dengan pengacara).

4. **Fitur yang menyentuh uang belum diatur di Terms:** tool credits, komisi affiliate, fee creator-store (toko), webinar berbayar, produk digital. Terms lama hanya menyebut kelas/Zoom/komunitas.

5. **Beberapa kebijakan adalah keputusan bisnis murni (tak ada di kode):** kebijakan refund, masa berlaku kredit AI, dan aturan pencairan (payout) komisi affiliate. Ditandai `[TODO]` di Fase 3 & 6.

---

## FASE 1 — Peta Fitur (Feature Map)

### 1.1 Domain & endpoint utama

Semua route dimount di `apps/api/src/app.ts`. Aktor ditentukan middleware `apps/api/src/middleware/auth.ts` (`authMiddleware`, `requireRole`).

| Domain | Endpoint (contoh) | Aktor | Input user | Side-effect | Uang | PII | Bukti |
|---|---|---|---|---|:--:|:--:|---|
| **Auth** | `POST /api/auth/register`, `/login`, `/verify-email`, `/forgot-password`, `/reset-password`, `/logout`, `GET /me` | Guest/User | email, password, nama, phone, OTP, Turnstile | buat user & session, kirim OTP, grant 3 kredit gratis saat verifikasi | | ✓ | `domains/auth/routes.ts`, `service.ts` |
| **Courses/LMS** | `GET /api/courses`, `/:slug`, `/:id/modules` | Publik | filter, slug | baca katalog (cache KV) | | | `domains/courses/routes.ts` |
| **User/LMS** | `GET /api/user/my-classes`, `POST /enroll/free`, `POST /progress/complete`, `/progress/watch`, `GET/PUT /profile`, `POST /onboarding`, `POST /checkin` | User | course_id, lesson_id, progress, profil | enrollment, progress, poin/badge, update profil | | ✓ | `domains/user/routes.ts` |
| **Membership** | `GET /api/membership/plans` | Publik | — | baca paket (cache 5 mnt) | ✓ | | `domains/membership/routes.ts` |
| **Orders** | `POST /api/orders/create`, `GET /api/orders`, `/:id` | User | product_id, order_type, affiliate_code, coupon | buat order pending, panggil provider | ✓ | ✓ | `domains/orders/routes.ts`, `service.ts` |
| **Checkout** | `POST /api/checkout/create-payment`, `/:id/check`, `/:id/repay`, `/:id/simulate` | User | metode bayar | buat/poll transaksi, fulfillment | ✓ | ✓ | `domains/checkout/routes.ts`, `service.ts` |
| **Webhooks** | `/api/webhooks/pakasir`, `/api/webhooks/mailketing/*` | Provider | payload + signature | verifikasi & fulfillment / suppression email | ✓ | ✓ | `domains/webhooks/*` |
| **Tools/Credits** | `GET /api/tools`, `GET /api/tools/credits`, `/credits/packages`, `POST /credits/purchase`, `POST /api/tools/web-prompt-generator` | User | data PRD, package_id | potong 1 kredit, panggil AI Sumopod, log | ✓ | ✓ | `domains/tools/tools.routes.ts`, `credits.routes.ts` |
| **Affiliate** | `POST /api/affiliate/register`, `GET /me`, `/commissions`, `/leads`, `/leaderboard`, `POST /track-click`, `GET /resolve/:code` | User/Publik | kode, landing_url | buat akun affiliate, log klik (IP/UA hash), hitung komisi | ✓ | ✓ | `domains/affiliate/routes.ts` |
| **Webinars** | `GET /api/user/webinars`, `POST /:id/register`, `/:id/attend`, `/:id/select-method`, `GET /api/public/webinars` | User/Publik | affiliate_code, metode | registrasi, kehadiran+poin, buat shortlink | ✓ | ✓ | `domains/webinars/user.routes.ts`, `public.routes.ts` |
| **Shortlinks** | `GET/POST/PATCH/DELETE /api/shortlinks`, `GET /api/public/shortlinks` | User/Publik | slug, destination_url | buat/kelola link, log klik (IP/UA hash) | | ✓ | `domains/shortlinks/routes.ts` |
| **Toko/Creator** | `GET/POST /api/toko/me/products`, `GET /api/public/toko`, `GET /api/purchases` | User/Publik | produk, file | buat produk creator, jual (fee + earnings) | ✓ | ✓ | `domains/toko/routes.ts`, `purchases.routes.ts` |
| **Digital products** | `GET /api/public/digital-products`, `GET /api/user/digital-products` | User/Publik | — | akses produk digital | ✓ | | `domains/public/digital-products.routes.ts` |
| **Certificates** | `GET /api/user/certificates`, `GET /api/verify/:number` (publik, no-auth) | User/Publik | nomor sertifikat | terbitkan & verifikasi sertifikat publik | | ✓ | `domains/user/certificates.routes.ts`, `domains/public/verify.routes.ts` |
| **Funnels** | `GET /api/public/funnels`, `/api/funnels` | User/Publik | offer_id | upsell/downsell, order bump | ✓ | | `domains/funnels/*` |
| **Community** | `GET/POST /api/community/*`, `GET /api/public/community-blog` | User/Publik | post, komentar | diskusi, blog publik | | ✓ | `domains/community/routes.ts` |
| **Tracking** | `POST /api/tracking` | Anon/User | event, UTM, session_id | catat event first-party | | ✓ | `domains/tracking/routes.ts` |
| **Email** | `GET /api/unsubscribe` (publik, no-auth) | Publik | email | suppression + cabut consent | | ✓ | `apps/api/src/app.ts:196` |
| **Admin** | `/api/admin/*` (users, orders, courses, memberships, coupons, commissions, email, webinars, recordings, audit-logs, settings, dst.) | Admin | — | kelola seluruh entitas, approve komisi, ubah status order | ✓ | ✓ | `domains/admin/*` |

> Domain lain yang ada: `resources`, `skills`, `search`, `paths`, `leaderboard`, `analytics`, `invoices`, `categories`, `settings`. (Lihat daftar lengkap mount di `apps/api/src/app.ts:101-193`.)

### 1.2 Halaman web user-facing (`apps/web/src/app`)

- **Publik:** `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/verify/[number]`, `/order/[productSlug]`, `/checkout/[orderId]`, `/learn/[courseSlug]`, `/learn/[courseSlug]/[lessonSlug]`, `/premium`, `/webinar/[slug]`, `/toko/[slug]`.
- **User (login):** `/dashboard`, `/my-classes`, `/kelas`, `/explore`, `/webinars`, `/rekaman-zoom`, `/tools`, `/products`, `/affiliate`, `/growth-ambassador`, `/bonuses`, `/certificates`, `/community`, `/member-map`, `/shortlinks`, `/skills`, `/talent-board`, `/toko-saya`, `/pembelian`, `/transactions`, `/account`, `/resources`, `/paths`.
- **Admin:** `/admin`, `/admin/users`, `/admin/orders`, `/admin/courses`, `/admin/memberships`, dst.

**FAKTA penting:** Tidak ada `/terms`, `/privacy`, `/refund`, `/faq`, `/help`, `/getting-started` di `apps/web`. → **GAP** (lihat Fase 6).

### 1.3 Rate limit & anti-abuse (`apps/api/src/middleware/rate-limit.ts`)

Pakai Cloudflare Workers Rate Limiting bindings (`RL_5_PER_MIN`, `RL_3_PER_HOUR`, `RL_10_PER_HOUR`, `RL_60_PER_MIN` — lihat `apps/api/src/env.ts:16-20`).

| Aksi | Batas | Kunci | Bukti |
|---|---|---|---|
| Register / Login / Verify | 5/menit per IP | `reg:{ip}` dst. | `domains/auth/routes.ts` |
| Forgot password | 3/jam per IP | `forgot:{ip}` | idem |
| Reset password | 10/jam per IP | `reset:{ip}` | idem |
| Checkout create | 10/menit per user | `checkout:{user}` | `domains/checkout/routes.ts` |
| Beli kredit / order | 10/menit per user | `credits:{user}`, `order:{user}` | `domains/tools`, `orders` |
| Buat shortlink | 20/jam per user (maks 20 link) | `shortlink:{user}` | `domains/shortlinks/routes.ts` |

Anti-abuse lain (FAKTA): **Cloudflare Turnstile** (`TURNSTILE_SECRET_KEY`) + **honeypot** + **MX-check email** saat register; **OTP** 6 digit TTL 24 jam di KV; session token di-hash SHA256, dapat di-revoke. Bukti: `domains/auth/service.ts`, `lib/turnstile.ts`, `lib/mx-check.ts`.

### 1.4 Klasifikasi prioritas

- **Menyentuh uang:** orders, checkout, membership, tool credits, affiliate commission, webinar berbayar, digital products, toko/creator. → prioritas **Terms & Refund**.
- **Menyentuh data pribadi:** auth, user profile, tracking, affiliate/shortlink clicks (IP/UA hash), email marketing, certificates (nama publik), member-map (kota/bio). → prioritas **Privacy**.
- **Sering bikin bingung (butuh tutorial):** verifikasi OTP, alur checkout & "saya sudah bayar", perpanjangan membership (extend dari expiry), saldo kredit AI, jadi affiliate + komisi, free-share webinar. → prioritas **FAQ/tutorial** (Fase 4).

---

## FASE 2 — Inventaris Data (bahan Kebijakan Privasi)

### 2.1 Data pribadi yang dikumpulkan

Sumber: `packages/shared/src/schemas.ts`, migrasi `apps/api/src/db/migrations/*` (a.l. `0001_initial_schema.sql`, `0005_email_marketing.sql`, `0049_tracking_foundation.sql`).

| Data | Sumber | Disimpan di | Tujuan | Retensi |
|---|---|---|---|---|
| Email, nama, no. WhatsApp | Registrasi | `users` | autentikasi, komunikasi | seumur akun |
| Password (hash) | Registrasi | `users.password_hash` | autentikasi | seumur akun (`lib/password.ts`) |
| Avatar, bio, kota, visibilitas map | Update profil | `users` | profil, member-map | seumur akun |
| Session token (hash SHA256) | Login | `sessions.token_hash` | autentikasi | aktif 7 hari; revoked dihapus >30 hari |
| OTP email | Verifikasi | KV `otp:email:{email}` | verifikasi | TTL 24 jam |
| Token reset password (hash) | Lupa password | `password_reset_tokens` | reset | kedaluwarsa 1 jam |
| Atribusi (first/last touch, UTM, affiliate_code, referrer, landing) | Frontend → register | `user_attribution`, `tracking_events` | atribusi marketing | event mentah 90 hari; agregat selamanya |
| IP & user-agent (**di-hash SHA256**) | Header request | `affiliate_clicks`, `shortlink_clicks`, `audit_logs` | anti-fraud, analitik klik | mengikuti tabelnya |
| Device, negara, page_url, referrer | Tracking | `tracking_events` | analitik | 90 hari (purge) |
| Profil email marketing (status langganan, consent, engagement, purchase_count, total_spent) | Register + webhook Mailketing | `email_marketing_profiles`, `email_events` | segmentasi & lifecycle email | seumur akun |
| Order, pembayaran, payload provider | Checkout/webhook | `orders`, `payments.raw_payload_json` | transaksi, audit | selamanya (akuntansi) |
| Progress belajar, kehadiran webinar | Aktivitas | `enrollments`, `lesson_progress`, `webinar_registrations` | LMS | seumur akun |
| Onboarding (role, goal, level, minat) | Survey | `user_profiles` | personalisasi | seumur akun |
| Gamifikasi (poin, badge, streak) | Aktivitas | `user_points`, `user_streaks`, `user_badges` | engagement | seumur akun |

### 2.2 Pihak ketiga (processor) — data keluar

Sumber: `apps/api/src/env.ts`, `services/pakasir.ts`, `services/mailketing.ts`, `domains/tools/*`. **Hanya NAMA variabel env yang ditulis (bukan nilainya).**

| Processor | Data dikirim | Tujuan | Env var |
|---|---|---|---|
| **Pakasir** | order id, nominal, metode bayar | payment gateway (embedded checkout) | `PAKASIR_PROJECT_SLUG`, `PAKASIR_API_KEY`, `PAKASIR_WEBHOOK_SECRET`, `PAKASIR_MODE` |
| **Mailketing** | email, nama, phone, status langganan, UTM | email marketing & transaksional | `MAILKETING_API_TOKEN`, `MAILKETING_WEBHOOK_SECRET` |
| **Sumopod (AI)** | **prompt + konteks yang diketik user** (PRD generator) dikirim ke model AI eksternal | generate konten AI | `SUMOPOD_API_KEY`, `SUMOPOD_BASE_URL`, `SUMOPOD_MODEL`, `SUMOPOD_DEEP_MODEL`, `SUMOPOD_FALLBACK_MODEL` |
| **Cloudflare** | semua request; Turnstile menerima fingerprint/IP; D1/R2/KV/Queues/Workers AI menyimpan/memproses data | hosting, DB, storage, bot protection | `TURNSTILE_SECRET_KEY` + binding `DB/R2/R2_PRIVATE/KV/AI/*_QUEUE` |
| **WhatsApp (opsional)** | no. WA, isi notifikasi | notifikasi | `WHATSAPP_API_URL`, `WHATSAPP_API_TOKEN`, `WHATSAPP_API_AUTH_SCHEME` |

> **Implikasi privacy:** Kebijakan Privasi WAJIB menyebut bahwa **prompt yang diketik user pada AI Tools dikirim ke penyedia AI pihak ketiga (Sumopod)**. Pernyataan lama "hanya Google Analytics" pada halaman landing **tidak akurat** — sistem pakai tracking first-party sendiri, bukan GA.

### 2.3 Cookie, tracking, unsubscribe, retensi

- **Cookie:** `session` (HttpOnly, Secure, SameSite=Lax, 7 hari) — `apps/api/src/lib/cookies.ts`. `affiliate_code` disimpan client-side (localStorage), dikirim saat register/order.
- **Tracking first-party:** event di `tracking_events` (bukan pihak ketiga). IP & UA selalu di-hash. Bukti: `domains/tracking/*`, migrasi `0049`.
- **Unsubscribe (FAKTA, ADA):** `GET /api/unsubscribe?email=` → masuk `email_suppression_list`, set `email_marketing_profiles.marketing_consent = 0`, batalkan sequence. Bukti: `apps/api/src/app.ts:196-215`, `lib/email-suppression.ts`. Juga via webhook Mailketing (bounce/unsub).
- **Retensi via cron** (`apps/api/src/index.ts:71-157`, jadwal `0 0 * * *`):

| Data | Retensi | Bukti |
|---|---|---|
| Membership aktif lewat `expires_at` | → status `expired` | `index.ts:77` |
| Order `pending` | → `expired` setelah 24 jam | `index.ts:84` |
| Session revoked | dihapus >30 hari | `index.ts:92` |
| Error logs | dihapus >90 hari | `index.ts:98` |
| Webhook events (processed) | dihapus >90 hari | `index.ts:104` |
| **User belum verifikasi** | **dihapus >24 jam** | `index.ts:110` |
| Tracking event mentah | purge >90 hari (agregat & `user_activity_days` disimpan selamanya) | `index.ts:150`, `domains/tracking/aggregate.ts` |

### 2.4 Hak subjek data (UU PDP No. 27/2022) — status

| Hak | Status di sistem | Bukti |
|---|---|---|
| Akses data sendiri | ⚠️ Sebagian — bisa lihat profil/transaksi, **tapi tak ada export menyeluruh (SAR)** | `domains/user/routes.ts` |
| Perbaikan data | ✅ Ada — `PUT /api/user/profile` | `domains/user/routes.ts` |
| Tarik consent email | ✅ Ada — `/api/unsubscribe` | `app.ts:196` |
| **Penghapusan / "hak dilupakan"** | ❌ **TIDAK ADA** endpoint hapus akun | grep `delete-account/anonymize` = kosong |
| **Portabilitas data** | ❌ **TIDAK ADA** endpoint export | idem |
| Pembatasan/keberatan pemrosesan | ⚠️ Hanya untuk email marketing, bukan tracking | — |

> **(c) GAP — keputusan/implementasi:** Untuk patuh UU PDP, sistem perlu (a) endpoint **hapus akun** (idealnya soft-delete + anonymisasi + masa tenggang) dan (b) **export data**. Saat ini **tidak ada di kode** → ini juga catatan untuk halaman Privacy: jangan menjanjikan hak yang belum bisa dieksekusi otomatis; jika dijanjikan, sebut kanal manual (mis. email `admin@growwithai.id`) sebagai mekanisme sementara.

---

## FASE 3 — Commerce, Membership, Refund, Affiliate (bahan Terms)

### 3.1 Jenis produk & model akses (FAKTA)

Bukti utama: `apps/api/src/domains/orders/fulfillment.ts`, `domains/access/service.ts`, `lib/dates.ts`.

| Produk | `order_type` | Akses diberikan | Durasi |
|---|---|---|---|
| Kelas | `course` | `enrollments` + `user_access` lifetime | **seumur hidup** (`fulfillment.ts:190`) |
| Membership | `membership` | row `memberships` (status active) | sesuai paket (lihat 3.3) |
| Kredit AI | `tool_credits` | tambah saldo `user_tool_credits` | **saldo permanen, tanpa expiry** (`fulfillment.ts:237`) |
| Webinar berbayar | `webinar_registration` | `webinar_registrations` → `registered_paid` | sesuai jadwal webinar (`fulfillment.ts:270`) |
| Produk digital | `digital_product` | `user_access` lifetime; `delivery_type='service'` → admin follow-up WA | seumur hidup (`fulfillment.ts:277`) |
| Produk creator (toko) | `creator_product` | `user_access` lifetime + `creator_earnings` (fee platform di-snapshot, hold default 7 hari) | seumur hidup (`fulfillment.ts:303`) |

**Enrollment ≠ entitlement:** akses kelas yang dibeli langsung bersifat lifetime (tetap ada walau membership berakhir). Akses konten **membership-only** dicek via membership aktif — **hilang saat membership `expired`**. Bukti: `domains/access/service.ts:12-44`.

### 3.2 Lifecycle pembayaran (FAKTA)

`order create` → `Pakasir embedded transaction (QRIS/VA)` → `webhook` → `verifikasi + verify ke API Pakasir` → `fulfillment atomik`.

- **Idempotency (kuat):** dedup order pending 2 jam; `webhook_events` UNIQUE(`provider_event_id`); fulfillment pakai `INSERT OR IGNORE` + unique index (enrollments, memberships, affiliate_commissions, user_access, kredit per order). Aman untuk retry webhook. Bukti: `fulfillment.ts:96-107`, `domains/webhooks/routes.ts`.
- **Verifikasi:** Pakasir embedded + manual check ("Saya sudah bayar" → `POST /api/checkout/:id/check`) yang memverifikasi status transaksi langsung ke API Pakasir sebelum fulfillment. Bukti: `domains/checkout/service.ts`, `services/pakasir.ts`.
- **Order pending kedaluwarsa** setelah 24 jam via cron (`index.ts:84`). User bisa `repay` selama masih pending.

### 3.3 Membership & expiry (FAKTA)

- Durasi (`lib/dates.ts:11`): `lifetime`=tanpa expiry, `monthly`=+30 hari, `yearly`=+365 hari, `custom`=+`duration_days` (default +30).
- **Perpanjangan extend dari `expires_at` lama, BUKAN dari tanggal bayar** — jika user masih punya membership aktif, durasi baru ditambahkan ke akhir periode berjalan. Bukti: `access/service.ts:54-63`, `fulfillment.ts:218-230`.
- Expiry otomatis via cron harian (`index.ts:77`).

### 3.4 Refund — **TIDAK DITEMUKAN DI KODE**

- **Tidak ada endpoint/logika refund pembayaran** untuk order tipe apa pun (terverifikasi via grep seluruh `apps/api/src`).
- Admin hanya bisa ubah status order ke `cancelled` (yang mencabut `user_access` → `revoked`), **tanpa** mengembalikan dana ke provider. Bukti: `domains/admin/orders.routes.ts`.
- Satu-satunya "refund" di sistem: **auto-refund 1 kredit** saat eksekusi AI gagal (`tools.routes.ts:586-602`), bukan pengembalian uang.

> **`[TODO — KEPUTUSAN BISNIS #1: Kebijakan Refund]`**
> - ⚠️ Halaman landing lama menjanjikan "garansi 7 hari, diproses 3-5 hari kerja". Sistem tidak menegakkan ini.
> - Founder harus tetapkan: **(a)** apakah ada refund? **(b)** syarat & jendela waktu? **(c)** dijalankan manual via channel apa? **(d)** produk mana yang non-refundable (mis. kredit AI yang sudah terpakai, produk digital yang sudah diunduh)?
> - Sampai diputuskan, **bagian refund di Terms dikosongkan** — jangan tulis default.

### 3.5 Kredit AI (FAKTA)

- Pemotongan: **1 kredit per pemakaian**, atomic, ditolak jika saldo < 1 (`tools.routes.ts:487-494`).
- Bonus: **3 kredit gratis** saat email terverifikasi (`domains/auth`).
- Refund hanya saat AI gagal (1 kredit). **Tidak ada expiry** kredit, **tidak ada** transfer antar-user, **tidak ada** refund paket yang sudah dibeli.

> **`[TODO — KEPUTUSAN BISNIS #2: Masa berlaku & sifat kredit]`** Kredit saat ini permanen & non-refundable (selain kegagalan AI). Founder perlu menegaskan di Terms apakah kebijakan ini final (disarankan: nyatakan kredit non-refundable & tanpa kedaluwarsa, sesuai perilaku sistem). **Dikosongkan sampai dikonfirmasi.**

### 3.6 Affiliate (FAKTA)

- Daftar: `POST /api/affiliate/register` (langsung aktif, tanpa approval manual). Atribusi via `affiliate_code` di order; klik dilacak (IP/UA hash).
- **Rate komisi** (`lib/settings.ts:15-29`): **membership = 40%**; tipe lain (course, webinar, produk digital) **dibatasi maks 20%** (`default_commission_rate`, di-clamp ≤20%); **`tool_credits` & `creator_product` = TANPA komisi** (kode affiliate tidak dilampirkan, `orders/service.ts:305-308`). Diubah via migrasi `0066_affiliate_commission_20_membership_40.sql` (komisi yang sudah tercatat tidak diubah retroaktif).
- Komisi langsung berstatus **`approved`** saat pembayaran; **self-referral diblokir** (`fulfillment.ts:370-389`).
- **Pencairan/payout: TIDAK DITEMUKAN DI KODE.** `GET /api/affiliate/commissions` read-only; tidak ada endpoint request payout / proses pembayaran komisi.

> **`[TODO — KEPUTUSAN BISNIS #3: Aturan komisi & payout affiliate]`** Founder harus tetapkan: minimum payout, jadwal/metode pencairan, masa tunggu (hold), syarat diskualifikasi (mis. order yang di-refund/cancel), dan apakah self-purchase dilarang. **Affiliate Terms dikosongkan di bagian payout sampai dikonfirmasi.**

### 3.7 Cron jobs (FAKTA, `apps/api/src/index.ts`)

- **Harian `0 0 * * *`:** expire membership; expire order pending; bersihkan session/error-log/webhook/unverified-user; cek & sync Mailketing; scan email lifecycle; rollup + purge tracking.
- **Tiap 10 menit `*/10 * * * *`:** proses email sequence; scan abandoned checkout; reminder webinar (jendela 12:00 WIB); reminder streak (jendela 19:00 WIB).

---

## FASE 4 — User Flow → Tutorial / Panduan

Outline diturunkan dari endpoint Fase 1 (bukan mengarang UI). Format tiap artikel: **Prasyarat · Langkah · Hasil · Error umum & solusi**.

1. **Daftar akun + verifikasi.** Langkah: isi form register (Turnstile) → cek email → masukkan OTP 6 digit → dapat 3 kredit gratis. Error umum: OTP kedaluwarsa (TTL 24 jam) → "Kirim ulang"; email tak masuk → cek spam / MX invalid. *(Endpoint: `/api/auth/register`, `/verify-email`, `/resend-verification`.)*
2. **Beli membership / checkout.** Langkah: buka `/order/[slug]` atau `/premium` → pilih paket → checkout → bayar via Pakasir (QRIS/VA) → akses aktif otomatis. Catatan: perpanjangan menambah durasi ke akhir periode aktif. Error: order pending 24 jam, gunakan "Bayar ulang" / "Saya sudah bayar".
3. **Akses kelas + progress + sertifikat.** Langkah: `/my-classes` → buka lesson → progress & watch tersimpan otomatis → selesai modul → sertifikat → verifikasi publik di `/verify/[number]`.
4. **AI Tools.** Langkah: `/tools` → cek saldo → (beli paket bila habis) → isi form PRD → generate (potong 1 kredit). Error: saldo kurang → beli kredit; AI gagal → 1 kredit otomatis dikembalikan.
5. **Webinar + replay.** Langkah: `/webinars` → daftar (gratis/free-share/berbayar) → hadir (dapat poin) → replay di `/rekaman-zoom` (sebagian butuh membership).
6. **Jadi affiliate.** Langkah: `/affiliate` → daftar → ambil link/kode → share → pantau klik, leads, komisi, leaderboard. Catatan komisi: membership 40%, lainnya ≤20%, kredit/produk-creator tanpa komisi.
7. **Shortlink.** Langkah: `/shortlinks` → buat (maks 20, slug `[a-z0-9-]{3,50}`) → pantau klik.
8. **Akun:** reset password (`/forgot-password`), ubah profil & visibilitas member-map (`/account`), unsubscribe email (link footer).

---

## FASE 5 — Disclaimer, Batasan & Edge Case

Semua diturunkan dari fakta sistem.

- **Penggunaan yang Dilarang** (basis: rate-limit, Turnstile, honeypot, IDOR guard): dilarang bot/scraping/abuse pendaftaran & order, multi-akun untuk manipulasi kredit/komisi, mengakses data user lain, membagikan akun (akses bersifat personal — lihat Terms IP).
- **Disclaimer AI** (basis: Sumopod): output AI Tools dapat tidak akurat/keliru; tanggung jawab verifikasi ada pada user; prompt dikirim ke penyedia AI pihak ketiga.
- **Ketersediaan layanan** (basis: serverless Cloudflare): dapat ada pemeliharaan/gangguan; tidak ada jaminan uptime/SLA tertentu; layanan dapat berubah.
- **Konten affiliate** (basis: tracking + komisi): dilarang spam, klaim palsu/menyesatkan, self-referral (diblokir sistem); pelanggaran → komisi dibatalkan & akun affiliate dinonaktifkan.
- **Pembatasan & penghentian akun** (basis: `users.status`, revoke session, admin bypass): admin dapat menonaktifkan akun, mencabut session, dan mencabut akses (`user_access` → `revoked`) atas pelanggaran. Catat: pencabutan akses **tidak** otomatis berarti refund (lihat 3.4).
- **Edge case retensi:** akun yang tidak diverifikasi dalam 24 jam dihapus otomatis → sebut di FAQ "Kenapa akun saya hilang?".

---

## FASE 6 — Daftar Deliverable Halaman + Ringkasan GAP

**Lokasi target: di dalam aplikasi** `apps/web/src/app` (keputusan founder). Halaman landing lama (`growwithai-landing`) perlu **diselaraskan/redirect** agar tidak bertentangan (terutama klaim refund 7 hari).

| Halaman | Jenis | Status | Catatan |
|---|---|---|---|
| `/terms` | Legal | **BUTUH KEPUTUSAN** | Data sistem lengkap, tapi bagian refund (#1) & kredit (#2) menunggu keputusan |
| `/privacy` | Legal | **SIAP DITULIS** (data cukup) | Wajib sebut tracking first-party, Pakasir/Mailketing/Sumopod, dan **batasan**: hapus akun/export belum otomatis |
| `/refund` | Legal | **BUTUH KEPUTUSAN** (#1) | Tidak ada mekanisme di kode; tunggu kebijakan founder |
| `/affiliate-terms` | Legal | **BUTUH KEPUTUSAN** (#3) | Aturan rate jelas; payout menunggu keputusan |
| `/cookies` | Legal | **SIAP DITULIS** | Bisa digabung ke `/privacy`; cookie utama hanya `session` |
| `/faq` | Bantuan | **SIAP DITULIS** | Berbasis Fase 4; revisi FAQ landing (hapus janji refund yang belum pasti) |
| `/getting-started` | Bantuan | **SIAP DITULIS** | Onboarding: daftar → verifikasi → beli → akses |
| `/help` atau `/docs` | Bantuan | **SIAP DITULIS** | Kumpulan tutorial Fase 4 |

### Ringkasan GAP & keputusan bisnis yang menghambat

1. **Refund (#1):** tak ada di kode + bertentangan dengan janji landing. **Blokir** `/terms` & `/refund`.
2. **Masa berlaku/sifat kredit (#2):** perlu penegasan (disarankan: non-refundable, tanpa expiry — sesuai sistem). **Blokir** sebagian `/terms`.
3. **Payout affiliate (#3):** tak ada mekanisme. **Blokir** `/affiliate-terms`.
4. **UU PDP — hapus akun & export data:** belum ada di kode. **Bukan pemblokir penulisan** Privacy, tapi halaman harus jujur menyebut mekanisme manual; idealnya diimplementasi sebagai pekerjaan teknis terpisah.
5. **Penyelarasan landing:** halaman `terms/privacy/faq` di `growwithai-landing` harus diperbarui/di-redirect agar konsisten dengan halaman app yang baru.

---

*Akhir laporan. Semua klaim FAKTA dapat dilacak ke path file pada kolom Bukti. Bagian refund, masa berlaku kredit, dan payout affiliate sengaja dikosongkan dengan tanda `[TODO — KEPUTUSAN BISNIS]` sesuai instruksi.*
