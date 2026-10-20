-- Lifecycle sequence for users who register for a webinar.
-- Time-sensitive H-1/day-of reminders remain handled by webinar_reminder_sends.

INSERT OR IGNORE INTO email_sequences
  (id, name, trigger_event, description, status, created_at, updated_at)
VALUES
  (
    'seq_webinar_registration',
    'webinar_registration_followup',
    'webinar_registered',
    'Follow-up sequence for webinar registrants after they reserve a seat',
    'active',
    datetime('now'),
    datetime('now')
  );

INSERT OR IGNORE INTO email_sequence_steps
  (id, sequence_id, step_order, delay_minutes, subject, preview_text, template_key, cta_url, created_at, updated_at)
VALUES
  (
    'step_wr_1',
    'seq_webinar_registration',
    1,
    0,
    'Kursi webinar kamu sudah aman',
    'Siapkan satu pertanyaan supaya sesi webinar lebih relevan untuk kamu.',
    'webinar_registration_1',
    'https://app.pejuangyen.com/webinars',
    datetime('now'),
    datetime('now')
  ),
  (
    'step_wr_2',
    'seq_webinar_registration',
    2,
    1440,
    'Sebelum webinar, siapkan ini dulu',
    'Tulis satu workflow AI yang ingin kamu perbaiki saat webinar.',
    'webinar_registration_2',
    'https://app.pejuangyen.com/webinars',
    datetime('now'),
    datetime('now')
  ),
  (
    'step_wr_3',
    'seq_webinar_registration',
    3,
    4320,
    'Bawa satu use case ke webinar',
    'Datang dengan satu masalah spesifik agar insight webinar langsung bisa dipakai.',
    'webinar_registration_3',
    'https://app.pejuangyen.com/webinars',
    datetime('now'),
    datetime('now')
  );

INSERT OR IGNORE INTO user_email_sequence_state
  (id, user_id, sequence_id, current_step, status, next_send_at, created_at, updated_at)
SELECT
  lower(hex(randomblob(16))),
  wr.user_id,
  'seq_webinar_registration',
  1,
  'active',
  datetime('now'),
  datetime('now'),
  datetime('now')
FROM webinar_registrations wr
JOIN webinars w ON w.id = wr.webinar_id
WHERE wr.status = 'registered'
  AND w.status = 'published'
  AND datetime(w.starts_at) >= datetime('now')
  AND NOT EXISTS (
    SELECT 1
    FROM user_email_sequence_state s
    WHERE s.user_id = wr.user_id
      AND s.sequence_id = 'seq_webinar_registration'
      AND s.status IN ('active', 'paused', 'completed')
  );
