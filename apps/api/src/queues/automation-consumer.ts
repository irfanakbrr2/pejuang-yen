import type { Env } from '../env';
import type { AutomationQueueMessage } from '../lib/automation-queue';
import { AutomationService } from '../domains/automations/service';

/**
 * Consumer queue 'automation-runs'. processRun mencatat status & error sendiri,
 * jadi message selalu di-ack (hindari dobel-posting akibat retry).
 */
export async function handleAutomationQueue(
  batch: MessageBatch<AutomationQueueMessage>,
  env: Env
): Promise<void> {
  const svc = new AutomationService(env);
  for (const msg of batch.messages) {
    try {
      await svc.processRun(msg.body.automationId, msg.body.runId);
    } catch (err) {
      console.error('[automation-queue] Error processing run:', msg.body?.runId, err);
    } finally {
      msg.ack();
    }
  }
}
