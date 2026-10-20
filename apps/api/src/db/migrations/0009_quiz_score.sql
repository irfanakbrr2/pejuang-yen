-- Add score tracking to lesson_progress for quiz lessons
ALTER TABLE lesson_progress ADD COLUMN score INTEGER;
ALTER TABLE lesson_progress ADD COLUMN max_score INTEGER;
