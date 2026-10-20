-- WS2: Seasonal leaderboards + Challenges
-- Level/poin lifetime tetap kumulatif (tidak di-reset). "Musim" hanyalah jendela
-- waktu untuk papan kompetisi: leaderboard difilter BETWEEN starts_at AND ends_at.
-- Saat musim berakhir, juara di-arsip ke season_winners lalu musim baru dibuka.

CREATE TABLE IF NOT EXISTS seasons (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active | closed
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_seasons_status ON seasons(status, ends_at);

CREATE TABLE IF NOT EXISTS season_winners (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL,
  board TEXT NOT NULL,        -- 'learning' | 'affiliate'
  rank INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  display_name TEXT,
  score INTEGER NOT NULL,     -- poin (learning) atau komisi (affiliate)
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_season_winners_season ON season_winners(season_id, board, rank);

CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  metric TEXT NOT NULL,       -- lessons | points | referrals | webinars
  target INTEGER NOT NULL,
  reward_label TEXT,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- draft | active | ended
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status, ends_at);

CREATE TABLE IF NOT EXISTS challenge_participants (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  joined_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cp_unique ON challenge_participants(challenge_id, user_id);
CREATE INDEX IF NOT EXISTS idx_cp_challenge ON challenge_participants(challenge_id, progress DESC);

-- Seed musim perdana (bulan berjalan saat rilis). Cron tutup-musim akan
-- menggulirkan ke musim berikutnya secara otomatis.
INSERT OR IGNORE INTO seasons (id, name, starts_at, ends_at, status, created_at)
VALUES (
  'season-2026-06',
  'Musim Juni 2026',
  '2026-06-01T00:00:00.000Z',
  '2026-07-01T00:00:00.000Z',
  'active',
  '2026-06-01T00:00:00.000Z'
);

-- Seed challenge perdana agar tab "Challenge" langsung berisi.
INSERT OR IGNORE INTO challenges (id, title, description, metric, target, reward_label, starts_at, ends_at, status, created_at)
VALUES (
  'challenge-2026-06-sprint',
  'Sprint Belajar Juni',
  'Selesaikan 10 pelajaran bulan ini dan rebut posisi teratas challenge.',
  'lessons',
  10,
  'Badge eksklusif + sorotan di leaderboard',
  '2026-06-01T00:00:00.000Z',
  '2026-07-01T00:00:00.000Z',
  'active',
  '2026-06-01T00:00:00.000Z'
);
