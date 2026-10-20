-- 0080_ai_pulse_title_image.sql
-- AI Pulse v2: judul Bahasa Indonesia + auto-post.
-- Kolom `title` kini menyimpan judul Bahasa Indonesia hasil AI.
-- Judul asli sumber (umumnya Inggris) disimpan di original_title untuk referensi.
ALTER TABLE ai_pulse_items ADD COLUMN original_title TEXT;
