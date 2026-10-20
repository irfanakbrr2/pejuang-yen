-- Track automated webinar reminder emails per registration.
-- Reminder jobs are idempotent through the registration/reminder_type unique key.

CREATE TABLE IF NOT EXISTS webinar_reminder_sends (
  id TEXT PRIMARY KEY,
  webinar_id TEXT NOT NULL,
  registration_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  reminder_type TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (webinar_id) REFERENCES webinars(id),
  FOREIGN KEY (registration_id) REFERENCES webinar_registrations(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webinar_reminder_unique
ON webinar_reminder_sends(registration_id, reminder_type);

CREATE INDEX IF NOT EXISTS idx_webinar_reminder_webinar
ON webinar_reminder_sends(webinar_id, reminder_type);

CREATE INDEX IF NOT EXISTS idx_webinar_reminder_sent_at
ON webinar_reminder_sends(sent_at);
