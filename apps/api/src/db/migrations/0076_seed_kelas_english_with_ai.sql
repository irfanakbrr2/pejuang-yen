-- Pejuang Yen — Seed: Kelas Gratis "English Class With AI"
-- Free course (access_type='free', self-enroll). Pola mengikuti 0068 (semua INSERT OR IGNORE, idempoten).
-- 3 video YouTube (Part 1–3). Deskripsi di-generate menyesuaikan gaya kelas lain.

-- ── Course ───────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO courses (id, slug, title, subtitle, short_description, description, thumbnail_url, level, category, instructor_name, access_type, price, compare_at_price, status, sort_order, published_at, created_at, updated_at)
VALUES
  ('course-english-ai', 'english-class-with-ai', 'English Class With AI',
   'Belajar Bahasa Inggris dengan AI sebagai partner latihanmu',
   'Kelas gratis untuk belajar Bahasa Inggris memakai AI — dari fondasi sampai praktik harian, santai dan cocok untuk pemula.',
   'Kelas gratis ini mengajak kamu belajar Bahasa Inggris dengan memanfaatkan AI sebagai partner latihan. Mulai dari fondasi, membangun kebiasaan berlatih, hingga praktik langsung memakai AI untuk mengasah speaking, vocabulary, dan rasa percaya diri berbahasa Inggris. Dirancang untuk pemula yang ingin belajar dengan cara modern, fleksibel, dan tanpa biaya.',
   'https://pub-d56d873c4b8d4204b35361d7bea0dca8.r2.dev/Kelas/English%20Class%20With%20Ai.webp',
   'beginner', 'English', 'Pejuang Yen Team', 'free', 0, NULL, 'published', 21,
   '2026-06-16T00:00:00.000Z', '2026-06-16T00:00:00.000Z', '2026-06-16T00:00:00.000Z');

-- ── Module ───────────────────────────────────────────────────────────────────
INSERT OR IGNORE INTO course_modules (id, course_id, title, description, sort_order, created_at, updated_at)
VALUES
  ('mod-english-001', 'course-english-ai', 'English Class With AI', 'Belajar Bahasa Inggris dengan AI — Part 1 sampai 3', 1, '2026-06-16T00:00:00.000Z', '2026-06-16T00:00:00.000Z');

-- ── Lessons: Video 1–3 ───────────────────────────────────────────────────────
INSERT OR IGNORE INTO lessons (id, course_id, module_id, title, slug, lesson_type, video_provider, video_url, description, is_preview, sort_order, status, created_at, updated_at)
VALUES
  ('lesson-english-001', 'course-english-ai', 'mod-english-001', 'English Class With AI — Part 1', 'english-class-part-1', 'video', 'youtube', 'https://youtu.be/9K0H_HVVkEk', 'Bagian pertama: pengenalan cara belajar Bahasa Inggris dengan AI dan fondasi yang perlu kamu siapkan.', 1, 1, 'published', '2026-06-16T00:00:00.000Z', '2026-06-16T00:00:00.000Z'),
  ('lesson-english-002', 'course-english-ai', 'mod-english-001', 'English Class With AI — Part 2', 'english-class-part-2', 'video', 'youtube', 'https://youtu.be/SgAbJ_pnbtk', 'Bagian kedua: lanjut praktik dan teknik memakai AI untuk mengasah kemampuan berbahasa Inggris.', 0, 2, 'published', '2026-06-16T00:00:00.000Z', '2026-06-16T00:00:00.000Z'),
  ('lesson-english-003', 'course-english-ai', 'mod-english-001', 'English Class With AI — Part 3', 'english-class-part-3', 'video', 'youtube', 'https://youtu.be/fWxMkOzFweI', 'Bagian ketiga: praktik lanjutan dan penerapan harian agar kemampuan Bahasa Inggrismu makin lancar.', 0, 3, 'published', '2026-06-16T00:00:00.000Z', '2026-06-16T00:00:00.000Z');
