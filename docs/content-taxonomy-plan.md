# Analisa & Planning: Sistem Kategori Konten GrowWithAI

**Dokumen produk — Kelas vs Bonus dalam satu taxonomy 9 kategori**
Status: Final untuk review · Penulis: AI Product Strategist · Tanggal: 11 Juni 2026

---

## Temuan lapangan (kenapa ini urgent)

Audit data production hari ini membuktikan masalahnya bukan teoretis:

| Temuan | Bukti di database |
|---|---|
| Kategori tercampur dengan akses | `courses.category` berisi: `AI Basics`, `Business`, `Prompt Engineering`, **`Gratis`**, **`Member Only`** — dua nilai terakhir adalah *access level*, bukan topik |
| Kategori free-text tanpa kontrol | Tidak ada tabel kategori; admin mengetik bebas, typo dan inkonsistensi tak terhindarkan |
| Bonus type sudah ada tapi minim | `bonuses.bonus_type` baru berisi 3 nilai: `ebook`, `prompt_pack`, `bundle` — `bundle` adalah bentuk paket, bukan jenis aset |
| 3 model akses membingungkan | `access_type`: `free`, `paid`, `membership_only` — padahal arah bisnis: Free vs Premium (membership) |
| Taxonomy ganda | Sudah ada `skills` (12 item) yang tumpang tindih dengan 9 kategori usulan |

Skala saat ini: **10 kelas, 47 bonus**. Ini momen tepat merapikan — migrasi masih murah. Di 500 konten, biayanya 50x lipat.

---

## A. Verdict

**9 kategori layak dipakai sebagai taxonomy utama GrowWithAI, dengan syarat setiap kategori diberi boundary yang tegas.** Struktur ini cukup luas untuk menampung kelas, bonus, webinar recording, template, ebook, checklist, prompt pack, dan source code tanpa membuat kategori baru yang berantakan.

**Namun, kategori tidak boleh dipakai sendirian.** Setiap konten wajib punya Content Type. Untuk bonus, wajib punya Bonus Type. Dengan begitu, "Ebook", "Template", "Checklist", dan "Prompt Pack" tidak menjadi kategori, melainkan bentuk konten.

**Jangan tambah kategori baru sebelum satu kategori memiliki minimal 15 konten aktif.** Kalau belum mencapai angka itu, lebih baik gunakan filter tambahan seperti Content Type, Level, Target Role, Access, dan Bonus Type.

Tiga titik rawan yang ditemukan dari analisa kritis (diselesaikan di seksi A2 sebagai aturan operasional, bukan sekadar catatan):

1. **#4 vs #6** — "Vibe Marketing" dan "Content Creation & Personal Branding" beririsan di copywriting & konten promosi.
2. **#7 vs #8** — "Business/Solopreneurship" dan "Career/Freelance" beririsan di topik "menghasilkan uang dari skill".
3. **#9** — "Productivity, Learning & Self-Development" berisiko jadi keranjang sampah untuk semua konten yang sulit dikategorikan.

---

## A2. Aturan Operasional Kategori

Bagian ini adalah **aturan kerja admin**, bukan analisa. Tempel di SOP upload konten dan tampilkan sebagai helper di form admin.

### Boundary #4 vs #6

**#4 Vibe Marketing, Sales & Growth** — dipakai kalau fokus konten adalah **mendatangkan traffic, leads, conversion, closing, revenue, atau growth bisnis**.

Contoh masuk #4: AI Copywriting Landing Page · Email Marketing dengan AI · Funnel Webinar · Affiliate Marketing · Teknik Closing dengan AI · Growth Strategy untuk Digital Product · Broadcast WhatsApp yang Convert

**#6 Content Creation & Personal Branding** — dipakai kalau fokus konten adalah **membuat konten, membangun audiens, membentuk identitas, storytelling, dan meningkatkan trust personal brand**.

Contoh masuk #6: Cara Bikin Konten Pakai AI · 100 Hook Konten · Faceless Content Workflow · Script Reels dengan AI · Personal Branding untuk Mahasiswa · Content Repurposing · Storytelling untuk Creator

> **Tie-break:** Output akhirnya **konten untuk membangun audience** → #6. Output akhirnya **konversi, penjualan, funnel, leads, revenue** → #4.

Contoh abu-abu:

| Konten | Kategori |
|---|---|
| AI Copywriting untuk Konten Instagram | #6 |
| AI Copywriting untuk Landing Page Jualan | #4 |
| Hook Konten Personal Branding | #6 |
| Hook Iklan atau Sales Page | #4 |

### Boundary #7 vs #8

**#7 Business, Monetization & Solopreneurship** — fokus **membangun bisnis sendiri, produk sendiri, offer sendiri, sistem revenue, agency, digital product, atau monetisasi aset**.

Contoh masuk #7: Cara Jual Jasa AI · Membuat Digital Product · Membangun AI Agency · Pricing Offer · Validasi Produk Digital · Revenue Stream dengan AI · Solopreneur Workflow

**#8 Career, Freelance & Portfolio** — fokus **mendapat pekerjaan, client, project, portfolio, CV, LinkedIn, interview, atau freelance execution**.

Contoh masuk #8: CV dengan AI · LinkedIn Optimization · Portfolio Website untuk Freelancer · Proposal Freelance · Cara Cari Client · Interview Preparation dengan AI · Remote Work Starter

> **Tie-break:** Fokus **membangun bisnis/produk/offer milik sendiri** → #7. Fokus **menjual skill ke perusahaan/client/project** → #8.

Contoh abu-abu:

| Konten | Kategori |
|---|---|
| Cara Jual Jasa AI sebagai Freelancer (fokus cari client & proposal) | #8 |
| Cara Bangun AI Agency (fokus sistem bisnis, pricing, delivery, scaling) | #7 |
| Portfolio untuk Menjual Jasa Website | #8 |
| Productized Service AI untuk Solopreneur | #7 |

### Boundary #9 (anti keranjang-sampah)

**#9 Productivity, Learning & Self-Development** — dipakai kalau fokus konten adalah **cara belajar, cara bekerja, cara berpikir, cara mengelola waktu, cara riset, cara membangun sistem pribadi, atau growth personal**.

Contoh masuk #9: Belajar Lebih Cepat dengan AI · Riset Skripsi dengan AI · Note Taking dengan AI · Personal Knowledge Management · Deep Work dengan AI · Time Management · Habit Tracker · Framework Berpikir dengan AI

Yang **bukan** #9:

- Ada unsur bikin website → #2
- Ada unsur desain visual → #3
- Ada unsur marketing/sales → #4
- Ada unsur automation → #5
- Ada unsur content/personal brand → #6
- Ada unsur bisnis/monetisasi → #7
- Ada unsur karier/freelance → #8

> **Tie-break:** #9 hanya dipakai kalau kontennya **tidak menghasilkan aset bisnis langsung**, melainkan meningkatkan cara user belajar, bekerja, berpikir, atau mengelola diri.

### Decision rule admin (urutan pertanyaan saat upload)

1. Tentang dasar AI/prompting? → **#1 AI Fundamentals & Prompting**
2. Outputnya website, landing page, web app, coding, deployment, debugging? → **#2 Vibecoding & Web Dev**
3. Outputnya visual: desain, poster, thumbnail, UI, brand kit, image asset? → **#3 Vibe Design & Visual Creation**
4. Outputnya traffic, leads, sales, funnel, closing, ads, email, conversion, revenue growth? → **#4 Vibe Marketing, Sales & Growth**
5. Outputnya sistem otomatis, workflow, API, webhook, n8n, Zapier, CRM, invoice, database automation? → **#5 AI Automation & Workflow**
6. Outputnya konten, personal branding, storytelling, script, audience building? → **#6 Content Creation & Personal Branding**
7. Outputnya bisnis sendiri, digital product, offer, agency, pricing, monetisasi aset? → **#7 Business, Monetization & Solopreneurship**
8. Outputnya karier, freelance, portfolio, CV, LinkedIn, client, interview, remote work? → **#8 Career, Freelance & Portfolio**
9. Fokusnya belajar, produktivitas, riset, habit, mindset, sistem pribadi? → **#9 Productivity, Learning & Self-Development**

Urutan ini sengaja: kategori dengan output paling konkret dicek dulu, #9 selalu terakhir.

### Primary + Secondary Category

Setiap konten wajib punya **1 primary category** dan boleh punya **maksimal 2 secondary category**.

| Konten | Primary | Secondary |
|---|---|---|
| Bikin Landing Page Jualan dengan AI | #2 Vibecoding & Web Dev | #4 Marketing |
| Personal Branding untuk Jual Jasa AI | #6 Content Creation | #8 Career/Freelance *atau* #7 Business (tergantung fokus materi) |
| Automation Follow Up Leads dengan n8n | #5 AI Automation | #4 Marketing |

Primary category menjawab: **"skill utama yang diajarkan apa?"** Tanpa aturan ini, satu konten bisa masuk semua kategori dan sistem filtering rusak.

---

## B. Prinsip Utama Sistem Kategori

Enam dimensi yang **ortogonal** — satu dimensi tidak boleh bocor ke dimensi lain:

| Dimensi | Menjawab | Nilai | Berlaku untuk |
|---|---|---|---|
| **Category** | Topik ini tentang apa? | 9 kategori utama | Semua konten |
| **Content Type** | Konten ini bentuknya apa? | `class`, `bonus` (future: `recording`, `tool`) | Semua konten |
| **Bonus Type** | Bonus ini jenis asetnya apa? | 12 jenis (lihat seksi D) | Hanya `bonus` |
| **Level** | Untuk tingkat kemampuan mana? | `beginner`, `intermediate`, `advanced` | Semua konten |
| **Access** | Siapa yang boleh akses? | `free` (semua user), `premium` (membership aktif) | Semua konten |
| **Target Role** | Cocok untuk siapa? | Role dari onboarding (`user_profiles.role`): mahasiswa, karyawan, freelancer, pebisnis, dst. | Opsional, untuk rekomendasi |

Aturan emas yang melanggar prinsip ini **ditolak di level validasi**:

- ❌ Kategori bernama "Bonus", "Ebook", "Template", "Gratis", "Member Only"
- ❌ Bonus Type pada Content Type = class
- ❌ Konten published tanpa primary category

---

## C. Struktur Field Upload Kelas

Dipetakan ke tabel `courses` eksisting (kolom baru ditandai 🆕):

| Field | Kolom DB | Wajib | Validasi / Catatan |
|---|---|---|---|
| Title | `title` | ✅ | Maks 200 karakter |
| Slug | `slug` | ✅ | Auto dari title, unik, immutable setelah publish |
| Category (Primary) | 🆕 `primary_category_id` | ✅ | FK ke `categories`; ganti free-text `category` lama |
| Category (Secondary) | 🆕 via `content_categories` | — | Maks 2 |
| Content Type | implisit `class` | ✅ | Tidak bisa diubah setelah dibuat |
| Level | `level` | ✅ | beginner / intermediate / advanced |
| Access | `access_type` | ✅ | `free` / `premium` (disederhanakan dari 3 nilai) |
| Instructor | `instructor_name` | ✅ | Default "Irfan Akbar" |
| Description | `description`, `short_description` | ✅ | Short maks 160 char (untuk card) |
| Thumbnail | `thumbnail_url` | ✅ | Rasio 16:9, wajib sebelum publish |
| Video / Module | `course_modules` + `lessons` (eksisting) | ✅ | Minimal 1 modul + 1 lesson published sebelum kelas dipublish |
| Duration | 🆕 `duration_minutes` | ⬜ | Estimasi total; bisa dihitung otomatis dari lessons |
| Learning Outcome | 🆕 `learning_outcome` | ✅ | 1–3 kalimat: "Setelah kelas ini, user bisa..." |
| Recommended For | 🆕 `recommended_for` | ⬜ | Teks bebas pendek + Target Role tags |
| Skill Tags | `content_skills` (eksisting) | ⬜ | Taxonomy `skills` lama, turun jadi tag personalisasi |
| Status | `status` | ✅ | draft / published / archived |

---

## D. Struktur Field Upload Bonus

Dipetakan ke tabel `bonuses` eksisting:

| Field | Kolom DB | Wajib | Validasi / Catatan |
|---|---|---|---|
| Title | `title` | ✅ | |
| Slug | `slug` | ✅ | Unik |
| Category (Primary) | 🆕 `primary_category_id` | ✅ | FK ke `categories` |
| Category (Secondary) | 🆕 via `content_categories` | — | Maks 2 |
| Content Type | implisit `bonus` | ✅ | |
| Bonus Type | `bonus_type` | ✅ | Enum 12 nilai (di bawah) — **wajib sebelum publish** |
| Access | `access_type` | ✅ | `free` / `premium` |
| Description | `description` | ✅ | |
| File Upload / External Link | `r2_key` / `external_url` + `bonus_files` (eksisting, multi-file) | ✅ | Minimal 1 file ATAU 1 link |
| Preview Image | `thumbnail_url` | ✅ | |
| Recommended For | 🆕 `recommended_for` | ⬜ | |
| Related Class | 🆕 `related_course_id` | ⬜ | FK ke `courses` — "Checklist Deploy" terhubung ke kelas deployment |
| Status | `status` | ✅ | draft / published / archived |

**Bonus Type final (12 nilai enum):**

`ebook` · `template` · `checklist` · `prompt_pack` · `sop` · `worksheet` · `swipe_file` · `source_code` · `asset_pack` · `spreadsheet` · `notion_template` · `pdf_resource`

Migrasi nilai lama: `ebook` ✅ tetap · `prompt_pack` ✅ tetap · **`bundle` → bukan jenis aset**; bonus ber-type `bundle` direview manual dan dipecah ke jenis sebenarnya (mayoritas kandidat `asset_pack`).

Catatan disiplin: `pdf_resource` adalah *fallback terakhir* — kalau sebuah PDF sebenarnya checklist, pakai `checklist`. Format file ≠ jenis aset.

---

## E. Struktur Filter Halaman User

### Halaman Kelas (`/kelas`, `/my-classes`, `/explore`)

| Filter | Bentuk UI | Default |
|---|---|---|
| Category | 9 chip horizontal scroll (pola chip `/bonuses` eksisting) | Semua |
| Level | Dropdown / chip kecil | Semua |
| Access | Toggle: Semua / Free / Premium | Semua; konten Premium yang terkunci tetap tampil dengan ikon gembok |
| Sort | Newest / Most Popular | Newest |
| Recommended For You | Section terpisah di atas (bukan filter) | Berdasarkan `user_profiles.role` + `interests_json` |

Content Type **tidak jadi filter** di sini — halaman Kelas selalu Content Type = class.

### Halaman Bonus (`/bonuses`)

| Filter | Bentuk UI | Default |
|---|---|---|
| Category | 9 chip yang sama persis dengan halaman Kelas | Semua |
| Bonus Type | Dropdown 12 jenis | Semua |
| Access | Toggle Free / Premium | Semua |
| Sort | Newest / Most Popular | Newest |

**Most Popular** kini bisa dihitung nyata: sistem tracking first-party yang baru live sudah merekam `bonus_viewed`, `lesson_started`, `course_completed` — agregasinya tersedia di `events_daily`.

---

## F. Struktur Filter Dashboard Admin

Satu halaman "Semua Konten" (atau filter konsisten di halaman Kelas & Bonus admin):

| Filter | Catatan |
|---|---|
| Category | Dropdown 9 kategori + "Tanpa kategori" (penting saat migrasi — menemukan konten yang belum dipetakan) |
| Content Type | Class / Bonus |
| Bonus Type | Muncul hanya saat Content Type = Bonus |
| Status | Draft / Published / Archived |
| Access | Free / Premium |
| Instructor | Dropdown distinct |
| Created / Updated / Published Date | Range picker, pola periode 7/30/90 hari eksisting |
| Search | Judul & slug (pola debounce 300ms eksisting) |

---

## G. UX Recommendation (User)

1. **Halaman terpisah, taxonomy sama.** `/kelas` default Content Type = class; `/bonuses` default = bonus. User tidak pernah melihat campuran tanpa konteks.
2. **Kategori = filter di dalam halaman, BUKAN pintu masuk sendiri.** Tidak ada (dan tidak akan ada) halaman kategori lintas-tipe — intent user di `/kelas` (belajar terstruktur) berbeda dengan di `/bonuses` (ambil resource cepat); menggabungkannya dalam satu halaman kategori mencampur dua intent dan menduplikasi navigasi yang sudah dikerjakan chip filter. Chip 9 kategori yang identik di kedua halaman sudah memberi konsistensi topik tanpa halaman tambahan.
3. **Label visual wajib di setiap card:**
   - Badge Content Type: `Kelas` (hijau brand) / `Bonus` (amber) — selalu tampil di card lintas-konteks (search, rekomendasi, halaman kategori).
   - Badge Bonus Type kecil di card bonus: "Checklist", "Prompt Pack", dst.
   - Ikon gembok 🔒 + label "Premium" untuk konten membership; card tetap terlihat (teaser → upgrade path), klik mengarah ke halaman upgrade.
4. **Bonus terkait di halaman kelas.** Kelas menampilkan section "Resource pendukung kelas ini" dari `related_course_id` — bonus jadi alasan menyelesaikan kelas, kelas jadi alasan membuka bonus.
5. **Search global** (komponen GlobalSearch eksisting) menampilkan hasil bergrup per Content Type, bukan flat list.
6. **Jangan tampilkan 9 chip kategori di mobile sekaligus tanpa scroll** — pakai horizontal scroll chip (pola yang sudah ada di `/bonuses`).

## H. Admin UX Recommendation

Flow upload (satu entry point "Tambah Konten" atau di masing-masing halaman):

```
Step 0  Pilih Content Type:  [ Kelas ]  [ Bonus ]
            │
   ┌────────┴──────────┐
   ▼                   ▼
 Form Kelas         Form Bonus
 (field seksi C)    (field seksi D — Bonus Type muncul HANYA di sini)
   │                   │
   └────────┬──────────┘
            ▼
 Pilih Primary Category (wajib, dropdown 9)
   + helper "?" menampilkan decision rule 9 langkah (seksi A2)
 Pilih Secondary Category (opsional, maks 2, tidak boleh = primary)
            ▼
 Validasi publish:
   ✗ Tanpa primary category  → tolak
   ✗ Bonus tanpa Bonus Type  → tolak
   ✗ Bonus tanpa file/link   → tolak
   ✗ Kelas tanpa lesson published → tolak
   ✓ Lolos → Published
```

Prinsip: **Content Type dipilih paling awal** dan mengubah form secara dinamis. Category wajib untuk keduanya. Draft boleh tidak lengkap; **publish tidak boleh**.

---

## I. Database / Schema Recommendation (Konseptual)

Prinsip: **extend struktur eksisting, jangan bangun ulang**. Registry `content_items` (migration 0046) sudah menyatukan course/bonus/recording/tool — jangan buat tabel `contents` baru yang menduplikasinya.

```
categories  (BARU — 9 baris seed, slug stabil)
  id, slug, name, description, icon, sort_order, is_active

content_categories  (BARU — mapping konten ↔ kategori)
  content_id   → content_items.id      ← lewat registry, otomatis future-proof
  category_id  → categories.id            untuk recording & tool di fase berikutnya
  is_primary   INTEGER (0/1)
  PK (content_id, category_id)
  Aturan (validasi API): tepat 1 primary; maks 2 secondary

courses   (UBAH)
  + primary_category_id → categories.id   ← denormalized untuk query cepat
  + learning_outcome TEXT
  + recommended_for TEXT
  + duration_minutes INTEGER
  - category (free-text)                  ← deprecated, drop setelah migrasi
  access_type: nilai dinormalisasi ke 'free' | 'premium'

bonuses   (UBAH)
  + primary_category_id → categories.id
  + recommended_for TEXT
  + related_course_id → courses.id
  bonus_type: enum 12 nilai (validasi API), nilai 'bundle' dimigrasi
  access_type: 'free' | 'premium'

content_items  (UBAH)
  + primary_category_id                    ← sinkron saat course/bonus disimpan

content_types   → enum di aplikasi: 'class' | 'bonus' (registry sudah pakai
                  'course' — alias di layer tampilan, tidak perlu tabel)
bonus_types     → enum 12 nilai di shared schema (zod) — bukan tabel
access_level    → enum 'free' | 'premium' di shared schema
target_roles    → REUSE user_profiles.role + resource_tags (tag_type='role')
                  — tidak perlu tabel baru
related_content → kolom bonuses.related_course_id (1 arah cukup untuk fase ini;
                  jika nanti butuh N:N, naikkan ke tabel content_relations)
content_status  → REUSE kolom status eksisting ('draft'|'published'|'archived')
skills/tags     → TETAP (content_skills, content_tags) sebagai tag sekunder
                  untuk personalisasi & "Recommended For You"
```

Catatan akses (kritis): penyederhanaan `paid` → `premium` **tidak boleh mencabut akses** user yang pernah membeli kelas satuan — `user_access` (lifetime, source_type='order') tetap dihormati oleh `checkUserAccess()` eksisting tanpa perubahan.

---

## J. Mapping Contoh Konten

### 5 Kelas (judul asli production)

| Title | Category (Primary) | Content Type | Level | Access | Recommended For |
|---|---|---|---|---|---|
| Premium Prompting Mastery | #1 AI Fundamentals & Prompting | Class | Beginner | Free | Semua role; pemula yang baru kenal AI |
| Vibecoding For Beginner | #2 Vibecoding & Web Dev | Class | Beginner | Free | Non-programmer yang mau bikin website dengan AI |
| Membuat Website & Landing Page dengan Bantuan AI | #2 Vibecoding & Web Dev *(sec: #4 Marketing — jika materi menyentuh copywriting jualan)* | Class | Beginner | Free | Freelancer & pemilik usaha kecil |
| AI untuk Bisnis & Marketing | #4 Vibe Marketing, Sales & Growth *(sec: #7 Business)* | Class | Intermediate | Premium | Pebisnis & tim marketing |
| Ai For Solo Preneur | #7 Business, Monetization & Solopreneurship | Class | Beginner | Premium | Solopreneur & calon founder produk digital |

Catatan: kelas berkategori lama `Gratis` / `Member Only` di atas membuktikan kolom category lama harus diganti — nilai aslinya bukan topik.

### 5 Bonus (2 judul asli production + 3 representatif dari 47 bonus)

| Title | Category (Primary) | Content Type | Bonus Type | Access | Recommended For |
|---|---|---|---|---|---|
| 100+ Prompt Templates | #1 AI Fundamentals & Prompting | Bonus | Prompt Pack | Premium | Semua member yang mulai praktik prompting |
| Panduan AI Tools 2026 | #1 AI Fundamentals & Prompting *(sec: #9 Productivity)* | Bonus | Ebook | Premium | Member yang memilih stack tools |
| Checklist Deploy Website ke Cloudflare Pages | #2 Vibecoding & Web Dev | Bonus | Checklist | Premium | Pemula yang sedang belajar deployment *(Related Class: Vibecoding For Beginner)* |
| 100 Hook Konten AI untuk Personal Branding | #6 Content Creation & Personal Branding | Bonus | Swipe File | Premium | Creator yang membangun audiens |
| SOP Layanan Jasa AI untuk Client | #8 Career, Freelance & Portfolio | Bonus | SOP | Premium | Freelancer yang mulai ambil client |

---

## K. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| **Kategori terlalu banyak** (tambah terus) | Navigasi penuh, tiap kategori isi 2–3 konten, terlihat kosong | Aturan keras: tidak ada kategori #10 sebelum satu kategori berisi ≥15 konten aktif; kebutuhan baru diselesaikan via filter/tag |
| **Bonus dicampur dengan kelas tanpa label** | User bingung "kok kelas ini cuma PDF?", persepsi kualitas turun | Halaman terpisah + badge Content Type wajib di semua card lintas-konteks |
| **Ebook/Template dijadikan kategori** | Topik dan bentuk bertabrakan; "Ebook Marketing" masuk mana? Filter rusak permanen | Validasi API menolak nama kategori terlarang; Bonus Type sebagai dimensi terpisah |
| **Admin tanpa field yang jelas** | Kategori asal pilih, data kotor lagi dalam 6 bulan | Form dinamis + decision rule 9 langkah sebagai helper + validasi publish (seksi H) |
| **User tidak bisa filter dengan mudah** | Konten bagus tidak ditemukan, engagement & konversi upgrade turun | 9 chip konsisten di semua halaman; sort Popular dari tracking nyata; Recommended dari onboarding role |
| *(Spesifik sistem)* **Migrasi category free-text lama** | 10 kelas berkategori `Gratis`/`Member Only` tersesat | Mapping manual semua 10 kelas (1 jam kerja); kolom lama baru di-drop setelah verifikasi |
| *(Spesifik sistem)* **Kelas `paid` yang sudah dibeli** | User kehilangan akses yang sudah dibayar → komplain & refund | `user_access` lifetime tidak disentuh; hanya konten baru yang memakai 2 tier |
| *(Spesifik sistem)* **47 bonus tanpa kategori** | Halaman bonus tidak bisa difilter saat rilis | Migrasi wajib selesai (Phase 4) sebelum filter kategori dirilis ke user (Phase 3 → soft-launch internal dulu) |

---

## L. Implementation Roadmap

**Phase 1 — Rapikan struktur kategori & content type (fondasi data)**
Buat tabel `categories` (seed 9) + `content_categories`; tambah kolom baru di `courses`/`bonuses`/`content_items`; normalisasi enum `access_type` & `bonus_type` di shared schema (zod). Belum ada perubahan UI. *Estimasi: 1 migration + validasi API.*

**Phase 2 — Update dashboard admin upload Kelas & Bonus**
Form dinamis per Content Type, pemilih primary+secondary category dengan helper decision rule, validasi publish, filter admin (seksi F), kolom kategori di tabel list admin.

**Phase 3 — Update UI user: filter & label visual**
Chip 9 kategori di `/kelas` & `/bonuses`, badge Content Type & Bonus Type, sort Popular dari `events_daily`, section "Resource pendukung" di halaman kelas. Soft-launch setelah Phase 4 selesai.

**Phase 4 — Migrasi konten lama**
Mapping manual 10 kelas + 47 bonus ke 9 kategori (pakai decision rule A2); pecah bonus `bundle`; normalisasi `paid` → `premium` dengan menjaga `user_access` lama; drop kolom `category` free-text; verifikasi: 0 konten published tanpa primary category.

**Phase 5 — Rekomendasi berbasis role & level**
"Recommended For You" dari `user_profiles` (role/goal/ai_level dari onboarding) + `content_skills` + sinyal `tracking_events`; urutan kategori dipersonalisasi per user; cross-sell bonus↔kelas via `related_course_id`.

Urutan ini sengaja: data dulu (1), alat produksi konten (2), baru pengalaman user (3) setelah datanya bersih (4). Fase 5 menumpang pada fondasi tracking yang sudah live.

---

## M. Acceptance Criteria

Fitur dianggap selesai jika **semua** checklist ini terpenuhi:

**Data & schema**
- [ ] Tabel `categories` berisi tepat 9 kategori dengan slug stabil
- [ ] Tidak ada kategori bernama "Bonus", "Ebook", "Template", "Gratis", atau "Member Only" (divalidasi di API, bukan cuma konvensi)
- [ ] Semua Class dan Bonus published punya tepat 1 primary category
- [ ] Tidak ada konten dengan >2 secondary category
- [ ] Semua Bonus punya Bonus Type dari enum 12 nilai; tidak ada `bundle` tersisa
- [ ] Kolom `courses.category` free-text sudah di-drop; tidak ada nilai `Gratis`/`Member Only` di sistem kategori
- [ ] `access_type` hanya berisi `free`/`premium` untuk konten aktif; user pemilik akses `paid` lama tetap bisa mengakses kelasnya (uji dengan akun nyata)

**Admin**
- [ ] Admin memilih Content Type dulu, lalu form berubah dinamis (field kelas ≠ field bonus)
- [ ] Bonus Type hanya muncul ketika Content Type = Bonus
- [ ] Publish tertolak jika: tanpa primary category / bonus tanpa Bonus Type / bonus tanpa file-link / kelas tanpa lesson published
- [ ] Decision rule 9 langkah tampil sebagai helper di pemilih kategori
- [ ] Admin bisa search & filter konten berdasarkan Content Type, Category, Bonus Type, Status, Access, Instructor, dan tanggal

**User**
- [ ] User bisa filter Kelas dan Bonus berdasarkan 9 kategori yang sama
- [ ] User bisa membedakan Class dan Bonus secara visual (badge) di semua konteks termasuk search & rekomendasi
- [ ] Chip 9 kategori identik di `/kelas` dan `/bonuses` (tidak ada halaman kategori lintas-tipe)
- [ ] Konten Premium terlihat oleh user free dengan state terkunci yang mengarah ke upgrade
- [ ] Kelas gratis bisa diakses semua user login; kelas premium hanya membership aktif

**Skalabilitas**
- [ ] Struktur terbukti menampung konten baru tanpa skema berubah (uji: tambah 1 kelas + 1 bonus baru end-to-end hanya lewat admin UI)
- [ ] Penambahan content type baru (recording/tool) tidak butuh perubahan struktur kategori — cukup lewat `content_items` + `content_categories`
