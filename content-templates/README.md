# Content Templates — Grow With AI

Template & tooling untuk membuat **materi bacaan** dan **quiz** (pretest/post-test) lalu memasukkannya ke database sebagai **SQL migration**. Mengikuti `panduan-materi.md` dan `panduan-quiz.md`.

## Isi folder

| File | Fungsi |
|------|--------|
| `template-materi-bacaan.html` | Kerangka materi bacaan (14 bagian, Notion-style) sesuai `panduan-materi.md`. |
| `template-quiz.html` | Quiz 10 soal (contoh: N8N) sesuai `panduan-quiz.md`, sudah ter-wire ke platform. |
| `html-to-lesson-sql.mjs` | Generator: ubah file HTML → statement `INSERT OR IGNORE INTO lessons` (escape otomatis). |
| `README.md` | Dokumen ini. |

---

## Konsep penting (cara platform merender konten)

Tiap lesson punya `lesson_type`: **video · text · quiz · resource**. Yang menentukan tampilan:

- **video** → isi kolom `video_url` (YouTube; link `youtu.be/...` didukung). Tidak perlu HTML.
- **text** (materi bacaan) & **quiz** → dokumen HTML penuh **WAJIB masuk kolom `content_embed`**.
  - Jangan pakai `content_html`: sanitizer (`packages/shared/src/sanitize-html.ts`) membuang `<style>`, `<script>`, `<form>`, `<iframe>` → template panduan akan rusak.
  - Prioritas render: `content_embed || content_html || content_markdown` (`apps/web/.../[lessonSlug]/page-client.tsx`).
- **resource** → isi kolom `resources_json` = `[{ "title": "...", "url": "https://..." }]`.

**Quiz** dirender di iframe srcdoc. Platform menyuntik `window.submitQuizScore(score, maxScore)`; `template-quiz.html` memanggilnya saat submit sehingga lesson **otomatis ditandai selesai**. Platform menandai "lulus" pada **≥ 60%**; result card di dalam quiz memakai **passing 70** sesuai panduan (dua angka ini beda peran — biarkan saja).

---

## Alur kerja: dari template → masuk DB

### 1. Materi bacaan

1. Salin `template-materi-bacaan.html` → mis. `bacaan-workflow-n8n.html`.
2. Ganti semua teks dalam tanda `[ ... ]`. Tambah/kurangi `<li>`, baris tabel, `<details>` sesuai kebutuhan.
3. Generate SQL:
   ```bash
   node html-to-lesson-sql.mjs \
     --file bacaan-workflow-n8n.html \
     --course course-n8n-automation \
     --module mod-n8n-001 \
     --title "Membangun Workflow Pertama" \
     --slug bacaan-workflow-pertama \
     --type text \
     --sort 4 \
     >> ../apps/api/src/db/migrations/0047_n8n_bacaan.sql
   ```

### 2. Quiz (pretest / post-test)

1. Salin `template-quiz.html` → mis. `posttest-n8n.html`.
2. Edit `QUIZ_TITLE`, `QUIZ_SUBTITLE`, dan array `QUESTIONS` (komposisi panduan: 3 konsep, 4 studi kasus, 2 implementasi, 1 best practice; `correctAnswer` = index 0–3).
3. Generate SQL dengan `--type quiz` (lihat perintah di atas, ganti `--file`/`--title`/`--slug`/`--type quiz`).

> Generator meng-escape `'` → `''` otomatis, jadi HTML bebas memakai tanda kutip.

---

## Menambahkan pretest + post-test ke course mana pun

Pola "course sempurna" `ai-for-solo-preneur`:
**Pretest (quiz) → Video → Materi Bacaan → Post-test (quiz) → Penutup**.

Untuk meniru: buat 2 lesson `quiz` di module yang sama —
- **Pretest** → `--sort 1` (paling awal), `--slug pretest-...`, boleh `--preview 1`.
- **Post-test** → `--sort` paling besar (paling akhir), `--slug post-test-...`.

Pretest & post-test boleh memakai soal yang sama (sesuai catatan user). Cukup generate dua lesson dari file quiz yang sama dengan slug/sort berbeda.

---

## Menerapkan migration

Migration ada di `apps/api/src/db/migrations/` (penomoran urut; terakhir lihat di folder itu).

```bash
cd ../apps/api

# DB lokal (dev / miniflare)
npx wrangler d1 execute growwithai-db --local --file=./src/db/migrations/0046_seed_n8n_automation_course.sql
# atau apply semua migration baru sekaligus:
npx wrangler d1 migrations apply growwithai-db --local

# Production (jalankan saat sudah yakin)
npx wrangler d1 execute growwithai-db --remote --file=./src/db/migrations/0046_seed_n8n_automation_course.sql
```

Semua seed memakai `INSERT OR IGNORE` → **idempoten**, aman dijalankan ulang dan tidak bentrok dengan course yang sudah ada (asal `id`/`slug` unik).

---

## Contoh nyata di repo

`apps/api/src/db/migrations/0046_seed_n8n_automation_course.sql` — kelas **Automation N8N for Everyone** (membership-only): 1 course + 1 module + 3 lesson (2 video + 1 materi "Coming Soon" via `content_embed`). Pakai itu sebagai acuan struktur INSERT.
