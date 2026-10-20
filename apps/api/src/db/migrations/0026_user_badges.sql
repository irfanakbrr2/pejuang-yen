-- Migration number: 0026
-- Add badges_json to users table

ALTER TABLE users ADD COLUMN badges_json TEXT DEFAULT '[]';
