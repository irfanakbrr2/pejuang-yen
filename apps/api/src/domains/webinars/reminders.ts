import type { Env } from '../../env';
import { enqueueEmail } from '../../lib/email-queue';
import { webinarReminderEmailHtml } from '../../lib/email-templates';

type WebinarReminderType = 'day_minus_1' | 'day_of';

type WebinarReminderRow = {
  registration_id: string;
  webinar_id: string;
  user_id: string;
  name: string;
  email: string;
  slug: string;
  title: string;
  starts_at: string;
  timezone?: string | null;
  join_url?: string | null;
};

const JAKARTA_TIMEZONE = 'Asia/Jakarta';

function jakartaParts(date = new Date()): { date: string; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    hour: Number(value('hour')),
    minute: Number(value('minute')),
  };
}

function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return utc.toISOString().slice(0, 10);
}

function shouldRunNoonWib(now = new Date()): boolean {
  const parts = jakartaParts(now);
  return parts.hour === 12 && parts.minute < 20;
}

async function fetchReminderRows(db: D1Database, reminderType: WebinarReminderType, targetDate: string): Promise<WebinarReminderRow[]> {
  const rows = await db.prepare(
    `SELECT
       wr.id as registration_id,
       wr.webinar_id,
       wr.user_id,
       wr.name,
       wr.email,
       w.slug,
       w.title,
       w.starts_at,
       w.timezone,
       w.join_url
     FROM webinar_registrations wr
     JOIN webinars w ON w.id = wr.webinar_id
     WHERE wr.status = 'registered'
       AND w.status = 'published'
       AND date(w.starts_at, '+7 hours') = ?
       AND NOT EXISTS (
         SELECT 1 FROM webinar_reminder_sends s
         WHERE s.registration_id = wr.id AND s.reminder_type = ?
       )
     ORDER BY w.starts_at ASC, wr.registered_at ASC
     LIMIT 500`
  ).bind(targetDate, reminderType).all();

  return rows.results as unknown as WebinarReminderRow[];
}

async function sendReminder(env: Env, row: WebinarReminderRow, reminderType: WebinarReminderType, now: string): Promise<boolean> {
  const claim = await env.DB.prepare(
    `INSERT OR IGNORE INTO webinar_reminder_sends
      (id, webinar_id, registration_id, user_id, email, reminder_type, sent_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(),
    row.webinar_id,
    row.registration_id,
    row.user_id,
    row.email.toLowerCase(),
    reminderType,
    now,
    now
  ).run();

  if ((claim.meta?.changes || 0) === 0) return false;

  await enqueueEmail(env, {
    type: 'send_email',
    recipient: row.email,
    subject: reminderType === 'day_of'
      ? `Hari ini: ${row.title}`
      : `Besok: ${row.title}`,
    content: webinarReminderEmailHtml({
      name: (row.name || 'Kamu').split(' ')[0] || 'Kamu',
      webinarTitle: row.title,
      startsAt: row.starts_at,
      timezone: row.timezone || JAKARTA_TIMEZONE,
      detailUrl: `${env.APP_URL}/webinars/${row.slug}`,
      joinUrl: row.join_url,
      reminderType,
    }),
    emailType: 'transactional',
  });

  return true;
}

export async function scanWebinarReminders(env: Env, nowDate = new Date()): Promise<{ sent: number; skipped: boolean }> {
  if (!shouldRunNoonWib(nowDate)) {
    return { sent: 0, skipped: true };
  }

  const now = nowDate.toISOString();
  const todayWib = jakartaParts(nowDate).date;
  const targets: Array<{ type: WebinarReminderType; date: string }> = [
    { type: 'day_minus_1', date: addDays(todayWib, 1) },
    { type: 'day_of', date: todayWib },
  ];

  let sent = 0;
  for (const target of targets) {
    const rows = await fetchReminderRows(env.DB, target.type, target.date);
    for (const row of rows) {
      try {
        if (await sendReminder(env, row, target.type, now)) sent += 1;
      } catch (err) {
        console.error('[webinar-reminders] failed to enqueue reminder', {
          registrationId: row.registration_id,
          webinarId: row.webinar_id,
          reminderType: target.type,
          err,
        });
      }
    }
  }

  return { sent, skipped: false };
}
