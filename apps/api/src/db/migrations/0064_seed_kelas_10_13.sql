-- Seed Kelas 10-13 (lanjutan seri vibecoding): Visual Asset Generation, Merging AI Result,
-- Anti AI Looks, Framer Advance. Semua Free + published, instruktur Irfan Akbar.
-- 1 modul 'Materi Utama' per kelas, lesson video YouTube.

-- ═══ AI Visual Asset Generation (cat_03/cat_02) ═══
INSERT OR IGNORE INTO courses (id, slug, title, short_description, description, thumbnail_url, level, instructor_name, access_type, price, status, sort_order, priority_score, primary_category_id, learning_outcome, recommended_for, published_at, created_at, updated_at) VALUES (
  'crs-visual-asset', 'ai-visual-asset-generation', 'AI Visual Asset Generation',
  'Hasilkan aset visual untuk landing page & website dengan AI — dari fundamental desain visual sampai menyusun prompt engineering visual yang presisi.',
  'Pelajari cara menghasilkan aset visual untuk landing page dan website menggunakan AI. Mulai dari fundamental desain visual, memahami prompt engineering khusus visual design, hingga menyusun prompt yang presisi agar AI menghasilkan visual yang sesuai kebutuhan dan estetika website-mu.',
  'https://pub-d56d873c4b8d4204b35361d7bea0dca8.r2.dev/Kelas/Ai%20visual%20Asset%20Generation.webp',
  'intermediate', 'Irfan Akbar', 'free', 0, 'published', 12, 89, 'cat_03',
  'User bisa menghasilkan aset visual landing page/website yang rapi dan relevan menggunakan AI, lewat fundamental desain visual dan prompt engineering visual.',
  'Pembuat website/landing page yang ingin menghasilkan aset visual berkualitas dengan AI.',
  '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z');
INSERT OR IGNORE INTO course_modules (id, course_id, title, sort_order, created_at, updated_at) VALUES
  ('mod-visual-asset', 'crs-visual-asset', 'Materi Utama', 1, '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z');
INSERT OR IGNORE INTO lessons (id, course_id, module_id, title, slug, lesson_type, video_provider, video_url, is_preview, sort_order, status, created_at, updated_at) VALUES
  ('les-visual-asset-01', 'crs-visual-asset', 'mod-visual-asset', 'Visual Design Fundamental Landing Page atau Website', 'visual-design-fundamental-landing-page-atau-website', 'video', 'youtube', 'https://www.youtube.com/watch?v=QTLLqzXcQ3A', 1, 1, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z'),
  ('les-visual-asset-02', 'crs-visual-asset', 'mod-visual-asset', 'Fundamental Prompt Engineering Visual Design Landing Page atau Website', 'fundamental-prompt-engineering-visual-design-landing-page-atau-website', 'video', 'youtube', 'https://www.youtube.com/watch?v=qCQtd5Nmh1Q', 0, 2, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z'),
  ('les-visual-asset-03', 'crs-visual-asset', 'mod-visual-asset', 'Menyusun Prompt Engineering Visual Design AI Landing Page atau Website', 'menyusun-prompt-engineering-visual-design-ai-landing-page-atau-website', 'video', 'youtube', 'https://www.youtube.com/watch?v=d5t6nAvf3yk', 0, 3, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z');
INSERT OR IGNORE INTO content_categories (content_type, ref_id, category_id, is_primary, created_at) VALUES
  ('course', 'crs-visual-asset', 'cat_03', 1, '2026-06-14T00:00:00.000Z'),
  ('course', 'crs-visual-asset', 'cat_02', 0, '2026-06-14T00:00:00.000Z');

-- ═══ Merging AI Result (cat_02/cat_03) ═══
INSERT OR IGNORE INTO courses (id, slug, title, short_description, description, thumbnail_url, level, instructor_name, access_type, price, status, sort_order, priority_score, primary_category_id, learning_outcome, recommended_for, published_at, created_at, updated_at) VALUES (
  'crs-merging-ai', 'merging-ai-result', 'Merging AI Result',
  'Gabungkan hasil AI desain + copywriting jadi satu landing page/website utuh, lalu deploy ke Netlify & Cloudflare.',
  'Satukan hasil AI desain dan copywriting menjadi landing page maupun website yang utuh dan siap pakai. Kelas ini membahas proses merge untuk landing page dan website, lalu menuntunmu melakukan deployment final ke Netlify dan Cloudflare hingga situs benar-benar online.',
  'https://pub-d56d873c4b8d4204b35361d7bea0dca8.r2.dev/Kelas/Merging%20Ai%20Result.webp',
  'intermediate', 'Irfan Akbar', 'free', 0, 'published', 13, 88, 'cat_02',
  'User bisa menggabungkan output AI (desain + copywriting) menjadi landing page/website final dan men-deploy-nya ke Netlify maupun Cloudflare.',
  'User yang sudah punya hasil desain & copywriting AI dan ingin menyatukannya jadi website final yang siap online.',
  '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z');
INSERT OR IGNORE INTO course_modules (id, course_id, title, sort_order, created_at, updated_at) VALUES
  ('mod-merging-ai', 'crs-merging-ai', 'Materi Utama', 1, '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z');
INSERT OR IGNORE INTO lessons (id, course_id, module_id, title, slug, lesson_type, video_provider, video_url, is_preview, sort_order, status, created_at, updated_at) VALUES
  ('les-merging-ai-01', 'crs-merging-ai', 'mod-merging-ai', 'Merge AI Landing Page (Design + Copywriting)', 'merge-ai-landing-page-design-copywriting', 'video', 'youtube', 'https://www.youtube.com/watch?v=9EdfpTcSHvo', 1, 1, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z'),
  ('les-merging-ai-02', 'crs-merging-ai', 'mod-merging-ai', 'Merge AI Website (Design + Copywriting)', 'merge-ai-website-design-copywriting', 'video', 'youtube', 'https://www.youtube.com/watch?v=GRT3p-d00Gg', 0, 2, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z'),
  ('les-merging-ai-03', 'crs-merging-ai', 'mod-merging-ai', 'Final Deployment on Netlify', 'final-deployment-on-netlify', 'video', 'youtube', 'https://www.youtube.com/watch?v=R2QF4czEm24', 0, 3, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z'),
  ('les-merging-ai-04', 'crs-merging-ai', 'mod-merging-ai', 'Final Deployment on Cloudflare', 'final-deployment-on-cloudflare', 'video', 'youtube', 'https://www.youtube.com/watch?v=6S00YP58uT0', 0, 4, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z');
INSERT OR IGNORE INTO content_categories (content_type, ref_id, category_id, is_primary, created_at) VALUES
  ('course', 'crs-merging-ai', 'cat_02', 1, '2026-06-14T00:00:00.000Z'),
  ('course', 'crs-merging-ai', 'cat_03', 0, '2026-06-14T00:00:00.000Z');

-- ═══ Anti AI Looks (cat_02/cat_03) ═══
INSERT OR IGNORE INTO courses (id, slug, title, short_description, description, thumbnail_url, level, instructor_name, access_type, price, status, sort_order, priority_score, primary_category_id, learning_outcome, recommended_for, published_at, created_at, updated_at) VALUES (
  'crs-anti-ai-looks', 'anti-ai-looks', 'Anti AI Looks',
  'Buat website hasil AI tidak terlihat ''AI banget'' — humanizing copywriting, perbaikan visual generic, sampai compliance WCAG.',
  'Hilangkan kesan ''AI banget'' dari website hasil AI agar tampil unik dan profesional. Kamu akan belajar mengenali ciri website yang terlalu generic, humanizing copywriting agar terdengar natural, memperbaiki visual AI (font, spacing, warna), memenuhi standar aksesibilitas WCAG, hingga checklist final keunikan website.',
  'https://pub-d56d873c4b8d4204b35361d7bea0dca8.r2.dev/Kelas/Anti%20Ai%20looks.webp',
  'intermediate', 'Irfan Akbar', 'free', 0, 'published', 14, 87, 'cat_02',
  'User bisa membuat website/landing page hasil AI tampak unik dan natural — copywriting yang manusiawi, visual non-generic, dan memenuhi standar WCAG.',
  'User yang websitenya masih terasa generic/AI dan ingin tampil unik & profesional.',
  '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z');
INSERT OR IGNORE INTO course_modules (id, course_id, title, sort_order, created_at, updated_at) VALUES
  ('mod-anti-ai-looks', 'crs-anti-ai-looks', 'Materi Utama', 1, '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z');
INSERT OR IGNORE INTO lessons (id, course_id, module_id, title, slug, lesson_type, video_provider, video_url, is_preview, sort_order, status, created_at, updated_at) VALUES
  ('les-anti-ai-looks-01', 'crs-anti-ai-looks', 'mod-anti-ai-looks', 'Kenapa Website AI Kelihatan "AI Banget" & Apa yang Harus Diubah', 'kenapa-website-ai-kelihatan-ai-banget-dan-apa-yang-harus-diubah', 'video', 'youtube', 'https://www.youtube.com/watch?v=YnDO7LYD1zo', 1, 1, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z'),
  ('les-anti-ai-looks-02', 'crs-anti-ai-looks', 'mod-anti-ai-looks', 'Humanizing Copywriting: Dari Robotic Jadi Natural', 'humanizing-copywriting-dari-robotic-jadi-natural', 'video', 'youtube', 'https://www.youtube.com/watch?v=V_GbMGg6R3g', 0, 2, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z'),
  ('les-anti-ai-looks-03', 'crs-anti-ai-looks', 'mod-anti-ai-looks', 'Fixing Visual AI yang Terlalu Generic (Font, Spacing, Warna)', 'fixing-visual-ai-yang-terlalu-generic-font-spacing-warna', 'video', 'youtube', 'https://www.youtube.com/watch?v=aGad5us0DO0', 0, 3, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z'),
  ('les-anti-ai-looks-04', 'crs-anti-ai-looks', 'mod-anti-ai-looks', 'WCAG Compliant Website dan Landing Page', 'wcag-compliant-website-dan-landing-page', 'video', 'youtube', 'https://www.youtube.com/watch?v=jsXAnOc530k', 0, 4, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z'),
  ('les-anti-ai-looks-05', 'crs-anti-ai-looks', 'mod-anti-ai-looks', 'Final Checklist: Sudah Unique dan Tidak Pakai Template AI Belum?', 'final-checklist-sudah-unique-dan-tidak-pakai-template-ai-belum', 'video', 'youtube', 'https://www.youtube.com/watch?v=TrSepvmcpwo', 0, 5, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z');
INSERT OR IGNORE INTO content_categories (content_type, ref_id, category_id, is_primary, created_at) VALUES
  ('course', 'crs-anti-ai-looks', 'cat_02', 1, '2026-06-14T00:00:00.000Z'),
  ('course', 'crs-anti-ai-looks', 'cat_03', 0, '2026-06-14T00:00:00.000Z');

-- ═══ Framer Advance (cat_02/cat_03) ═══
INSERT OR IGNORE INTO courses (id, slug, title, short_description, description, thumbnail_url, level, instructor_name, access_type, price, status, sort_order, priority_score, primary_category_id, learning_outcome, recommended_for, published_at, created_at, updated_at) VALUES (
  'crs-framer-advance', 'framer-advance', 'Framer Advance',
  'Kuasai Framer tingkat lanjut: hero, pricing, navigation, components, plugin, sampai custom domain untuk website profesional.',
  'Naik level di Framer dari dasar ke tingkat lanjut. Kelas ini membahas pembuatan setiap bagian website profesional — hero, feature-benefit, navigasi, katalog produk, pricing, FAQ, footer — plus komponen, plugin penting, interaksi (hamburger menu, lightbox, carousel), pengaturan situs, hingga publish dengan custom domain.',
  'https://pub-d56d873c4b8d4204b35361d7bea0dca8.r2.dev/Kelas/Framer%20Advance.webp',
  'advanced', 'Irfan Akbar', 'free', 0, 'published', 15, 86, 'cat_02',
  'User menguasai pembuatan website profesional di Framer tingkat lanjut — dari section utama, komponen, interaksi, hingga publish dengan custom domain.',
  'User yang sudah paham dasar Framer dan ingin naik ke level lanjut membangun website lengkap.',
  '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z');
INSERT OR IGNORE INTO course_modules (id, course_id, title, sort_order, created_at, updated_at) VALUES
  ('mod-framer-advance', 'crs-framer-advance', 'Materi Utama', 1, '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z');
INSERT OR IGNORE INTO lessons (id, course_id, module_id, title, slug, lesson_type, video_provider, video_url, is_preview, sort_order, status, created_at, updated_at) VALUES
  ('les-framer-advance-01', 'crs-framer-advance', 'mod-framer-advance', 'Hero Creation in Framer', 'hero-creation-in-framer', 'video', 'youtube', 'https://www.youtube.com/watch?v=p2LyDf-9Ejo', 1, 1, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z'),
  ('les-framer-advance-02', 'crs-framer-advance', 'mod-framer-advance', 'Feature-Benefit Creation in Framer', 'feature-benefit-creation-in-framer', 'video', 'youtube', 'https://www.youtube.com/watch?v=n8HSwmkTIP8', 0, 2, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z'),
  ('les-framer-advance-03', 'crs-framer-advance', 'mod-framer-advance', 'Menu Navigation Creation in Framer', 'menu-navigation-creation-in-framer', 'video', 'youtube', 'https://www.youtube.com/watch?v=ZnSGS5TE5YI', 0, 3, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z'),
  ('les-framer-advance-04', 'crs-framer-advance', 'mod-framer-advance', 'Product Catalog Creation in Framer', 'product-catalog-creation-in-framer', 'video', 'youtube', 'https://www.youtube.com/watch?v=I-flY4GYD8E', 0, 4, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z'),
  ('les-framer-advance-05', 'crs-framer-advance', 'mod-framer-advance', 'Pricing Section Creation in Framer', 'pricing-section-creation-in-framer', 'video', 'youtube', 'https://www.youtube.com/watch?v=Esxj9Ve20WU', 0, 5, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z'),
  ('les-framer-advance-06', 'crs-framer-advance', 'mod-framer-advance', 'Click-to-Scroll Section in Framer', 'click-to-scroll-section-in-framer', 'video', 'youtube', 'https://www.youtube.com/watch?v=nbxUTaSnDdE', 0, 6, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z'),
  ('les-framer-advance-07', 'crs-framer-advance', 'mod-framer-advance', 'Site & Page Settings', 'site-dan-page-settings', 'video', 'youtube', 'https://www.youtube.com/watch?v=_bxplQyXhOs', 0, 7, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z'),
  ('les-framer-advance-08', 'crs-framer-advance', 'mod-framer-advance', 'Copy Landing Page to Another Page', 'copy-landing-page-to-another-page', 'video', 'youtube', 'https://www.youtube.com/watch?v=jZlOOjgJx3Y', 0, 8, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z'),
  ('les-framer-advance-09', 'crs-framer-advance', 'mod-framer-advance', 'FAQ Creation', 'faq-creation', 'video', 'youtube', 'https://www.youtube.com/watch?v=KZFazXRXscw', 0, 9, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z'),
  ('les-framer-advance-10', 'crs-framer-advance', 'mod-framer-advance', 'Footer Creation in Framer', 'footer-creation-in-framer', 'video', 'youtube', 'https://www.youtube.com/watch?v=S9pIW9nfzH8', 0, 10, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z'),
  ('les-framer-advance-11', 'crs-framer-advance', 'mod-framer-advance', 'Plugin Penting di Framer', 'plugin-penting-di-framer', 'video', 'youtube', 'https://www.youtube.com/watch?v=OoUg7wlrnV8', 0, 11, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z'),
  ('les-framer-advance-12', 'crs-framer-advance', 'mod-framer-advance', 'Components in Framer', 'components-in-framer', 'video', 'youtube', 'https://www.youtube.com/watch?v=6m7qtVBVukk', 0, 12, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z'),
  ('les-framer-advance-13', 'crs-framer-advance', 'mod-framer-advance', 'Hamburger Menu', 'hamburger-menu', 'video', 'youtube', 'https://www.youtube.com/watch?v=_NZO_78pOL4', 0, 13, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z'),
  ('les-framer-advance-14', 'crs-framer-advance', 'mod-framer-advance', 'Image Lightbox', 'image-lightbox', 'video', 'youtube', 'https://www.youtube.com/watch?v=VRVaJgp9WXk', 0, 14, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z'),
  ('les-framer-advance-15', 'crs-framer-advance', 'mod-framer-advance', 'Carousel in Framer', 'carousel-in-framer', 'video', 'youtube', 'https://www.youtube.com/watch?v=fi03nkYKUYg', 0, 15, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z'),
  ('les-framer-advance-16', 'crs-framer-advance', 'mod-framer-advance', 'Layout Templates', 'layout-templates', 'video', 'youtube', 'https://www.youtube.com/watch?v=oQxZL_UhX0o', 0, 16, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z'),
  ('les-framer-advance-17', 'crs-framer-advance', 'mod-framer-advance', 'Custom Domain', 'custom-domain', 'video', 'youtube', 'https://www.youtube.com/watch?v=T6GFpJ7D0Og', 0, 17, 'published', '2026-06-14T00:00:00.000Z', '2026-06-14T00:00:00.000Z');
INSERT OR IGNORE INTO content_categories (content_type, ref_id, category_id, is_primary, created_at) VALUES
  ('course', 'crs-framer-advance', 'cat_02', 1, '2026-06-14T00:00:00.000Z'),
  ('course', 'crs-framer-advance', 'cat_03', 0, '2026-06-14T00:00:00.000Z');

-- ═══ Sync registry content_items ═══
INSERT OR IGNORE INTO content_items (id, content_type, ref_id, slug, title, description, thumbnail_url, format, level, access_type, price, priority_score, is_featured, status, search_text, published_at, created_at, updated_at)
SELECT 'course:' || id, 'course', id, slug, title, short_description, thumbnail_url, 'kelas', level, access_type, price, COALESCE(priority_score,0), COALESCE(is_featured,0), status, lower(title || ' ' || COALESCE(short_description,'')), published_at, created_at, updated_at
FROM courses WHERE id IN ('crs-visual-asset','crs-merging-ai','crs-anti-ai-looks','crs-framer-advance');

