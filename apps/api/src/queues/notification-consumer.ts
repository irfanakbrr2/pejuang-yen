import type { Env } from '../env';

export async function handleNotificationQueue(batch: MessageBatch<any>, env: Env): Promise<void> {
  for (const msg of batch.messages) {
    try {
      const payload = msg.body;
      console.log(`[QUEUE] Processing notification for ${payload.recipient}`);
      
      // Update notification status
      if (payload.notificationId) {
        await env.DB.prepare(
          `UPDATE notifications SET status = 'sent', sent_at = ? WHERE id = ?`
        ).bind(new Date().toISOString(), payload.notificationId).run();
      }

      msg.ack();
    } catch (err) {
      console.error('[QUEUE] Error processing message', err);
      // Let it retry
      msg.retry();
    }
  }
}
