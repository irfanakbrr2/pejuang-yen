-- Skills Taxonomy + Managed Tag Vocabulary
-- Curated skill categories (multi-skill per content) + free-form tag layer.
-- Joins target content_items (registry) so every content type participates.

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,                 -- stable seeded ids: 'skill_marketing' ...
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,                           -- lucide icon name for SkillCard
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS content_skills (
  content_id TEXT NOT NULL REFERENCES content_items(id),
  skill_id TEXT NOT NULL REFERENCES skills(id),
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (content_id, skill_id)
);
CREATE INDEX IF NOT EXISTS idx_content_skills_skill ON content_skills(skill_id);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS content_tags (
  content_id TEXT NOT NULL REFERENCES content_items(id),
  tag_id TEXT NOT NULL REFERENCES tags(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (content_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_content_tags_tag ON content_tags(tag_id);

-- Seed curated skills
INSERT OR IGNORE INTO skills (id, slug, name, description, icon, sort_order) VALUES
  ('skill_start_here',   'mulai-dari-nol',   'Mulai dari Nol',          'Fondasi AI untuk pemula',                   'Sparkles',   1),
  ('skill_productivity', 'produktivitas',    'Produktivitas',           'Kerja lebih cepat dengan AI',               'Zap',        2),
  ('skill_content',      'konten-kreatif',   'Konten & Copywriting',    'Bikin konten, copy, dan kreatif dengan AI', 'PenTool',    3),
  ('skill_marketing',    'marketing',        'Marketing',               'Digital marketing, ads, dan funnel',        'Megaphone',  4),
  ('skill_automation',   'otomasi',          'Otomasi & Workflow',      'Otomasi pekerjaan dan integrasi tools',     'Workflow',   5),
  ('skill_business',     'bisnis',           'Bisnis & UMKM',           'Strategi bisnis dan operasional dengan AI', 'Briefcase',  6),
  ('skill_webdev',       'web-development',  'Web & App Development',   'Bangun website dan aplikasi dengan AI',     'Code2',      7),
  ('skill_sales',        'penjualan',        'Penjualan',               'Closing, CRM, dan sales enablement',        'TrendingUp', 8),
  ('skill_finance',      'keuangan',         'Keuangan',                'Analisis dan laporan keuangan dengan AI',   'Calculator', 9),
  ('skill_hr',           'hr',               'HR & Rekrutmen',          'AI untuk HR, rekrutmen, dan people ops',    'Users',      10),
  ('skill_cs',           'customer-service', 'Customer Service',        'Layanan pelanggan dengan AI',               'Headphones', 11),
  ('skill_career',       'karier',           'Karier & Personal Brand', 'Naik karier dan personal branding',         'Award',      12);

-- Backfill content_skills from existing free-text course categories.
-- Unmapped category values stay unassigned; admin fixes them via Skills & Tags UI.
INSERT OR IGNORE INTO content_skills (content_id, skill_id, is_primary)
SELECT ci.id,
  CASE c.category
    WHEN 'Start Here'         THEN 'skill_start_here'
    WHEN 'AI Basics'          THEN 'skill_start_here'
    WHEN 'Prompt Engineering' THEN 'skill_start_here'
    WHEN 'Productivity'       THEN 'skill_productivity'
    WHEN 'Content Creation'   THEN 'skill_content'
    WHEN 'Digital Marketing'  THEN 'skill_marketing'
    WHEN 'Business'           THEN 'skill_business'
  END,
  1
FROM courses c
JOIN content_items ci ON ci.content_type = 'course' AND ci.ref_id = c.id
WHERE c.category IN ('Start Here', 'AI Basics', 'Prompt Engineering', 'Productivity', 'Content Creation', 'Digital Marketing', 'Business');

-- Backfill from resource_tags persona-era category tags (bonuses etc.)
INSERT OR IGNORE INTO content_skills (content_id, skill_id, is_primary)
SELECT ci.id,
  CASE rt.tag_value
    WHEN 'Start Here'         THEN 'skill_start_here'
    WHEN 'AI Basics'          THEN 'skill_start_here'
    WHEN 'Prompt Engineering' THEN 'skill_start_here'
    WHEN 'Productivity'       THEN 'skill_productivity'
    WHEN 'Content Creation'   THEN 'skill_content'
    WHEN 'Digital Marketing'  THEN 'skill_marketing'
    WHEN 'Business'           THEN 'skill_business'
  END,
  0
FROM resource_tags rt
JOIN content_items ci ON ci.ref_id = rt.resource_id AND ci.content_type = rt.resource_type
WHERE rt.tag_type = 'category'
  AND rt.tag_value IN ('Start Here', 'AI Basics', 'Prompt Engineering', 'Productivity', 'Content Creation', 'Digital Marketing', 'Business');
