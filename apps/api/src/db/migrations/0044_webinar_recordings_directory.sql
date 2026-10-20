-- Add directory fields for webinar recordings

ALTER TABLE webinars ADD COLUMN category TEXT;
ALTER TABLE webinars ADD COLUMN format TEXT;
ALTER TABLE webinars ADD COLUMN tags TEXT;
