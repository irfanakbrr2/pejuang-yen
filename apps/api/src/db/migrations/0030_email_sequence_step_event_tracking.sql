-- Track the exact sequence step that produced each email event.
-- This keeps admin sequence metrics accurate even after a step subject is edited.

ALTER TABLE email_events ADD COLUMN sequence_step_id TEXT;

CREATE INDEX IF NOT EXISTS idx_ee_sequence_step_id ON email_events(sequence_step_id);

UPDATE email_events
SET sequence_step_id = (
  SELECT ess.id
  FROM email_sequence_steps ess
  WHERE ess.sequence_id = email_events.sequence_id
    AND ess.subject = email_events.email_subject
  ORDER BY ess.step_order ASC
  LIMIT 1
)
WHERE sequence_id IS NOT NULL
  AND sequence_step_id IS NULL;
