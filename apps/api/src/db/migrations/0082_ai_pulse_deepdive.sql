-- 0082_ai_pulse_deepdive.sql
-- AI Pulse v2.2: konten lebih berbobot.
-- Penjelasan mendalam (cara kerja teknis + konteks) terpisah dari ringkasan.
ALTER TABLE ai_pulse_items ADD COLUMN deep_dive TEXT;
