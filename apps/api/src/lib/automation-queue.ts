import type { Env } from '../env';

export interface AutomationQueueMessage {
  automationId: string;
  runId: string;
  trigger: 'schedule' | 'manual';
}

/** Enqueue satu run automation ke queue 'automation-runs'. */
export async function enqueueAutomationRun(env: Env, message: AutomationQueueMessage): Promise<void> {
  if (!env.AUTOMATION_QUEUE) {
    console.error('[automation-queue] AUTOMATION_QUEUE binding is missing');
    return;
  }
  await env.AUTOMATION_QUEUE.send(message);
}
