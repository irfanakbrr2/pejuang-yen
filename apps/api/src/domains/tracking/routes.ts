import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, optionalAuthMiddleware } from '../../middleware/auth';
import { rateLimit } from '../../middleware/rate-limit';
import { success } from '../../lib/response';
import {
  buildTrackingInsert,
  buildActivityDayInsert,
  deviceTypeFromUA,
  upsertUserAttribution,
  type AttributionPatch,
  type ServerTrackedEvent,
} from '../../lib/tracking';
import type { UserPublic } from '@growwithai/shared';

// Event names the client may emit directly. Sensitive lifecycle events
// (signup_completed, payment_success, membership_upgraded, ...) are emitted
// server-side only and silently dropped here.
const CLIENT_EVENT_WHITELIST = new Set([
  'page_view',
  'lesson_started',
  'lesson_progress',
  'checkout_intent',
  'bonus_viewed',
  'recording_viewed',
  'webinar_viewed',
]);

const MAX_BATCH = 20;
const MAX_STRING = 500;
const MAX_METADATA_JSON = 2048;

const STRING_FIELDS = [
  'anonymous_id', 'session_id', 'event_category',
  'page_url', 'referrer_url', 'landing_page',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'affiliate_code', 'referral_code',
  'course_id', 'lesson_id', 'webinar_id', 'bonus_id', 'recording_id',
  'coupon_code',
] as const;

function sanitizeClientEvent(raw: unknown, userId: string | null, deviceType: string, country: string | null): ServerTrackedEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Record<string, unknown>;
  const eventName = typeof input.event_name === 'string' ? input.event_name.trim() : '';
  if (!CLIENT_EVENT_WHITELIST.has(eventName)) return null;

  const evt: ServerTrackedEvent = {
    event_name: eventName,
    user_id: userId,
    device_type: deviceType,
    country,
  };

  for (const field of STRING_FIELDS) {
    const value = input[field];
    if (typeof value === 'string' && value.trim()) {
      (evt as unknown as Record<string, unknown>)[field] = value.trim().slice(0, MAX_STRING);
    }
  }

  if (input.metadata && typeof input.metadata === 'object') {
    const json = JSON.stringify(input.metadata);
    if (json.length <= MAX_METADATA_JSON) evt.metadata = input.metadata;
  }

  return evt;
}

const trackingRoutes = new Hono<{ Bindings: Env }>();

// Batched event ingest — anonymous allowed; always returns success so a
// tracking failure can never surface as an app error.
trackingRoutes.post(
  '/events',
  optionalAuthMiddleware(),
  rateLimit({
    max: 60,
    windowSec: 60,
    keyFn: (c) => `trk:${c.req.header('cf-connecting-ip') || 'unknown'}`,
    binding: 'RL_60_PER_MIN',
  }),
  async (c) => {
    try {
      const user = c.get('user') as UserPublic | undefined;
      const userId = user?.id || null;
      const deviceType = deviceTypeFromUA(c.req.header('user-agent'));
      const country = ((c.req.raw as { cf?: { country?: string } }).cf?.country) || null;

      const body = await c.req.json<{ events?: unknown[] }>().catch(() => null);
      const rawEvents = Array.isArray(body?.events) ? body.events.slice(0, MAX_BATCH) : [];

      const statements: D1PreparedStatement[] = [];
      let accepted = 0;
      for (const raw of rawEvents) {
        const evt = sanitizeClientEvent(raw, userId, deviceType, country);
        if (!evt) continue;
        statements.push(buildTrackingInsert(c.env, evt));
        accepted++;
      }
      if (userId && accepted > 0) {
        statements.push(buildActivityDayInsert(c.env, userId));
      }
      if (statements.length > 0) {
        await c.env.DB.batch(statements);
      }
      return success(c, { accepted });
    } catch (err) {
      console.error('[tracking] ingest error:', err);
      return success(c, { accepted: 0 });
    }
  }
);

// Link anonymous pre-signup activity to the logged-in user and merge
// client-captured attribution (first-touch preserved server-side).
trackingRoutes.post('/identify', authMiddleware(), async (c) => {
  try {
    const user = c.get('user') as UserPublic;
    const body = await c.req.json<{
      anonymous_id?: string;
      attribution?: { first?: Record<string, unknown>; last?: Record<string, unknown> };
    }>().catch(() => null);

    const anonymousId = typeof body?.anonymous_id === 'string' ? body.anonymous_id.trim().slice(0, MAX_STRING) : '';
    if (anonymousId) {
      await c.env.DB.prepare(
        `UPDATE tracking_events SET user_id = ?
         WHERE anonymous_id = ? AND user_id IS NULL AND created_at > datetime('now', '-30 days')`
      ).bind(user.id, anonymousId).run();
    }

    const patch = attributionPatchFromBody(body?.attribution);
    if (patch) {
      await upsertUserAttribution(c.env, user.id, patch);
    }

    return success(c, { identified: true });
  } catch (err) {
    console.error('[tracking] identify error:', err);
    return success(c, { identified: false });
  }
});

const ATTR_KEYS = ['source', 'medium', 'campaign', 'landing_page', 'referrer', 'affiliate_code', 'referral_code', 'webinar_id', 'ts'] as const;

export function attributionPatchFromBody(
  attribution: { first?: Record<string, unknown>; last?: Record<string, unknown> } | undefined | null
): AttributionPatch | null {
  if (!attribution || typeof attribution !== 'object') return null;
  const patch: AttributionPatch = {};
  let hasValue = false;

  for (const touch of ['first', 'last'] as const) {
    const raw = attribution[touch];
    if (!raw || typeof raw !== 'object') continue;
    for (const key of ATTR_KEYS) {
      const value = (raw as Record<string, unknown>)[key];
      if (typeof value !== 'string' || !value.trim()) continue;
      const clean = value.trim().slice(0, MAX_STRING);
      const target = key === 'ts' ? `${touch}_touch_at` : `${touch}_${key}`;
      (patch as Record<string, unknown>)[target] = clean;
      hasValue = true;
    }
  }

  return hasValue ? patch : null;
}

export default trackingRoutes;
