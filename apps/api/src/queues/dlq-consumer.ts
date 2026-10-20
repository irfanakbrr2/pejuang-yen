import type { Env } from '../env';

export async function handleDlqQueue(batch: MessageBatch<any>, env: Env) {
  const now = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statements: any[] = [];
  
  for (const msg of batch.messages) {
    const payload = JSON.stringify(msg.body);
    
    // Store in DB
    statements.push(
      env.DB.prepare(
        `INSERT INTO failed_queue_logs (id, queue_name, payload_json, error_message, created_at)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(),
        batch.queue,
        payload,
        'Max retries exceeded',
        now
      )
    );

    // Acknowledge so it doesn't loop forever
    msg.ack();
  }

  if (statements.length > 0) {
    await env.DB.batch(statements).catch(err => {
      console.error(`[DLQ] Failed to write DLQ logs to D1:`, err);
    });
    console.log(`[DLQ] Logged ${statements.length} failed messages from ${batch.queue}`);
  }
}
