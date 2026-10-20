import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, optionalAuthMiddleware } from '../../middleware/auth';
import { success, error, paginated } from '../../lib/response';
import { kvGetOrSet, kvDelete } from '../../lib/cache';
import { sendMailketingEmail } from '../../services/mailketing';
import { affiliateWelcomeEmailHtml } from '../../lib/email-templates';
import { getDefaultCommissionRate, resolveAffiliateTier } from '../../lib/settings';
import { getActiveSeason } from '../../lib/seasons';
import { getSnapshotRankMap } from '../../lib/rank-snapshots';
import {
  DEFAULT_AFFILIATE_PRODUCT_SLUG,
  isSafeSlug,
  publicAffiliateLink,
  randomAffiliateToken,
  sanitizePublicRefCode,
} from '../../lib/affiliate-links';

const affiliateRoutes = new Hono<{ Bindings: Env }>();

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function isSafePublicRefCode(code: string): boolean {
  return /^[a-z0-9-]{4,40}$/.test(code);
}

async function generateUniquePublicRefCode(db: D1Database): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomAffiliateToken(7);
    const existing = await db.prepare(
      'SELECT id FROM affiliate_accounts WHERE public_ref_code = ? LIMIT 1'
    ).bind(code).first();
    if (!existing) return code;
  }
  throw new Error('Unable to generate unique public affiliate code');
}

async function generateUniqueAffiliateCode(db: D1Database): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = `PY-${randomAffiliateToken(8).toUpperCase()}`;
    const existing = await db.prepare(
      'SELECT id FROM affiliate_accounts WHERE affiliate_code = ? LIMIT 1'
    ).bind(code).first();
    if (!existing) return code;
  }
  throw new Error('Unable to generate unique affiliate code');
}

async function ensurePublicRefCode(db: D1Database, affiliate: { id: string; public_ref_code?: string | null }) {
  if (affiliate.public_ref_code) return affiliate.public_ref_code;

  const publicRefCode = await generateUniquePublicRefCode(db);
  await db.prepare(
    'UPDATE affiliate_accounts SET public_ref_code = ?, updated_at = ? WHERE id = ?'
  ).bind(publicRefCode, new Date().toISOString(), affiliate.id).run();
  return publicRefCode;
}

// Public: top affiliates by commission (no auth required)
affiliateRoutes.get('/leaderboard', optionalAuthMiddleware(), async (c) => {
  try {
    const period = c.req.query('period') || 'lifetime';
    if (!['monthly', 'yearly', 'lifetime', 'season'].includes(period)) {
      return error(c, 'Invalid period', 400);
    }

    const data = await kvGetOrSet(c.env, `affiliate:leaderboard:${period}`, 300, async () => {
      let dateFilterComm = '';
      let dateFilterAttr = '';
      let dateFilterWebinar = '';
      const params: unknown[] = [];
      const now = new Date();
      let contextStr = '';

      if (period === 'season') {
        const season = await getActiveSeason(c.env.DB);
        const start = season ? season.starts_at : new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        dateFilterComm = 'AND created_at >= ?';
        dateFilterAttr = 'AND created_at >= ?';
        dateFilterWebinar = 'AND registered_at >= ?';
        params.push(start, start, start, start);
        contextStr = season?.name || 'Musim Ini';
      } else if (period === 'monthly') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        dateFilterComm = 'AND created_at >= ?';
        dateFilterAttr = 'AND created_at >= ?';
        dateFilterWebinar = 'AND registered_at >= ?';
        params.push(startOfMonth, startOfMonth, startOfMonth, startOfMonth);
        contextStr = now.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
      } else if (period === 'yearly') {
        const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();
        dateFilterComm = 'AND created_at >= ?';
        dateFilterAttr = 'AND created_at >= ?';
        dateFilterWebinar = 'AND registered_at >= ?';
        params.push(startOfYear, startOfYear, startOfYear, startOfYear);
        contextStr = now.getFullYear().toString();
      } else {
        contextStr = 'Sepanjang Masa';
      }

      const rows = await c.env.DB.prepare(`
        SELECT aa.affiliate_code, aa.tier, u.id as user_id, u.name, u.avatar_url, u.badges_json, u.created_at,
               (SELECT COUNT(id) FROM affiliate_commissions WHERE affiliate_code = aa.affiliate_code ${dateFilterComm}) as total_referrals,
               (SELECT COALESCE(SUM(commission_amount), 0) FROM affiliate_commissions WHERE affiliate_code = aa.affiliate_code AND status != 'rejected' ${dateFilterComm}) as total_commission,
               (
                 (SELECT COUNT(id) FROM affiliate_attributions WHERE affiliate_code = aa.affiliate_code AND order_id IS NULL ${dateFilterAttr}) +
                 (SELECT COUNT(id) FROM webinar_registrations WHERE affiliate_code = aa.affiliate_code ${dateFilterWebinar})
               ) as total_leads
        FROM affiliate_accounts aa
        JOIN users u ON aa.user_id = u.id
        WHERE aa.status = 'active'
        ORDER BY total_commission DESC, u.created_at ASC
        LIMIT 10
      `).bind(...params).all();

      const snapMap = period === 'monthly' ? await getSnapshotRankMap(c.env.DB, 'affiliate') : null;

      const result = rows.results.map((r: any, i: number) => {
        let badges: string[] = [];
        try { badges = JSON.parse(r.badges_json || '[]'); } catch { /* ignore */ }

        const liveRank = i + 1;
        const lastRank = snapMap?.get(r.user_id);
        return {
          rank: liveRank,
          name: r.name,
          initials: (r.name as string).split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
          avatar: r.avatar_url || null,
          affiliate_code: r.affiliate_code,
          tier: r.tier || 'bronze',
          referrals: Number(r.total_referrals) || 0,
          leads: Number(r.total_leads) || 0,
          totalCommission: Number(r.total_commission) || 0,
          delta: lastRank !== undefined ? lastRank - liveRank : null,
          badges,
        };
      });

      // Auto-grant Growth Ambassador badge to Top 3
      const top3UserIds = rows.results.slice(0, 3).map((r: any) => r.user_id);
      if (top3UserIds.length > 0) {
        const placeholders = top3UserIds.map(() => '?').join(',');
        await c.env.DB.prepare(`
          UPDATE users
          SET badges_json = (
            CASE
              WHEN badges_json IS NULL OR badges_json = '' THEN '["growth_ambassador"]'
              WHEN badges_json NOT LIKE '%growth_ambassador%' THEN
                json_insert(COALESCE(badges_json, '[]'), '$[#]', 'growth_ambassador')
              ELSE badges_json
            END
          )
          WHERE id IN (${placeholders})
        `).bind(...top3UserIds).run();
      }

      return { leaderboard: result, context: contextStr };
    });

    let myRank = null;
    const user = c.get('user');

    if (user) {
      // Find user's affiliate account
      const myAffiliate = await c.env.DB.prepare('SELECT affiliate_code FROM affiliate_accounts WHERE user_id = ?').bind(user.id).first();
      
      if (myAffiliate) {
        // Find if user is in top 10
        const top10Match = data.leaderboard.find((entry: any) => entry.affiliate_code === myAffiliate.affiliate_code);
        if (top10Match) {
          myRank = top10Match;
        } else {
          // Compute user's stats and rank
          let dateFilter = '';
          const params: unknown[] = [];
          const now = new Date();

          if (period === 'monthly') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            dateFilter = 'AND ac.created_at >= ?';
            params.push(startOfMonth);
          } else if (period === 'yearly') {
            const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();
            dateFilter = 'AND ac.created_at >= ?';
            params.push(startOfYear);
          }

          const myStats = await c.env.DB.prepare(`
            SELECT 
              COUNT(ac.id) as total_referrals,
              COALESCE(SUM(CASE WHEN ac.status != 'rejected' THEN ac.commission_amount ELSE 0 END), 0) as total_commission
            FROM affiliate_commissions ac
            WHERE ac.affiliate_code = ? ${dateFilter}
          `).bind(myAffiliate.affiliate_code, ...params).first();

          const myTotal = Number(myStats?.total_commission || 0);

          // Find rank (count affiliates with more commission or earlier registration)
          const rankQuery = await c.env.DB.prepare(`
            SELECT COUNT(*) + 1 as rank FROM (
              SELECT COALESCE(SUM(CASE WHEN ac.status != 'rejected' THEN ac.commission_amount ELSE 0 END), 0) as total_commission, u.created_at
              FROM affiliate_accounts aa
              JOIN users u ON aa.user_id = u.id
              LEFT JOIN affiliate_commissions ac ON ac.affiliate_code = aa.affiliate_code ${dateFilter}
              WHERE aa.status = 'active'
              GROUP BY aa.affiliate_code, u.created_at
              HAVING total_commission > ? OR (total_commission = ? AND u.created_at < ?)
            )
          `).bind(...params, myTotal, myTotal, user.created_at).first();

          const userDb = await c.env.DB.prepare('SELECT badges_json FROM users WHERE id = ?').bind(user.id).first();
          let badges: string[] = [];
          try { badges = JSON.parse((userDb as any)?.badges_json || '[]'); } catch { /* ignore */ }

          myRank = {
            rank: rankQuery?.rank || 0,
            name: user.name,
            initials: user.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
            avatar: user.avatar_url || null,
            affiliate_code: myAffiliate.affiliate_code,
            referrals: Number(myStats?.total_referrals || 0),
            totalCommission: myTotal,
            badges
          };
        }
      }
    }

    c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
    return success(c, { ...data, myRank });
  } catch (err) {
    console.error('[affiliate:leaderboard]', err);
    return error(c, 'Gagal memuat leaderboard', 500);
  }
});

// Track affiliate click (public, used by landing pages and order pages)
affiliateRoutes.post('/track-click', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({})) as {
      affiliate_code?: string;
      landing_url?: string;
      referrer_url?: string;
      campaign?: string;
    };
    const { affiliate_code, landing_url, referrer_url, campaign } = body;

    if (!affiliate_code) return error(c, 'affiliate_code required', 400);

    const affiliate = await c.env.DB.prepare('SELECT id FROM affiliate_accounts WHERE affiliate_code = ? AND status = ?').bind(affiliate_code, 'active').first();
    if (!affiliate) return error(c, 'Invalid affiliate code', 404);

    const now = new Date().toISOString();
    const ip = c.req.header('cf-connecting-ip') || '';
    const ua = c.req.header('user-agent') || '';

    const encoder = new TextEncoder();
    const ipHash = ip ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(ip)))).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16) : null;
    const uaHash = ua ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(ua)))).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16) : null;

    // Fire-and-forget: jangan blokir order/webinar page pada write log klik.
    c.executionCtx.waitUntil(
      c.env.DB.prepare(
        `INSERT INTO affiliate_clicks (id, affiliate_code, ip_hash, user_agent_hash, landing_url, referrer_url, campaign, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), affiliate_code, ipHash, uaHash, landing_url || null, referrer_url || null, campaign || null, now).run()
        .catch(err => console.error('[affiliate:track-click:log]', err))
    );

    return success(c, { message: 'Click tracked' });
  } catch (err) {
    console.error('[affiliate:track-click]', err);
    return error(c, 'Gagal merekam klik', 500);
  }
});

// Public: resolve pejuangyen.link aliases into first-party tracking URLs
affiliateRoutes.get('/resolve/:publicRefCode', async (c) => {
  try {
    const publicRefCode = sanitizePublicRefCode(c.req.param('publicRefCode'));
    if (!isSafePublicRefCode(publicRefCode)) return error(c, 'Invalid affiliate link', 400);

    const affiliate = await c.env.DB.prepare(
      `SELECT affiliate_code, public_ref_code
       FROM affiliate_accounts
       WHERE public_ref_code = ? AND status = 'active'
       LIMIT 1`
    ).bind(publicRefCode).first() as { affiliate_code: string; public_ref_code: string } | null;

    if (!affiliate) return error(c, 'Affiliate link not found', 404);

    const target = c.req.query('target') || 'order';
    const appUrl = trimTrailingSlash(c.env.APP_URL || 'https://app.pejuangyen.com');
    const landingUrl = trimTrailingSlash(c.env.LANDING_URL || 'https://pejuangyen.com');
    let targetUrl: string;

    if (target === 'landing') {
      targetUrl = `${landingUrl}/?ref=${encodeURIComponent(affiliate.affiliate_code)}`;
    } else if (target === 'webinar') {
      const webinarSlug = c.req.query('webinar_slug') || '';
      if (!isSafeSlug(webinarSlug)) return error(c, 'Invalid webinar slug', 400);
      targetUrl = `${appUrl}/webinar/${webinarSlug}?ref=${encodeURIComponent(affiliate.affiliate_code)}`;
    } else {
      const productSlug = c.req.query('product_slug') || DEFAULT_AFFILIATE_PRODUCT_SLUG;
      if (!isSafeSlug(productSlug)) return error(c, 'Invalid product slug', 400);
      targetUrl = `${appUrl}/order/${productSlug}?ref=${encodeURIComponent(affiliate.affiliate_code)}`;
    }

    c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
    return success(c, {
      target_url: targetUrl,
      affiliate_code: affiliate.affiliate_code,
      public_ref_code: affiliate.public_ref_code,
    });
  } catch (err) {
    console.error('[affiliate:resolve]', err);
    return error(c, 'Gagal resolve link affiliate', 500);
  }
});

affiliateRoutes.use('*', authMiddleware());

// Register as affiliate
affiliateRoutes.post('/register', async (c) => {
  try {
    const user = c.get('user');

    const existing = await c.env.DB.prepare(
      'SELECT id, affiliate_code, public_ref_code FROM affiliate_accounts WHERE user_id = ?'
    ).bind(user.id).first() as any;
    if (existing) {
      const publicRefCode = await ensurePublicRefCode(c.env.DB, existing);
      return success(c, {
        message: 'Already registered as affiliate',
        affiliate_code: existing.affiliate_code,
        public_ref_code: publicRefCode,
        public_affiliate_link: publicAffiliateLink(publicRefCode),
      });
    }

    const affiliateCode = await generateUniqueAffiliateCode(c.env.DB);
    const publicRefCode = await generateUniquePublicRefCode(c.env.DB);
    const now = new Date().toISOString();
    const defaultCommissionRate = await getDefaultCommissionRate(c.env.DB);

    await c.env.DB.prepare(
      `INSERT INTO affiliate_accounts (id, user_id, affiliate_code, public_ref_code, status, default_commission_rate, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?)`
    ).bind(crypto.randomUUID(), user.id, affiliateCode, publicRefCode, defaultCommissionRate, now, now).run();

    await kvDelete(c.env, 'affiliate:leaderboard');

    await sendMailketingEmail(c.env, {
      recipient: user.email,
      subject: 'Selamat! Kamu resmi jadi Affiliate PejuangYen',
      content: affiliateWelcomeEmailHtml(user.name.split(' ')[0], publicAffiliateLink(publicRefCode)),
      emailType: 'transactional',
    }, c.env.DB).catch(err => console.error('[affiliate] welcome email error:', err));

    return success(c, {
      message: 'Registered successfully',
      affiliate_code: affiliateCode,
      public_ref_code: publicRefCode,
      public_affiliate_link: publicAffiliateLink(publicRefCode),
    });
  } catch (err) {
    console.error('[affiliate:register]', err);
    return error(c, 'Gagal mendaftar sebagai affiliate', 500);
  }
});

// Get affiliate details and stats
affiliateRoutes.get('/me', async (c) => {
  try {
    const user = c.get('user');

    const affiliate = await c.env.DB.prepare('SELECT * FROM affiliate_accounts WHERE user_id = ?').bind(user.id).first();
    if (!affiliate) return success(c, { is_affiliate: false });
    const publicRefCode = await ensurePublicRefCode(c.env.DB, affiliate as any);

    const stats = await c.env.DB.prepare(
      `SELECT
        COUNT(id) as total_referrals,
        SUM(commission_amount) as total_commissions,
        SUM(CASE WHEN status IN ('pending', 'approved') THEN commission_amount ELSE 0 END) as unpaid_commissions,
        SUM(CASE WHEN status = 'paid' THEN commission_amount ELSE 0 END) as paid_commissions
       FROM affiliate_commissions WHERE affiliate_code = ?`
    ).bind(affiliate.affiliate_code).first();

    const paidTotal = Number(stats?.paid_commissions || 0);
    const tierState = resolveAffiliateTier(paidTotal);
    // Self-heal kolom tier yang di-cache bila tertinggal dari realita komisi paid.
    if (affiliate.tier !== tierState.tier) {
      c.executionCtx.waitUntil(
        c.env.DB.prepare('UPDATE affiliate_accounts SET tier = ?, updated_at = ? WHERE user_id = ?')
          .bind(tierState.tier, new Date().toISOString(), user.id)
          .run()
          .catch((e) => console.error('[affiliate:me] tier sync failed', e))
      );
    }

    return success(c, {
      is_affiliate: true,
      affiliate: {
        ...affiliate,
        tier: tierState.tier,
        public_ref_code: publicRefCode,
        public_affiliate_link: publicAffiliateLink(publicRefCode),
      },
      stats: {
        total_referrals: stats?.total_referrals || 0,
        total_commissions: stats?.total_commissions || 0,
        unpaid_commissions: stats?.unpaid_commissions || 0,
        paid_commissions: stats?.paid_commissions || 0,
      },
      tier: tierState,
    });
  } catch (err) {
    console.error('[affiliate:me]', err);
    return error(c, 'Gagal memuat data affiliate', 500);
  }
});

// Update payout (rekening) details for affiliate commission withdrawals
affiliateRoutes.put('/payout', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json().catch(() => ({})) as {
      payout_name?: string;
      payout_bank_name?: string;
      payout_bank_account?: string;
    };

    const affiliate = await c.env.DB.prepare(
      'SELECT id FROM affiliate_accounts WHERE user_id = ?'
    ).bind(user.id).first();
    if (!affiliate) return error(c, 'Not an affiliate', 403);

    const payoutName = (body.payout_name || '').trim().slice(0, 120) || null;
    const bankName = (body.payout_bank_name || '').trim().slice(0, 60) || null;
    const bankAccount = (body.payout_bank_account || '').trim().slice(0, 40) || null;

    if (bankAccount && !/^[0-9 .-]{6,40}$/.test(bankAccount)) {
      return error(c, 'Nomor rekening tidak valid (hanya angka)', 400);
    }

    await c.env.DB.prepare(
      `UPDATE affiliate_accounts
       SET payout_name = ?, payout_bank_name = ?, payout_bank_account = ?, updated_at = ?
       WHERE id = ?`
    ).bind(payoutName, bankName, bankAccount, new Date().toISOString(), affiliate.id).run();

    return success(c, {
      message: 'Rekening penarikan tersimpan',
      payout_name: payoutName,
      payout_bank_name: bankName,
      payout_bank_account: bankAccount,
    });
  } catch (err) {
    console.error('[affiliate:payout]', err);
    return error(c, 'Gagal menyimpan rekening penarikan', 500);
  }
});

// Get commissions history
affiliateRoutes.get('/commissions', async (c) => {
  try {
    const user = c.get('user');
    const url = new URL(c.req.url);
    const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1), 100);
    const offset = (page - 1) * limit;
    const affiliate = await c.env.DB.prepare('SELECT affiliate_code FROM affiliate_accounts WHERE user_id = ?').bind(user.id).first();
    if (!affiliate) return error(c, 'Not an affiliate', 403);

    const totalRow = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM affiliate_commissions WHERE affiliate_code = ?`
    ).bind(affiliate.affiliate_code).first();

    const rows = await c.env.DB.prepare(
      `SELECT c.*, o.order_type, o.amount as order_amount, u.name as buyer_name
       FROM affiliate_commissions c
       JOIN orders o ON c.order_id = o.id
       JOIN users u ON c.buyer_user_id = u.id
       WHERE c.affiliate_code = ?
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(affiliate.affiliate_code, limit, offset).all();

    return paginated(c, rows.results, { page, limit, total: Number(totalRow?.total || 0) });
  } catch (err) {
    console.error('[affiliate:commissions]', err);
    return error(c, 'Gagal memuat riwayat komisi', 500);
  }
});

// Get all leads (registrations + webinar signups) from this affiliate — paginated
affiliateRoutes.get('/leads', async (c) => {
  try {
    const user = c.get('user');
    const affiliate = await c.env.DB.prepare(
      'SELECT affiliate_code FROM affiliate_accounts WHERE user_id = ? LIMIT 1'
    ).bind(user.id).first() as any;
    if (!affiliate) return error(c, 'Not an affiliate', 403);

    const code = affiliate.affiliate_code as string;
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
    const limit = 20;
    const offset = (page - 1) * limit;

    // Fetch all combined leads via UNION — sorted, paginated
    const rows = await c.env.DB.prepare(
      `SELECT name, created_at, type, detail FROM (
         SELECT u.name, aa.created_at, 'registration' as type, NULL as detail
         FROM affiliate_attributions aa
         JOIN users u ON aa.user_id = u.id
         WHERE aa.affiliate_code = ? AND aa.order_id IS NULL
         UNION ALL
         SELECT wr.name, wr.registered_at as created_at, 'webinar' as type, w.title as detail
         FROM webinar_registrations wr
         JOIN webinars w ON wr.webinar_id = w.id
         WHERE wr.affiliate_code = ?
       )
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(code, code, limit, offset).all();

    const totalRow = await c.env.DB.prepare(
      `SELECT COUNT(*) as total FROM (
         SELECT aa.id FROM affiliate_attributions aa WHERE aa.affiliate_code = ? AND aa.order_id IS NULL
         UNION ALL
         SELECT wr.id FROM webinar_registrations wr WHERE wr.affiliate_code = ?
       )`
    ).bind(code, code).first() as any;

    const total = Number(totalRow?.total || 0);
    const totalPages = Math.ceil(total / limit);

    const leads = (rows.results as any[]).map((lead) => ({
      ...lead,
      name: censorName(lead.name || ''),
    }));

    return success(c, { leads, page, limit, total, totalPages });
  } catch (err) {
    console.error('[affiliate:leads]', err);
    return error(c, 'Gagal memuat leads', 500);
  }
});

function censorName(name: string): string {
  return name.trim().split(/\s+/).map((word) => {
    if (word.length <= 2) return word;
    return word.slice(0, 2) + '*'.repeat(Math.max(2, word.length - 2));
  }).join(' ');
}

export default affiliateRoutes;
