# Checkout Embedded Pakasir — Setup, Testing & Cutover

Migrasi dari Mayar (redirect eksternal) ke Pakasir (embedded, via API). Seluruh proses
checkout (QRIS / Virtual Account, countdown, polling status) terjadi di `app.growwithai.id/checkout/[orderId]`
— user tidak pernah diarahkan ke `app.pakasir.com`.

## Arsitektur

```
[order / webinar / tools-credits page]
  → POST /api/checkout/create-payment {order_type, product_id, payment_method, coupon_code?, affiliate_code?, mobile?}
  → prepareOrder() → POST pakasir /api/transactioncreate/{method} → INSERT payments (attempt pending)
  → frontend router.push(/checkout/{order_id})

[/checkout/[orderId]]
  → GET  /api/checkout/:orderId           (detail + payment_number + expired_at)
  → GET  /api/checkout/:orderId/status    (polling 5 detik)
  → POST /api/checkout/:orderId/check     ("Saya sudah bayar" → konfirmasi via Transaction Detail API)
  → POST /api/checkout/:orderId/repay     (expired / ganti metode → attempt baru GWA-xxx-R2)
  → POST /api/checkout/:orderId/simulate  (sandbox only)
  → paid → /checkout/success?order_id=...

[Pakasir webhook] POST /api/webhooks/pakasir?key=SECRET
  → validasi key + project + amount → idempotency (webhook_events unique provider_event_id)
  → KONFIRMASI ke Transaction Detail API (tidak pernah grant dari payload saja)
  → fulfillPaidOrder() — shared dengan webhook Mayar (orders/fulfillment.ts)
```

`order_id` yang dikirim ke Pakasir = `orders.order_number` (`GWA-...`); attempt ulang = `GWA-...-R2`, dst.
Disimpan di `payments.provider_transaction_id` (unique index) — lookup webhook tidak pernah ambigu.

Idempotency anti double-access/komisi (struktural, jangan diubah):
- `webhook_events.provider_event_id` UNIQUE — key: `pakasir:{order_id}:{amount}:{status}:{completed_at}`
- `UPDATE orders ... WHERE status != 'paid'`
- `affiliate_commissions.order_id` UNIQUE, `memberships(source_order_id)` UNIQUE,
  `enrollments(user_id, course_id)` UNIQUE, `user_access(source_*)` UNIQUE — semua `INSERT OR IGNORE`.

## Setup

### 1. Migrasi DB (WAJIB sebelum deploy API)

```bash
cd apps/api
# lokal
npx wrangler d1 execute growwithai-db --local  --file=./src/db/migrations/0057_pakasir_embedded_checkout.sql
# production
npx wrangler d1 execute growwithai-db --remote --file=./src/db/migrations/0057_pakasir_embedded_checkout.sql
```

### 2. Env & secrets

- `apps/api/wrangler.toml` → isi `PAKASIR_PROJECT_SLUG = "<slug project di dashboard Pakasir>"`
  (ada di `[vars]` dan `[env.production.vars]`; saat ini masih `""`).
- `PAKASIR_MODE`: `sandbox` mengaktifkan endpoint `/simulate`; set `production` saat go-live.

```bash
cd apps/api
openssl rand -hex 24   # → pakai sebagai PAKASIR_WEBHOOK_SECRET
npx wrangler secret put PAKASIR_API_KEY
npx wrangler secret put PAKASIR_WEBHOOK_SECRET
npx wrangler secret put PAKASIR_API_KEY --env production
npx wrangler secret put PAKASIR_WEBHOOK_SECRET --env production
# dev lokal: isi PAKASIR_API_KEY & PAKASIR_WEBHOOK_SECRET di apps/api/.dev.vars
```

### 3. Webhook URL (simpan di dashboard Pakasir)

```
https://api.growwithai.id/api/webhooks/pakasir?key=<PAKASIR_WEBHOOK_SECRET>
```

Dev lokal: `wrangler dev` + tunnel (`cloudflared tunnel --url http://localhost:8787`) bila ingin
webhook nyata; alternatifnya cukup `/simulate` + tombol "Saya sudah bayar" (keduanya
memverifikasi lewat Transaction Detail API, jalur grant-nya sama dengan webhook).

> ℹ️ Bentuk respons Pakasir **sudah diverifikasi live** (2026-06-12, project `grow-with-ai`):
> `transactioncreate` membungkus di `{"payment": {...}}` (order_id, amount, fee, total_payment,
> payment_method, payment_number, expired_at), `transactiondetail` di `{"transaction": {...}}`
> (status, completed_at, is_sandbox). Parser di `src/services/pakasir.ts` menangani keduanya.
>
> ⚠️ Project Pakasir `grow-with-ai` berstatus **PRODUCTION** (`is_sandbox: false`) —
> Payment Simulation API tidak tersedia dan endpoint `/simulate` dimatikan
> (`PAKASIR_MODE=production`). Smoke test = transaksi kecil nyata.

## Testing (sandbox)

Otomatis:

```bash
pnpm -C apps/api test:pakasir    # 11 skenario webhook (dedup, amount mismatch, verifikasi detail, dll)
pnpm -C apps/api test:webhooks   # regresi webhook Mayar
pnpm -C apps/api typecheck && pnpm -C apps/web typecheck
```

Manual end-to-end (project PRODUCTION → pakai transaksi kecil nyata, lalu refund/abaikan):

| # | Skenario | Cara | Ekspektasi |
|---|---|---|---|
| a | QRIS sukses | Beli webinar/produk termurah QRIS → QR tampil → bayar nyata | Webhook/check → paid → success page, akses granted |
| b | VA sukses | Membership via `bri_va` → salin VA → transfer nyata | Paid, membership extend dari expiry berjalan |
| c | Webhook double | curl webhook payload sama 2× | Respons ke-2 `Already recorded`, tanpa grant/komisi kedua |
| d | Amount mismatch | curl webhook dengan amount diubah | Event `failed: Amount mismatch`, order tetap pending |
| e | order_id tak dikenal | curl order_id ngawur | Event `failed: Order not found` |
| f | "Saya sudah bayar" | Klik sebelum bayar → setelah simulate | Belum terdeteksi → setelah simulate jadi paid |
| g | Expired | Tunggu countdown habis | UI expired → repay → attempt `-R2` bisa dibayar |
| h | Komisi tidak double | Order via `?ref=` → webhook double + check bersamaan | `affiliate_commissions` tetap 1 row |
| i | Akses tidak double | 2 webhook + manual check | `memberships`/`enrollments` tetap 1 row |

Contoh curl webhook (ganti key & order_number):

```bash
curl -X POST "https://api.growwithai.id/api/webhooks/pakasir?key=SECRET" \
  -H "Content-Type: application/json" \
  -d '{"amount":501231,"order_id":"GWA-XXXX-0001","project":"<slug>","status":"completed","payment_method":"qris","completed_at":"2026-06-12T08:07:02.819+07:00"}'
```

Monitoring: `GET /api/admin/webhooks` (event Pakasir tampil dengan provider `pakasir`),
`GET /api/admin/payments`, tabel `error_logs` (source `pakasir_*`).

## Cutover ke production

1. Apply migrasi 0057 ke remote D1 (lihat atas) — **sebelum** deploy API.
2. Set secrets production + isi `PAKASIR_PROJECT_SLUG` di wrangler.toml.
3. `pnpm -C apps/api deploy` → simpan webhook URL di Pakasir → jalankan skenario sandbox di infra production.
4. Ubah project Pakasir ke mode production + set `PAKASIR_MODE = "production"` di `[env.production.vars]` → deploy ulang API.
5. Deploy web: `pnpm -C apps/web build` → deploy `out/` ke Cloudflare Pages seperti biasa.
6. Smoke test transaksi kecil nyata (webinar QRIS).
7. **Mayar dibiarkan hidup** (webhook + route lama `/api/orders/create` & `/api/tools/credits/purchase`)
   untuk order in-flight dan fallback darurat. Cleanup Mayar = tugas terpisah setelah Pakasir stabil.

Rollback cepat: frontend entry point tinggal dikembalikan ke `ordersApi.create` +
`window.location.href` (lihat git history); backend Mayar tidak pernah dihapus.
