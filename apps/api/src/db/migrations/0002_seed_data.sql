-- Pejuang Yen — Seed Data (Editable via Admin)

-- Admin user (login: admin@pejuangyen.com / AdminPejuangYen#2026 — GANTI password setelah login pertama)
INSERT OR IGNORE INTO users (id, email, password_hash, name, role, status, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@pejuangyen.com',
  'pbkdf2:100000:f7ce126cc74176c24149659493eccce9:b2211764cf7e6ad7a2244a62222e7f0f38889e1ed0766fce70cbdf53bcf4f0f4',
  'Admin Pejuang Yen',
  'super_admin',
  'active',
  '2026-01-01T00:00:00.000Z',
  '2026-01-01T00:00:00.000Z'
);

-- Membership Plans
INSERT OR IGNORE INTO membership_plans (id, slug, name, description, duration_type, duration_days, price, compare_at_price, status, sort_order, created_at, updated_at)
VALUES
  ('plan-monthly', 'monthly', 'Membership Bulanan', 'Akses semua kelas selama 30 hari', 'monthly', 30, 99000, 149000, 'active', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('plan-yearly', 'yearly', 'Membership Tahunan', 'Akses semua kelas selama 365 hari', 'yearly', 365, 799000, 1499000, 'active', 2, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('plan-lifetime', 'lifetime', 'Membership Lifetime', 'Akses semua kelas selamanya', 'lifetime', NULL, 1999000, 3999000, 'active', 3, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

-- Demo Courses
INSERT OR IGNORE INTO courses (id, slug, title, subtitle, short_description, description, level, category, instructor_name, access_type, price, compare_at_price, status, sort_order, published_at, created_at, updated_at)
VALUES
  ('course-001', 'ai-untuk-pemula', 'AI untuk Pemula', 'Mulai perjalanan AI Anda dari nol', 'Pelajari dasar-dasar AI dan cara menggunakannya untuk produktivitas sehari-hari', 'Kelas ini dirancang khusus untuk pemula yang ingin memahami AI dari dasar. Anda akan belajar konsep fundamental AI, cara menggunakan ChatGPT, dan bagaimana AI bisa meningkatkan produktivitas kerja Anda.', 'beginner', 'AI Basics', 'Pejuang Yen Team', 'free', 0, NULL, 'published', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('course-002', 'prompt-engineering-masterclass', 'Prompt Engineering Masterclass', 'Kuasai seni menulis prompt yang efektif', 'Teknik advanced untuk membuat prompt yang menghasilkan output berkualitas tinggi', 'Masterclass lengkap tentang prompt engineering. Dari teknik dasar hingga advanced, Anda akan belajar cara menulis prompt yang menghasilkan output berkualitas tinggi dari berbagai AI model.', 'intermediate', 'Prompt Engineering', 'Pejuang Yen Team', 'paid', 299000, 499000, 'published', 2, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('course-003', 'ai-untuk-bisnis', 'AI untuk Bisnis & Marketing', 'Transformasi bisnis Anda dengan AI', 'Strategi implementasi AI untuk meningkatkan revenue dan efisiensi bisnis', 'Pelajari cara mengintegrasikan AI ke dalam strategi bisnis dan marketing. Dari content creation hingga data analysis, kelas ini akan mengajarkan cara praktis menggunakan AI untuk mengembangkan bisnis.', 'intermediate', 'Business', 'Pejuang Yen Team', 'membership_only', 0, NULL, 'published', 3, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

-- Demo Modules
INSERT OR IGNORE INTO course_modules (id, course_id, title, description, sort_order, created_at, updated_at)
VALUES
  ('mod-001', 'course-001', 'Pengenalan AI', 'Memahami dasar-dasar Artificial Intelligence', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('mod-002', 'course-001', 'Menggunakan ChatGPT', 'Praktek langsung dengan ChatGPT', 2, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('mod-003', 'course-002', 'Fondasi Prompt Engineering', 'Memahami cara kerja prompt', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('mod-004', 'course-002', 'Teknik Advanced', 'Prompt chaining, few-shot, dan CoT', 2, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('mod-005', 'course-003', 'AI dalam Marketing', 'Content, social media, dan email marketing dengan AI', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

-- Demo Lessons
INSERT OR IGNORE INTO lessons (id, course_id, module_id, title, slug, lesson_type, video_provider, video_url, content_markdown, is_preview, sort_order, status, created_at, updated_at)
VALUES
  ('lesson-001', 'course-001', 'mod-001', 'Apa itu AI?', 'apa-itu-ai', 'video', 'youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', '# Apa itu AI?\n\nArtificial Intelligence (AI) adalah teknologi yang memungkinkan mesin untuk belajar dan membuat keputusan.', 1, 1, 'published', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('lesson-002', 'course-001', 'mod-001', 'Sejarah AI', 'sejarah-ai', 'video', 'youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', '# Sejarah AI\n\nAI telah berkembang sejak tahun 1950-an.', 0, 2, 'published', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('lesson-003', 'course-001', 'mod-002', 'Setup ChatGPT', 'setup-chatgpt', 'video', 'youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', '# Setup ChatGPT\n\nLangkah-langkah membuat akun dan mulai menggunakan ChatGPT.', 1, 1, 'published', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('lesson-004', 'course-002', 'mod-003', 'Anatomy of a Prompt', 'anatomy-of-prompt', 'video', 'youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', '# Anatomy of a Prompt\n\nMemahami struktur dan komponen prompt yang efektif.', 1, 1, 'published', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('lesson-005', 'course-002', 'mod-004', 'Chain of Thought', 'chain-of-thought', 'video', 'youtube', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', '# Chain of Thought Prompting\n\nTeknik untuk membuat AI berpikir step-by-step.', 0, 1, 'published', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

-- Demo Bonuses
INSERT OR IGNORE INTO bonuses (id, slug, title, description, bonus_type, access_type, status, sort_order, published_at, created_at, updated_at)
VALUES
  ('bonus-001', '100-prompt-templates', '100+ Prompt Templates', 'Koleksi 100+ template prompt siap pakai untuk berbagai kebutuhan', 'prompt_pack', 'membership_only', 'published', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'),
  ('bonus-002', 'ai-tools-guide', 'Panduan AI Tools 2026', 'Daftar lengkap AI tools terbaik untuk produktivitas', 'ebook', 'membership_only', 'published', 2, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z');

-- App Settings (Mayar config via admin)
INSERT OR IGNORE INTO app_settings (key, value_json, updated_at)
VALUES
  ('mayar_api_key', '""', '2026-01-01T00:00:00.000Z'),
  ('mayar_webhook_secret', '""', '2026-01-01T00:00:00.000Z'),
  ('mayar_api_url', '"https://api.mayar.id/hl/v1"', '2026-01-01T00:00:00.000Z'),
  ('affiliate_cookie_days', '30', '2026-01-01T00:00:00.000Z'),
  ('default_commission_rate', '10', '2026-01-01T00:00:00.000Z'),
  ('site_name', '"Pejuang Yen"', '2026-01-01T00:00:00.000Z'),
  ('site_description', '"Platform belajar & membership untuk Pejuang Yen"', '2026-01-01T00:00:00.000Z'),
  ('creator_store_enabled', 'false', '2026-01-01T00:00:00.000Z');
