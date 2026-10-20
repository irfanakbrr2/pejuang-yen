-- Talent Board & Success Stories
-- Admin-side management is fully active; the public user pages stay
-- "coming soon" until visibility/consent rules are switched on.

-- 1. Talent Board candidates (kurasi member untuk ditampilkan ke perusahaan)
CREATE TABLE IF NOT EXISTS talent_board_candidates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',   -- 'hidden' | 'pending' | 'visible' | 'featured'
  skill_tags_json TEXT,                     -- JSON array of skill tag strings
  portfolio_url TEXT,
  admin_notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tbc_status ON talent_board_candidates(status, sort_order);
CREATE INDEX IF NOT EXISTS idx_tbc_user ON talent_board_candidates(user_id);

-- 2. Success Stories CMS (cerita transformasi member, dengan alur approval)
CREATE TABLE IF NOT EXISTS success_stories (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  member_name TEXT NOT NULL,
  member_role TEXT,
  member_user_id TEXT REFERENCES users(id), -- optional link ke akun member
  avatar_url TEXT,
  before_text TEXT,
  after_text TEXT,
  result_text TEXT,
  course_id TEXT REFERENCES courses(id),    -- kelas terkait (optional)
  tags_json TEXT,                           -- JSON array kategori cerita
  quote TEXT,
  link_url TEXT,                            -- portofolio / project link
  approval_status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  is_featured INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 0,  -- publish hanya boleh saat approved
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ss_status ON success_stories(approval_status, is_published, sort_order);
CREATE INDEX IF NOT EXISTS idx_ss_member_user ON success_stories(member_user_id);
