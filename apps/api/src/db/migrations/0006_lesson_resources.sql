-- Add description and resource links to lessons
ALTER TABLE lessons ADD COLUMN description TEXT;
ALTER TABLE lessons ADD COLUMN resources_json TEXT;
