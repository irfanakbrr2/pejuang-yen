import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware } from '../../middleware/auth';
import { success, error } from '../../lib/response';
import { sendMailketingEmail } from '../../services/mailketing';
import {
  webinarAffiliateLeadEmailHtml,
  webinarRegistrationEmailHtml,
} from '../../lib/email-templates';
import { publicWebinarAffiliateLink } from '../../lib/affiliate-links';
import { startSequence } from '../email/sequence-engine';
import { trackServerEvent, upsertUserAttribution } from '../../lib/tracking';
import { awardPoints, POINTS } from '../../lib/gamification';
import { bumpChallengeProgress } from '../challenges/service';

const userWebinarsRoutes = new Hono<{ Bindings: Env }>();
userWebinarsRoutes.use('*', authMiddleware());

function getCookie(c: any, name: string): string {
  const cookieHeader = c.req.header('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function appAffiliateLink(slug: string, code: string): string {
  return `https://app.pejuangyen.com/webinars/${slug}?ref=${encodeURIComponent(code)}`;
}

async function getUserAffiliate(db: D1Database, userId: string) {
  return await db.prepare(
    `SELECT id, affiliate_code, public_ref_code, status FROM affiliate_accounts WHERE user_id = ? LIMIT 1`
  ).bind(userId).first() as any;
}

async function decorateWebinars(db: D1Database, rows: any[], userId: string, affiliateCode?: string, publicRefCode?: string) {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const placeholders = ids.map(() => '?').join(',');
  const regs = await db.prepare(
    `SELECT webinar_id, status, coupon_code, affiliate_code, registered_at
     FROM webinar_registrations
     WHERE user_id = ? AND webinar_id IN (${placeholders})`
  ).bind(userId, ...ids).all();

  const regMap = new Map((regs.results as any[]).map((reg) => [reg.webinar_id, reg]));
  return rows.map((row) => {
    const registration = regMap.get(row.id) || null;
    const isRegistered = Boolean(registration);
    const hasStarted = new Date(row.starts_at).getTime() <= Date.now();
    return {
      ...row,
      participants_preview: row.participants_preview ? JSON.parse(row.participants_preview) : [],
      event_state: hasStarted ? 'started' : 'upcoming',
      is_registered: isRegistered,
      registration,
      join_url: isRegistered || hasStarted ? row.join_url : null,
      calendar_url: isRegistered || hasStarted ? row.calendar_url : null,
      affiliate_link: publicRefCode ? publicWebinarAffiliateLink(row.slug, publicRefCode) : null,
      app_affiliate_link: affiliateCode ? appAffiliateLink(row.slug, affiliateCode) : null,
    };
  });
}

userWebinarsRoutes.get('/recordings/directory', async (c) => {
  try {
    const user = c.get('user');
    const url = new URL(c.req.url);
    const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10), 1), 100);
    const search = (url.searchParams.get('search') || '').trim();
    const category = url.searchParams.get('category');
    const format = url.searchParams.get('format');
    const tag = url.searchParams.get('tag');
    const offset = (page - 1) * limit;

    let where = "WHERE status IN ('public', 'membership_only')";
    const params: unknown[] = [];

    if (search) {
      where += " AND (title LIKE ?)";
      params.push(`%${search}%`);
    }
    if (category) {
      // Kategori = skill taxonomy (content_skills via registry id 'recording:<id>'),
      // fallback ke kolom category lama untuk kompatibilitas
      where += ` AND (EXISTS (SELECT 1 FROM content_skills cs JOIN skills s ON s.id = cs.skill_id
                 WHERE cs.content_id = 'recording:' || webinar_recordings.id AND s.name = ?)
                 OR category = ?)`;
      params.push(category, category);
    }
    if (format) {
      where += " AND format = ?";
      params.push(format);
    }
    if (tag) {
      where += " AND tags LIKE ?";
      params.push(`%${tag}%`);
    }

    const totalRow = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM webinar_recordings ${where}`).bind(...params).first() as any;

    const rows = await c.env.DB.prepare(
      `SELECT id, slug, title, subtitle, thumbnail_url, recorded_at as starts_at, category, format, tags, status as replay_status
       FROM webinar_recordings
       ${where}
       ORDER BY sort_order ASC, recorded_at DESC
       LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    // Also get active membership status
    const activeMembership = await c.env.DB.prepare(
      `SELECT m.status FROM memberships m WHERE m.user_id = ? AND m.status = 'active' AND (m.expires_at IS NULL OR m.expires_at > datetime('now')) LIMIT 1`
    ).bind(user.id).first();

    // Kategori (skill taxonomy) yang dipakai rekaman — untuk dropdown filter
    const categoriesResult = await c.env.DB.prepare(
      `SELECT DISTINCT s.name FROM content_skills cs
       JOIN skills s ON s.id = cs.skill_id
       JOIN content_items ci ON ci.id = cs.content_id
       WHERE ci.content_type = 'recording'
       ORDER BY s.name`
    ).all();

    return success(c, {
      recordings: rows.results,
      categories: categoriesResult.results.map((r: any) => r.name),
      pagination: {
        page,
        limit,
        total: totalRow?.total || 0,
        totalPages: Math.ceil((totalRow?.total || 0) / limit)
      },
      has_active_membership: Boolean(activeMembership)
    });
  } catch (err) {
    console.error('[user:webinars:recordings:directory]', err);
    return error(c, 'Gagal memuat rekaman', 500);
  }
});

userWebinarsRoutes.get('/recordings/directory/:slug', async (c) => {
  try {
    const user = c.get('user');
    const slug = c.req.param('slug');

    const webinar = await c.env.DB.prepare(
      `SELECT id, slug, title, subtitle, thumbnail_url, body_html as replay_body_html, recording_url, recording_embed_url, recorded_at as starts_at, category, format, tags, status as replay_status
       FROM webinar_recordings
       WHERE slug = ? AND status IN ('public', 'membership_only')
       LIMIT 1`
    ).bind(slug).first() as any;

    if (!webinar) return error(c, 'Rekaman tidak ditemukan', 404);

    const activeMembership = await c.env.DB.prepare(
      `SELECT m.status FROM memberships m WHERE m.user_id = ? AND m.status = 'active' AND (m.expires_at IS NULL OR m.expires_at > datetime('now')) LIMIT 1`
    ).bind(user.id).first();

    return success(c, {
      recording: webinar,
      has_active_membership: Boolean(activeMembership)
    });
  } catch (err) {
    console.error('[user:webinars:recordings:detail]', err);
    return error(c, 'Gagal memuat detail rekaman', 500);
  }
});


userWebinarsRoutes.get('/', async (c) => {
  try {
    const user = c.get('user');
    const affiliate = await getUserAffiliate(c.env.DB, user.id);
    const activeAffiliateCode = affiliate?.status === 'active' ? affiliate.affiliate_code as string : '';
    const activePublicRefCode = affiliate?.status === 'active' ? affiliate.public_ref_code as string : '';

    const rows = await c.env.DB.prepare(
      `SELECT w.*,
              (SELECT COUNT(*) FROM webinar_registrations wr WHERE wr.webinar_id = w.id AND wr.status = 'registered') as registered_count,
              (SELECT json_group_array(
                 json_object(
                   'id', u.id,
                   'name', u.name,
                   'avatar_url', u.avatar_url,
                   'badges_json', u.badges_json
                 )
               ) FROM (
                 SELECT u.id, u.name, u.avatar_url, u.badges_json
                 FROM webinar_registrations wr
                 JOIN users u ON u.id = wr.user_id
                 WHERE wr.webinar_id = w.id AND wr.status = 'registered'
                 ORDER BY wr.created_at DESC
                 LIMIT 3
               ) u) as participants_preview
       FROM webinars w
       WHERE w.status = 'published'
       ORDER BY w.sort_order ASC, w.starts_at DESC`
    ).all();

    const webinars = await decorateWebinars(c.env.DB, rows.results as any[], user.id, activeAffiliateCode, activePublicRefCode);
    return success(c, {
      is_affiliate: Boolean(activeAffiliateCode),
      affiliate_code: activeAffiliateCode || null,
      public_ref_code: activePublicRefCode || null,
      webinars,
    });
  } catch (err) {
    console.error('[user:webinars:list]', err);
    return error(c, 'Gagal memuat webinar', 500);
  }
});

userWebinarsRoutes.get('/:slug', async (c) => {
  try {
    const user = c.get('user');
    const slug = c.req.param('slug');
    const affiliate = await getUserAffiliate(c.env.DB, user.id);
    const activeAffiliateCode = affiliate?.status === 'active' ? affiliate.affiliate_code as string : '';
    const activePublicRefCode = affiliate?.status === 'active' ? affiliate.public_ref_code as string : '';

    const webinar = await c.env.DB.prepare(
      `SELECT w.*,
              (SELECT COUNT(*) FROM webinar_registrations wr WHERE wr.webinar_id = w.id AND wr.status = 'registered') as registered_count,
              (SELECT json_group_array(
                 json_object(
                   'id', u.id,
                   'name', u.name,
                   'avatar_url', u.avatar_url,
                   'badges_json', u.badges_json
                 )
               ) FROM (
                 SELECT u.id, u.name, u.avatar_url, u.badges_json
                 FROM webinar_registrations wr
                 JOIN users u ON u.id = wr.user_id
                 WHERE wr.webinar_id = w.id AND wr.status = 'registered'
                 ORDER BY wr.created_at DESC
                 LIMIT 3
               ) u) as participants_preview
       FROM webinars w
       WHERE w.slug = ? AND w.status = 'published'
       LIMIT 1`
    ).bind(slug).first() as any;

    if (!webinar) return error(c, 'Webinar not found', 404);
    const [decorated] = await decorateWebinars(c.env.DB, [webinar], user.id, activeAffiliateCode, activePublicRefCode);
    return success(c, decorated);
  } catch (err) {
    console.error('[user:webinars:detail]', err);
    return error(c, 'Gagal memuat webinar', 500);
  }
});

// ─── POST /api/user/webinars/:id/attend ───────────
// Stamped when a registered user clicks the join link. Records attendance
// (attended_at), awards points once, and emits a webinar_joined event so
// attendance rate becomes measurable.
userWebinarsRoutes.post('/:id/attend', async (c) => {
  try {
    const user = c.get('user');
    const webinarId = c.req.param('id');
    const now = new Date().toISOString();

    const stamped = await c.env.DB.prepare(
      `UPDATE webinar_registrations SET attended_at = COALESCE(attended_at, ?), updated_at = ?
       WHERE webinar_id = ? AND user_id = ?
         AND status IN ('registered', 'registered_free', 'registered_paid')`
    ).bind(now, now, webinarId, user.id).run();

    if ((stamped.meta?.changes || 0) === 0) {
      return error(c, 'Registrasi webinar tidak ditemukan', 404);
    }

    c.executionCtx.waitUntil((async () => {
      const got = await awardPoints(c.env, user.id, 'webinar_attend', webinarId);
      if (got) {
        await bumpChallengeProgress(c.env, user.id, 'webinars', 1);
        await bumpChallengeProgress(c.env, user.id, 'points', POINTS.webinar_attend);
      }
      await trackServerEvent(c.env, {
        event_name: 'webinar_joined',
        event_category: 'webinar',
        user_id: user.id,
        webinar_id: webinarId,
      });
    })());

    return success(c, { message: 'Attendance recorded' });
  } catch (err) {
    console.error('[user:webinars:attend]', err);
    return error(c, 'Gagal mencatat kehadiran', 500);
  }
});

userWebinarsRoutes.post('/:id/register', async (c) => {
  try {
    const user = c.get('user');
    const webinarId = c.req.param('id');
    const body = await c.req.json().catch(() => ({})) as { affiliate_code?: string, click_id?: string };
    const requestedAffiliateCode = (body.affiliate_code || getCookie(c, 'affiliate_code') || '').trim();

    const webinar = await c.env.DB.prepare(
      `SELECT * FROM webinars WHERE id = ? AND status = 'published' LIMIT 1`
    ).bind(webinarId).first() as any;
    if (!webinar) return error(c, 'Webinar not found', 404);

    const existing = await c.env.DB.prepare(
      `SELECT * FROM webinar_registrations WHERE webinar_id = ? AND user_id = ? LIMIT 1`
    ).bind(webinarId, user.id).first() as any;
    if (existing && ['registered', 'registered_free', 'registered_paid'].includes(existing.status)) {
      return success(c, { message: 'Already registered', registration: existing });
    }

    if (webinar.capacity) {
      const count = await c.env.DB.prepare(
        `SELECT COUNT(*) as count FROM webinar_registrations WHERE webinar_id = ? AND status = 'registered'`
      ).bind(webinarId).first() as any;
      if (Number(count?.count || 0) >= Number(webinar.capacity)) {
        return error(c, 'Kuota webinar sudah penuh', 409);
      }
    }

    let affiliateCode: string | null = null;
    let affiliateAccount: any = null;
    if (requestedAffiliateCode) {
      affiliateAccount = await c.env.DB.prepare(
        `SELECT aa.user_id, aa.affiliate_code, u.name, u.email
         FROM affiliate_accounts aa
         JOIN users u ON u.id = aa.user_id
         WHERE aa.affiliate_code = ? AND aa.status = 'active'
         LIMIT 1`
      ).bind(requestedAffiliateCode).first() as any;
      if (affiliateAccount && affiliateAccount.user_id !== user.id) {
        affiliateCode = affiliateAccount.affiliate_code as string;
      }
    }

    const now = new Date().toISOString();
    const couponCode = 'GROW';
    const registrationId = crypto.randomUUID();

    const activeMembership = await c.env.DB.prepare(
      `SELECT m.status, m.expires_at, p.id as plan_id
       FROM memberships m
       JOIN membership_plans p ON p.id = m.plan_id
       WHERE m.user_id = ? AND m.status = 'active'
       ORDER BY m.expires_at DESC NULLS LAST
       LIMIT 1`
    ).bind(user.id).first() as any;

    const userRecord = await c.env.DB.prepare(
      `SELECT created_at FROM users WHERE id = ? LIMIT 1`
    ).bind(user.id).first() as any;

    const membershipStatus = activeMembership ? activeMembership.status : 'free';
    const membershipPlan = activeMembership ? activeMembership.plan_id : null;
    const membershipExpiresAt = activeMembership ? activeMembership.expires_at : null;
    const userCreatedAt = userRecord ? userRecord.created_at : null;

    // Check click_id for attribution
    const clickId = (body.click_id || getCookie(c, 'webinar_click_id') || '').trim() || null;
    let shortLinkId = null;
    let sourceReferrerId = null;
    let attributionSource = null;
    let attributionCampaign = null;

    if (clickId) {
      const clickInfo = await c.env.DB.prepare(
        `SELECT sc.id, sc.shortlink_id, sc.referrer_user_id, s.source, s.campaign
         FROM shortlink_clicks sc
         JOIN shortlinks s ON s.id = sc.shortlink_id
         WHERE sc.click_id = ? LIMIT 1`
      ).bind(clickId).first() as any;
      if (clickInfo) {
        shortLinkId = clickInfo.shortlink_id;
        sourceReferrerId = clickInfo.referrer_user_id;
        attributionSource = clickInfo.source;
        attributionCampaign = clickInfo.campaign;
      }
    }

    if (existing) {
      await c.env.DB.prepare(
        `UPDATE webinar_registrations
         SET status = 'registered', updated_at = ?,
             referral_click_id = COALESCE(referral_click_id, ?),
             short_link_id = COALESCE(short_link_id, ?),
             source_referrer_user_id = COALESCE(source_referrer_user_id, ?),
             attribution_source = COALESCE(attribution_source, ?),
             attribution_campaign = COALESCE(attribution_campaign, ?)
         WHERE id = ?`
      ).bind(now, clickId, shortLinkId, sourceReferrerId, attributionSource, attributionCampaign, existing.id).run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO webinar_registrations
         (id, webinar_id, user_id, name, email, phone, coupon_code, affiliate_code, status, registered_at, created_at, updated_at,
          membership_status_at_registration, membership_plan_at_registration, membership_expires_at_registration, user_created_at_registration,
          referral_click_id, short_link_id, source_referrer_user_id, attribution_source, attribution_campaign)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'registered', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        registrationId, webinarId, user.id, user.name, user.email, user.phone || null, couponCode, affiliateCode,
        now, now, now, membershipStatus, membershipPlan, membershipExpiresAt, userCreatedAt,
        clickId, shortLinkId, sourceReferrerId, attributionSource, attributionCampaign
      ).run();
    }

    await sendMailketingEmail(c.env, {
      recipient: user.email,
      subject: `Kamu terdaftar: ${webinar.title}`,
      content: webinarRegistrationEmailHtml({
        name: user.name.split(' ')[0] || user.name,
        webinarTitle: webinar.title,
        startsAt: webinar.starts_at,
        timezone: webinar.timezone,
        detailUrl: `https://app.pejuangyen.com/webinars/${webinar.slug}`,
        couponCode,
      }),
      emailType: 'transactional',
    }, c.env.DB).catch((err) => console.error('[webinars] registration email failed:', err));

    await startSequence(user.id, 'webinar_registration_followup', c.env.DB, c.env)
      .catch((err) => console.error('[webinars] webinar sequence error:', err));

    if (affiliateCode && affiliateAccount?.email) {
      await sendMailketingEmail(c.env, {
        recipient: affiliateAccount.email,
        subject: `Lead webinar baru dari link kamu: ${user.name}`,
        content: webinarAffiliateLeadEmailHtml({
          affiliateName: ((affiliateAccount.name as string) || 'Kamu').split(' ')[0],
          registrantName: user.name,
          webinarTitle: webinar.title,
          startsAt: webinar.starts_at,
          timezone: webinar.timezone,
          dashboardUrl: 'https://app.pejuangyen.com/affiliate',
        }),
        emailType: 'transactional',
      }, c.env.DB).catch((err) => console.error('[webinars] affiliate lead email failed:', err));
    }

    if (clickId) {
      await c.env.DB.prepare(
        `UPDATE shortlink_clicks SET converted_user_id = ?, converted_registration_id = ?, converted_at = ? WHERE click_id = ? AND converted_user_id IS NULL`
      ).bind(user.id, existing ? existing.id : registrationId, now, clickId).run().catch(() => {});
    }

    const registration = await c.env.DB.prepare(
      `SELECT * FROM webinar_registrations WHERE id = ?`
    ).bind(existing ? existing.id : registrationId).first();

    c.executionCtx.waitUntil((async () => {
      await trackServerEvent(c.env, {
        event_name: 'webinar_registered',
        event_category: 'webinar',
        user_id: user.id,
        webinar_id: webinarId,
        affiliate_code: affiliateCode || null,
        coupon_code: couponCode || null,
        utm_source: attributionSource || null,
        utm_campaign: attributionCampaign || null,
      });
      // A webinar is an attribution touch — remember it as the user's most
      // recent (and possibly first) source before any upgrade.
      await upsertUserAttribution(c.env, user.id, {
        first_webinar_id: webinarId,
        last_webinar_id: webinarId,
        last_touch_at: now,
        ...(affiliateCode ? { first_affiliate_code: affiliateCode, last_affiliate_code: affiliateCode } : {}),
      });
    })());

    return success(c, { message: 'Registered successfully', registration }, 201);
  } catch (err) {
    console.error('[user:webinars:register]', err);
    return error(c, 'Gagal mendaftar webinar', 500);
  }
});

userWebinarsRoutes.post('/:id/select-method', async (c) => {
  try {
    const user = c.get('user');
    const webinarId = c.req.param('id');
    const body = await c.req.json().catch(() => ({})) as { method?: 'free_share' | 'paid', click_id?: string };

    const webinar = await c.env.DB.prepare(
      `SELECT * FROM webinars WHERE id = ? AND status = 'published' LIMIT 1`
    ).bind(webinarId).first() as any;
    if (!webinar) return error(c, 'Webinar not found', 404);

    if (webinar.capacity) {
      const count = await c.env.DB.prepare(
        `SELECT COUNT(*) as count FROM webinar_registrations WHERE webinar_id = ? AND status IN ('registered', 'registered_free', 'registered_paid')`
      ).bind(webinarId).first() as any;
      if (Number(count?.count || 0) >= Number(webinar.capacity)) {
        return error(c, 'Kuota webinar sudah penuh', 409);
      }
    }

    const method = body.method;
    if (!method || (method !== 'free_share' && method !== 'paid')) {
      return error(c, 'Metode pendaftaran tidak valid', 400);
    }
    if (method === 'free_share' && !webinar.free_registration_enabled) {
      return error(c, 'Pendaftaran gratis sedang ditutup', 400);
    }
    if (method === 'paid' && !webinar.paid_registration_enabled) {
      return error(c, 'Pendaftaran berbayar sedang ditutup', 400);
    }

    const existing = await c.env.DB.prepare(
      `SELECT * FROM webinar_registrations WHERE webinar_id = ? AND user_id = ? LIMIT 1`
    ).bind(webinarId, user.id).first() as any;

    if (existing && ['registered', 'registered_free', 'registered_paid'].includes(existing.status)) {
      return success(c, { message: 'Already registered', registration: existing });
    }

    const now = new Date().toISOString();
    const newStatus = method === 'free_share' ? 'share_confirmation_pending' : 'payment_pending';
    const clickId = (body.click_id || getCookie(c, 'webinar_click_id') || '').trim() || null;

    let shortLinkId = null;
    let sourceReferrerId = null;
    let attributionSource = null;
    let attributionCampaign = null;

    if (clickId) {
      const clickInfo = await c.env.DB.prepare(
        `SELECT sc.shortlink_id, sc.referrer_user_id, s.source, s.campaign
         FROM shortlink_clicks sc
         JOIN shortlinks s ON s.id = sc.shortlink_id
         WHERE sc.click_id = ? LIMIT 1`
      ).bind(clickId).first() as any;
      if (clickInfo) {
        shortLinkId = clickInfo.shortlink_id;
        sourceReferrerId = clickInfo.referrer_user_id;
        attributionSource = clickInfo.source;
        attributionCampaign = clickInfo.campaign;
      }
    }

    if (existing) {
      await c.env.DB.prepare(
        `UPDATE webinar_registrations
         SET registration_type = ?, status = ?, selected_at = ?, updated_at = ?,
             referral_click_id = COALESCE(referral_click_id, ?),
             short_link_id = COALESCE(short_link_id, ?),
             source_referrer_user_id = COALESCE(source_referrer_user_id, ?),
             attribution_source = COALESCE(attribution_source, ?),
             attribution_campaign = COALESCE(attribution_campaign, ?)
         WHERE id = ?`
      ).bind(method, newStatus, now, now, clickId, shortLinkId, sourceReferrerId, attributionSource, attributionCampaign, existing.id).run();
    } else {
      const registrationId = crypto.randomUUID();
      const activeMembership = await c.env.DB.prepare(
        `SELECT m.status, m.expires_at, p.id as plan_id FROM memberships m JOIN membership_plans p ON p.id = m.plan_id WHERE m.user_id = ? AND m.status = 'active' ORDER BY m.expires_at DESC LIMIT 1`
      ).bind(user.id).first() as any;
      const userRecord = await c.env.DB.prepare(`SELECT created_at FROM users WHERE id = ?`).bind(user.id).first() as any;

      await c.env.DB.prepare(
        `INSERT INTO webinar_registrations
         (id, webinar_id, user_id, name, email, phone, status, registration_type, selected_at, registered_at, created_at, updated_at,
          membership_status_at_registration, membership_plan_at_registration, membership_expires_at_registration, user_created_at_registration,
          referral_click_id, short_link_id, source_referrer_user_id, attribution_source, attribution_campaign)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        registrationId, webinarId, user.id, user.name, user.email, user.phone || null, newStatus, method, now, now, now, now,
        activeMembership?.status || 'free', activeMembership?.plan_id || null, activeMembership?.expires_at || null, userRecord?.created_at || null,
        clickId, shortLinkId, sourceReferrerId, attributionSource, attributionCampaign
      ).run();
    }

    const updatedReg = await c.env.DB.prepare(
      `SELECT * FROM webinar_registrations WHERE webinar_id = ? AND user_id = ? LIMIT 1`
    ).bind(webinarId, user.id).first();

    if (method === 'paid') {
      return success(c, { message: 'Method selected', registration: updatedReg });
    }

    // method === 'free_share' -> handle shortlink generation
    let userShortLink = await c.env.DB.prepare(
      `SELECT slug FROM shortlinks WHERE destination_type = 'webinar' AND destination_id = ? AND user_id = ? AND source = 'free_share' LIMIT 1`
    ).bind(webinarId, user.id).first() as any;

    if (!userShortLink) {
      const slug = crypto.randomUUID().slice(0, 6).replace(/[^a-zA-Z0-9]/g, '') + Math.floor(Math.random() * 100).toString();
      await c.env.DB.prepare(
        `INSERT INTO shortlinks (id, user_id, slug, destination_url, title, destination_type, destination_id, source, campaign, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
      ).bind(
        crypto.randomUUID(), user.id, slug, 'https://app.pejuangyen.com/webinars/' + webinar.slug, 'Share ' + webinar.title, 'webinar', webinarId, 'free_share', 'webinar', now, now
      ).run();
      userShortLink = { slug };
    }

    const shortUrl = `https://app.pejuangyen.com/r/w/${userShortLink.slug}`;
    
    // Replace variables in message template
    let messageTemplate = webinar.share_message_template || '';
    if (!messageTemplate) {
      messageTemplate = `Guys, aku nemu webinar gratis dari PejuangYen yang kayaknya worth it buat diikutin 🚀\n\nTopiknya:\n*{{webinar_title}}*\n\nDaftar gratis di sini:\n{{webinar_short_url}}`;
    }
    
    const formattedMessage = messageTemplate
      .replace(/{{webinar_title}}/g, webinar.title)
      .replace(/{{webinar_short_url}}/g, shortUrl)
      .replace(/{{webinar_url}}/g, `https://app.pejuangyen.com/webinars/${webinar.slug}`)
      .replace(/{{webinar_date}}/g, new Date(webinar.starts_at).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))
      .replace(/{{webinar_time}}/g, new Date(webinar.starts_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB');

    return success(c, {
      message: 'Method selected',
      registration: updatedReg,
      share_data: {
        short_url: shortUrl,
        message: formattedMessage,
      }
    });

  } catch (err) {
    console.error('[user:webinars:select-method]', err);
    return error(c, 'Gagal memilih metode pendaftaran', 500);
  }
});

userWebinarsRoutes.post('/:id/confirm-free-share', async (c) => {
  try {
    const user = c.get('user');
    const webinarId = c.req.param('id');
    const body = await c.req.json().catch(() => ({})) as { confirmed?: boolean };

    if (!body.confirmed) return error(c, 'Anda harus mengonfirmasi syarat share', 400);

    const webinar = await c.env.DB.prepare(
      `SELECT * FROM webinars WHERE id = ? AND status = 'published' LIMIT 1`
    ).bind(webinarId).first() as any;
    if (!webinar) return error(c, 'Webinar not found', 404);

    const existing = await c.env.DB.prepare(
      `SELECT * FROM webinar_registrations WHERE webinar_id = ? AND user_id = ? LIMIT 1`
    ).bind(webinarId, user.id).first() as any;

    if (!existing || existing.registration_type !== 'free_share' || existing.status !== 'share_confirmation_pending') {
      if (existing && ['registered', 'registered_free', 'registered_paid'].includes(existing.status)) {
        return success(c, { message: 'Already registered', registration: existing });
      }
      return error(c, 'Pendaftaran tidak valid', 400);
    }

    const now = new Date().toISOString();

    await c.env.DB.prepare(
      `UPDATE webinar_registrations
       SET status = 'registered_free', share_confirmation_checked = 1, share_confirmed_at = ?, confirmed_at = ?, updated_at = ?
       WHERE id = ?`
    ).bind(now, now, now, existing.id).run();

    await sendMailketingEmail(c.env, {
      recipient: user.email,
      subject: `Kamu terdaftar (Gratis): ${webinar.title}`,
      content: webinarRegistrationEmailHtml({
        name: user.name.split(' ')[0] || user.name,
        webinarTitle: webinar.title,
        startsAt: webinar.starts_at,
        timezone: webinar.timezone,
        detailUrl: `https://app.pejuangyen.com/webinars/${webinar.slug}`,
        couponCode: existing.coupon_code || 'GROW',
      }),
      emailType: 'transactional',
    }, c.env.DB).catch((err) => console.error('[webinars] registration email failed:', err));

    await startSequence(user.id, 'webinar_registration_followup', c.env.DB, c.env)
      .catch((err) => console.error('[webinars] webinar sequence error:', err));

    if (existing.referral_click_id) {
      await c.env.DB.prepare(
        `UPDATE shortlink_clicks SET converted_user_id = ?, converted_registration_id = ?, converted_at = ? WHERE click_id = ? AND converted_user_id IS NULL`
      ).bind(user.id, existing.id, now, existing.referral_click_id).run().catch(() => {});
    }

    const registration = await c.env.DB.prepare(
      `SELECT * FROM webinar_registrations WHERE id = ?`
    ).bind(existing.id).first();

    return success(c, { message: 'Registered successfully', registration }, 200);

  } catch (err) {
    console.error('[user:webinars:confirm-free-share]', err);
    return error(c, 'Gagal mengonfirmasi pendaftaran', 500);
  }
});

export default userWebinarsRoutes;
