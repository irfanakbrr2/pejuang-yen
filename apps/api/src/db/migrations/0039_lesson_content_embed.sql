-- Add content_embed column for raw HTML lessons (bypasses sanitization, rendered via iframe srcdoc)
ALTER TABLE lessons ADD COLUMN content_embed TEXT;
