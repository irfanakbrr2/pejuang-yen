-- Content Taxonomy: 9 kategori utama untuk Kelas & Bonus
-- (docs/content-taxonomy-plan.md)
-- Category = topik. Content Type = bentuk. Asset Type (bonus) = jenis aset.
-- bonus_type lama TETAP sebagai format delivery (content/bundle/mini_course)
-- karena menggerakkan logika UI; jenis aset hidup di kolom baru asset_type.

-- 1. Kategori utama (9 seed, slug stabil — tidak ada CRUD admin)
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

INSERT OR IGNORE INTO categories (id, slug, name, description, icon, sort_order) VALUES
  ('cat_01', 'ai-fundamentals-prompting',  'AI Fundamentals & Prompting',           'Dasar AI, cara kerja LLM, dan teknik prompting.', 'sparkles', 1),
  ('cat_02', 'vibecoding-web-dev',         'Vibecoding & Web Dev',                  'Website, landing page, web app, coding, dan deployment dengan AI.', 'code', 2),
  ('cat_03', 'vibe-design-visual',         'Vibe Design & Visual Creation',         'Desain, poster, thumbnail, UI, brand kit, dan image asset dengan AI.', 'palette', 3),
  ('cat_04', 'vibe-marketing-sales-growth','Vibe Marketing, Sales & Growth',        'Traffic, leads, funnel, closing, ads, email, dan revenue growth.', 'trending-up', 4),
  ('cat_05', 'ai-automation-workflow',     'AI Automation & Workflow',              'Sistem otomatis, workflow, API, webhook, n8n, Zapier, dan CRM.', 'workflow', 5),
  ('cat_06', 'content-creation-branding',  'Content Creation & Personal Branding',  'Konten, storytelling, script, audience building, dan personal brand.', 'megaphone', 6),
  ('cat_07', 'business-monetization',      'Business, Monetization & Solopreneurship', 'Bisnis sendiri, digital product, offer, agency, dan monetisasi.', 'briefcase', 7),
  ('cat_08', 'career-freelance-portfolio', 'Career, Freelance & Portfolio',         'Karier, freelance, portfolio, CV, LinkedIn, client, dan interview.', 'user-check', 8),
  ('cat_09', 'productivity-learning',      'Productivity, Learning & Self-Development', 'Cara belajar, bekerja, berpikir, riset, dan sistem pribadi.', 'brain', 9);

-- 2. Mapping konten <-> kategori. Keyed langsung ke (content_type, ref_id)
--    agar bekerja untuk course/bonus sekarang dan recording/tool nanti
--    tanpa bergantung pada sinkronisasi registry.
--    Aturan (divalidasi di API): tepat 1 primary, maksimal 2 secondary.
CREATE TABLE IF NOT EXISTS content_categories (
  content_type TEXT NOT NULL,           -- 'course' | 'bonus' | (future: 'recording' | 'tool')
  ref_id TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id),
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (content_type, ref_id, category_id)
);
CREATE INDEX IF NOT EXISTS idx_cc_category ON content_categories(category_id);

-- 3. Kolom baru di tabel sumber (primary denormalized untuk query list cepat)
ALTER TABLE courses ADD COLUMN primary_category_id TEXT REFERENCES categories(id);
ALTER TABLE courses ADD COLUMN learning_outcome TEXT;
ALTER TABLE courses ADD COLUMN recommended_for TEXT;
ALTER TABLE courses ADD COLUMN duration_minutes INTEGER;

ALTER TABLE bonuses ADD COLUMN primary_category_id TEXT REFERENCES categories(id);
ALTER TABLE bonuses ADD COLUMN asset_type TEXT;     -- 12 jenis aset (ebook, checklist, ...)
ALTER TABLE bonuses ADD COLUMN recommended_for TEXT;
ALTER TABLE bonuses ADD COLUMN related_course_id TEXT REFERENCES courses(id);

-- 4. Normalisasi akses: 2 tier (free / premium=membership_only).
--    Pembelian satuan lama tetap dihormati lewat user_access (tidak disentuh).
UPDATE courses SET access_type = 'membership_only' WHERE access_type = 'paid';

-- 5. Migrasi kategori kelas eksisting (mapping by judul, urutan penting:
--    rule paling spesifik dulu, guard primary_category_id IS NULL)
UPDATE courses SET primary_category_id = 'cat_01' WHERE primary_category_id IS NULL AND title LIKE '%Prompting%';
UPDATE courses SET primary_category_id = 'cat_04' WHERE primary_category_id IS NULL AND title LIKE '%Marketing%';
UPDATE courses SET primary_category_id = 'cat_02' WHERE primary_category_id IS NULL AND (
  title LIKE '%Vibecoding%' OR title LIKE '%Website%' OR title LIKE '%GitHub%' OR title LIKE '%Web %' OR title LIKE '%Web Modern%'
);
UPDATE courses SET primary_category_id = 'cat_07' WHERE primary_category_id IS NULL AND (
  title LIKE '%Solo%Preneur%' OR title LIKE '%Bussines%' OR title LIKE '%Business%' OR title LIKE '%Bisnis%'
);

-- 6. Migrasi bonus: jenis aset lama yang tersimpan di bonus_type dipindah ke
--    asset_type, lalu bonus_type dinormalisasi ke format delivery.
UPDATE bonuses SET asset_type = bonus_type WHERE bonus_type IN ('ebook', 'prompt_pack');
UPDATE bonuses SET bonus_type = CASE
    WHEN EXISTS (SELECT 1 FROM bonus_files bf WHERE bf.bonus_id = bonuses.id) THEN 'bundle'
    ELSE 'content'
  END
  WHERE bonus_type IN ('ebook', 'prompt_pack');

-- Bonus published yang dikenal (mapping by judul)
UPDATE bonuses SET primary_category_id = 'cat_01' WHERE primary_category_id IS NULL AND (
  title LIKE '%Prompt Template%' OR title LIKE '%Panduan AI Tools%'
);

-- 7. Seed content_categories dari primary yang sudah terisi
INSERT OR IGNORE INTO content_categories (content_type, ref_id, category_id, is_primary, created_at)
  SELECT 'course', id, primary_category_id, 1, datetime('now') FROM courses WHERE primary_category_id IS NOT NULL;
INSERT OR IGNORE INTO content_categories (content_type, ref_id, category_id, is_primary, created_at)
  SELECT 'bonus', id, primary_category_id, 1, datetime('now') FROM bonuses WHERE primary_category_id IS NOT NULL;
