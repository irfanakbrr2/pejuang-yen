import type { Env } from '../env';

export type EmailQueueMessage =
  | {
      type: 'trigger_sequence';
      userId: string;
      sequenceName: string;
    }
  | {
      type: 'send_email';
      recipient: string;
      subject: string;
      content: string;
      emailType: 'transactional' | 'marketing' | 'lifecycle' | 'notification';
      campaignId?: string;
      sequenceId?: string;
    };

export async function enqueueEmail(env: Env, message: EmailQueueMessage): Promise<void> {
  if (!env.EMAIL_SEQUENCE_QUEUE) {
    console.error('[email-queue] EMAIL_SEQUENCE_QUEUE binding is missing');
    return;
  }

  await env.EMAIL_SEQUENCE_QUEUE.send(message);
}

// Cloudflare Queues limits: <=100 messages/batch, <=256KB total per sendBatch,
// <=128KB per message. We stay well under to leave room for envelope overhead.
// A single community-post email embeds the full post body, so a fixed 100/batch
// could blow past 256KB and (previously) be silently dropped — see flushBatch.
const MAX_BATCH_MESSAGES = 100;
const MAX_BATCH_BYTES = 200_000;
const MAX_MESSAGE_BYTES = 120_000;

function messageBytes(msg: EmailQueueMessage): number {
  // Rough upper bound of the serialized payload size.
  return JSON.stringify(msg).length;
}

async function flushBatch(env: Env, batch: EmailQueueMessage[]): Promise<void> {
  if (batch.length === 0) return;
  try {
    await env.EMAIL_SEQUENCE_QUEUE.sendBatch(batch.map((msg) => ({ body: msg })));
  } catch (err) {
    // A batch-level failure (e.g. exceeding the 256KB sendBatch limit) must NOT
    // silently drop every message. This previously caused large community
    // broadcasts to vanish: notifications were inserted but 0 emails enqueued.
    // Fall back to individual send so one oversized/bad message can't take down
    // the rest of the batch.
    console.error(`[email-queue] sendBatch failed for ${batch.length} messages, falling back to individual send:`, err);
    let failed = 0;
    for (const msg of batch) {
      try {
        await env.EMAIL_SEQUENCE_QUEUE.send(msg);
      } catch (innerErr) {
        failed++;
        console.error('[email-queue] dropped message (send failed):', JSON.stringify(msg).slice(0, 200), innerErr);
      }
    }
    if (failed > 0) {
      console.error(`[email-queue] ${failed}/${batch.length} messages could not be enqueued`);
    }
  }
}

export async function enqueueEmailBatch(env: Env, messages: EmailQueueMessage[]): Promise<void> {
  if (!env.EMAIL_SEQUENCE_QUEUE) {
    console.error('[email-queue] EMAIL_SEQUENCE_QUEUE binding is missing');
    return;
  }

  if (messages.length === 0) return;

  // Accumulate messages into batches bounded by BOTH count and serialized size,
  // so a batch never exceeds Cloudflare's 256KB sendBatch limit.
  let batch: EmailQueueMessage[] = [];
  let batchBytes = 0;

  for (const msg of messages) {
    const size = messageBytes(msg);

    // A single message too large for any batch: flush current batch, send it alone.
    if (size > MAX_MESSAGE_BYTES) {
      await flushBatch(env, batch);
      batch = [];
      batchBytes = 0;
      await flushBatch(env, [msg]);
      continue;
    }

    // Flush if adding this message would exceed either limit.
    if (batch.length >= MAX_BATCH_MESSAGES || batchBytes + size > MAX_BATCH_BYTES) {
      await flushBatch(env, batch);
      batch = [];
      batchBytes = 0;
    }

    batch.push(msg);
    batchBytes += size;
  }

  await flushBatch(env, batch);
}
