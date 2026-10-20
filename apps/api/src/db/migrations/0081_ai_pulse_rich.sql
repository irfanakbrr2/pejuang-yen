-- 0081_ai_pulse_rich.sql
-- AI Pulse v2.1: konten lebih informatif & actionable.
-- Tambah seksi bernilai tinggi: poin penting (TL;DR), langkah praktis memulai,
-- dan contoh prompt siap pakai.
ALTER TABLE ai_pulse_items ADD COLUMN key_points_json TEXT;     -- JSON array string (3-6 poin)
ALTER TABLE ai_pulse_items ADD COLUMN how_to_start_json TEXT;   -- JSON array string (langkah praktis)
ALTER TABLE ai_pulse_items ADD COLUMN prompt_example TEXT;      -- 1 prompt siap pakai terkait update
