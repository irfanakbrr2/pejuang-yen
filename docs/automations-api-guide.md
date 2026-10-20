# Panduan Singkat: Membaca / Memanggil API Automation

Endpoint automation dilindungi **session cookie** (auth). Tanpa login → `401 Unauthorized`.
Ada 2 cara "membaca" API:

---

## A. Baca KODE-nya (paling cepat untuk paham kontrak)

- Route + method: `apps/api/src/domains/automations/routes.ts`
- Logika: `apps/api/src/domains/automations/service.ts`
- Bentuk data: `apps/api/src/domains/automations/types.ts`
- Template & field: `apps/api/src/domains/automations/templates.ts`

Claude Code cukup `Read`/`grep` file di atas — tidak perlu auth.

---

## B. PANGGIL API live (butuh login)

Base URL produksi: `https://api.growwithai.id`

### 1. Login → simpan cookie
```bash
curl -s -c /tmp/gwai.cookies \
  -X POST https://api.growwithai.id/api/auth/login \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://app.growwithai.id' \
  -d '{"email":"admin@growwithai.id","password":"PASSWORD_KAMU"}'
```
Cookie sesi (`session`) tersimpan di `/tmp/gwai.cookies`.

### 2. Pakai cookie untuk request berikutnya
```bash
# list template
curl -s -b /tmp/gwai.cookies https://api.growwithai.id/api/automations/templates | jq

# list automation milik user
curl -s -b /tmp/gwai.cookies https://api.growwithai.id/api/automations | jq

# detail satu automation
curl -s -b /tmp/gwai.cookies https://api.growwithai.id/api/automations/<ID> | jq
```

Untuk POST/PATCH/DELETE tambahkan `-H 'Origin: https://app.growwithai.id' -H 'Content-Type: application/json'`.

---

## Daftar endpoint automation

| Method | Path | Body |
|---|---|---|
| GET | `/api/automations/templates` | — |
| GET | `/api/automations` | — |
| POST | `/api/automations` | `{templateKey,name,config,topics?}` |
| GET | `/api/automations/:id` | — |
| PATCH | `/api/automations/:id` | `{name?,config?}` |
| POST | `/api/automations/:id/status` | `{status:"active"\|"paused"}` |
| POST | `/api/automations/:id/run` | — (trigger manual) |
| DELETE | `/api/automations/:id` | — |
| POST | `/api/automations/:id/topics` | `{topics:string[]}` |
| DELETE | `/api/automations/:id/topics/:topicId` | — |
| GET | `/api/automations/credentials` | — (metadata saja, tanpa secret) |
| POST | `/api/automations/credentials` | `{type,label,fields}` |
| DELETE | `/api/automations/credentials/:id` | — |

Format respons: `{ "success": true, "data": ... }` atau `{ "success": false, "error": "..." }`.

---

## Cek tanpa login (smoke test)
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://api.growwithai.id/api/automations/templates
# 401 = route hidup & terlindungi (benar). 404 = belum ter-deploy.
```

## Baca DATA langsung dari DB (alternatif, butuh wrangler auth)
```bash
cd apps/api
npx wrangler d1 execute growwithai-db --remote \
  --command "SELECT id,name,status,template_key,next_run_at FROM automations LIMIT 20"
```

> Catatan: jangan menaruh password asli di file/commit. Untuk dev lokal, base URL = `http://localhost:8787` (jalankan `pnpm --filter api dev`).
