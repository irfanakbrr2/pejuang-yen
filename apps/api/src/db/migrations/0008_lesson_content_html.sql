-- Add sanitized HTML lesson content for text-first and mixed media lessons.
-- Note: this project already has two 0006 migrations; keep new lesson changes at 0008+.

ALTER TABLE lessons ADD COLUMN content_html TEXT;
ALTER TABLE lessons ADD COLUMN content_format TEXT NOT NULL DEFAULT 'html';
