-- Link kelas "Automation N8N for Everyone" ke kategori taxonomy yang benar.
--
-- Konteks: /my-classes (production) mengelompokkan kelas berdasarkan taxonomy
-- categories + content_categories, BUKAN kolom legacy courses.category.
-- Kelas N8N dibuat via SQL (0046) tanpa baris content_categories, sehingga
-- jatuh ke grup "Lainnya". Migration ini menautkannya ke cat_05
-- ("AI Automation & Workflow" — deskripsinya mencakup n8n, Zapier).
--
-- CATATAN: tabel categories/content_categories ada di PRODUCTION (taxonomy baru),
-- belum tentu ada di DB lokal yang stale. Jalankan ke --remote.
-- Pakai INSERT ... SELECT by slug agar ref_id selalu cocok dengan courses.id.

INSERT OR IGNORE INTO content_categories (content_type, ref_id, category_id, is_primary, created_at)
SELECT 'course', c.id, 'cat_05', 1, '2026-06-14T00:00:00.000Z'
FROM courses c
WHERE c.slug = 'automation-n8n-for-everyone';
