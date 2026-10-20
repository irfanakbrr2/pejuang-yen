import type { Env } from '../../env';

function utcDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Recompute daily aggregates for D-1 and D-2 (idempotent — tolerates a missed
 * run and late-arriving events). Dates are UTC day buckets.
 */
export async function rollupTrackingDaily(env: Env): Promise<void> {
  for (const date of [utcDateNDaysAgo(1), utcDateNDaysAgo(2)]) {
    const dayStart = `${date}T00:00:00.000Z`;
    const dayEnd = `${date}T23:59:59.999Z`;

    await env.DB.batch([
      env.DB.prepare(`DELETE FROM events_daily WHERE event_date = ?`).bind(date),
      env.DB.prepare(
        `INSERT INTO events_daily (event_date, event_name, count, unique_users)
         SELECT ?, event_name, COUNT(*), COUNT(DISTINCT user_id)
         FROM tracking_events
         WHERE created_at >= ? AND created_at <= ?
         GROUP BY event_name`
      ).bind(date, dayStart, dayEnd),
      env.DB.prepare(`DELETE FROM acquisition_daily WHERE event_date = ?`).bind(date),
      env.DB.prepare(
        `INSERT INTO acquisition_daily (event_date, source, medium, campaign, signups, checkouts, payments, revenue)
         SELECT ?,
           COALESCE(NULLIF(utm_source, ''), '(none)'),
           COALESCE(NULLIF(utm_medium, ''), '(none)'),
           COALESCE(NULLIF(utm_campaign, ''), '(none)'),
           SUM(CASE WHEN event_name = 'signup_completed' THEN 1 ELSE 0 END),
           SUM(CASE WHEN event_name = 'checkout_started' THEN 1 ELSE 0 END),
           SUM(CASE WHEN event_name = 'payment_success' THEN 1 ELSE 0 END),
           SUM(CASE WHEN event_name = 'payment_success' THEN COALESCE(payment_amount, 0) ELSE 0 END)
         FROM tracking_events
         WHERE created_at >= ? AND created_at <= ?
           AND event_name IN ('signup_completed', 'checkout_started', 'payment_success')
         GROUP BY 2, 3, 4`
      ).bind(date, dayStart, dayEnd),
    ]);
  }
}

/**
 * Delete raw tracking events older than 90 days, in chunks to stay within
 * D1 limits. Aggregates in events_daily/acquisition_daily are kept forever.
 */
export async function purgeOldTrackingEvents(env: Env): Promise<void> {
  for (let i = 0; i < 10; i++) {
    const result = await env.DB.prepare(
      `DELETE FROM tracking_events
       WHERE id IN (
         SELECT id FROM tracking_events
         WHERE created_at < datetime('now', '-90 days')
         LIMIT 5000
       )`
    ).run();
    if (!result.meta || (result.meta.changes ?? 0) === 0) break;
  }
}
