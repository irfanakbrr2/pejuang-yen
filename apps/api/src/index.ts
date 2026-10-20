import app from './app';
import type { Env } from './env';
import { handleNotificationQueue } from './queues/notification-consumer';
import { handleEmailQueue } from './queues/email-consumer';
import { handleDlqQueue } from './queues/dlq-consumer';
import { handleAutomationQueue } from './queues/automation-consumer';
import { runDueAutomations } from './domains/automations/scheduler';
import {
  processReadySequenceSteps,
  scanInactiveUsers,
  scanAbandonedCheckouts,
  scanMembershipExpiry,
  scanCourseInactive,
  type SequenceProcessSummary,
} from './domains/email/sequence-engine';
import { scanWebinarReminders } from './domains/webinars/reminders';
import { scanStreakReminders } from './domains/email/streak-reminder';
import { getAllLists, checkCredits } from './services/mailketing';
import { rollupTrackingDaily, purgeOldTrackingEvents } from './domains/tracking/aggregate';
import { rolloverSeasons } from './lib/seasons';
import { runWeeklyRankUp } from './lib/rank-snapshots';
import { runAiPulseIngestion } from './domains/ai-pulse/service';
import { sendWeeklyAiPulseDigest } from './domains/ai-pulse/digest';

async function recordEmailSequenceRun(
  env: Env,
  startedAt: string,
  summary: SequenceProcessSummary,
  errorMessage?: string
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO email_sequence_runs
     (id, started_at, finished_at, selected_count, sent_count, failed_count, retried_count, cancelled_count, completed_count, error_message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(),
    startedAt,
    new Date().toISOString(),
    summary.selected,
    summary.sent,
    summary.failed,
    summary.retried,
    summary.cancelled,
    summary.completed,
    errorMessage || null
  ).run().catch((err) => console.error('[CRON][EMAIL] Failed to record sequence run:', err));
}

export default {
  /**
   * Main fetch handler for Cloudflare Workers
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.endsWith('/') && url.pathname.length > 1) {
      url.pathname = url.pathname.slice(0, -1);
      const init: RequestInit = {
        method: request.method,
        headers: request.headers,
        redirect: request.redirect,
      };
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        init.body = request.body;
      }
      const newRequest = new Request(url.toString(), init);
      return app.fetch(newRequest, env, ctx);
    }
    return app.fetch(request, env, ctx);
  },

  /**
   * Cron trigger handler for scheduled jobs
   */
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`[CRON] ${controller.cron} triggered at ${new Date().toISOString()}`);

    if (controller.cron === '0 0 * * *') {
      ctx.waitUntil((async () => {
        try {
          const now = new Date().toISOString();

          // Expire memberships
          const expired = await env.DB.prepare(
            `UPDATE memberships SET status = 'expired', updated_at = ?
             WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < ?`
          ).bind(now, now).run();
          console.log(`[CRON] Expired ${expired.meta.changes} memberships`);

          // Cleanup old pending orders (older than 24 hours)
          const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
          const cleaned = await env.DB.prepare(
            `UPDATE orders SET status = 'expired', updated_at = ?, expired_at = ?
             WHERE status = 'pending' AND created_at < ?`
          ).bind(now, now, cutoff).run();
          console.log(`[CRON] Expired ${cleaned.meta.changes} pending orders`);

          // Cleanup revoked sessions older than 30 days
          const sessionsCleaned = await env.DB.prepare(
            `DELETE FROM sessions WHERE revoked_at IS NOT NULL AND revoked_at < datetime('now', '-30 days')`
          ).run();
          console.log(`[CRON] Cleaned ${sessionsCleaned.meta.changes} old sessions`);

          // Cleanup error logs older than 90 days
          const errorLogsCleaned = await env.DB.prepare(
            `DELETE FROM error_logs WHERE created_at < datetime('now', '-90 days')`
          ).run();
          console.log(`[CRON] Cleaned ${errorLogsCleaned.meta.changes} old error logs`);

          // Cleanup processed webhook events older than 90 days
          const webhooksCleaned = await env.DB.prepare(
            `DELETE FROM webhook_events WHERE processing_status = 'processed' AND received_at < datetime('now', '-90 days')`
          ).run();
          console.log(`[CRON] Cleaned ${webhooksCleaned.meta.changes} old webhook events`);

          // Cleanup unverified users older than 24 hours — HANYA saat verifikasi email aktif.
          // Kalau verifikasi dimatikan (DISABLE_EMAIL_VERIFICATION), user sah bisa punya
          // email_verified_at NULL, jadi jangan dihapus.
          if (env.DISABLE_EMAIL_VERIFICATION !== 'true') {
            const unverifiedCleaned = await env.DB.prepare(
              `DELETE FROM users WHERE email_verified_at IS NULL AND created_at < datetime('now', '-24 hours')`
            ).run();
            console.log(`[CRON] Cleaned ${unverifiedCleaned.meta.changes} unverified users`);
          }

          // Check Mailketing credits
          const credits = await checkCredits(env).catch(() => null);
          if (credits) {
            if (credits.isEmpty) {
              console.error('[CRON][EMAIL] CRITICAL: Mailketing credits are EMPTY (0). Non-transactional emails paused.');
            } else if (credits.isCritical) {
              console.error(`[CRON][EMAIL] CRITICAL: Mailketing credits low: ${credits.balance}. Recharge urgently.`);
            } else if (credits.isWarning) {
              console.warn(`[CRON][EMAIL] WARNING: Mailketing credits below 1000: ${credits.balance}.`);
            } else {
              console.log(`[CRON][EMAIL] Credits OK: ${credits.balance}`);
            }
          }

          // Sync Mailketing lists
          const lists = await getAllLists(env).catch(() => []);
          for (const list of lists) {
            await env.DB.prepare(
              `INSERT INTO mailketing_lists (id, list_id, list_name, synced_at, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)
               ON CONFLICT(list_id) DO UPDATE SET list_name = excluded.list_name, synced_at = excluded.synced_at, updated_at = excluded.updated_at`
            ).bind(crypto.randomUUID(), list.id, list.name, now, now, now).run().catch(console.error);
          }
          console.log(`[CRON][EMAIL] Synced ${lists.length} Mailketing lists`);

          // Scan inactive users (30+ days)
          await scanInactiveUsers(env.DB, env).catch(err => console.error('[CRON][EMAIL] scanInactiveUsers error:', err));

          // Scan membership expiry
          await scanMembershipExpiry(env.DB, env).catch(err => console.error('[CRON][EMAIL] scanMembershipExpiry error:', err));

          // Scan course-inactive users (enrolled, progress started, 3+ days inactive)
          await scanCourseInactive(env.DB, env).catch(err => console.error('[CRON][EMAIL] scanCourseInactive error:', err));

          // Tracking: rollup daily aggregates (D-1/D-2), then purge raw events >90 days
          await rollupTrackingDaily(env).catch(err => console.error('[CRON][TRACKING] rollup error:', err));
          await purgeOldTrackingEvents(env).catch(err => console.error('[CRON][TRACKING] purge error:', err));

          // Seasons: tutup musim yang sudah lewat, arsip juara, buka musim baru
          const seasonRoll = await rolloverSeasons(env).catch(err => {
            console.error('[CRON][SEASON] rollover error:', err);
            return { closed: 0, opened: 0 };
          });
          if (seasonRoll.closed > 0) console.log(`[CRON][SEASON] Closed ${seasonRoll.closed}, opened ${seasonRoll.opened}`);

          // Rank-up mingguan: hanya jalan tiap Senin (UTC) — kirim push ke yang naik peringkat.
          if (new Date().getUTCDay() === 1) {
            const rankUp = await runWeeklyRankUp(env).catch(err => {
              console.error('[CRON][RANK] weekly rank-up error:', err);
              return { pushed: 0 };
            });
            console.log(`[CRON][RANK] Weekly rank-up pushes: ${rankUp.pushed}`);
          }

          // AI Pulse: ingest sumber -> AI draft learning package (status draft, direview admin).
          const pulse = await runAiPulseIngestion(env).catch(err => {
            console.error('[CRON][AI-PULSE] ingestion error:', err);
            return null;
          });
          if (pulse) console.log(`[CRON][AI-PULSE] Ingested: inserted=${pulse.inserted}, dup=${pulse.skippedDuplicate}, failed=${pulse.failed}`);

          // AI Pulse Weekly Digest: hanya tiap Senin (UTC).
          if (new Date().getUTCDay() === 1) {
            const digest = await sendWeeklyAiPulseDigest(env).catch(err => {
              console.error('[CRON][AI-PULSE] weekly digest error:', err);
              return { sent: 0, items: 0, skipped: true };
            });
            if (!digest.skipped) console.log(`[CRON][AI-PULSE] Weekly digest sent=${digest.sent} items=${digest.items}`);
          }

        } catch (err) {
          console.error('[CRON] Error:', err);
        }
      })());
    }

    // 07:10 WIB (00:10 UTC) — trigger rebuild blog landing pejuangyen.com via CF deploy hook,
    // 10 menit setelah ingest AI Pulse (07:00) supaya artikel sudah jadi.
    if (controller.cron === '10 0 * * *') {
      ctx.waitUntil((async () => {
        if (!env.LANDING_DEPLOY_HOOK_URL) {
          console.log('[CRON][LANDING] LANDING_DEPLOY_HOOK_URL belum diset, skip rebuild');
          return;
        }
        try {
          const res = await fetch(env.LANDING_DEPLOY_HOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: 'ai-pulse-daily', triggered_at: new Date().toISOString() }),
          });
          console.log(`[CRON][LANDING] Deploy hook triggered -> HTTP ${res.status}`);
        } catch (err) {
          console.error('[CRON][LANDING] Deploy hook failed:', err);
        }
      })());
    }

    if (controller.cron === '*/10 * * * *') {
      ctx.waitUntil((async () => {
        try {
          // Process ready email sequence steps
          const sequenceRunStartedAt = new Date().toISOString();
          try {
            const summary = await processReadySequenceSteps(env.DB, env);
            await recordEmailSequenceRun(env, sequenceRunStartedAt, summary);
            console.log(`[CRON][EMAIL] Sequence steps processed: selected=${summary.selected}, sent=${summary.sent}, retried=${summary.retried}, failed=${summary.failed}`);
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            await recordEmailSequenceRun(
              env,
              sequenceRunStartedAt,
              { selected: 0, sent: 0, failed: 0, retried: 0, cancelled: 0, completed: 0 },
              errorMessage
            );
            console.error('[CRON][EMAIL] Sequence processor error:', err);
          }

          // Scan for abandoned checkouts
          await scanAbandonedCheckouts(env.DB, env);
          console.log('[CRON][EMAIL] Abandoned checkout scan done');

          // Send webinar reminders only during the 12:00 WIB window.
          const webinarReminders = await scanWebinarReminders(env);
          if (!webinarReminders.skipped) {
            console.log(`[CRON][EMAIL] Webinar reminders sent: ${webinarReminders.sent}`);
          }

          // Streak-breaking reminders only during the 19:00 WIB window.
          const streakReminders = await scanStreakReminders(env).catch((err) => {
            console.error('[CRON][EMAIL] Streak reminder scan error:', err);
            return { sent: 0, skipped: true };
          });
          if (!streakReminders.skipped) {
            console.log(`[CRON][EMAIL] Streak reminders sent: ${streakReminders.sent}`);
          }

          // Content Automation: enqueue automation aktif yang jatuh tempo
          try {
            const enqueued = await runDueAutomations(env);
            if (enqueued > 0) console.log(`[CRON][AUTOMATION] Enqueued ${enqueued} due automations`);
          } catch (err) {
            console.error('[CRON][AUTOMATION] runDueAutomations error:', err);
          }
        } catch (err) {
          console.error('[CRON][EMAIL] Error in 10-min cron:', err);
        }
      })());
    }
  },

  /**
   * Queue consumer handler
   */
  async queue(batch: MessageBatch<any>, env: Env): Promise<void> {
    if (batch.queue === 'notifications') {
      await handleNotificationQueue(batch, env);
    } else if (batch.queue === 'email-sequences') {
      await handleEmailQueue(batch, env);
    } else if (batch.queue === 'automation-runs') {
      await handleAutomationQueue(batch, env);
    } else if (batch.queue.startsWith('dlq-')) {
      await handleDlqQueue(batch, env);
    }
  }
} satisfies ExportedHandler<Env>;
