-- Backfill kategori + jenis aset untuk bonus aktif eksisting.
-- Mapping editorial memakai decision rule docs/content-taxonomy-plan.md A2;
-- admin dapat menyesuaikan per item lewat form bonus baru.

-- cat_01 AI Fundamentals & Prompting
UPDATE bonuses SET primary_category_id = 'cat_01' WHERE primary_category_id IS NULL AND title IN (
  'Ai Prompt Engineering Ebook'
);

-- cat_04 Vibe Marketing, Sales & Growth (output: traffic/leads/funnel/closing/revenue)
UPDATE bonuses SET primary_category_id = 'cat_04' WHERE primary_category_id IS NULL AND title IN (
  'Content Marketing on Steroids',
  'The Psychology of Closing',
  'Beginners Guide to Ab Testing',
  'Content Marketing for Small Businesses',
  'Converting Content Funnel',
  'Growth with Social Proof',
  'Lead Generation with Linkedin Ads',
  'Mastering Paid Marketing Metrics',
  'Product Launch Storytelling Secrets',
  'Selling without Fear',
  'Seo Driven Storytelling Advantage',
  'The Art of Negotiation',
  'The Neuromarketing Edge',
  'The Ugc Conversion Playbook',
  'Visual Selling',
  'Writing Content That Sells without Sounding Salesy'
);

-- cat_06 Content Creation & Personal Branding (output: konten/audience/identitas)
UPDATE bonuses SET primary_category_id = 'cat_06' WHERE primary_category_id IS NULL AND title IN (
  'The Brand Evolution System for Modern Creators',
  'Building a Faceless Empire',
  'Content Repurposing Mastery',
  'From Zero to Content Hero',
  'Humanize Your Ai Copy'
);

-- cat_07 Business, Monetization & Solopreneurship (bisnis/produk/offer sendiri)
UPDATE bonuses SET primary_category_id = 'cat_07' WHERE primary_category_id IS NULL AND title IN (
  'Agency Growth Blueprint',
  'Monetizing Attention without Selling Your Soul',
  'Swot Analysis Simplified',
  'Ai Profit Mastery for Small Business',
  'Ai Ready Change Management Playbook',
  'Create Micro Products',
  'How to Franchise Your Business',
  'Monetize Your Micro Audience',
  'Online Business Security Best Practices',
  'The Business Model Blueprint',
  'The First Time Entrepreneur Launchpad'
);

-- cat_09 Productivity, Learning & Self-Development (cara belajar/bekerja/diri)
UPDATE bonuses SET primary_category_id = 'cat_09' WHERE primary_category_id IS NULL AND title IN (
  'Digital Detox for Founders',
  'The Neuroscience of Peak Productivity',
  'Working Smarter with Virtual Assistants',
  'Blockchain Basics',
  'Budgeting in Everyday Life',
  'Buy Back Your Time',
  'Confidence That Shows Before You Speak',
  'Prioritize Your Life',
  'Self Coaching Mastery',
  'The Ai Advantage in Learning',
  'The Ultimate Survival Prepper',
  'Work Life Balance for Ambitious Minds'
);

-- Jenis aset default untuk bonus aktif lama: ebook (koleksi PDF) —
-- admin menyesuaikan per item bila bukan ebook.
UPDATE bonuses SET asset_type = 'ebook' WHERE asset_type IS NULL AND status = 'active';

-- Sinkronkan content_categories untuk semua primary yang baru terisi
INSERT OR IGNORE INTO content_categories (content_type, ref_id, category_id, is_primary, created_at)
  SELECT 'bonus', id, primary_category_id, 1, datetime('now') FROM bonuses WHERE primary_category_id IS NOT NULL;
