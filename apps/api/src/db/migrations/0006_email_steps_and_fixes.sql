-- Pejuang Yen Email Marketing System — Step 2 Fixes & Missing Sequences
-- Run AFTER 0005_email_marketing.sql

-- ─── 1. Add preview_text column to sequence steps ────────────────────────────

ALTER TABLE email_sequence_steps ADD COLUMN preview_text TEXT;

-- ─── 2. Fix CTA URLs — only two valid URLs exist ─────────────────────────────
-- Valid: https://pejuangyen.com/ (general/purchase) | https://app.pejuangyen.com/dashboard (dashboard)
-- Invalid (do not exist): /checkout, /my-classes, /courses, /quiz, /feedback, /membership

-- Welcome sequence: Email 1 → dashboard (user just registered), emails 2-5 → pejuangyen.com
UPDATE email_sequence_steps SET
  cta_url = 'https://app.pejuangyen.com/dashboard',
  preview_text = 'Bukan tutorial AI biasa — ini workflow konkret yang langsung bisa dipraktikkan.'
WHERE id = 'step_wf_1';

UPDATE email_sequence_steps SET
  cta_url = 'https://pejuangyen.com/',
  preview_text = 'Yang berhasil bukan yang paling banyak tau tools-nya.'
WHERE id = 'step_wf_2';

UPDATE email_sequence_steps SET
  cta_url = 'https://pejuangyen.com/',
  preview_text = 'Setiap peran punya kebutuhan AI yang berbeda.'
WHERE id = 'step_wf_3';

UPDATE email_sequence_steps SET
  cta_url = 'https://pejuangyen.com/',
  preview_text = 'Contoh konkret dari berbagai peran yang sudah pakai Pejuang Yen.'
WHERE id = 'step_wf_4';

UPDATE email_sequence_steps SET
  cta_url = 'https://pejuangyen.com/',
  preview_text = 'Ini email terakhir dari seri welcome — sekarang tinggal satu langkah.'
WHERE id = 'step_wf_5';

-- Abandoned checkout: /checkout does not exist → pejuangyen.com
UPDATE email_sequence_steps SET
  cta_url = 'https://pejuangyen.com/',
  preview_text = 'Pembayaran kamu belum selesai. Lanjutkan dari link yang sama.'
WHERE id = 'step_ac_1';

UPDATE email_sequence_steps SET
  cta_url = 'https://pejuangyen.com/',
  preview_text = 'Ini yang sering dilewatkan orang sebelum beli kelas.'
WHERE id = 'step_ac_2';

UPDATE email_sequence_steps SET
  cta_url = 'https://pejuangyen.com/',
  preview_text = 'Bukan teori umum. Workflow konkret yang langsung bisa dipraktikkan.'
WHERE id = 'step_ac_3';

UPDATE email_sequence_steps SET
  cta_url = 'https://pejuangyen.com/',
  preview_text = 'Pengingat terakhir untuk pembayaran kelas ini.'
WHERE id = 'step_ac_4';

-- Post-purchase: steps 1-3 → dashboard (authenticated learning context), steps 4-5 → pejuangyen.com
UPDATE email_sequence_steps SET
  cta_url = 'https://app.pejuangyen.com/dashboard',
  preview_text = 'Login dan mulai belajar sekarang.'
WHERE id = 'step_pp_1';

UPDATE email_sequence_steps SET
  cta_url = 'https://app.pejuangyen.com/dashboard',
  preview_text = 'Satu modul selesai lebih berharga dari separuh kelas yang setengah-setengah.'
WHERE id = 'step_pp_2';

UPDATE email_sequence_steps SET
  cta_url = 'https://app.pejuangyen.com/dashboard',
  preview_text = 'Satu praktik langsung lebih efektif dari 10 modul yang cuma ditonton.'
WHERE id = 'step_pp_3';

UPDATE email_sequence_steps SET
  cta_url = 'https://pejuangyen.com/',
  preview_text = 'Hubungkan materi dengan kebutuhan yang lebih spesifik.'
WHERE id = 'step_pp_4';

UPDATE email_sequence_steps SET
  cta_url = 'https://pejuangyen.com/',
  preview_text = 'Bantu kami memperbaiki kelas dengan feedback singkat.'
WHERE id = 'step_pp_5';

-- Inactive reactivation: /courses and /quiz do not exist → pejuangyen.com
UPDATE email_sequence_steps SET
  cta_url = 'https://pejuangyen.com/',
  preview_text = 'Akun kamu belum aktif belajar lagi. Mulai ulang dari langkah kecil.'
WHERE id = 'step_ir_1';

UPDATE email_sequence_steps SET
  cta_url = 'https://pejuangyen.com/',
  preview_text = 'Pilih topik AI yang paling mungkin kamu pakai minggu ini.'
WHERE id = 'step_ir_2';

UPDATE email_sequence_steps SET
  cta_url = 'https://pejuangyen.com/',
  preview_text = 'Ini pesan terakhir dari seri re-engagement ini.'
WHERE id = 'step_ir_3';

-- Membership expiry: /membership does not exist → pejuangyen.com
UPDATE email_sequence_steps SET
  cta_url = 'https://pejuangyen.com/',
  preview_text = 'Perpanjang sekarang untuk tetap akses semua kelas.'
WHERE id = 'step_me_1';

UPDATE email_sequence_steps SET
  cta_url = 'https://pejuangyen.com/',
  preview_text = 'Tiga hari lagi membership kamu berakhir.'
WHERE id = 'step_me_2';

UPDATE email_sequence_steps SET
  cta_url = 'https://pejuangyen.com/',
  preview_text = 'Ini hari terakhir untuk perpanjang tanpa gangguan akses.'
WHERE id = 'step_me_3';

UPDATE email_sequence_steps SET
  cta_url = 'https://pejuangyen.com/',
  preview_text = 'Membership kamu sudah berakhir. Kamu bisa mengaktifkannya lagi kapan saja.'
WHERE id = 'step_me_4';

-- ─── 3. Seed missing steps: Course Progress Reminder (3 steps) ───────────────

INSERT OR IGNORE INTO email_sequence_steps (id, sequence_id, step_order, delay_minutes, subject, preview_text, template_key, cta_url, created_at, updated_at) VALUES
  (
    'step_cr_1',
    'seq_progress_reminder',
    1,
    4320,
    'Lanjutkan dari satu modul kecil',
    'Kamu sudah mulai. Lanjutkan dari satu modul kecil.',
    'course_reminder_1',
    'https://pejuangyen.com/',
    datetime('now'),
    datetime('now')
  ),
  (
    'step_cr_2',
    'seq_progress_reminder',
    2,
    10080,
    'Cukup 10-15 menit untuk lanjut',
    'Cukup 10-15 menit untuk menghidupkan progres belajar lagi.',
    'course_reminder_2',
    'https://pejuangyen.com/',
    datetime('now'),
    datetime('now')
  ),
  (
    'step_cr_3',
    'seq_progress_reminder',
    3,
    20160,
    'Satu workflow aja — worth it',
    'Ambil satu output kecil dari kelas yang belum selesai.',
    'course_reminder_3',
    'https://pejuangyen.com/',
    datetime('now'),
    datetime('now')
  );

-- ─── 4. Seed missing steps: Segment-Based Nurturing (3 steps) ────────────────

INSERT OR IGNORE INTO email_sequence_steps (id, sequence_id, step_order, delay_minutes, subject, preview_text, template_key, cta_url, created_at, updated_at) VALUES
  (
    'step_sn_1',
    'seq_segment_nurture',
    1,
    0,
    'Materi AI yang lebih relevan untuk kamu',
    'Mulai dari materi yang paling relevan dengan profil kamu.',
    'segment_nurture_1',
    'https://pejuangyen.com/',
    datetime('now'),
    datetime('now')
  ),
  (
    'step_sn_2',
    'seq_segment_nurture',
    2,
    2880,
    'Coba workflow AI ini hari ini',
    'Satu langkah kecil yang langsung terasa bedanya.',
    'segment_nurture_2',
    'https://pejuangyen.com/',
    datetime('now'),
    datetime('now')
  ),
  (
    'step_sn_3',
    'seq_segment_nurture',
    3,
    7200,
    'Simpan workflow yang berhasil',
    'Satu kelas yang paling sering kasih hasil nyata.',
    'segment_nurture_3',
    'https://pejuangyen.com/',
    datetime('now'),
    datetime('now')
  );
