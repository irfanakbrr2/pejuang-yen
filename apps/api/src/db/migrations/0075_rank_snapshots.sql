-- Enhancement: weekly rank snapshots untuk push "naik peringkat" + panah ▲▼.
-- `rank` = peringkat user pada snapshot mingguan terakhir (mis. tiap Senin).
-- Leaderboard membandingkan rank live sekarang vs rank tersimpan → delta.

CREATE TABLE IF NOT EXISTS leaderboard_rank_snapshots (
  user_id TEXT NOT NULL,
  board TEXT NOT NULL,        -- 'learning' | 'affiliate'
  rank INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, board)
);
CREATE INDEX IF NOT EXISTS idx_rank_snap_board ON leaderboard_rank_snapshots(board);
