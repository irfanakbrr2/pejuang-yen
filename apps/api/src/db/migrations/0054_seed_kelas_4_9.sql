-- Seed Kelas 4–9 (seri lanjutan vibecoding & copywriting).
-- Semua Free + published. Kategori mengikuti decision rule
-- docs/content-taxonomy-plan.md A2. 1 modul per kelas, lesson video YouTube.

-- ═══ KELAS 4 — Layout, Styling Element di Framer (cat_02, sec cat_03) ═══
INSERT OR IGNORE INTO courses (id, slug, title, short_description, thumbnail_url, level, instructor_name, access_type, price, status, sort_order, primary_category_id, learning_outcome, published_at, created_at, updated_at)
VALUES ('crs-framer-layout', 'layout-styling-element-di-framer', 'Layout, Styling Element di Framer',
  'Kuasai sistem layout, positioning, sizing, styling, dark mode, dan breakpoint di Framer.',
  'https://pub-d56d873c4b8d4204b35361d7bea0dca8.r2.dev/Kelas/Layout%2C%20Styling%20element%20di%20framer.png',
  'beginner', 'Irfan Akbar', 'free', 0, 'published', 13, 'cat_02',
  'User memahami sistem layout, positioning, sizing, styling, dark mode, dan breakpoint di Framer.',
  '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z');

INSERT OR IGNORE INTO course_modules (id, course_id, title, sort_order, created_at, updated_at)
VALUES ('mod-framer-layout', 'crs-framer-layout', 'Materi Utama', 1, '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z');

INSERT OR IGNORE INTO lessons (id, course_id, module_id, title, slug, lesson_type, video_provider, video_url, is_preview, sort_order, status, created_at, updated_at) VALUES
('les-fl-01', 'crs-framer-layout', 'mod-framer-layout', 'Tentang Frame dan Layout Stack', 'tentang-frame-dan-layout-stack', 'video', 'youtube', 'https://www.youtube.com/watch?v=FJAv9RS-5Gg', 0, 1, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z'),
('les-fl-02', 'crs-framer-layout', 'mod-framer-layout', 'Tentang Positioning di Framer', 'tentang-positioning-di-framer', 'video', 'youtube', 'https://www.youtube.com/watch?v=oI9CEfa-vNw', 0, 2, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z'),
('les-fl-03', 'crs-framer-layout', 'mod-framer-layout', 'Sizing Element Framer', 'sizing-element-framer', 'video', 'youtube', 'https://www.youtube.com/watch?v=LN1I1Wsqyfk', 0, 3, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z'),
('les-fl-04', 'crs-framer-layout', 'mod-framer-layout', 'Stack vs Grid', 'stack-vs-grid', 'video', 'youtube', 'https://www.youtube.com/watch?v=L6LBRvO_8X8', 0, 4, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z'),
('les-fl-05', 'crs-framer-layout', 'mod-framer-layout', 'Height Positioning Framer', 'height-positioning-framer', 'video', 'youtube', 'https://www.youtube.com/watch?v=wkJKRTXJ0Hs', 0, 5, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z'),
('les-fl-06', 'crs-framer-layout', 'mod-framer-layout', 'Min Max Sizing', 'min-max-sizing', 'video', 'youtube', 'https://www.youtube.com/watch?v=jElengGQm68', 0, 6, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z'),
('les-fl-07', 'crs-framer-layout', 'mod-framer-layout', 'Styling & Properti Layer', 'styling-properti-layer', 'video', 'youtube', 'https://www.youtube.com/watch?v=Xxx32aC4JB0', 0, 7, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z'),
('les-fl-08', 'crs-framer-layout', 'mod-framer-layout', 'Styling Element', 'styling-element', 'video', 'youtube', 'https://www.youtube.com/watch?v=vKhlSaRoIWM', 0, 8, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z'),
('les-fl-09', 'crs-framer-layout', 'mod-framer-layout', 'Dark Light Mode Framer', 'dark-light-mode-framer', 'video', 'youtube', 'https://www.youtube.com/watch?v=iLLOK6Ic0OM', 0, 9, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z'),
('les-fl-10', 'crs-framer-layout', 'mod-framer-layout', 'Fundamental Breakpoint di Framer', 'fundamental-breakpoint-di-framer', 'video', 'youtube', 'https://www.youtube.com/watch?v=0v2YVkbKKUc', 0, 10, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z');

-- ═══ KELAS 5 — Mobile Responsiveness (cat_02) ═══
INSERT OR IGNORE INTO courses (id, slug, title, short_description, thumbnail_url, level, instructor_name, access_type, price, status, sort_order, primary_category_id, learning_outcome, published_at, created_at, updated_at)
VALUES ('crs-mobile-responsive', 'mobile-responsiveness', 'Mobile Responsiveness',
  'Buat dan perbaiki website agar tampil sempurna di semua ukuran layar, dari prompt AI sampai Framer.',
  'https://pub-d56d873c4b8d4204b35361d7bea0dca8.r2.dev/Kelas/Mobile%20Responsive.png',
  'beginner', 'Irfan Akbar', 'free', 0, 'published', 14, 'cat_02',
  'User bisa membuat dan memperbaiki website agar responsive di semua ukuran layar.',
  '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z');

INSERT OR IGNORE INTO course_modules (id, course_id, title, sort_order, created_at, updated_at)
VALUES ('mod-mobile-responsive', 'crs-mobile-responsive', 'Materi Utama', 1, '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z');

INSERT OR IGNORE INTO lessons (id, course_id, module_id, title, slug, lesson_type, video_provider, video_url, is_preview, sort_order, status, created_at, updated_at) VALUES
('les-mr-01', 'crs-mobile-responsive', 'mod-mobile-responsive', 'Kenapa Mobile-First Itu Wajib', 'kenapa-mobile-first-itu-wajib', 'video', 'youtube', 'https://www.youtube.com/watch?v=dtti1pYUo34', 0, 1, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z'),
('les-mr-02', 'crs-mobile-responsive', 'mod-mobile-responsive', 'Cara Prompt AI Biar Hasilnya Langsung Responsive', 'cara-prompt-ai-biar-hasilnya-langsung-responsive', 'video', 'youtube', 'https://www.youtube.com/watch?v=VP9J1f1BbH8', 0, 2, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z'),
('les-mr-03', 'crs-mobile-responsive', 'mod-mobile-responsive', 'Cara Cek & Fix Responsiveness', 'cara-cek-fix-responsiveness', 'video', 'youtube', 'https://www.youtube.com/watch?v=QSbyyM4PLi4', 0, 3, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z'),
('les-mr-04', 'crs-mobile-responsive', 'mod-mobile-responsive', 'Testing di Berbagai Ukuran Layar', 'testing-di-berbagai-ukuran-layar', 'video', 'youtube', 'https://www.youtube.com/watch?v=pSt7hNxmTnw', 0, 4, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z'),
('les-mr-05', 'crs-mobile-responsive', 'mod-mobile-responsive', 'Responsive Design di Framer', 'responsive-design-di-framer', 'video', 'youtube', 'https://www.youtube.com/watch?v=sWr6mPQnMuU', 0, 5, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z'),
('les-mr-06', 'crs-mobile-responsive', 'mod-mobile-responsive', 'Fluid Layout di Framer', 'fluid-layout-di-framer', 'video', 'youtube', 'https://www.youtube.com/watch?v=FWyK1Kbc6GQ', 0, 6, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z'),
('les-mr-07', 'crs-mobile-responsive', 'mod-mobile-responsive', 'Breakpoints di Framer', 'breakpoints-di-framer', 'video', 'youtube', 'https://www.youtube.com/watch?v=-kpg_w7m1_8', 0, 7, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z');

-- ═══ KELAS 6 — Hosting & Deployment dengan Netlify (cat_02) ═══
INSERT OR IGNORE INTO courses (id, slug, title, short_description, thumbnail_url, level, instructor_name, access_type, price, status, sort_order, primary_category_id, learning_outcome, published_at, created_at, updated_at)
VALUES ('crs-netlify', 'hosting-deployment-dengan-netlify', 'Hosting & Deployment dengan Netlify',
  'Deploy website ke Netlify via GitHub maupun manual, lengkap dengan continuous deployment dan custom domain.',
  'https://pub-d56d873c4b8d4204b35361d7bea0dca8.r2.dev/Kelas/Hosting%20Dan%20Deployment%20dengan%20Netlify.png',
  'beginner', 'Irfan Akbar', 'free', 0, 'published', 15, 'cat_02',
  'User bisa deploy website ke Netlify via GitHub maupun manual, lengkap dengan custom domain.',
  '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z');

INSERT OR IGNORE INTO course_modules (id, course_id, title, sort_order, created_at, updated_at)
VALUES ('mod-netlify', 'crs-netlify', 'Materi Utama', 1, '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z');

INSERT OR IGNORE INTO lessons (id, course_id, module_id, title, slug, lesson_type, video_provider, video_url, is_preview, sort_order, status, created_at, updated_at) VALUES
('les-nf-01', 'crs-netlify', 'mod-netlify', 'Pengenalan Netlify', 'pengenalan-netlify', 'video', 'youtube', 'https://www.youtube.com/watch?v=Oqf3iByBpr0', 0, 1, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z'),
('les-nf-02', 'crs-netlify', 'mod-netlify', 'Proses Deploy via GitHub', 'proses-deploy-via-github', 'video', 'youtube', 'https://www.youtube.com/watch?v=2F1DfMwiqaY', 0, 2, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z'),
('les-nf-03', 'crs-netlify', 'mod-netlify', 'Proses Deploy Manual', 'proses-deploy-manual', 'video', 'youtube', 'https://www.youtube.com/watch?v=r_Wzc6GQEyU', 0, 3, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z'),
('les-nf-04', 'crs-netlify', 'mod-netlify', 'Continuous Deployment', 'continuous-deployment', 'video', 'youtube', 'https://www.youtube.com/watch?v=1JXj8TPBCUk', 0, 4, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z'),
('les-nf-05', 'crs-netlify', 'mod-netlify', 'Custom Domain Netlify', 'custom-domain-netlify', 'video', 'youtube', 'https://www.youtube.com/watch?v=OiSeDjrV6_s', 0, 5, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z');

-- ═══ KELAS 7 — Hosting & Deployment dengan Cloudflare Pages (cat_02) ═══
INSERT OR IGNORE INTO courses (id, slug, title, short_description, thumbnail_url, level, instructor_name, access_type, price, status, sort_order, primary_category_id, learning_outcome, published_at, created_at, updated_at)
VALUES ('crs-cf-pages', 'hosting-deployment-dengan-cloudflare-pages', 'Hosting & Deployment dengan Cloudflare Pages',
  'Deploy website ke Cloudflare Pages via GitHub maupun manual, lengkap dengan continuous deployment dan custom domain.',
  'https://pub-d56d873c4b8d4204b35361d7bea0dca8.r2.dev/Kelas/Hosting%20dan%20deployment%20dengan%20cloudflare%20Pages.png',
  'beginner', 'Irfan Akbar', 'free', 0, 'published', 16, 'cat_02',
  'User bisa deploy website ke Cloudflare Pages via GitHub maupun manual, lengkap dengan custom domain.',
  '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z');

INSERT OR IGNORE INTO course_modules (id, course_id, title, sort_order, created_at, updated_at)
VALUES ('mod-cf-pages', 'crs-cf-pages', 'Materi Utama', 1, '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z');

INSERT OR IGNORE INTO lessons (id, course_id, module_id, title, slug, lesson_type, video_provider, video_url, is_preview, sort_order, status, created_at, updated_at) VALUES
('les-cf-01', 'crs-cf-pages', 'mod-cf-pages', 'Introduction Cloudflare Pages', 'introduction-cloudflare-pages', 'video', 'youtube', 'https://www.youtube.com/watch?v=SrDhTyPdzG8', 0, 1, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z'),
('les-cf-02', 'crs-cf-pages', 'mod-cf-pages', 'Setup & Deployment via GitHub', 'setup-deployment-via-github', 'video', 'youtube', 'https://www.youtube.com/watch?v=SbQv1ZQSaLE', 0, 2, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z'),
('les-cf-03', 'crs-cf-pages', 'mod-cf-pages', 'Setup & Deployment Manual', 'setup-deployment-manual', 'video', 'youtube', 'https://www.youtube.com/watch?v=ECXeJKVEnF8', 0, 3, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z'),
('les-cf-04', 'crs-cf-pages', 'mod-cf-pages', 'Continuous Deployment Cloudflare Pages', 'continuous-deployment-cloudflare-pages', 'video', 'youtube', 'https://www.youtube.com/watch?v=wRXI--nPv4o', 0, 4, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z'),
('les-cf-05', 'crs-cf-pages', 'mod-cf-pages', 'Setting Custom Domain Cloudflare Pages', 'setting-custom-domain-cloudflare-pages', 'video', 'youtube', 'https://www.youtube.com/watch?v=9GA7nm81Kvg', 0, 5, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z');

-- ═══ KELAS 8 — AI Copywriting Landing Page (cat_04, sec cat_02) ═══
INSERT OR IGNORE INTO courses (id, slug, title, short_description, thumbnail_url, level, instructor_name, access_type, price, status, sort_order, primary_category_id, learning_outcome, published_at, created_at, updated_at)
VALUES ('crs-copy-landing', 'ai-copywriting-landing-page', 'AI Copywriting Landing Page',
  'Susun prompt AI untuk menghasilkan copywriting landing page yang menjual, dari framework dasar sampai prompt final.',
  'https://pub-d56d873c4b8d4204b35361d7bea0dca8.r2.dev/Kelas/Ai%20copywriting%20landingpage.png',
  'beginner', 'Irfan Akbar', 'free', 0, 'published', 17, 'cat_04',
  'User bisa menyusun prompt AI untuk menghasilkan copywriting landing page yang menjual.',
  '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z');

INSERT OR IGNORE INTO course_modules (id, course_id, title, sort_order, created_at, updated_at)
VALUES ('mod-copy-landing', 'crs-copy-landing', 'Materi Utama', 1, '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z');

INSERT OR IGNORE INTO lessons (id, course_id, module_id, title, slug, lesson_type, video_provider, video_url, is_preview, sort_order, status, created_at, updated_at) VALUES
('les-cl-01', 'crs-copy-landing', 'mod-copy-landing', 'Fundamental Prompt Engineering Copywriting', 'fundamental-prompt-engineering-copywriting', 'video', 'youtube', 'https://www.youtube.com/watch?v=q00FQ0uil2E', 0, 1, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z'),
('les-cl-02', 'crs-copy-landing', 'mod-copy-landing', 'Memahami Framework Copywriting Dasar', 'memahami-framework-copywriting-dasar', 'video', 'youtube', 'https://www.youtube.com/watch?v=Mhlry1_I0So', 0, 2, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z'),
('les-cl-03', 'crs-copy-landing', 'mod-copy-landing', 'Menyusun Prompt Copywriting Landing Page', 'menyusun-prompt-copywriting-landing-page', 'video', 'youtube', 'https://www.youtube.com/watch?v=HVTxDFdYh6A', 0, 3, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z');

-- ═══ KELAS 9 — AI Website Copywriting (cat_04, sec cat_06) ═══
INSERT OR IGNORE INTO courses (id, slug, title, short_description, thumbnail_url, level, instructor_name, access_type, price, status, sort_order, primary_category_id, learning_outcome, published_at, created_at, updated_at)
VALUES ('crs-copy-website', 'ai-website-copywriting', 'AI Website Copywriting',
  'Susun master prompt dan brand brief untuk copywriting seluruh halaman website dengan AI.',
  'https://pub-d56d873c4b8d4204b35361d7bea0dca8.r2.dev/Kelas/Ai%20Website%20Copywriting.png',
  'beginner', 'Irfan Akbar', 'free', 0, 'published', 18, 'cat_04',
  'User bisa menyusun master prompt dan brand brief untuk copywriting seluruh halaman website.',
  '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z');

INSERT OR IGNORE INTO course_modules (id, course_id, title, sort_order, created_at, updated_at)
VALUES ('mod-copy-website', 'crs-copy-website', 'Materi Utama', 1, '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z');

INSERT OR IGNORE INTO lessons (id, course_id, module_id, title, slug, lesson_type, video_provider, video_url, is_preview, sort_order, status, created_at, updated_at) VALUES
('les-cw-01', 'crs-copy-website', 'mod-copy-website', 'Perbedaan AI Copywriting Landing Page vs Website', 'perbedaan-ai-copywriting-landing-page-vs-website', 'video', 'youtube', 'https://www.youtube.com/watch?v=gRhRqrEnbmA', 0, 1, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z'),
('les-cw-02', 'crs-copy-website', 'mod-copy-website', 'Menyusun Master Prompt Copywriting Website', 'menyusun-master-prompt-copywriting-website', 'video', 'youtube', 'https://www.youtube.com/watch?v=dmN0MolSpFU', 0, 2, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z'),
('les-cw-03', 'crs-copy-website', 'mod-copy-website', 'Menyusun Brand Brief Website', 'menyusun-brand-brief-website', 'video', 'youtube', 'https://www.youtube.com/watch?v=VNFPe-h1Gbs', 0, 3, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z'),
('les-cw-04', 'crs-copy-website', 'mod-copy-website', 'Treatment Halaman Website AI Copywriting', 'treatment-halaman-website-ai-copywriting', 'video', 'youtube', 'https://www.youtube.com/watch?v=IU1wokbX4ZE', 0, 4, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z'),
('les-cw-05', 'crs-copy-website', 'mod-copy-website', 'Final Prompt AI Copywriting Website', 'final-prompt-ai-copywriting-website', 'video', 'youtube', 'https://www.youtube.com/watch?v=xLNPnz1Q0yc', 0, 5, 'published', '2026-06-11T06:38:53.000Z', '2026-06-11T06:38:53.000Z');

-- ═══ Mapping kategori (primary + secondary) ═══
INSERT OR IGNORE INTO content_categories (content_type, ref_id, category_id, is_primary, created_at) VALUES
('course', 'crs-framer-layout',     'cat_02', 1, '2026-06-11T06:38:53.000Z'),
('course', 'crs-framer-layout',     'cat_03', 0, '2026-06-11T06:38:53.000Z'),
('course', 'crs-mobile-responsive', 'cat_02', 1, '2026-06-11T06:38:53.000Z'),
('course', 'crs-netlify',           'cat_02', 1, '2026-06-11T06:38:53.000Z'),
('course', 'crs-cf-pages',          'cat_02', 1, '2026-06-11T06:38:53.000Z'),
('course', 'crs-copy-landing',      'cat_04', 1, '2026-06-11T06:38:53.000Z'),
('course', 'crs-copy-landing',      'cat_02', 0, '2026-06-11T06:38:53.000Z'),
('course', 'crs-copy-website',      'cat_04', 1, '2026-06-11T06:38:53.000Z'),
('course', 'crs-copy-website',      'cat_06', 0, '2026-06-11T06:38:53.000Z');

-- ═══ Sync registry content_items (discovery /kelas & explore) ═══
INSERT OR IGNORE INTO content_items (id, content_type, ref_id, slug, title, description, thumbnail_url, format, level, access_type, price, priority_score, is_featured, status, search_text, published_at, created_at, updated_at)
SELECT 'course:' || id, 'course', id, slug, title, short_description, thumbnail_url, 'kelas', level, access_type, price, 0, 0, status, lower(title || ' ' || COALESCE(short_description, '')), published_at, created_at, updated_at
FROM courses
WHERE id IN ('crs-framer-layout', 'crs-mobile-responsive', 'crs-netlify', 'crs-cf-pages', 'crs-copy-landing', 'crs-copy-website');
