import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error } from '../../lib/response';
import { canSendEmail } from '../../lib/email-guard';
import { updateEmailMarketingProfile } from '../../lib/email-suppression';
import {
  sendMailketingEmail,
  addSubscriberToList,
  getAllLists,
  checkCredits,
} from '../../services/mailketing';
import { startSequence } from './sequence-engine';

const emailRoutes = new Hono<{ Bindings: Env }>();

emailRoutes.use('*', authMiddleware());
emailRoutes.use('*', requireRole('admin', 'super_admin'));

// POST /api/email/send
emailRoutes.post('/send', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return error(c, 'Invalid JSON', 400);

  const { recipient, subject, content, emailType = 'marketing', campaignId, sequenceId } = body as Record<string, string>;

  if (!recipient || !subject || !content) {
    return error(c, 'recipient, subject, and content are required', 400);
  }

  const guard = await canSendEmail(recipient, emailType as 'transactional' | 'marketing' | 'lifecycle' | 'notification', c.env.DB);
  if (!guard.allowed) {
    return error(c, `Cannot send email: ${guard.reason}`, 422);
  }

  const credits = await checkCredits(c.env);
  if (credits.isEmpty && emailType !== 'transactional') {
    return error(c, 'Mailketing credits empty. Non-transactional email cannot be sent.', 503);
  }

  const result = await sendMailketingEmail(c.env, { recipient, subject, content, emailType: emailType as 'transactional' | 'marketing' | 'lifecycle' | 'notification', campaignId, sequenceId }, c.env.DB);

  if (!result.success) {
    return error(c, result.error || 'Failed to send email', 500);
  }

  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO email_events (id, email, event_type, campaign_id, sequence_id, email_subject, provider, created_at)
     VALUES (?, ?, 'sent', ?, ?, ?, 'mailketing', ?)`
  ).bind(crypto.randomUUID(), recipient.toLowerCase(), campaignId || null, sequenceId || null, subject, now).run().catch(console.error);

  return success(c, { message: 'Email sent', result });
});

// POST /api/email/subscribe
emailRoutes.post('/subscribe', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return error(c, 'Invalid JSON', 400);

  const { email, firstName, lastName, listId, role, interest, source, utmSource, utmMedium, utmCampaign } = body as Record<string, string>;

  if (!email || !listId) return error(c, 'email and listId are required', 400);

  const now = new Date().toISOString();

  // Upsert user
  let user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase()).first() as { id: string } | null;
  if (!user) {
    const userId = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO users (id, email, name, role, status, created_at, updated_at) VALUES (?, ?, ?, 'user', 'active', ?, ?)`
    ).bind(userId, email.toLowerCase(), firstName ? `${firstName} ${lastName || ''}`.trim() : email.split('@')[0], now, now).run();
    user = { id: userId };
  }

  // Upsert email marketing profile
  await updateEmailMarketingProfile(user.id, email, {
    user_role: role || 'general',
    interest: interest || null,
    source: source || null,
    utm_source: utmSource || null,
    utm_medium: utmMedium || null,
    utm_campaign: utmCampaign || null,
    email_status: 'subscribed',
    marketing_consent: 1,
  }, c.env.DB);

  // Add to Mailketing list
  const result = await addSubscriberToList(c.env, {
    listId, email, firstName, lastName, role, interest, source, utmSource, utmMedium, utmCampaign,
  });

  // Trigger segment nurture when a role is explicitly provided
  if (role) {
    startSequence(user.id, 'segment_based_nurturing', c.env.DB, c.env).catch(err => console.error('[subscribe] segment_nurture error:', err));
  }

  return success(c, { message: 'Subscriber added', userId: user.id, mailketingResult: result });
});

// GET /api/email/lists
emailRoutes.get('/lists', async (c) => {
  const lists = await c.env.DB.prepare('SELECT * FROM mailketing_lists ORDER BY list_name ASC').all();
  return success(c, { lists: lists.results });
});

// POST /api/email/sync-lists
emailRoutes.post('/sync-lists', async (c) => {
  const lists = await getAllLists(c.env);
  const now = new Date().toISOString();

  for (const list of lists) {
    await c.env.DB.prepare(
      `INSERT INTO mailketing_lists (id, list_id, list_name, synced_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(list_id) DO UPDATE SET list_name = excluded.list_name, synced_at = excluded.synced_at, updated_at = excluded.updated_at`
    ).bind(crypto.randomUUID(), list.id, list.name, now, now, now).run();
  }

  return success(c, { message: `Synced ${lists.length} lists`, lists });
});

// GET /api/email/credits
emailRoutes.get('/credits', async (c) => {
  const credits = await checkCredits(c.env);
  return success(c, { credits });
});

// POST /api/email/trigger-sequence
emailRoutes.post('/trigger-sequence', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body) return error(c, 'Invalid JSON', 400);

  const { userId, sequenceName } = body as Record<string, string>;
  if (!userId || !sequenceName) return error(c, 'userId and sequenceName are required', 400);

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first();
  if (!user) return error(c, 'User not found', 404);

  const result = await startSequence(userId, sequenceName, c.env.DB, c.env);
  if (!result.success) return error(c, result.message, 409);

  return success(c, { message: result.message });
});

export default emailRoutes;
