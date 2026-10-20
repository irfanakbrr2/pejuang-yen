import type { Env } from '../../env';
import { canSendEmail } from '../../lib/email-guard';
import { sendMailketingEmail } from '../../services/mailketing';
import { renderSequenceEmail } from '../../lib/email-templates';
import type { SequenceEmailContext } from '../../lib/email-templates';

interface SequenceStep {
  id: string;
  sequence_id: string;
  step_order: number;
  delay_minutes: number;
  subject: string;
  preview_text: string | null;
  template_key: string;
  cta_url: string;
  content: string | null;
  segment_condition: string | null;
}

interface SequenceState {
  id: string;
  user_id: string;
  sequence_id: string;
  current_step: number;
  status: string;
  next_send_at: string | null;
  failure_count: number | null;
  last_error: string | null;
}

interface UserContext {
  email: string;
  name: string | null;
}

export const SEQUENCE_PROCESS_BATCH_LIMIT = 200;

// Cloudflare cron tidak mencegah invocation tumpang-tindih, dan email dikirim
// SEBELUM state di-advance. Tiap step "diklaim" dulu dengan menggeser next_send_at
// ke masa depan sejauh lease ini (CAS atomik) — lebih panjang dari durasi run cron
// wajar agar holder yang crash bisa di-retry, cukup pendek untuk recovery cepat.
const SEQUENCE_CLAIM_LEASE_MS = 15 * 60 * 1000;

export interface SequenceProcessSummary {
  selected: number;
  sent: number;
  failed: number;
  cancelled: number;
  completed: number;
  retried: number;
}

type SequenceProcessDelta = Omit<SequenceProcessSummary, 'selected'>;

function emptyDelta(): SequenceProcessDelta {
  return { sent: 0, failed: 0, cancelled: 0, completed: 0, retried: 0 };
}

function addDelta(summary: SequenceProcessSummary, delta: SequenceProcessDelta): void {
  summary.sent += delta.sent;
  summary.failed += delta.failed;
  summary.cancelled += delta.cancelled;
  summary.completed += delta.completed;
  summary.retried += delta.retried;
}

function substituteSequenceVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

async function scheduleSequenceRetry(
  state: SequenceState,
  reason: string,
  db: D1Database
): Promise<'failed' | 'retried'> {
  const now = new Date().toISOString();
  const nextFailureCount = (state.failure_count || 0) + 1;
  const cleanReason = reason.slice(0, 500);

  if (nextFailureCount >= 3) {
    await db.prepare(
      `UPDATE user_email_sequence_state
       SET status = 'failed', failure_count = ?, last_error = ?, updated_at = ?
       WHERE id = ?`
    ).bind(nextFailureCount, cleanReason, now, state.id).run();
    return 'failed';
  }

  const nextSendAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  await db.prepare(
    `UPDATE user_email_sequence_state
     SET failure_count = ?, last_error = ?, next_send_at = ?, updated_at = ?
     WHERE id = ?`
  ).bind(nextFailureCount, cleanReason, nextSendAt, now, state.id).run();
  return 'retried';
}

export async function startSequence(
  userId: string,
  sequenceName: string,
  db: D1Database,
  env: Env
): Promise<{ success: boolean; message: string }> {
  const now = new Date().toISOString();

  const sequence = await db.prepare(
    `SELECT id FROM email_sequences WHERE name = ? AND status = 'active'`
  ).bind(sequenceName).first() as { id: string } | null;

  if (!sequence) {
    return { success: false, message: `Sequence '${sequenceName}' not found or inactive` };
  }

  // Check if active state already exists for this user+sequence
  const existing = await db.prepare(
    `SELECT id FROM user_email_sequence_state WHERE user_id = ? AND sequence_id = ? AND status IN ('active', 'paused') LIMIT 1`
  ).bind(userId, sequence.id).first();

  if (existing) {
    return { success: false, message: 'Sequence already active for this user' };
  }

  await db.prepare(
    `INSERT INTO user_email_sequence_state (id, user_id, sequence_id, current_step, status, next_send_at, created_at, updated_at)
     VALUES (?, ?, ?, 1, 'active', ?, ?, ?)`
  ).bind(crypto.randomUUID(), userId, sequence.id, now, now, now).run();

  return { success: true, message: `Sequence '${sequenceName}' started` };
}

export async function processReadySequenceSteps(db: D1Database, env: Env): Promise<SequenceProcessSummary> {
  const now = new Date().toISOString();

  const states = await db.prepare(
    `SELECT s.id, s.user_id, s.sequence_id, s.current_step, s.status, s.next_send_at, s.failure_count, s.last_error
     FROM user_email_sequence_state s
     JOIN email_sequences es ON es.id = s.sequence_id AND es.status = 'active'
     WHERE s.status = 'active' AND s.next_send_at <= ?
     ORDER BY s.next_send_at ASC, s.created_at ASC
     LIMIT ?`
  ).bind(now, SEQUENCE_PROCESS_BATCH_LIMIT).all() as { results: SequenceState[] };

  const summary: SequenceProcessSummary = {
    selected: states.results.length,
    sent: 0,
    failed: 0,
    cancelled: 0,
    completed: 0,
    retried: 0,
  };

  for (const state of states.results) {
    addDelta(summary, await processOneState(state, db, env));
  }

  return summary;
}

async function processOneState(
  state: SequenceState,
  db: D1Database,
  env: Env
): Promise<SequenceProcessDelta> {
  const now = new Date().toISOString();

  try {
    // Claim step sebelum kerja kirim apa pun. SELECT di processReadySequenceSteps
    // memilih baris berdasarkan (status='active' AND next_send_at <= now); tanpa
    // klaim ini dua run cron yang overlap akan sama-sama meng-SELECT baris yang
    // sama lalu mengirim email dobel. CAS pada next_send_at persis yang kita baca:
    // hanya satu invocation menang; sisanya changes=0 → skip diam-diam.
    const leaseUntil = new Date(Date.now() + SEQUENCE_CLAIM_LEASE_MS).toISOString();
    const claim = await db.prepare(
      `UPDATE user_email_sequence_state
       SET next_send_at = ?, updated_at = ?
       WHERE id = ? AND status = 'active' AND next_send_at = ?`
    ).bind(leaseUntil, now, state.id, state.next_send_at).run();
    if (!claim.meta.changes) {
      // Sudah diklaim invocation lain — jangan kirim ulang.
      return emptyDelta();
    }

    const user = await db.prepare(
      'SELECT email, name FROM users WHERE id = ?'
    ).bind(state.user_id).first() as UserContext | null;

    if (!user) {
      await db.prepare(
        `UPDATE user_email_sequence_state SET status = 'failed', updated_at = ? WHERE id = ?`
      ).bind(now, state.id).run();
      return { ...emptyDelta(), failed: 1 };
    }

    const step = await db.prepare(
      `SELECT ess.*, es.name as sequence_name
       FROM email_sequence_steps ess
       JOIN email_sequences es ON es.id = ess.sequence_id
       WHERE ess.sequence_id = ? AND ess.step_order = ?`
    ).bind(state.sequence_id, state.current_step).first() as (SequenceStep & { sequence_name: string }) | null;

    if (!step) {
      // No more steps - sequence complete
      await db.prepare(
        `UPDATE user_email_sequence_state SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ?`
      ).bind(now, now, state.id).run();
      return { ...emptyDelta(), completed: 1 };
    }

    const guard = await canSendEmail(user.email, 'lifecycle', db);
    if (!guard.allowed) {
      await db.prepare(
        `UPDATE user_email_sequence_state SET status = 'cancelled', updated_at = ? WHERE id = ?`
      ).bind(now, state.id).run();
      return { ...emptyDelta(), cancelled: 1 };
    }

    // Fetch sequence-specific context for personalization
    const extraCtx: Partial<SequenceEmailContext> = {};

    if (step.sequence_name === 'membership_expiry') {
      const membership = await db.prepare(
        `SELECT expires_at FROM memberships WHERE user_id = ? AND status IN ('active', 'expired') ORDER BY expires_at DESC LIMIT 1`
      ).bind(state.user_id).first() as { expires_at: string } | null;
      if (membership?.expires_at) {
        extraCtx.membershipExpiry = new Date(membership.expires_at).toLocaleDateString('id-ID', {
          day: 'numeric', month: 'long', year: 'numeric',
        });
      }
    }

    if (step.sequence_name === 'post_purchase_onboarding') {
      const order = await db.prepare(
        `SELECT product_name FROM orders WHERE user_id = ? AND status = 'paid' AND order_type = 'course' ORDER BY paid_at DESC LIMIT 1`
      ).bind(state.user_id).first() as { product_name: string } | null;
      if (order) {
        extraCtx.courseName = order.product_name;
        extraCtx.productName = order.product_name;
      }
    }

    if (step.sequence_name === 'abandoned_checkout') {
      const checkout = await db.prepare(
        `SELECT ce.checkout_url, o.product_name
         FROM checkout_events ce
         LEFT JOIN orders o ON o.user_id = ce.user_id AND o.product_id = ce.product_id
         WHERE ce.user_id = ? AND ce.status = 'abandoned'
         ORDER BY ce.updated_at DESC LIMIT 1`
      ).bind(state.user_id).first() as { checkout_url: string | null; product_name: string | null } | null;
      if (checkout) {
        if (checkout.product_name) extraCtx.productName = checkout.product_name;
        if (checkout.checkout_url) extraCtx.checkoutUrl = checkout.checkout_url;
      }
    }

    if (step.sequence_name === 'course_progress_reminder') {
      const enrollment = await db.prepare(
        `SELECT c.title FROM enrollments e
         JOIN courses c ON c.id = e.course_id
         WHERE e.user_id = ? AND e.status = 'active' AND e.progress_percent > 0 AND e.progress_percent < 100
         ORDER BY e.updated_at DESC LIMIT 1`
      ).bind(state.user_id).first() as { title: string } | null;
      if (enrollment) {
        extraCtx.courseName = enrollment.title;
      }
    }

    if (step.sequence_name === 'webinar_registration_followup') {
      const webinar = await db.prepare(
        `SELECT w.title, w.starts_at, w.timezone, w.slug, w.join_url
         FROM webinar_registrations wr
         JOIN webinars w ON w.id = wr.webinar_id
         WHERE wr.user_id = ? AND wr.status = 'registered'
         ORDER BY wr.registered_at DESC
         LIMIT 1`
      ).bind(state.user_id).first() as {
        title: string;
        starts_at: string;
        timezone: string | null;
        slug: string;
        join_url: string | null;
      } | null;
      if (webinar) {
        extraCtx.webinarTitle = webinar.title;
        extraCtx.webinarStartsAt = webinar.starts_at;
        extraCtx.webinarTimezone = webinar.timezone || undefined;
        extraCtx.webinarDetailUrl = `https://app.pejuangyen.com/webinars/${webinar.slug}`;
        extraCtx.webinarJoinUrl = webinar.join_url;
      }
    }

    const firstName = (user.name || '').split(' ')[0];
    const dashboardUrl = 'https://app.pejuangyen.com/dashboard';
    const checkoutUrl = extraCtx.checkoutUrl || step.cta_url;
    const unsubUrl = `https://api.pejuangyen.com/api/unsubscribe?email=${encodeURIComponent(user.email)}`;
    const rawHtml = step.content
      ? substituteSequenceVars(step.content, {
          firstName,
          userName: user.name || firstName,
          courseName: extraCtx.courseName || '',
          productName: extraCtx.productName || extraCtx.courseName || '',
          checkoutUrl,
          dashboardUrl,
          unsubscribe_url: unsubUrl,
        })
      : renderSequenceEmail(step.template_key, step.cta_url, {
          userName: user.name || undefined,
          sequenceName: step.sequence_name,
          stepOrder: step.step_order,
          previewText: step.preview_text || undefined,
          ...extraCtx,
        });

    const html = rawHtml.replace(/\{\{unsubscribe_url\}\}/g, unsubUrl);

    const sendResult = await sendMailketingEmail(env, {
      recipient: user.email,
      subject: step.subject,
      content: html,
      sequenceId: state.sequence_id,
      emailType: 'lifecycle',
    }, db);

    if (sendResult.success) {
      // Log sent event
      await db.prepare(
        `INSERT INTO email_events (id, user_id, email, event_type, sequence_id, sequence_step_id, email_subject, provider, created_at)
         VALUES (?, ?, ?, 'sent', ?, ?, ?, 'mailketing', ?)`
      ).bind(crypto.randomUUID(), state.user_id, user.email, state.sequence_id, step.id, step.subject, now).run();
    } else {
      const retryStatus = await scheduleSequenceRetry(state, sendResult.error || sendResult.message || 'email_send_failed', db);
      return retryStatus === 'failed'
        ? { ...emptyDelta(), failed: 1 }
        : { ...emptyDelta(), retried: 1 };
    }

    // Check if there's a next step
    const nextStep = await db.prepare(
      `SELECT step_order, delay_minutes FROM email_sequence_steps WHERE sequence_id = ? AND step_order = ?`
    ).bind(state.sequence_id, state.current_step + 1).first() as { step_order: number; delay_minutes: number } | null;

    if (nextStep) {
      const nextSendAt = new Date(Date.now() + nextStep.delay_minutes * 60 * 1000).toISOString();
      await db.prepare(
        `UPDATE user_email_sequence_state
         SET current_step = ?, last_sent_at = ?, next_send_at = ?, failure_count = 0, last_error = NULL, updated_at = ?
         WHERE id = ?`
      ).bind(state.current_step + 1, now, nextSendAt, now, state.id).run();
      return { ...emptyDelta(), sent: 1 };
    } else {
      // Final step was just sent
      await db.prepare(
        `UPDATE user_email_sequence_state
         SET status = 'completed', last_sent_at = ?, completed_at = ?, failure_count = 0, last_error = NULL, updated_at = ?
         WHERE id = ?`
      ).bind(now, now, now, state.id).run();
      return { ...emptyDelta(), sent: 1, completed: 1 };
    }
  } catch (err) {
    console.error(`[sequence-engine] Error processing state ${state.id}:`, err);
    await db.prepare(
      `UPDATE user_email_sequence_state SET status = 'failed', updated_at = ? WHERE id = ?`
    ).bind(now, state.id).run();
    return { ...emptyDelta(), failed: 1 };
  }
}

export async function scanInactiveUsers(db: D1Database, env: Env): Promise<void> {
  // Users inactive for 30+ days who haven't been put in reactivation sequence
  const cutoff30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const inactiveSeq = await db.prepare(
    `SELECT id FROM email_sequences WHERE name = 'inactive_user_reactivation'`
  ).first() as { id: string } | null;
  if (!inactiveSeq) return;

  const inactiveUsers = await db.prepare(
    `SELECT u.id FROM users u
     LEFT JOIN email_marketing_profiles emp ON emp.user_id = u.id
     LEFT JOIN user_email_sequence_state uess ON uess.user_id = u.id AND uess.sequence_id = ?
     WHERE u.role = 'user'
       AND (u.last_login_at IS NULL OR u.last_login_at < ?)
       AND (emp.email_status IS NULL OR emp.email_status = 'subscribed')
       AND uess.id IS NULL
     LIMIT 100`
  ).bind(inactiveSeq.id, cutoff30).all();

  for (const row of inactiveUsers.results as { id: string }[]) {
    await startSequence(row.id, 'inactive_user_reactivation', db, env);
  }
}

export async function scanAbandonedCheckouts(db: D1Database, env: Env): Promise<void> {
  const now = new Date().toISOString();
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30 minutes ago

  const abandonedSeq = await db.prepare(
    `SELECT id FROM email_sequences WHERE name = 'abandoned_checkout'`
  ).first() as { id: string } | null;
  if (!abandonedSeq) return;

  // Find checkouts started > 30 min ago without a paid order for same product
  const abandoned = await db.prepare(
    `SELECT ce.id, ce.user_id, ce.email, ce.product_id FROM checkout_events ce
     LEFT JOIN orders o ON o.user_id = ce.user_id AND o.product_id = ce.product_id AND o.status = 'paid'
     LEFT JOIN user_email_sequence_state uess ON uess.user_id = ce.user_id AND uess.sequence_id = ?
     WHERE ce.status = 'started'
       AND ce.created_at < ?
       AND o.id IS NULL
       AND uess.id IS NULL
     LIMIT 50`
  ).bind(abandonedSeq.id, cutoff).all();

  for (const row of abandoned.results as { id: string; user_id: string | null; email: string; product_id: string | null }[]) {
    if (!row.user_id) continue;

    // Mark checkout as abandoned
    await db.prepare(
      `UPDATE checkout_events SET status = 'abandoned', updated_at = ? WHERE id = ?`
    ).bind(now, row.id).run();

    await startSequence(row.user_id, 'abandoned_checkout', db, env);
  }
}

export async function scanCourseInactive(db: D1Database, env: Env): Promise<void> {
  // Users enrolled in a course who made some progress but have been inactive for 3+ days
  const cutoff3d = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  const seq = await db.prepare(
    `SELECT id FROM email_sequences WHERE name = 'course_progress_reminder' AND status = 'active'`
  ).first() as { id: string } | null;
  if (!seq) return;

  const inactive = await db.prepare(
    `SELECT DISTINCT e.user_id FROM enrollments e
     LEFT JOIN user_email_sequence_state uess ON uess.user_id = e.user_id AND uess.sequence_id = ?
     WHERE e.status = 'active'
       AND e.progress_percent > 0
       AND e.progress_percent < 100
       AND uess.id IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM lesson_progress lp
         JOIN enrollments e2 ON e2.id = lp.enrollment_id
         WHERE e2.user_id = e.user_id AND lp.updated_at > ?
       )
     LIMIT 50`
  ).bind(seq.id, cutoff3d).all();

  for (const row of inactive.results as { user_id: string }[]) {
    await startSequence(row.user_id, 'course_progress_reminder', db, env);
  }
}

export async function scanMembershipExpiry(db: D1Database, env: Env): Promise<void> {
  const now = new Date().toISOString();

  const expirySeq = await db.prepare(
    `SELECT id FROM email_sequences WHERE name = 'membership_expiry'`
  ).first() as { id: string } | null;
  if (!expirySeq) return;

  const in7days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const expiring = await db.prepare(
    `SELECT m.user_id FROM memberships m
     LEFT JOIN user_email_sequence_state uess ON uess.user_id = m.user_id AND uess.sequence_id = ?
     WHERE m.status = 'active'
       AND m.expires_at IS NOT NULL
       AND date(m.expires_at) <= ?
       AND date(m.expires_at) >= date('now')
       AND uess.id IS NULL
     LIMIT 50`
  ).bind(expirySeq.id, in7days).all();

  for (const row of expiring.results as { user_id: string }[]) {
    await startSequence(row.user_id, 'membership_expiry', db, env);
  }
}
