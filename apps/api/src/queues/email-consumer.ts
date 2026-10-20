import type { Env } from '../env';
import { startSequence } from '../domains/email/sequence-engine';
import { sendMailketingEmail } from '../services/mailketing';
import { canSendEmail } from '../lib/email-guard';
import type { EmailQueueMessage } from '../lib/email-queue';

export async function handleEmailQueue(
  batch: MessageBatch<EmailQueueMessage>,
  env: Env
): Promise<void> {
  for (const msg of batch.messages) {
    try {
      const payload = msg.body;

      if (payload.type === 'trigger_sequence') {
        const result = await startSequence(payload.userId, payload.sequenceName, env.DB, env);
        if (!result.success) {
          console.warn(`[email-queue] trigger_sequence skipped: ${result.message}`);
        }
        msg.ack();
        continue;
      }

      if (payload.type === 'send_email') {
        const guard = await canSendEmail(payload.recipient, payload.emailType, env.DB);
        if (!guard.allowed) {
          console.warn(`[email-queue] send_email blocked for ${payload.recipient}: ${guard.reason}`);
          msg.ack();
          continue;
        }

        const result = await sendMailketingEmail(env, {
          recipient: payload.recipient,
          subject: payload.subject,
          content: payload.content,
          emailType: payload.emailType,
          campaignId: payload.campaignId,
          sequenceId: payload.sequenceId,
        }, env.DB);

        if (!result.success) {
          console.error(`[email-queue] send_email failed for ${payload.recipient}: ${result.error}`);
          msg.retry();
          continue;
        }

        const now = new Date().toISOString();
        await env.DB.prepare(
          `INSERT INTO email_events (id, email, event_type, campaign_id, sequence_id, email_subject, provider, created_at)
           VALUES (?, ?, 'sent', ?, ?, ?, 'mailketing', ?)`
        ).bind(
          crypto.randomUUID(),
          payload.recipient.toLowerCase(),
          payload.campaignId || null,
          payload.sequenceId || null,
          payload.subject,
          now
        ).run().catch(console.error);

        msg.ack();
        continue;
      }

      console.warn('[email-queue] Unknown message type:', (payload as Record<string, unknown>).type);
      msg.ack();
    } catch (err) {
      console.error('[email-queue] Error processing message:', err);
      msg.retry();
    }
  }
}
