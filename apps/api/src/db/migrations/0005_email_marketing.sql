-- Pejuang Yen Email Marketing System
-- Adds email marketing, lifecycle automation, webhook, and sequence tables

-- 1. email_marketing_profiles (extends users without modifying existing table)
CREATE TABLE IF NOT EXISTS email_marketing_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  user_role TEXT DEFAULT 'general',
  interest TEXT,
  skill_level TEXT DEFAULT 'beginner',
  source TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  referral_code TEXT,
  marketing_consent INTEGER NOT NULL DEFAULT 0,
  email_status TEXT NOT NULL DEFAULT 'unknown',
  is_paid_user INTEGER NOT NULL DEFAULT 0,
  membership_status TEXT DEFAULT 'free',
  purchase_count INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  engagement_score INTEGER NOT NULL DEFAULT 0,
  last_email_open_at TEXT,
  last_email_click_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_emp_user_id ON email_marketing_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_emp_email_status ON email_marketing_profiles(email_status);
CREATE INDEX IF NOT EXISTS idx_emp_engagement ON email_marketing_profiles(engagement_score);
CREATE INDEX IF NOT EXISTS idx_emp_user_role ON email_marketing_profiles(user_role);

-- 2. mailketing_lists
CREATE TABLE IF NOT EXISTS mailketing_lists (
  id TEXT PRIMARY KEY,
  list_id TEXT NOT NULL UNIQUE,
  list_name TEXT NOT NULL,
  purpose TEXT,
  synced_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 3. email_events
CREATE TABLE IF NOT EXISTS email_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  email TEXT NOT NULL,
  event_type TEXT NOT NULL,
  campaign_id TEXT,
  sequence_id TEXT,
  email_subject TEXT,
  link_clicked TEXT,
  reason TEXT,
  provider TEXT DEFAULT 'mailketing',
  raw_payload TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ee_email ON email_events(email);
CREATE INDEX IF NOT EXISTS idx_ee_event_type ON email_events(event_type);
CREATE INDEX IF NOT EXISTS idx_ee_user_id ON email_events(user_id);
CREATE INDEX IF NOT EXISTS idx_ee_created_at ON email_events(created_at);
CREATE INDEX IF NOT EXISTS idx_ee_campaign_id ON email_events(campaign_id);

-- 4. email_campaigns
CREATE TABLE IF NOT EXISTS email_campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  campaign_type TEXT NOT NULL DEFAULT 'broadcast',
  segment TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  subject TEXT,
  content TEXT,
  cta_url TEXT,
  sent_count INTEGER NOT NULL DEFAULT 0,
  open_count INTEGER NOT NULL DEFAULT 0,
  click_count INTEGER NOT NULL DEFAULT 0,
  bounce_count INTEGER NOT NULL DEFAULT 0,
  unsubscribe_count INTEGER NOT NULL DEFAULT 0,
  revenue_attributed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ec_status ON email_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_ec_campaign_type ON email_campaigns(campaign_type);

-- 5. email_sequences
CREATE TABLE IF NOT EXISTS email_sequences (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  trigger_event TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 6. email_sequence_steps
CREATE TABLE IF NOT EXISTS email_sequence_steps (
  id TEXT PRIMARY KEY,
  sequence_id TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  subject TEXT NOT NULL,
  template_key TEXT NOT NULL,
  content TEXT,
  cta_url TEXT,
  segment_condition TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (sequence_id) REFERENCES email_sequences(id)
);
CREATE INDEX IF NOT EXISTS idx_ess_sequence_id ON email_sequence_steps(sequence_id);
CREATE INDEX IF NOT EXISTS idx_ess_step_order ON email_sequence_steps(step_order);

-- 7. user_email_sequence_state
CREATE TABLE IF NOT EXISTS user_email_sequence_state (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  sequence_id TEXT NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  last_sent_at TEXT,
  next_send_at TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (sequence_id) REFERENCES email_sequences(id)
);
CREATE INDEX IF NOT EXISTS idx_uess_user_id ON user_email_sequence_state(user_id);
CREATE INDEX IF NOT EXISTS idx_uess_status ON user_email_sequence_state(status);
CREATE INDEX IF NOT EXISTS idx_uess_next_send ON user_email_sequence_state(next_send_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_uess_user_seq ON user_email_sequence_state(user_id, sequence_id) WHERE status IN ('active', 'paused');

-- 8. email_suppression_list
CREATE TABLE IF NOT EXISTS email_suppression_list (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  source TEXT,
  raw_payload TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_esl_email ON email_suppression_list(email);

-- 9. checkout_events
CREATE TABLE IF NOT EXISTS checkout_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  email TEXT NOT NULL,
  product_id TEXT,
  checkout_url TEXT,
  status TEXT NOT NULL DEFAULT 'started',
  amount INTEGER,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ce_email ON checkout_events(email);
CREATE INDEX IF NOT EXISTS idx_ce_status ON checkout_events(status);
CREATE INDEX IF NOT EXISTS idx_ce_user_id ON checkout_events(user_id);

-- 10. Extend orders table with email attribution
ALTER TABLE orders ADD COLUMN email_campaign_id TEXT;

-- ─── Seed: Default Email Sequences ───────────────────────────────────────────

INSERT OR IGNORE INTO email_sequences (id, name, trigger_event, description, status, created_at, updated_at) VALUES
  ('seq_welcome_free',        'welcome_free_user',              'user_registered',        'Welcome sequence for new free users (5 steps over 6 days)', 'active', datetime('now'), datetime('now')),
  ('seq_abandoned_checkout',  'abandoned_checkout',             'checkout_started',       'Recovery sequence for abandoned checkouts (4 steps over 48 hours)', 'active', datetime('now'), datetime('now')),
  ('seq_post_purchase',       'post_purchase_onboarding',       'payment_successful',     'Onboarding sequence for new paid users (5 steps over 14 days)', 'active', datetime('now'), datetime('now')),
  ('seq_progress_reminder',   'course_progress_reminder',       'course_inactive',        'Nudge inactive learners to continue their course', 'active', datetime('now'), datetime('now')),
  ('seq_inactive_reactivation','inactive_user_reactivation',    'user_inactive_30d',      'Re-engage users inactive for 30 days (3 steps)', 'active', datetime('now'), datetime('now')),
  ('seq_membership_expiry',   'membership_expiry',              'membership_expiring',    'Membership renewal reminders (4 steps around expiry date)', 'active', datetime('now'), datetime('now')),
  ('seq_segment_nurture',     'segment_based_nurturing',        'user_role_identified',   'Role-specific nurturing emails after quiz/role selection', 'active', datetime('now'), datetime('now'));

-- Sequence 1: Welcome Free User (5 steps)
INSERT OR IGNORE INTO email_sequence_steps (id, sequence_id, step_order, delay_minutes, subject, template_key, cta_url, created_at, updated_at) VALUES
  ('step_wf_1', 'seq_welcome_free', 1,    0,    'Selamat datang di Pejuang Yen',                      'welcome_free_1', 'https://app.pejuangyen.com/dashboard',          datetime('now'), datetime('now')),
  ('step_wf_2', 'seq_welcome_free', 2,    1440, 'AI bukan cuma tools. Yang penting workflow.',        'welcome_free_2', 'https://app.pejuangyen.com/courses',            datetime('now'), datetime('now')),
  ('step_wf_3', 'seq_welcome_free', 3,    2880, 'Pilih kelas yang paling dekat dengan kebutuhanmu',   'welcome_free_3', 'https://pejuangyen.com/',                        datetime('now'), datetime('now')),
  ('step_wf_4', 'seq_welcome_free', 4,    5760, 'Contoh cara memakai AI sesuai peran kamu',           'welcome_free_4', 'https://pejuangyen.com/',                        datetime('now'), datetime('now')),
  ('step_wf_5', 'seq_welcome_free', 5,    8640, 'Mulai dari kelas pertama yang paling relevan',      'welcome_free_5', 'https://app.pejuangyen.com/courses',            datetime('now'), datetime('now'));

-- Sequence 2: Abandoned Checkout (4 steps)
INSERT OR IGNORE INTO email_sequence_steps (id, sequence_id, step_order, delay_minutes, subject, template_key, cta_url, created_at, updated_at) VALUES
  ('step_ac_1', 'seq_abandoned_checkout', 1,   30,   'Pembayaran kamu belum selesai',                         'abandoned_checkout_1', 'https://pejuangyen.com/', datetime('now'), datetime('now')),
  ('step_ac_2', 'seq_abandoned_checkout', 2,   360,  'Pastikan kelas ini cocok dengan kebutuhanmu',           'abandoned_checkout_2', 'https://pejuangyen.com/', datetime('now'), datetime('now')),
  ('step_ac_3', 'seq_abandoned_checkout', 3,   1440, 'Mulai dari satu use case kecil',                        'abandoned_checkout_3', 'https://pejuangyen.com/', datetime('now'), datetime('now')),
  ('step_ac_4', 'seq_abandoned_checkout', 4,   2880, 'Pengingat terakhir untuk pembayaran ini',                'abandoned_checkout_4', 'https://pejuangyen.com/', datetime('now'), datetime('now'));

-- Sequence 3: Post-Purchase Onboarding (5 steps)
INSERT OR IGNORE INTO email_sequence_steps (id, sequence_id, step_order, delay_minutes, subject, template_key, cta_url, created_at, updated_at) VALUES
  ('step_pp_1', 'seq_post_purchase', 1,    0,    'Akses kamu sudah aktif',                            'post_purchase_1', 'https://app.pejuangyen.com/dashboard',      datetime('now'), datetime('now')),
  ('step_pp_2', 'seq_post_purchase', 2,    1440, 'Mulai dari modul ini dulu',                         'post_purchase_2', 'https://app.pejuangyen.com/my-classes',    datetime('now'), datetime('now')),
  ('step_pp_3', 'seq_post_purchase', 3,    4320, 'Jangan cuma nonton. Praktikkan ini.',               'post_purchase_3', 'https://app.pejuangyen.com/my-classes',    datetime('now'), datetime('now')),
  ('step_pp_4', 'seq_post_purchase', 4,    10080,'Hubungkan materi dengan kebutuhanmu',                'post_purchase_4', 'https://pejuangyen.com/',                  datetime('now'), datetime('now')),
  ('step_pp_5', 'seq_post_purchase', 5,    20160,'Boleh minta feedback singkat?',                     'post_purchase_5', 'https://pejuangyen.com/',                  datetime('now'), datetime('now'));

-- Sequence 4: Inactive User Reactivation (3 steps)
INSERT OR IGNORE INTO email_sequence_steps (id, sequence_id, step_order, delay_minutes, subject, template_key, cta_url, created_at, updated_at) VALUES
  ('step_ir_1', 'seq_inactive_reactivation', 1,    0,    'Masih mau belajar AI dengan cara yang praktis?',     'inactive_reactivation_1', 'https://app.pejuangyen.com/courses', datetime('now'), datetime('now')),
  ('step_ir_2', 'seq_inactive_reactivation', 2,    4320, 'Pilih topik AI yang paling kamu butuhkan',            'inactive_reactivation_2', 'https://pejuangyen.com/',             datetime('now'), datetime('now')),
  ('step_ir_3', 'seq_inactive_reactivation', 3,    10080,'Gue bantu arahin dari kelas yang paling cocok',      'inactive_reactivation_3', 'https://app.pejuangyen.com/courses', datetime('now'), datetime('now'));

-- Sequence 5: Membership Expiry (4 steps — scheduled by cron based on expires_at)
INSERT OR IGNORE INTO email_sequence_steps (id, sequence_id, step_order, delay_minutes, subject, template_key, cta_url, created_at, updated_at) VALUES
  ('step_me_1', 'seq_membership_expiry', 1,    0,     'Membership kamu hampir berakhir',               'membership_expiry_7d',  'https://pejuangyen.com/', datetime('now'), datetime('now')),
  ('step_me_2', 'seq_membership_expiry', 2,    5760,  '3 hari lagi membership kamu berakhir',          'membership_expiry_3d',  'https://pejuangyen.com/', datetime('now'), datetime('now')),
  ('step_me_3', 'seq_membership_expiry', 3,    8640,  'Besok adalah hari terakhir membership aktif',   'membership_expiry_1d',  'https://pejuangyen.com/', datetime('now'), datetime('now')),
  ('step_me_4', 'seq_membership_expiry', 4,    1440,  'Membership kamu sudah berakhir',                'membership_expired',    'https://pejuangyen.com/', datetime('now'), datetime('now'));
