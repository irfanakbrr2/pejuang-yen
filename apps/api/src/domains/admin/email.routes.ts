import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error } from '../../lib/response';
import { checkCredits, sendMailketingEmail } from '../../services/mailketing';
import { renderSequenceEmail } from '../../lib/email-templates';
import { assertEmailSchema } from '../../lib/email-schema';

const COMMUNITY_WHATSAPP_URL = 'https://chat.whatsapp.com/REPLACE_PEJUANGYEN_COMMUNITY_GROUP';

function substituteVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

const adminEmailRoutes = new Hono<{ Bindings: Env }>();

adminEmailRoutes.use('*', authMiddleware());
adminEmailRoutes.use('*', requireRole('admin', 'super_admin'));

// GET /api/admin/email/diagnostics
adminEmailRoutes.get('/diagnostics', async (c) => {
  try {
    const db = c.env.DB;
    const now = new Date().toISOString();
    const [
      schema,
      backlogTotal,
      backlogBreakdown,
      failureBuckets,
      lastSequenceRuns,
      failedQueueLogs,
      recentEmailErrors,
      credits,
    ] = await Promise.all([
      assertEmailSchema(db),
      db.prepare(
        `SELECT COUNT(*) as count
         FROM user_email_sequence_state s
         JOIN email_sequences es ON es.id = s.sequence_id AND es.status = 'active'
         JOIN email_sequence_steps st ON st.sequence_id = s.sequence_id AND st.step_order = s.current_step
         WHERE s.status = 'active' AND s.next_send_at <= ? AND COALESCE(s.failure_count, 0) < 5`
      ).bind(now).first(),
      db.prepare(
        `SELECT es.id as sequence_id, es.name as sequence_name, s.current_step,
                COUNT(*) as ready_count,
                MIN(s.next_send_at) as oldest_next_send_at
         FROM user_email_sequence_state s
         JOIN email_sequences es ON es.id = s.sequence_id AND es.status = 'active'
         JOIN email_sequence_steps st ON st.sequence_id = s.sequence_id AND st.step_order = s.current_step
         WHERE s.status = 'active' AND s.next_send_at <= ? AND COALESCE(s.failure_count, 0) < 5
         GROUP BY es.id, es.name, s.current_step
         ORDER BY ready_count DESC
         LIMIT 20`
      ).bind(now).all(),
      db.prepare(
        `SELECT s.status, COALESCE(s.failure_count, 0) as failure_count,
                COALESCE(s.last_error, '') as last_error,
                COUNT(*) as count
         FROM user_email_sequence_state s
         GROUP BY s.status, COALESCE(s.failure_count, 0), COALESCE(s.last_error, '')
         ORDER BY failure_count DESC, count DESC
         LIMIT 30`
      ).all(),
      db.prepare(
        `SELECT id, started_at, finished_at, selected_count, sent_count, failed_count,
                retried_count, cancelled_count, completed_count, error_message
         FROM email_sequence_runs
         ORDER BY started_at DESC
         LIMIT 10`
      ).all(),
      db.prepare(
        `SELECT queue_name, COUNT(*) as count, MAX(created_at) as last_failed_at
         FROM failed_queue_logs
         WHERE queue_name LIKE '%email-sequences%'
         GROUP BY queue_name`
      ).all(),
      db.prepare(
        `SELECT id, source, message, created_at
         FROM error_logs
         WHERE lower(source) LIKE '%email%'
            OR lower(source) LIKE '%sequence%'
            OR lower(message) LIKE '%mailketing%'
            OR lower(message) LIKE '%email%'
            OR lower(message) LIKE '%sequence%'
         ORDER BY created_at DESC
         LIMIT 10`
      ).all(),
      checkCredits(c.env).catch(() => ({ balance: 0, isWarning: true, isCritical: true, isEmpty: true })),
    ]);

    return success(c, {
      generatedAt: now,
      schema,
      sequenceBacklog: {
        totalReady: (backlogTotal as any)?.count || 0,
        breakdown: backlogBreakdown.results,
      },
      sequenceFailures: failureBuckets.results,
      lastSequenceRuns: lastSequenceRuns.results,
      failedQueueLogs: failedQueueLogs.results,
      recentEmailErrors: recentEmailErrors.results,
      mailketingCredits: credits,
    });
  } catch (err: any) {
    return error(c, `Failed to load diagnostics: ${err.message}`, 500);
  }
});

// GET /api/admin/email/overview
adminEmailRoutes.get('/overview', async (c) => {
  try {
    const db = c.env.DB;
    const today = new Date().toISOString().slice(0, 10);

    const [
      totalUsers,
      activeSubs,
      unsubCount,
      paidUsers,
      emailsSentToday,
      attributedRevenue,
      totalOpens,
      totalClicks,
      totalBounced,
      activeSequenceUsers,
    ] = await Promise.all([
      db.prepare(`SELECT COUNT(*) as count FROM users WHERE role = 'user'`).first(),
      db.prepare(`SELECT COUNT(*) as count FROM email_marketing_profiles WHERE email_status = 'subscribed'`).first(),
      db.prepare(`SELECT COUNT(*) as count FROM email_marketing_profiles WHERE email_status = 'unsubscribed'`).first(),
      db.prepare(`SELECT COUNT(*) as count FROM email_marketing_profiles WHERE is_paid_user = 1`).first(),
      db.prepare(`SELECT COUNT(*) as count FROM email_events WHERE event_type = 'sent' AND created_at >= ?`).bind(`${today}T00:00:00.000Z`).first(),
      db.prepare(`
        SELECT COALESCE(SUM(p.amount), 0) as total
        FROM payments p
        JOIN orders o ON o.id = p.order_id
        WHERE o.email_campaign_id IS NOT NULL AND p.status = 'paid'
      `).first(),
      db.prepare(`SELECT COUNT(*) as count FROM email_events WHERE event_type = 'opened'`).first(),
      db.prepare(`SELECT COUNT(*) as count FROM email_events WHERE event_type = 'clicked'`).first(),
      db.prepare(`SELECT COUNT(*) as count FROM email_events WHERE event_type = 'bounced'`).first(),
      db.prepare(`SELECT COUNT(DISTINCT user_id) as count FROM user_email_sequence_state WHERE status = 'active'`).first(),
    ]);

    const credits = await checkCredits(c.env).catch(() => ({ balance: 0, isWarning: true, isCritical: true, isEmpty: true }));

    return success(c, {
      totalSubscribers: (totalUsers as any)?.count || 0,
      activeSubscribers: (activeSubs as any)?.count || 0,
      unsubscribedUsers: (unsubCount as any)?.count || 0,
      paidUsers: (paidUsers as any)?.count || 0,
      emailsSentToday: (emailsSentToday as any)?.count || 0,
      emailAttributedRevenue: (attributedRevenue as any)?.total || 0,
      totalOpens: (totalOpens as any)?.count || 0,
      totalClicks: (totalClicks as any)?.count || 0,
      totalBounced: (totalBounced as any)?.count || 0,
      activeSequenceUsers: (activeSequenceUsers as any)?.count || 0,
      mailketingCredits: credits,
    });
  } catch (err: any) {
    return error(c, `Failed to load overview: ${err.message}`, 500);
  }
});

// GET /api/admin/email/campaigns
adminEmailRoutes.get('/campaigns', async (c) => {
  try {
    const campaigns = await c.env.DB.prepare(
      `SELECT id, name, campaign_type, segment, status, subject,
              sent_count, open_count, click_count, bounce_count, unsubscribe_count,
              revenue_attributed, created_at, updated_at
       FROM email_campaigns
       ORDER BY created_at DESC
       LIMIT 100`
    ).all();

    const enriched = (campaigns.results as any[]).map(cam => ({
      ...cam,
      openRate: cam.sent_count > 0 ? ((cam.open_count / cam.sent_count) * 100).toFixed(1) : '0',
      clickRate: cam.sent_count > 0 ? ((cam.click_count / cam.sent_count) * 100).toFixed(1) : '0',
      conversionRate: cam.sent_count > 0 ? ((cam.revenue_attributed > 0 ? 1 : 0) / cam.sent_count * 100).toFixed(1) : '0',
    }));

    return success(c, { campaigns: enriched });
  } catch (err: any) {
    return error(c, `Failed to load campaigns: ${err.message}`, 500);
  }
});

// GET /api/admin/email/sequences
adminEmailRoutes.get('/sequences', async (c) => {
  try {
    const db = c.env.DB;

    const sequences = await db.prepare(
      `SELECT es.id, es.name, es.trigger_event, es.description, es.status,
              COUNT(uess.id) as total_started,
              SUM(CASE WHEN uess.status = 'active' THEN 1 ELSE 0 END) as active_users,
              SUM(CASE WHEN uess.status = 'completed' THEN 1 ELSE 0 END) as completed_users,
              SUM(CASE WHEN uess.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_users,
              SUM(CASE WHEN uess.status = 'failed' THEN 1 ELSE 0 END) as failed_users
       FROM email_sequences es
       LEFT JOIN user_email_sequence_state uess ON uess.sequence_id = es.id
       GROUP BY es.id
       ORDER BY es.name ASC`
    ).all();

    // Step drop-off for each sequence
    const stepDropoff = await db.prepare(
      `SELECT ess.sequence_id, ess.id as step_id, ess.step_order, ess.subject,
              COUNT(ee.id) as sent_count,
              COUNT(DISTINCT ee.email) as unique_recipients,
              MAX(ee.created_at) as last_sent_at
       FROM email_sequence_steps ess
       LEFT JOIN email_events ee ON ee.sequence_id = ess.sequence_id
        AND ee.event_type = 'sent'
        AND (
          ee.sequence_step_id = ess.id
          OR (ee.sequence_step_id IS NULL AND ee.email_subject = ess.subject)
        )
       GROUP BY ess.sequence_id, ess.step_order
       ORDER BY ess.sequence_id, ess.step_order ASC`
    ).all();

    const dropoffBySeq: Record<string, unknown[]> = {};
    for (const row of stepDropoff.results as any[]) {
      if (!dropoffBySeq[row.sequence_id]) dropoffBySeq[row.sequence_id] = [];
      dropoffBySeq[row.sequence_id].push(row);
    }

    const enriched = (sequences.results as any[]).map(seq => ({
      ...seq,
      completionRate: seq.total_started > 0 ? ((seq.completed_users / seq.total_started) * 100).toFixed(1) : '0',
      stepDropoff: dropoffBySeq[seq.id] || [],
    }));

    return success(c, { sequences: enriched });
  } catch (err: any) {
    return error(c, `Failed to load sequences: ${err.message}`, 500);
  }
});

// GET /api/admin/email/events
adminEmailRoutes.get('/events', async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);
    const limit = 100;
    const offset = (page - 1) * limit;
    const eventType = c.req.query('type');
    const email = c.req.query('email');

    let query = `SELECT ee.*, u.name as user_name FROM email_events ee LEFT JOIN users u ON u.email = ee.email WHERE 1=1`;
    const binds: unknown[] = [];

    if (eventType) { query += ` AND ee.event_type = ?`; binds.push(eventType); }
    if (email) { query += ` AND ee.email LIKE ?`; binds.push(`%${email}%`); }

    query += ` ORDER BY ee.created_at DESC LIMIT ? OFFSET ?`;
    binds.push(limit, offset);

    const events = await c.env.DB.prepare(query).bind(...binds).all();
    return success(c, { events: events.results, page, limit });
  } catch (err: any) {
    return error(c, `Failed to load events: ${err.message}`, 500);
  }
});

// GET /api/admin/email/suppression
adminEmailRoutes.get('/suppression', async (c) => {
  try {
    const page = Number(c.req.query('page') || 1);
    const limit = 100;
    const offset = (page - 1) * limit;

    const list = await c.env.DB.prepare(
      `SELECT id, email, reason, source, created_at FROM email_suppression_list ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(limit, offset).all();

    const total = await c.env.DB.prepare(`SELECT COUNT(*) as count FROM email_suppression_list`).first();

    return success(c, { suppressionList: list.results, total: (total as any)?.count || 0, page, limit });
  } catch (err: any) {
    return error(c, `Failed to load suppression list: ${err.message}`, 500);
  }
});

// GET /api/admin/email/hot-leads
adminEmailRoutes.get('/hot-leads', async (c) => {
  try {
    const minScore = Number(c.req.query('minScore') || 30);

    const leads = await c.env.DB.prepare(
      `SELECT u.id, u.email, u.name, emp.user_role, emp.interest, emp.engagement_score,
              emp.last_email_click_at, emp.membership_status, emp.is_paid_user
       FROM email_marketing_profiles emp
       JOIN users u ON u.id = emp.user_id
       WHERE emp.engagement_score >= ? AND emp.email_status = 'subscribed'
       ORDER BY emp.engagement_score DESC
       LIMIT 200`
    ).bind(minScore).all();

    return success(c, { hotLeads: leads.results, minScore });
  } catch (err: any) {
    return error(c, `Failed to load hot leads: ${err.message}`, 500);
  }
});

// GET /api/admin/email/abandoned-checkouts
adminEmailRoutes.get('/abandoned-checkouts', async (c) => {
  try {
    const checkouts = await c.env.DB.prepare(
      `SELECT ce.id, ce.email, ce.product_id, ce.amount, ce.status, ce.created_at, ce.updated_at,
              u.name as user_name,
              (SELECT uess.last_sent_at FROM user_email_sequence_state uess
               JOIN email_sequences es ON es.id = uess.sequence_id AND es.name = 'abandoned_checkout'
               WHERE uess.user_id = ce.user_id ORDER BY uess.created_at DESC LIMIT 1) as last_reminder_sent
       FROM checkout_events ce
       LEFT JOIN users u ON u.id = ce.user_id
       WHERE ce.status = 'abandoned'
       ORDER BY ce.created_at DESC
       LIMIT 100`
    ).all();

    return success(c, { abandonedCheckouts: checkouts.results });
  } catch (err: any) {
    return error(c, `Failed to load abandoned checkouts: ${err.message}`, 500);
  }
});

// GET /api/admin/email/templates
adminEmailRoutes.get('/templates', async (c) => {
  try {
    const db = c.env.DB;
    const [sequences, steps] = await Promise.all([
      db.prepare(
        `SELECT id, name, trigger_event, description FROM email_sequences WHERE status = 'active' ORDER BY name ASC`
      ).all(),
      db.prepare(
        `SELECT id, sequence_id, step_order, delay_minutes, subject, preview_text, template_key, cta_url, content FROM email_sequence_steps ORDER BY sequence_id, step_order ASC`
      ).all(),
    ]);

    const stepsBySeq: Record<string, unknown[]> = {};
    for (const step of steps.results as any[]) {
      if (!stepsBySeq[step.sequence_id]) stepsBySeq[step.sequence_id] = [];
      stepsBySeq[step.sequence_id].push({
        id: step.id,
        stepOrder: step.step_order,
        delayMinutes: step.delay_minutes,
        subject: step.subject,
        previewText: step.preview_text,
        templateKey: step.template_key,
        ctaUrl: step.cta_url,
        hasCustomContent: step.content !== null,
        content: step.content,
      });
    }

    const result = (sequences.results as any[]).map(seq => ({
      id: seq.id,
      name: seq.name,
      triggerEvent: seq.trigger_event,
      description: seq.description,
      steps: stepsBySeq[seq.id] || [],
    }));

    return success(c, { sequences: result });
  } catch (err: any) {
    return error(c, `Failed to load templates: ${err.message}`, 500);
  }
});

// GET /api/admin/email/templates/:stepId/preview
adminEmailRoutes.get('/templates/:stepId/preview', async (c) => {
  try {
    const stepId = c.req.param('stepId');
    const previewTextOverride = c.req.query('previewText');

    const step = await c.env.DB.prepare(
      `SELECT ess.id, ess.template_key, ess.cta_url, ess.preview_text, ess.step_order, es.name as sequence_name
       FROM email_sequence_steps ess
       JOIN email_sequences es ON es.id = ess.sequence_id
       WHERE ess.id = ?`
    ).bind(stepId).first() as any;

    if (!step) {
      return error(c, 'Step tidak ditemukan', 404);
    }

    const html = renderSequenceEmail(step.template_key, step.cta_url, {
      userName: 'Irfan',
      courseName: 'Persiapan JLPT N5',
      productName: 'Kelas Persiapan JLPT N5',
      membershipExpiry: '31 Des 2025',
      previewText: previewTextOverride || step.preview_text || undefined,
      sequenceName: step.sequence_name,
      stepOrder: step.step_order,
    });

    return success(c, { html, templateKey: step.template_key });
  } catch (err: any) {
    return error(c, `Failed to render preview: ${err.message}`, 500);
  }
});

// PUT /api/admin/email/templates/:stepId
adminEmailRoutes.put('/templates/:stepId', async (c) => {
  try {
    const stepId = c.req.param('stepId');
    const body = await c.req.json();
    const { subject, previewText, ctaUrl, content } = body;

    if (!subject || typeof subject !== 'string' || !subject.trim()) {
      return error(c, 'Subject wajib diisi', 400);
    }

    const now = new Date().toISOString();
    const result = await c.env.DB.prepare(
      `UPDATE email_sequence_steps SET subject = ?, preview_text = ?, cta_url = ?, content = ?, updated_at = ? WHERE id = ?`
    ).bind(subject.trim(), previewText?.trim() || null, ctaUrl || null, content || null, now, stepId).run();

    if (result.meta.changes === 0) {
      return error(c, 'Step tidak ditemukan', 404);
    }

    return success(c, { message: 'Template berhasil disimpan' });
  } catch (err: any) {
    return error(c, `Failed to update template: ${err.message}`, 500);
  }
});

// POST /api/admin/email/campaigns
adminEmailRoutes.post('/campaigns', async (c) => {
  try {
    const body = await c.req.json();
    const { name, subject, content, segment } = body;

    if (!name || !subject || !content) {
      return error(c, 'Nama, subject, dan konten wajib diisi', 400);
    }

    const validSegments = ['all', 'paid', 'free', 'employee', 'business', 'student', 'creator', 'freelancer'];
    const seg = segment && validSegments.includes(segment) ? segment : 'all';

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await c.env.DB.prepare(
      `INSERT INTO email_campaigns (id, name, campaign_type, segment, status, subject, content, created_at, updated_at)
       VALUES (?, ?, 'broadcast', ?, 'draft', ?, ?, ?, ?)`
    ).bind(id, name.trim(), seg, subject.trim(), content, now, now).run();

    return success(c, { id, message: 'Draft campaign berhasil dibuat' });
  } catch (err: any) {
    return error(c, `Gagal membuat campaign: ${err.message}`, 500);
  }
});

// POST /api/admin/email/campaigns/:id/send
adminEmailRoutes.post('/campaigns/:id/send', async (c) => {
  try {
    const campaignId = c.req.param('id');
    const db = c.env.DB;

    const campaign = await db.prepare(
      `SELECT id, name, subject, content, segment, status FROM email_campaigns WHERE id = ?`
    ).bind(campaignId).first() as any;

    if (!campaign) return error(c, 'Campaign tidak ditemukan', 404);
    if (campaign.status !== 'draft') return error(c, 'Hanya campaign dengan status draft yang bisa dikirim', 400);
    if (!campaign.content) return error(c, 'Konten campaign kosong', 400);

    // Build recipient query based on segment
    let recipientQuery = `SELECT u.id as user_id, u.email, u.name, emp.user_role FROM email_marketing_profiles emp JOIN users u ON u.id = emp.user_id WHERE emp.email_status = 'subscribed'`;
    if (campaign.segment === 'paid') recipientQuery += ` AND emp.is_paid_user = 1`;
    else if (campaign.segment === 'free') recipientQuery += ` AND emp.is_paid_user = 0`;
    else if (['employee', 'business', 'student', 'creator', 'freelancer'].includes(campaign.segment)) {
      recipientQuery += ` AND emp.user_role = '${campaign.segment}'`;
    }

    const recipients = await db.prepare(recipientQuery).all();
    const recipientList = recipients.results as Array<{ user_id: string; email: string; name: string; user_role: string | null }>;

    if (recipientList.length === 0) {
      return error(c, 'Tidak ada penerima yang memenuhi kriteria segmen', 400);
    }

    const credits = await checkCredits(c.env).catch(() => null);
    if (credits?.isEmpty) {
      return error(c, 'Kredit Mailketing tidak cukup untuk mengirim campaign', 400);
    }

    const now = new Date().toISOString();
    await db.prepare(
      `UPDATE email_campaigns SET status = 'sending', updated_at = ? WHERE id = ?`
    ).bind(now, campaignId).run();

    // Send emails per recipient with per-recipient variable substitution
    let sentCount = 0;
    for (const recipient of recipientList) {
      const firstName = (recipient.name || '').split(' ')[0] || '';
      const personalContent = substituteVars(campaign.content, {
        first_name: firstName,
        role: recipient.user_role || '',
        dashboard_url: 'https://app.pejuangyen.com/dashboard',
        support_email: COMMUNITY_WHATSAPP_URL,
        support_url: COMMUNITY_WHATSAPP_URL,
        community_whatsapp_url: COMMUNITY_WHATSAPP_URL,
        unsubscribe_url: `https://api.pejuangyen.com/api/unsubscribe?email=${encodeURIComponent(recipient.email)}`,
      });
      const personalSubject = substituteVars(campaign.subject, { first_name: firstName });

      const result = await sendMailketingEmail(c.env, {
        recipient: recipient.email,
        subject: personalSubject,
        content: personalContent,
        campaignId,
        emailType: 'marketing',
      }, db);
      if (result.success) {
        sentCount++;
        await db.prepare(
          `INSERT INTO email_events (id, user_id, email, event_type, campaign_id, email_subject, provider, created_at)
           VALUES (?, ?, ?, 'sent', ?, ?, 'mailketing', ?)`
        ).bind(
          crypto.randomUUID(),
          recipient.user_id,
          recipient.email.toLowerCase(),
          campaignId,
          personalSubject,
          new Date().toISOString()
        ).run().catch(console.error);
      }
    }

    const failedCount = recipientList.length - sentCount;
    const finalStatus = sentCount > 0 ? 'sent' : 'failed';
    await db.prepare(
      `UPDATE email_campaigns SET status = ?, sent_count = ?, updated_at = ? WHERE id = ?`
    ).bind(finalStatus, sentCount, new Date().toISOString(), campaignId).run();

    return success(c, {
      message: `Campaign berhasil dikirim ke ${sentCount} dari ${recipientList.length} penerima`,
      sent: sentCount,
      failed: failedCount,
      total: recipientList.length,
    });
  } catch (err: any) {
    return error(c, `Gagal mengirim campaign: ${err.message}`, 500);
  }
});

// POST /api/admin/email/send-test
adminEmailRoutes.post('/send-test', async (c) => {
  try {
    const body = await c.req.json();
    const { to, subject, html } = body;

    if (!to || !subject || !html) {
      return error(c, 'Email tujuan, subject, dan konten wajib diisi', 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return error(c, 'Format email tidak valid', 400);
    }

    const testHtml = substituteVars(html, {
      firstName: 'Test',
      userName: 'Test User',
      courseName: 'Persiapan JLPT N5',
      productName: 'Kelas Persiapan JLPT N5',
      checkoutUrl: 'https://app.pejuangyen.com/checkout/sample',
      dashboardUrl: 'https://app.pejuangyen.com/dashboard',
      unsubscribe_url: `https://api.pejuangyen.com/api/unsubscribe?email=${encodeURIComponent(to)}`,
      support_email: COMMUNITY_WHATSAPP_URL,
      support_url: COMMUNITY_WHATSAPP_URL,
      community_whatsapp_url: COMMUNITY_WHATSAPP_URL,
    });

    const result = await sendMailketingEmail(c.env, { recipient: to, subject, content: testHtml });

    if (!result.success) {
      return error(c, result.error || 'Gagal mengirim email test', 500);
    }

    return success(c, { message: `Email test berhasil dikirim ke ${to}` });
  } catch (err: any) {
    return error(c, `Gagal mengirim email test: ${err.message}`, 500);
  }
});

// PATCH /api/admin/email/sequences/:id/status
adminEmailRoutes.patch('/sequences/:id/status', async (c) => {
  try {
    const seqId = c.req.param('id');
    const body = await c.req.json();
    const { status } = body;

    if (!status || !['active', 'paused'].includes(status)) {
      return error(c, 'Status harus "active" atau "paused"', 400);
    }

    const now = new Date().toISOString();
    const result = await c.env.DB.prepare(
      `UPDATE email_sequences SET status = ?, updated_at = ? WHERE id = ?`
    ).bind(status, now, seqId).run();

    if (result.meta.changes === 0) {
      return error(c, 'Sequence tidak ditemukan', 404);
    }

    const label = status === 'active' ? 'diaktifkan' : 'dijeda';
    return success(c, { message: `Sequence berhasil ${label}` });
  } catch (err: any) {
    return error(c, `Gagal mengubah status sequence: ${err.message}`, 500);
  }
});

export default adminEmailRoutes;
