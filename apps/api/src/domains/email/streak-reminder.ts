import type { Env } from '../../env';
import { notifyUser } from '../../lib/notify';

const JAKARTA_TIMEZONE = 'Asia/Jakarta';

function jakartaHourMinute(date = new Date()): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value || '0';
  return { hour: Number(value('hour')), minute: Number(value('minute')) };
}

// 19:00 WIB = 12:00 UTC — at this moment the WIB calendar date equals the
// UTC date, so "last_streak_date = yesterday (UTC)" cleanly means "active
// yesterday but not yet today".
function shouldRunEveningWib(now = new Date()): boolean {
  const { hour, minute } = jakartaHourMinute(now);
  return hour === 19 && minute < 20;
}

/**
 * Email users whose streak (≥3 days) ends today unless they come back.
 * Runs inside the 10-minute cron; only acts during the 19:00 WIB window.
 * Deduped per user per day via streak_reminder_sends.
 */
export async function scanStreakReminders(env: Env, nowDate = new Date()): Promise<{ sent: number; skipped: boolean }> {
  if (!shouldRunEveningWib(nowDate)) {
    return { sent: 0, skipped: true };
  }

  const now = nowDate.toISOString();
  const today = now.slice(0, 10);
  const yesterday = new Date(nowDate.getTime() - 86400000).toISOString().slice(0, 10);

  // Streak reminder = PUSH-ONLY (tanpa email). User sudah dapat email lain
  // (komunitas, progres, dll) — reminder harian via push saja agar tidak spam inbox.
  // Hanya proses user yang sudah mengaktifkan push.
  const rows = await env.DB.prepare(
    `SELECT u.id, u.current_streak
     FROM users u
     WHERE u.status = 'active'
       AND u.current_streak >= 3
       AND u.last_streak_date = ?
       AND EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = u.id)
       AND NOT EXISTS (
         SELECT 1 FROM streak_reminder_sends s
         WHERE s.user_id = u.id AND s.reminder_date = ?
       )
     LIMIT 500`
  ).bind(yesterday, today).all();

  let sent = 0;
  for (const row of rows.results as any[]) {
    try {
      const claim = await env.DB.prepare(
        `INSERT OR IGNORE INTO streak_reminder_sends (user_id, reminder_date, sent_at)
         VALUES (?, ?, ?)`
      ).bind(row.id, today, now).run();
      if ((claim.meta?.changes || 0) === 0) continue;

      await notifyUser(env, row.id, {
        title: `Streak ${row.current_streak} hari hampir putus 🔥`,
        body: 'Belajar sebentar hari ini untuk menjaga streak-mu tetap hidup.',
        url: '/dashboard?utm_source=push&utm_campaign=streak_reminder',
        tag: 'streak-reminder',
        inApp: false,
      }).catch(() => {});

      sent += 1;
    } catch (err) {
      console.error('[streak-reminder] failed for user', row.id, err);
    }
  }

  return { sent, skipped: false };
}
