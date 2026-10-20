-- Urutan seri kelas vibecoding (1-10) + hapus course/bonus seed lama.
-- sort_order dipakai katalog /api/courses (ASC); priority_score dipakai
-- registry /api/resources (DESC) — keduanya diset agar urutan konsisten.

-- ═══ 1. Urutan seri (KELAS 1-10) ═══
UPDATE courses SET sort_order = 1,  priority_score = 100 WHERE id = '3d3acf80-92d7-45c0-b707-0ef686ecb055'; -- Vibecoding For Beginner
UPDATE courses SET sort_order = 2,  priority_score = 99  WHERE id = 'eb1f34a9-4159-4cd4-adcc-ede956e53803'; -- Memahami Ekosistem Web Modern & AI
UPDATE courses SET sort_order = 3,  priority_score = 98  WHERE id = '3dc84a6c-c8ec-4fb3-af1e-39527900dd28'; -- Integrasi GitHub sebagai Jantung Website
UPDATE courses SET sort_order = 4,  priority_score = 97  WHERE id = '3a488c93-7627-416d-aac0-23f6bf3e5858'; -- Membuat Website & Landing Page dengan Bantuan AI
UPDATE courses SET sort_order = 5,  priority_score = 96  WHERE id = 'crs-framer-layout';                    -- Layout, Styling Element di Framer
UPDATE courses SET sort_order = 6,  priority_score = 95  WHERE id = 'crs-mobile-responsive';                -- Mobile Responsiveness
UPDATE courses SET sort_order = 7,  priority_score = 94  WHERE id = 'crs-netlify';                          -- Hosting & Deployment dengan Netlify
UPDATE courses SET sort_order = 8,  priority_score = 93  WHERE id = 'crs-cf-pages';                         -- Hosting & Deployment dengan Cloudflare Pages
UPDATE courses SET sort_order = 9,  priority_score = 92  WHERE id = 'crs-copy-landing';                     -- AI Copywriting Landing Page
UPDATE courses SET sort_order = 10, priority_score = 91  WHERE id = 'crs-copy-website';                     -- AI Website Copywriting

-- Sinkronkan registry agar /kelas (resources, order by priority_score DESC) ikut urut
UPDATE content_items SET
  priority_score = (SELECT priority_score FROM courses WHERE courses.id = content_items.ref_id)
WHERE content_type = 'course'
  AND ref_id IN ('3d3acf80-92d7-45c0-b707-0ef686ecb055','eb1f34a9-4159-4cd4-adcc-ede956e53803','3dc84a6c-c8ec-4fb3-af1e-39527900dd28','3a488c93-7627-416d-aac0-23f6bf3e5858','crs-framer-layout','crs-mobile-responsive','crs-netlify','crs-cf-pages','crs-copy-landing','crs-copy-website');

-- ═══ 2. Hapus course seed: Prompt Engineering Masterclass + AI untuk Bisnis & Marketing ═══
-- Cascade penuh termasuk data belajar turunannya (18 enrollment, 1 sertifikat, 1 akses).
-- Urutan penting: certificates dulu (FK ke enrollments); lepas referensi
-- dari bonuses.related_course_id & success_stories.course_id sebelum courses.
DELETE FROM certificates WHERE course_id IN ('course-002','course-003');
DELETE FROM lesson_progress WHERE enrollment_id IN (SELECT id FROM enrollments WHERE course_id IN ('course-002','course-003'));
DELETE FROM lesson_progress WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id IN ('course-002','course-003'));
DELETE FROM enrollments WHERE course_id IN ('course-002','course-003');
DELETE FROM user_access WHERE resource_type = 'course' AND resource_id IN ('course-002','course-003');
DELETE FROM lessons WHERE course_id IN ('course-002','course-003');
UPDATE bonuses SET related_course_id = NULL WHERE related_course_id IN ('course-002','course-003');
UPDATE success_stories SET course_id = NULL WHERE course_id IN ('course-002','course-003');
DELETE FROM course_modules WHERE course_id IN ('course-002','course-003');
DELETE FROM resource_tags WHERE resource_type = 'course' AND resource_id IN ('course-002','course-003');
DELETE FROM learning_path_items WHERE content_id IN ('course:course-002','course:course-003');
DELETE FROM content_skills WHERE content_id IN ('course:course-002','course:course-003');
DELETE FROM content_tags WHERE content_id IN ('course:course-002','course:course-003');
DELETE FROM content_categories WHERE content_type = 'course' AND ref_id IN ('course-002','course-003');
DELETE FROM content_items WHERE id IN ('course:course-002','course:course-003');
DELETE FROM courses WHERE id IN ('course-002','course-003');

-- ═══ 3. Hapus bonus seed: 100+ Prompt Templates + Panduan AI Tools 2026 ═══
DELETE FROM bonus_files WHERE bonus_id IN ('bonus-001','bonus-002');
DELETE FROM resource_tags WHERE resource_type = 'bonus' AND resource_id IN ('bonus-001','bonus-002');
DELETE FROM learning_path_items WHERE content_id IN ('bonus:bonus-001','bonus:bonus-002');
DELETE FROM content_skills WHERE content_id IN ('bonus:bonus-001','bonus:bonus-002');
DELETE FROM content_tags WHERE content_id IN ('bonus:bonus-001','bonus:bonus-002');
DELETE FROM content_categories WHERE content_type = 'bonus' AND ref_id IN ('bonus-001','bonus-002');
DELETE FROM content_items WHERE id IN ('bonus:bonus-001','bonus:bonus-002');
DELETE FROM bonuses WHERE id IN ('bonus-001','bonus-002');
