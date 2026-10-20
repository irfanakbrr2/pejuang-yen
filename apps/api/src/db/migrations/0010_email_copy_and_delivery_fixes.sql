-- Pejuang Yen Email Copy & Delivery Fixes
-- Run after 0005/0006 email marketing migrations.

ALTER TABLE user_email_sequence_state ADD COLUMN failure_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_email_sequence_state ADD COLUMN last_error TEXT;

-- Welcome sequence
UPDATE email_sequence_steps SET
  subject = 'Selamat datang di Pejuang Yen',
  preview_text = 'Akun kamu sudah aktif. Mulai dari satu kelas yang paling relevan.',
  cta_url = 'https://app.pejuangyen.com/dashboard',
  updated_at = datetime('now')
WHERE id = 'step_wf_1';

UPDATE email_sequence_steps SET
  subject = 'Mulai dari workflow, bukan daftar tools',
  preview_text = 'Mulai dari workflow yang jelas, bukan dari semua tools sekaligus.',
  cta_url = 'https://pejuangyen.com/',
  updated_at = datetime('now')
WHERE id = 'step_wf_2';

UPDATE email_sequence_steps SET
  subject = 'Pilih kelas yang paling dekat dengan kebutuhanmu',
  preview_text = 'Setiap peran punya kebutuhan AI yang berbeda. Pilih jalur yang paling dekat.',
  cta_url = 'https://pejuangyen.com/',
  updated_at = datetime('now')
WHERE id = 'step_wf_3';

UPDATE email_sequence_steps SET
  subject = 'Contoh cara memakai AI sesuai peran kamu',
  preview_text = 'Contoh konkret cara memakai AI untuk kerja, belajar, bisnis, dan konten.',
  cta_url = 'https://pejuangyen.com/',
  updated_at = datetime('now')
WHERE id = 'step_wf_4';

UPDATE email_sequence_steps SET
  subject = 'Mulai kelas pertama hari ini',
  preview_text = 'Seri welcome selesai. Sekarang mulai dari satu modul yang paling relevan.',
  cta_url = 'https://pejuangyen.com/',
  updated_at = datetime('now')
WHERE id = 'step_wf_5';

-- Abandoned checkout sequence. Actual Mayar URL is supplied from checkout_events when available.
UPDATE email_sequence_steps SET
  subject = 'Pembayaran kamu belum selesai',
  preview_text = 'Pembayaran kamu belum selesai. Lanjutkan dari link yang sama.',
  cta_url = 'https://pejuangyen.com/',
  updated_at = datetime('now')
WHERE id = 'step_ac_1';

UPDATE email_sequence_steps SET
  subject = 'Pastikan kelas ini cocok dengan kebutuhanmu',
  preview_text = 'Pastikan kelas ini cocok dengan kebutuhan kamu sebelum lanjut.',
  cta_url = 'https://pejuangyen.com/',
  updated_at = datetime('now')
WHERE id = 'step_ac_2';

UPDATE email_sequence_steps SET
  subject = 'Mulai dari satu use case kecil',
  preview_text = 'Mulai dari satu use case kecil setelah akses aktif.',
  cta_url = 'https://pejuangyen.com/',
  updated_at = datetime('now')
WHERE id = 'step_ac_3';

UPDATE email_sequence_steps SET
  subject = 'Pengingat terakhir untuk pembayaran ini',
  preview_text = 'Pengingat terakhir untuk pembayaran kelas ini.',
  cta_url = 'https://pejuangyen.com/',
  updated_at = datetime('now')
WHERE id = 'step_ac_4';

-- Post-purchase onboarding
UPDATE email_sequence_steps SET
  subject = 'Akses kamu sudah aktif',
  preview_text = 'Pembayaran berhasil. Akses kamu sudah aktif di dashboard.',
  cta_url = 'https://app.pejuangyen.com/dashboard',
  updated_at = datetime('now')
WHERE id = 'step_pp_1';

UPDATE email_sequence_steps SET
  subject = 'Buat ritme belajar yang sederhana',
  preview_text = 'Buat ritme belajar sederhana dari modul pertama.',
  cta_url = 'https://app.pejuangyen.com/my-classes',
  updated_at = datetime('now')
WHERE id = 'step_pp_2';

UPDATE email_sequence_steps SET
  subject = 'Praktikkan satu workflow hari ini',
  preview_text = 'Ambil satu workflow dari kelas dan praktikkan hari ini.',
  cta_url = 'https://app.pejuangyen.com/my-classes',
  updated_at = datetime('now')
WHERE id = 'step_pp_3';

UPDATE email_sequence_steps SET
  subject = 'Hubungkan materi dengan kebutuhanmu',
  preview_text = 'Hubungkan materi dengan kebutuhan yang lebih spesifik.',
  cta_url = 'https://pejuangyen.com/',
  updated_at = datetime('now')
WHERE id = 'step_pp_4';

UPDATE email_sequence_steps SET
  subject = 'Boleh minta feedback singkat?',
  preview_text = 'Bantu kami memperbaiki kelas dengan feedback singkat.',
  cta_url = 'https://pejuangyen.com/',
  updated_at = datetime('now')
WHERE id = 'step_pp_5';

-- Inactive reactivation
UPDATE email_sequence_steps SET
  subject = 'Mulai lagi dari langkah kecil',
  preview_text = 'Akun kamu belum aktif belajar lagi. Mulai ulang dari langkah kecil.',
  cta_url = 'https://pejuangyen.com/',
  updated_at = datetime('now')
WHERE id = 'step_ir_1';

UPDATE email_sequence_steps SET
  subject = 'Pilih topik AI yang paling kamu butuhkan',
  preview_text = 'Pilih topik AI yang paling mungkin kamu pakai minggu ini.',
  cta_url = 'https://pejuangyen.com/',
  updated_at = datetime('now')
WHERE id = 'step_ir_2';

UPDATE email_sequence_steps SET
  subject = 'Pengingat terakhir untuk mulai lagi',
  preview_text = 'Pengingat terakhir untuk mulai lagi saat kamu siap.',
  cta_url = 'https://pejuangyen.com/',
  updated_at = datetime('now')
WHERE id = 'step_ir_3';

-- Membership expiry
UPDATE email_sequence_steps SET
  subject = 'Membership kamu hampir berakhir',
  preview_text = 'Membership kamu hampir berakhir. Perpanjang agar akses tidak terputus.',
  cta_url = 'https://pejuangyen.com/',
  updated_at = datetime('now')
WHERE id = 'step_me_1';

UPDATE email_sequence_steps SET
  subject = '3 hari lagi membership kamu berakhir',
  preview_text = 'Tiga hari lagi membership kamu berakhir.',
  cta_url = 'https://pejuangyen.com/',
  updated_at = datetime('now')
WHERE id = 'step_me_2';

UPDATE email_sequence_steps SET
  subject = 'Besok adalah hari terakhir membership aktif',
  preview_text = 'Besok adalah hari terakhir membership aktif.',
  cta_url = 'https://pejuangyen.com/',
  updated_at = datetime('now')
WHERE id = 'step_me_3';

UPDATE email_sequence_steps SET
  subject = 'Membership kamu sudah berakhir',
  preview_text = 'Membership kamu sudah berakhir. Kamu bisa mengaktifkannya lagi kapan saja.',
  cta_url = 'https://pejuangyen.com/',
  updated_at = datetime('now')
WHERE id = 'step_me_4';

-- Course progress reminder
UPDATE email_sequence_steps SET
  subject = 'Lanjutkan dari satu modul kecil',
  preview_text = 'Kamu sudah mulai. Lanjutkan dari satu modul kecil.',
  cta_url = 'https://app.pejuangyen.com/my-classes',
  updated_at = datetime('now')
WHERE id = 'step_cr_1';

UPDATE email_sequence_steps SET
  subject = 'Cukup 10-15 menit untuk lanjut',
  preview_text = 'Cukup 10-15 menit untuk menghidupkan progres belajar lagi.',
  cta_url = 'https://app.pejuangyen.com/my-classes',
  updated_at = datetime('now')
WHERE id = 'step_cr_2';

UPDATE email_sequence_steps SET
  subject = 'Ambil satu output kecil dari kelas ini',
  preview_text = 'Ambil satu output kecil dari kelas yang belum selesai.',
  cta_url = 'https://app.pejuangyen.com/my-classes',
  updated_at = datetime('now')
WHERE id = 'step_cr_3';

-- Segment-based nurturing
UPDATE email_sequence_steps SET
  subject = 'Materi AI yang lebih relevan untuk kamu',
  preview_text = 'Mulai dari materi yang paling relevan dengan profil kamu.',
  cta_url = 'https://pejuangyen.com/',
  updated_at = datetime('now')
WHERE id = 'step_sn_1';

UPDATE email_sequence_steps SET
  subject = 'Coba satu workflow AI ringan hari ini',
  preview_text = 'Coba workflow AI ringan dari tugas yang sedang kamu kerjakan.',
  cta_url = 'https://pejuangyen.com/',
  updated_at = datetime('now')
WHERE id = 'step_sn_2';

UPDATE email_sequence_steps SET
  subject = 'Simpan workflow yang berhasil',
  preview_text = 'Simpan satu workflow yang berhasil, lalu lanjutkan dari sana.',
  cta_url = 'https://pejuangyen.com/',
  updated_at = datetime('now')
WHERE id = 'step_sn_3';
