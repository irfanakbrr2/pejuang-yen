-- Pejuang Yen — HAPUS PERMANEN semua kelas/bonus AI (yang diarsipkan di 0083) beserta
-- seluruh dependensinya, dan GANTI kategori taxonomy AI/web (Vibecoding & Web Dev, dll)
-- dengan kategori Pejuang Yen (Bahasa Jepang). FK D1 aktif → pakai defer agar aman.
PRAGMA defer_foreign_keys = TRUE;

-- ── 1. Hapus konten AI lama (status='archived') + semua baris yang mereferensikannya ──
DELETE FROM content_skills      WHERE content_id IN (SELECT id FROM content_items WHERE status='archived' AND content_type IN ('course','bonus'));
DELETE FROM content_tags        WHERE content_id IN (SELECT id FROM content_items WHERE status='archived' AND content_type IN ('course','bonus'));
DELETE FROM learning_path_items WHERE content_id IN (SELECT id FROM content_items WHERE status='archived' AND content_type IN ('course','bonus'));
DELETE FROM content_categories  WHERE content_type='course' AND ref_id IN (SELECT id FROM courses WHERE status='archived');
DELETE FROM content_categories  WHERE content_type='bonus'  AND ref_id IN (SELECT id FROM bonuses WHERE status='archived');
DELETE FROM lesson_progress     WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id IN (SELECT id FROM courses WHERE status='archived'));
DELETE FROM certificates        WHERE course_id IN (SELECT id FROM courses WHERE status='archived');
DELETE FROM enrollments         WHERE course_id IN (SELECT id FROM courses WHERE status='archived');
DELETE FROM lessons             WHERE course_id IN (SELECT id FROM courses WHERE status='archived');
DELETE FROM course_modules      WHERE course_id IN (SELECT id FROM courses WHERE status='archived');
UPDATE success_stories SET course_id = NULL WHERE course_id IN (SELECT id FROM courses WHERE status='archived');
DELETE FROM bonus_files         WHERE bonus_id IN (SELECT id FROM bonuses WHERE status='archived');
DELETE FROM content_items       WHERE status='archived' AND content_type IN ('course','bonus');
DELETE FROM bonuses             WHERE status='archived';
DELETE FROM courses             WHERE status='archived';

-- ── 2. Nonaktifkan kategori AI/web lama (tidak muncul lagi di chip /kelas) ──
UPDATE categories SET is_active = 0
 WHERE id IN ('cat_01','cat_02','cat_03','cat_04','cat_05','cat_06','cat_07','cat_08','cat_09');

-- ── 3. Kategori Pejuang Yen (Bahasa Jepang & persiapan kerja) ──
INSERT OR IGNORE INTO categories (id, slug, name, description, icon, sort_order, is_active) VALUES
  ('cat_jp_01','bahasa-jepang',   'Bahasa Jepang',                'Hiragana, Katakana, Kanji, tata bahasa & kosakata.',   'languages',       1, 1),
  ('cat_jp_02','persiapan-ujian', 'Persiapan Ujian',              'JLPT, JFT-Basic, dan ujian keterampilan SSW.',         'clipboard-check', 2, 1),
  ('cat_jp_03','persiapan-kerja', 'Persiapan Kerja ke Jepang',    'Tokutei Ginou, budaya kerja, wawancara & CV.',         'briefcase',       3, 1),
  ('cat_jp_04','budaya-jepang',   'Budaya & Kehidupan di Jepang', 'Adaptasi budaya, etika, dan kehidupan sehari-hari.',   'globe',           4, 1);

-- ── 4. Petakan 8 kelas Jepang ke kategori (primary denormalized + content_categories) ──
UPDATE courses SET primary_category_id='cat_jp_01' WHERE id IN ('py-course-01','py-course-02');
UPDATE courses SET primary_category_id='cat_jp_02' WHERE id IN ('py-course-03','py-course-04','py-course-05');
UPDATE courses SET primary_category_id='cat_jp_03' WHERE id IN ('py-course-06','py-course-07','py-course-08');

INSERT OR IGNORE INTO content_categories (content_type, ref_id, category_id, is_primary, created_at) VALUES
  ('course','py-course-01','cat_jp_01',1,'2026-06-30T00:00:00.000Z'),
  ('course','py-course-02','cat_jp_01',1,'2026-06-30T00:00:00.000Z'),
  ('course','py-course-03','cat_jp_02',1,'2026-06-30T00:00:00.000Z'),
  ('course','py-course-04','cat_jp_02',1,'2026-06-30T00:00:00.000Z'),
  ('course','py-course-05','cat_jp_02',1,'2026-06-30T00:00:00.000Z'),
  ('course','py-course-06','cat_jp_03',1,'2026-06-30T00:00:00.000Z'),
  ('course','py-course-07','cat_jp_03',1,'2026-06-30T00:00:00.000Z'),
  ('course','py-course-08','cat_jp_03',1,'2026-06-30T00:00:00.000Z');
