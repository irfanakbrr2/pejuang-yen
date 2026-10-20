# Tools SaaS — AI Content Automation (n8n-free, di dalam GrowWithAI)

> Status: PLAN / draft. Sumber ide: workflow n8n "Auto AI Thread @irfanakbrr".

## Context

Workflow n8n yang sudah jalan: cron → ambil topik dari Supabase → generate thread AI (OpenRouter) → parse jadi 15 tweet → jadwalkan post via Repliz → notifikasi Telegram → tandai topik terpakai.

Insight kunci: JSON n8n itu hanyalah **graph node + connections**. Sebuah engine cukup mengeksekusi node berurutan dan meneruskan output ke node berikutnya. n8n bisa diganti; yang berharga adalah format graph-nya.

Tujuan: ubah jadi **fitur SaaS "AI Content Automation"** di dalam GrowWithAI, sebagai tool baru di menu **AI Tools**, supaya user (kreator/marketer) bisa mengaktifkan otomasi konten tanpa menyentuh n8n.

Keputusan produk (dikonfirmasi):
- **Niche**: otomasi konten AI + auto-posting (bukan engine n8n umum).
- **Template-driven**: user pilih template lalu isi form. Tanpa visual node editor (fase awal).
- **Typed nodes saja**: tidak ada eksekusi JS untrusted → **tidak perlu sandbox** (risiko teknis terbesar hilang).
- **Lokasi**: tool tambahan di menu Tools GrowWithAI (reuse auth, UI, D1, queues, cron, credit system).

## ⚠️ Precondition / Risk (BACA DULU)

Salinan **growwithai-app lokal BUKAN git dan lebih lama dari production**. Fitur ini butuh migrasi DB + deploy worker. Men-deploy dari salinan stale bisa **meregresi production**.

**Sebelum implementasi**: pastikan bekerja di atas source production terkini (bukan salinan lokal stale ini). Migrasi DB aman dengan `--remote`. Jangan deploy web/worker dari lokal sampai source dipastikan up-to-date.

## Arsitektur

Workflow = daftar **step bertipe** yang dieksekusi berurutan (graph linear, sesuai bentuk n8n flow). Tiap step = handler TypeScript `(ctx, config) => output`. `ctx` membawa data akumulatif + credential terdekripsi. Tidak ada DAG kompleks, tidak ada eval.

**Alur runtime:**
1. Cron Cloudflare (`scheduled()` di `apps/api/src/index.ts`) jalan periodik → query `automations` yang `status='active'` AND `next_run_at <= now` → enqueue tiap satu ke queue baru `automation-runs` → hitung & simpan `next_run_at` berikutnya.
2. Consumer queue `automation-runs` (pola di `apps/api/src/queues/email-consumer.ts`, dispatch di `queue()` handler): load automation → dekripsi credential → jalankan step chain → tulis baris `automation_runs` (status, preview, error, logs) → `msg.ack()`/`msg.retry()`.

**Node/step types MVP** (diturunkan dari JSON):
- `pickTopic` — ambil 1 topik `used_at IS NULL` milik automation; jika habis, reset semua `used_at=NULL` lalu pilih ulang.
- `aiGenerate` — panggil Sumopod dengan `systemPrompt` (default = Director prompt dari JSON, editable) + `userPrompt` ber-`{{topic}}`. Output `rawText`.
- `parseThread` — pecah output bernomor jadi `posts[]` (port langsung 3-tier parser dari node "Parse Output AI").
- `socialPost` — POST ke Repliz `/public/schedule` dengan body thread + `scheduleAt` (pakai credential Repliz). Output `scheduledId`.
- `notify` — kirim preview ke Telegram (credential bot + chat_id).
- `markUsed` — set `used_at` topik terpilih.

Template MVP **"Auto AI Thread"** merangkai step di atas dengan default systemPrompt = prompt Director dari JSON.

## Perubahan Backend (`apps/api`)

Mirror pola domain `routes.ts`/`service.ts`/`repository.ts` (contoh `domains/orders`). Buat domain baru `apps/api/src/domains/automations/`:
- `routes.ts` — CRUD automations, credentials, topics; list runs; `POST /:id/execute` (manual, enqueue); pause/activate. Pakai `authMiddleware()`.
- `service.ts` — orkestrasi, enqueue ke `automation-runs`, cek/deduct credit (pola atomic deduct/refund di `domains/tools/tools.routes.ts` ~baris 487).
- `repository.ts` — query D1.
- `engine/runner.ts` + `engine/steps.ts` — registry step bertipe + eksekutor `executeAutomation(automationId, env)`, dipanggil dari consumer.
- `templates.ts` — definisi template built-in ("Auto AI Thread").

Reuse / util baru:
- **AI**: ekstrak pemanggil Sumopod dari `tools.routes.ts` (`generatePrdWithModel`, ~baris 393) ke `apps/api/src/services/sumopod.ts`; pakai untuk `aiGenerate`. Tidak perlu OpenRouter.
- **Credential vault (BARU)**: `apps/api/src/lib/crypto-vault.ts` — AES-GCM via `crypto.subtle`, key dari secret baru `AUTOMATION_ENCRYPTION_KEY`. Encrypt saat simpan, decrypt hanya saat eksekusi di worker. (Pola `crypto.subtle` sudah ada di `apps/api/src/lib/password.ts`.)

Wiring infra:
- `apps/api/src/app.ts`: mount routes `automations`.
- `apps/api/wrangler.toml`: tambah queue `automation-runs` (producer+consumer+DLQ) mengikuti pola `notifications`; tambah cron (mis. `*/5 * * * *`) di `[triggers]`.
- `scheduled()` di index.ts: tambah cabang untuk cron baru → scheduler enqueue.
- `queue()` di index.ts: tambah cabang `batch.queue === 'automation-runs'`.
- `apps/api/src/env.ts`: tambah `AUTOMATION_ENCRYPTION_KEY`.

## Migrasi DB (`apps/api/src/db/migrations/00NN_content_automations.sql`)

Penamaan `NNNN_description.sql` (nomor berikutnya setelah migrasi terakhir). Tabel:
- `automations` — id, user_id, template_key, name, status(active/paused/draft), schedule_cron, timezone, config_json, next_run_at, last_run_at, created_at, updated_at.
- `automation_credentials` — id, user_id, type(repliz/telegram/...), label, ciphertext, iv, created_at.
- `automation_topics` — id, automation_id, topic, used_at, created_at.
- `automation_runs` — id, automation_id, user_id, status(queued/running/success/failed), started_at, finished_at, preview, error, logs_json, credits_used.

Index pada `automations(status, next_run_at)`, `automation_topics(automation_id, used_at)`, `automation_runs(automation_id)`. Jalankan via `wrangler d1 execute growwithai-db --remote --file=...`.

## Perubahan Frontend (`apps/web`)

- **Nav**: tambah item "Content Automation" di section "AI Tools" pada `components/layout/UserDashboardLayout.tsx` (~baris 65).
- **Routes** (pola `(user)/tools/*`):
  - `app/(user)/tools/automation/page.tsx` — daftar automation user (status, last run, next run) + tombol "Buat dari Template".
  - `app/(user)/tools/automation/[id]/page.tsx` — detail + riwayat run + "Jalankan sekarang" + pause/activate + edit form.
  - `app/(user)/tools/automation/credentials/page.tsx` — kelola API key (Repliz, Telegram).
  - Pembuatan via Dialog: pilih template → form (nama, jadwal, pilih credential, textarea daftar topik, prompt editable opsional).
- **UI**: reuse `Button`, `Card`, `Input`, `Select`, `Dialog`, `Badge`, `EmptyState`, `Pagination`, `toast` dari `components/ui`. Form pakai vanilla React state (pola tool yang ada, tanpa Zod di FE).
- **API client**: tambah namespace `automationApi` di `apps/web/src/lib/api-client.ts`.

## Monetisasi (MVP)

Reuse sistem `user_tool_credits`: tiap run otomasi sukses men-deduct kredit (atomic, refund saat gagal — pola sudah ada di tools). Daftarkan tool di `TOOLS_CATALOG` (`tools.routes.ts`) dengan `credits_per_use`.

## Keamanan

- Tidak ada JS untrusted → tidak perlu sandbox.
- Semua secret keluar dari JSON; credential dienkripsi at-rest (AES-GCM) dan hanya didekripsi saat eksekusi.
- Multi-tenant: semua query difilter `user_id`; credential & topik terikat ke user/automation.

## Template Library (ide automation — produk sebenarnya)

Thread generator = template #1. Engine yang sama memungkinkan banyak template lain. Tiap template = rangkaian step bertipe + form.

**Tier 1 — reuse step yang sudah dibangun (cepat):**
1. **Auto AI Thread** (MVP) — topik → thread → Repliz → Telegram.
2. **Cross-post multi-platform** — 1 konten → AI format ulang per platform (Threads/X/IG/LinkedIn) → jadwalkan ke masing-masing.
3. **AI News Digest → Email** — query AI news (sudah ada di JSON) → AI ringkas → kirim via Mailketing sebagai newsletter harian.
4. **Daily AI News → Thread** — varian: hasil scan jadi thread otomatis.
5. **Evergreen recycler** — putar ulang konten lama yang perform bagus pada jadwal.

**Tier 2 — butuh step baru (fetch/listen):**
6. **Content repurposing** — input long-form (transkrip YouTube / artikel) → AI pecah jadi thread + carousel + caption → jadwalkan.
7. **Comment/Question → Content** — kumpulkan pertanyaan/komentar top → AI bikin thread menjawabnya.
8. **Trend watcher → Alert** — scan topik AI trending → Telegram alert + draft thread siap edit.
9. **Blog auto-draft (SEO)** — keyword → AI draft artikel → simpan sebagai draft di growwithai-landing/blog untuk review.

**Tier 3 — lifecycle / funnel (nilai bisnis tinggi untuk GrowWithAI sendiri):**
10. **Lead nurture / welcome sequence** — signup baru → AI personalisasi urutan welcome (email/WhatsApp; `WHATSAPP_API_TOKEN` sudah ada).
11. **Testimonial collector** — setelah pembelian → follow-up AI minta testimoni.
12. **WhatsApp broadcast** — segmen user → AI generate broadcast → kirim.
13. **Course → promo** — ambil konten lesson → auto-generate thread/email promo kelas.

Pola monetisasi: template gratis terbatas + template premium / kuota run berbayar via sistem kredit. Template Tier 3 juga dipakai internal GrowWithAI (dogfooding).

## Verifikasi (end-to-end)

1. **Migrasi**: `wrangler d1 execute growwithai-db --remote --file=.../00NN_content_automations.sql`, cek via `--command ".tables"`.
2. **Unit step**: test `parseThread` dengan output AI contoh (8–15 post); test `pickTopic` reset saat habis.
3. **Manual run**: buat 1 automation via UI (template "Auto AI Thread"), isi credential Repliz+Telegram (akun test) + 3 topik → "Jalankan sekarang" → cek `automation_runs` status `success`, preview muncul, Telegram diterima, topik ter-`used_at`.
4. **Scheduler**: set `next_run_at` ke masa lalu, picu cron → konfirmasi auto-enqueue + run.
5. **Vault**: simpan credential → verifikasi `ciphertext` di DB bukan plaintext; decrypt benar saat run.
6. **Billing**: konfirmasi kredit ter-deduct saat sukses, ter-refund saat gagal.

## Fase berikutnya (di luar MVP)

Visual node editor (React Flow) di atas engine yang sama; lebih banyak provider sosial; node `branch`/`filter`; import JSON n8n; template marketplace.
