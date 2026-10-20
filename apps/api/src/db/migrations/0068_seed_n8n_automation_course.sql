-- Pejuang Yen — Seed: Kelas Premium "Automation N8N for Everyone"
-- Membership-only course. Pola mengikuti 0002_seed_data.sql (semua INSERT OR IGNORE, idempoten).
-- Lesson coming-soon disimpan di content_embed (dokumen HTML penuh, bypass sanitizer, dirender via iframe srcdoc).
-- Catatan: HTML coming-soon sengaja ditulis tanpa single-quote agar aman di dalam string SQL.

-- ── Course ───────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO courses (id, slug, title, subtitle, short_description, description, thumbnail_url, level, category, instructor_name, access_type, price, compare_at_price, status, sort_order, published_at, created_at, updated_at)
VALUES
  ('course-n8n-automation', 'automation-n8n-for-everyone', 'Automation N8N for Everyone',
   'Belajar automation workflow pakai N8N dari nol sampai praktik nyata',
   'Kuasai dasar N8N: kenali tools-nya, pahami antarmuka, dan siap untuk banyak praktik automation.',
   'Kelas ini mengajak kamu memahami N8N, salah satu tools automation paling fleksibel, dari pengenalan sampai praktik. Mulai dari mengenal N8N, memahami antarmukanya dan alasan memakainya, hingga sesi praktik membangun workflow automation yang akan terus ditambahkan.',
   'https://pub-d56d873c4b8d4204b35361d7bea0dca8.r2.dev/Kelas/Automation%20N8N%20for%20Everyone.webp',
   'beginner', 'Automation', 'Pejuang Yen Team', 'membership_only', 0, NULL, 'published', 20,
   '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z');

-- ── Module ───────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO course_modules (id, course_id, title, description, sort_order, created_at, updated_at)
VALUES
  ('mod-n8n-001', 'course-n8n-automation', 'Pengenalan N8N', 'Mengenal N8N, antarmuka, dan praktik automation', 1, '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z');

-- ── Lessons: Video 1 & Video 2 ───────────────────────────────────────────────
INSERT OR IGNORE INTO lessons (id, course_id, module_id, title, slug, lesson_type, video_provider, video_url, description, is_preview, sort_order, status, created_at, updated_at)
VALUES
  ('lesson-n8n-001', 'course-n8n-automation', 'mod-n8n-001', 'Perkenalan Mengenai N8N', 'perkenalan-n8n', 'video', 'youtube', 'https://youtu.be/dTLwm4WUooQ', 'Kenalan dengan N8N dan kenapa automation penting untuk produktivitas.', 1, 1, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z'),
  ('lesson-n8n-002', 'course-n8n-automation', 'mod-n8n-001', 'Antar Muka N8N dan Kenapa N8N', 'antarmuka-n8n', 'video', 'youtube', 'https://youtu.be/h5qR7WO97Ts', 'Tur antarmuka N8N dan alasan memilih N8N untuk membangun workflow automation.', 0, 2, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z');

-- ── Lesson 3: Praktik N8N (Coming Soon) — text lesson, content_embed ──────────
INSERT OR IGNORE INTO lessons (id, course_id, module_id, title, slug, lesson_type, content_embed, content_format, description, is_preview, sort_order, status, created_at, updated_at)
VALUES
  ('lesson-n8n-003', 'course-n8n-automation', 'mod-n8n-001', 'Praktik N8N — Coming Soon', 'praktik-n8n-coming-soon', 'text',
'<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Praktik N8N — Coming Soon</title>
<style>
:root{--text:#2f3437;--muted:#6b7280;--border:#e5e7eb;--soft:#f7f7f5;--accent:#0F6E56;}
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:var(--text);line-height:1.8;}
.container{max-width:940px;margin:auto;}
section{margin-bottom:36px;}
h1{font-size:36px;line-height:1.2;margin-bottom:16px;}
h2{font-size:24px;margin-bottom:16px;}
p{margin-bottom:16px;}
.tag{display:inline-block;padding:6px 12px;border-radius:999px;background:#f3f4f6;font-size:13px;margin:0 8px 8px 0;}
.tag-accent{background:#E8F5F0;color:var(--accent);}
.card{border:1px solid var(--border);border-radius:18px;padding:28px;background:#fff;text-align:center;}
.callout{background:var(--soft);padding:20px;border-radius:14px;}
ul{margin:4px 0 4px 22px;}
li{margin-bottom:10px;}
.muted{color:var(--muted);}
.dot{display:inline-block;width:8px;height:8px;border-radius:999px;background:var(--accent);margin-right:8px;vertical-align:middle;}
</style>
</head>
<body>
<div class="container">
<header style="text-align:center;margin-bottom:28px;">
<div class="tag tag-accent">Coming Soon</div>
<div class="tag">Automation</div>
<div class="tag">Hands-on N8N</div>
<h1 style="margin-top:14px;">Praktik N8N Segera Hadir</h1>
<p class="muted">Bagian ini sedang kami siapkan. Akan ada banyak praktik langsung membangun workflow automation memakai N8N.</p>
</header>
<section>
<div class="card">
<h2>Materi praktik sedang disiapkan</h2>
<p class="muted" style="margin-bottom:0;">Sambil menunggu, tonton dulu dua video pengantar di kelas ini supaya kamu siap saat sesi praktik dibuka.</p>
</div>
</section>
<section>
<h2>Yang akan kamu praktikkan</h2>
<div class="callout">
<ul>
<li><span class="dot"></span>Membuat workflow pertama dari nol di N8N</li>
<li><span class="dot"></span>Menghubungkan aplikasi: Gmail, Google Sheets, Telegram, dan WhatsApp</li>
<li><span class="dot"></span>Trigger otomatis: webhook, schedule, dan event aplikasi</li>
<li><span class="dot"></span>Mengolah data antar node dan memakai ekspresi</li>
<li><span class="dot"></span>Integrasi AI ke dalam workflow automation</li>
<li><span class="dot"></span>Studi kasus automation nyata untuk bisnis dan solopreneur</li>
</ul>
</div>
</section>
<section>
<div class="callout">
<p style="margin-bottom:0;"><strong>Catatan:</strong> Akan ada banyak praktik mengenai N8N di sini. Pantau terus halaman ini, materi baru ditambahkan secara bertahap.</p>
</div>
</section>
</div>
</body>
</html>',
   'html', 'Sesi praktik N8N sedang disiapkan. Akan ada banyak praktik automation di sini.', 0, 3, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z');
