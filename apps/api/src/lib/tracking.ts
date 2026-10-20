import type { Env } from '../env';
import { normalizeUtmSet } from '@growwithai/shared';

export interface AttributionPatch {
  first_source?: string | null;
  first_medium?: string | null;
  first_campaign?: string | null;
  first_landing_page?: string | null;
  first_referrer?: string | null;
  first_affiliate_code?: string | null;
  first_referral_code?: string | null;
  first_webinar_id?: string | null;
  first_touch_at?: string | null;
  last_source?: string | null;
  last_medium?: string | null;
  last_campaign?: string | null;
  last_landing_page?: string | null;
  last_referrer?: string | null;
  last_affiliate_code?: string | null;
  last_referral_code?: string | null;
  last_webinar_id?: string | null;
  last_touch_at?: string | null;
  signup_source?: string | null;
}

export interface UpgradeSnap {
  upgrade_source?: string | null;
  upgrade_medium?: string | null;
  upgrade_campaign?: string | null;
  upgrade_page?: string | null;
  upgrade_webinar_id?: string | null;
  upgraded_at: string;
}

export interface ServerTrackedEvent {
  event_name: string;
  event_category?: string;
  user_id?: string | null;
  anonymous_id?: string | null;
  session_id?: string | null;
  page_url?: string | null;
  referrer_url?: string | null;
  landing_page?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  affiliate_code?: string | null;
  referral_code?: string | null;
  course_id?: string | null;
  lesson_id?: string | null;
  webinar_id?: string | null;
  bonus_id?: string | null;
  recording_id?: string | null;
  order_id?: string | null;
  coupon_code?: string | null;
  plan_before?: string | null;
  plan_after?: string | null;
  payment_amount?: number | null;
  payment_status?: string | null;
  device_type?: string | null;
  country?: string | null;
  metadata?: unknown;
}

export function buildTrackingInsert(env: Env, evt: ServerTrackedEvent): D1PreparedStatement {
  // Normalisasi UTM di INGEST — choke point yang menangkap SEMUA traffic, termasuk
  // link mentah (bukan hanya shortlink). Inilah yang membuat acquisition_daily kanonik.
  const utm = normalizeUtmSet({
    source: evt.utm_source,
    medium: evt.utm_medium,
    campaign: evt.utm_campaign,
    content: evt.utm_content,
    term: evt.utm_term,
  });
  return env.DB.prepare(
    `INSERT OR IGNORE INTO tracking_events (
       id, user_id, anonymous_id, session_id, event_name, event_category,
       page_url, referrer_url, landing_page,
       utm_source, utm_medium, utm_campaign, utm_term, utm_content,
       affiliate_code, referral_code,
       course_id, lesson_id, webinar_id, bonus_id, recording_id,
       order_id, coupon_code, plan_before, plan_after,
       payment_amount, payment_status, device_type, country, metadata_json, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(),
    evt.user_id || null,
    evt.anonymous_id || null,
    evt.session_id || null,
    evt.event_name,
    evt.event_category || null,
    evt.page_url || null,
    evt.referrer_url || null,
    evt.landing_page || null,
    utm.utm_source,
    utm.utm_medium,
    utm.utm_campaign,
    utm.utm_term,
    utm.utm_content,
    evt.affiliate_code || null,
    evt.referral_code || null,
    evt.course_id || null,
    evt.lesson_id || null,
    evt.webinar_id || null,
    evt.bonus_id || null,
    evt.recording_id || null,
    evt.order_id || null,
    evt.coupon_code || null,
    evt.plan_before || null,
    evt.plan_after || null,
    evt.payment_amount ?? null,
    evt.payment_status || null,
    evt.device_type || null,
    evt.country || null,
    evt.metadata ? JSON.stringify(evt.metadata) : null,
    new Date().toISOString()
  );
}

export function buildActivityDayInsert(env: Env, userId: string): D1PreparedStatement {
  const now = new Date().toISOString();
  return env.DB.prepare(
    `INSERT OR IGNORE INTO user_activity_days (user_id, activity_date, first_seen_at)
     VALUES (?, ?, ?)`
  ).bind(userId, now.slice(0, 10), now);
}

/**
 * Insert one tracking event (+ activity day when a user is attached).
 * Never throws — tracking must not break auth/payment/learning flows.
 */
export async function trackServerEvent(env: Env, evt: ServerTrackedEvent): Promise<void> {
  try {
    const statements = [buildTrackingInsert(env, evt)];
    if (evt.user_id) statements.push(buildActivityDayInsert(env, evt.user_id));
    await env.DB.batch(statements);
  } catch (err) {
    console.error('[tracking] Failed to write event:', evt.event_name, err);
  }
}

/**
 * Upsert per-user attribution. First-touch columns are written once and never
 * overwritten; last-touch columns follow the most recent non-null signal.
 * Never throws.
 */
export async function upsertUserAttribution(env: Env, userId: string, attr: AttributionPatch): Promise<void> {
  try {
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO user_attribution (
         user_id,
         first_source, first_medium, first_campaign, first_landing_page, first_referrer,
         first_affiliate_code, first_referral_code, first_webinar_id, first_touch_at,
         last_source, last_medium, last_campaign, last_landing_page, last_referrer,
         last_affiliate_code, last_referral_code, last_webinar_id, last_touch_at,
         signup_source, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         first_source = COALESCE(user_attribution.first_source, excluded.first_source),
         first_medium = COALESCE(user_attribution.first_medium, excluded.first_medium),
         first_campaign = COALESCE(user_attribution.first_campaign, excluded.first_campaign),
         first_landing_page = COALESCE(user_attribution.first_landing_page, excluded.first_landing_page),
         first_referrer = COALESCE(user_attribution.first_referrer, excluded.first_referrer),
         first_affiliate_code = COALESCE(user_attribution.first_affiliate_code, excluded.first_affiliate_code),
         first_referral_code = COALESCE(user_attribution.first_referral_code, excluded.first_referral_code),
         first_webinar_id = COALESCE(user_attribution.first_webinar_id, excluded.first_webinar_id),
         first_touch_at = COALESCE(user_attribution.first_touch_at, excluded.first_touch_at),
         last_source = COALESCE(excluded.last_source, user_attribution.last_source),
         last_medium = COALESCE(excluded.last_medium, user_attribution.last_medium),
         last_campaign = COALESCE(excluded.last_campaign, user_attribution.last_campaign),
         last_landing_page = COALESCE(excluded.last_landing_page, user_attribution.last_landing_page),
         last_referrer = COALESCE(excluded.last_referrer, user_attribution.last_referrer),
         last_affiliate_code = COALESCE(excluded.last_affiliate_code, user_attribution.last_affiliate_code),
         last_referral_code = COALESCE(excluded.last_referral_code, user_attribution.last_referral_code),
         last_webinar_id = COALESCE(excluded.last_webinar_id, user_attribution.last_webinar_id),
         last_touch_at = COALESCE(excluded.last_touch_at, user_attribution.last_touch_at),
         signup_source = COALESCE(user_attribution.signup_source, excluded.signup_source),
         updated_at = excluded.updated_at`
    ).bind(
      userId,
      attr.first_source || null,
      attr.first_medium || null,
      attr.first_campaign || null,
      attr.first_landing_page || null,
      attr.first_referrer || null,
      attr.first_affiliate_code || null,
      attr.first_referral_code || null,
      attr.first_webinar_id || null,
      attr.first_touch_at || null,
      attr.last_source || null,
      attr.last_medium || null,
      attr.last_campaign || null,
      attr.last_landing_page || null,
      attr.last_referrer || null,
      attr.last_affiliate_code || null,
      attr.last_referral_code || null,
      attr.last_webinar_id || null,
      attr.last_touch_at || null,
      attr.signup_source || null,
      now,
      now
    ).run();
  } catch (err) {
    console.error('[tracking] Failed to upsert attribution for user:', userId, err);
  }
}

/**
 * Record the source that influenced the first upgrade. First upgrade wins —
 * later renewals/upgrades do not overwrite. Never throws.
 */
export async function recordUpgradeAttribution(env: Env, userId: string, snap: UpgradeSnap): Promise<void> {
  try {
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO user_attribution (user_id, upgrade_source, upgrade_medium, upgrade_campaign, upgrade_page, upgrade_webinar_id, upgraded_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         upgrade_source = CASE WHEN user_attribution.upgraded_at IS NULL THEN excluded.upgrade_source ELSE user_attribution.upgrade_source END,
         upgrade_medium = CASE WHEN user_attribution.upgraded_at IS NULL THEN excluded.upgrade_medium ELSE user_attribution.upgrade_medium END,
         upgrade_campaign = CASE WHEN user_attribution.upgraded_at IS NULL THEN excluded.upgrade_campaign ELSE user_attribution.upgrade_campaign END,
         upgrade_page = CASE WHEN user_attribution.upgraded_at IS NULL THEN excluded.upgrade_page ELSE user_attribution.upgrade_page END,
         upgrade_webinar_id = CASE WHEN user_attribution.upgraded_at IS NULL THEN excluded.upgrade_webinar_id ELSE user_attribution.upgrade_webinar_id END,
         upgraded_at = COALESCE(user_attribution.upgraded_at, excluded.upgraded_at),
         updated_at = excluded.updated_at`
    ).bind(
      userId,
      snap.upgrade_source || null,
      snap.upgrade_medium || null,
      snap.upgrade_campaign || null,
      snap.upgrade_page || null,
      snap.upgrade_webinar_id || null,
      snap.upgraded_at,
      now,
      now
    ).run();
  } catch (err) {
    console.error('[tracking] Failed to record upgrade attribution for user:', userId, err);
  }
}

export function deviceTypeFromUA(ua: string | undefined): 'mobile' | 'tablet' | 'desktop' {
  if (!ua) return 'desktop';
  if (/ipad|tablet|playbook|silk/i.test(ua)) return 'tablet';
  if (/mobi|iphone|android/i.test(ua)) return 'mobile';
  return 'desktop';
}
