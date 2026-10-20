import { Hono } from 'hono';
import type { Env } from './env';
import { corsMiddleware } from './middleware/cors';
import { errorHandler } from './middleware/error-handler';
import { originGuard } from './middleware/origin';
import authRoutes from './domains/auth/routes';
import coursesRoutes from './domains/courses/routes';
import userRoutes from './domains/user/routes';
import userDashboardRoutes from './domains/user/dashboard.routes';
import userPushRoutes from './domains/user/push.routes';
import userBonusesRoutes from './domains/user/bonuses.routes';
import userCertificatesRoutes from './domains/user/certificates.routes';
import ordersRoutes from './domains/orders/routes';
import checkoutRoutes from './domains/checkout/routes';
import pakasirWebhookRoutes from './domains/webhooks/pakasir.routes';
import affiliateRoutes from './domains/affiliate/routes';
import resourceRoutes from './domains/resources/routes';
import skillsRoutes from './domains/skills/routes';
import searchRoutes from './domains/search/routes';
import pathsRoutes from './domains/paths/routes';
import adminSkillsRoutes from './domains/admin/skills.routes';
import adminTagsRoutes from './domains/admin/tags.routes';
import adminContentRoutes from './domains/admin/content.routes';
import adminPathsRoutes from './domains/admin/paths.routes';
import adminCoursesRoutes from './domains/admin/courses.routes';
import adminModulesRoutes from './domains/admin/modules.routes';
import adminLessonsRoutes from './domains/admin/lessons.routes';
import adminUsersRoutes from './domains/admin/users.routes';
import adminMembershipsRoutes from './domains/admin/memberships.routes';
import adminOrdersRoutes from './domains/admin/orders.routes';
import adminAffiliatesRoutes from './domains/admin/affiliates.routes';
import adminCommissionsRoutes from './domains/admin/commissions.routes';
import adminBonusesRoutes from './domains/admin/bonuses.routes';
import adminDashboardRoutes from './domains/admin/dashboard.routes';
import adminPaymentsRoutes from './domains/admin/payments.routes';
import adminResourcesRoutes from './domains/admin/resources.routes';
import adminAuditLogsRoutes from './domains/admin/audit-logs.routes';
import adminAnalyticsKeysRoutes from './domains/admin/analytics-keys.routes';
import adminErrorLogsRoutes from './domains/admin/error-logs.routes';
import adminCertificatesRoutes from './domains/admin/certificates.routes';
import adminWebinarsRoutes from './domains/admin/webinars.routes';
import adminRecordingsRoutes from './domains/admin/recordings.routes';
import adminCommunityRoutes from './domains/admin/community.routes';
import adminAiFillRoutes from './domains/admin/ai-fill.routes';
import adminWebhooksRoutes from './domains/admin/webhooks.routes';
import adminCouponsRoutes from './domains/admin/coupons.routes';
import invoiceRoutes from './domains/invoices/routes';
import membershipRoutes from './domains/membership/routes';
import settingsRoutes from './domains/settings/routes';
import storageRoutes from './domains/storage/routes';
import emailRoutes from './domains/email/routes';
import mailketingWebhookRoutes from './domains/webhooks/mailketing.routes';
import adminEmailRoutes from './domains/admin/email.routes';
import adminPushRoutes from './domains/admin/push.routes';
import verifyRoutes from './domains/public/verify.routes';
import adminDigitalProductsRoutes from './domains/admin/digital-products.routes';
import publicDigitalProductsRoutes from './domains/public/digital-products.routes';
import userDigitalProductsRoutes from './domains/user/digital-products.routes';
import adminFunnelsRoutes from './domains/admin/funnels.routes';
import publicFunnelsRoutes from './domains/funnels/public.routes';
import funnelsRoutes from './domains/funnels/routes';
import tokoRoutes from './domains/toko/routes';
import publicTokoRoutes from './domains/toko/public.routes';
import purchasesRoutes from './domains/toko/purchases.routes';
import adminTokoRoutes from './domains/admin/toko.routes';
import analyticsRoutes from './domains/analytics/routes';
import toolsRoutes from './domains/tools/tools.routes';
import toolsCreditsRoutes from './domains/tools/credits.routes';
import adminToolsRoutes from './domains/tools/admin.tools.routes';
import publicWebinarsRoutes from './domains/webinars/public.routes';
import userWebinarsRoutes from './domains/webinars/user.routes';
import publicCouponsRoutes from './domains/public/coupons.routes';
import communityRoutes from './domains/community/routes';
import publicCommunityBlogRoutes from './domains/community/public.routes';
import shortlinksRoutes from './domains/shortlinks/routes';
import publicShortlinksRoutes from './domains/shortlinks/public.routes';
import trackingRoutes from './domains/tracking/routes';
import adminAnalyticsRoutes from './domains/admin/analytics.routes';
import adminTalentBoardRoutes from './domains/admin/talent-board.routes';
import adminSuccessStoriesRoutes from './domains/admin/success-stories.routes';
import categoriesRoutes from './domains/public/categories.routes';
import manualPaymentRoutes from './domains/public/manual-payment.routes';
import leaderboardRoutes from './domains/leaderboard/routes';
import challengeRoutes from './domains/challenges/routes';
import automationsRoutes from './domains/automations/routes';
import aiPulseRoutes from './domains/ai-pulse/routes';
import userAiPulseRoutes from './domains/ai-pulse/user.routes';
import adminAiPulseRoutes from './domains/ai-pulse/admin.routes';
import publicAiPulseBlogRoutes from './domains/ai-pulse/public.routes';
import { suppressEmail, cancelUserSequences } from './lib/email-suppression';

const app = new Hono<{ Bindings: Env }>();

// ─── Global Middleware ───────────────────────────
app.use('*', errorHandler());
app.use('*', corsMiddleware());
app.use('*', originGuard());

// ─── Health Check ────────────────────────────────
app.get('/', (c) => c.json({
  success: true,
  message: 'PejuangYen API v1.0',
  timestamp: new Date().toISOString(),
}));

app.get('/health', (c) => c.json({ status: 'ok' }));

// ─── Route Modules ───────────────────────────────
app.route('/api/auth', authRoutes);
app.route('/api/courses', coursesRoutes);
app.route('/api/user', userRoutes);
app.route('/api/user/dashboard', userDashboardRoutes);
app.route('/api/user/push', userPushRoutes);
app.route('/api/user/bonuses', userBonusesRoutes);
app.route('/api/user/certificates', userCertificatesRoutes);
app.route('/api/user/webinars', userWebinarsRoutes);
app.route('/api/community', communityRoutes);
app.route('/api/orders', ordersRoutes);
app.route('/api/checkout', checkoutRoutes);
app.route('/api/webhooks/pakasir', pakasirWebhookRoutes);
app.route('/api/affiliate', affiliateRoutes);
app.route('/api/leaderboard', leaderboardRoutes);
app.route('/api/challenges', challengeRoutes);
app.route('/api/resources', resourceRoutes);
app.route('/api/skills', skillsRoutes);
app.route('/api/search', searchRoutes);
app.route('/api/paths', pathsRoutes);

app.route('/api/admin/dashboard', adminDashboardRoutes);
app.route('/api/admin/courses', adminCoursesRoutes);
app.route('/api/admin/modules', adminModulesRoutes);
app.route('/api/admin/lessons', adminLessonsRoutes);
app.route('/api/admin/users', adminUsersRoutes);
app.route('/api/admin/memberships', adminMembershipsRoutes);
app.route('/api/admin/orders', adminOrdersRoutes);
app.route('/api/admin/affiliates', adminAffiliatesRoutes);
app.route('/api/admin/commissions', adminCommissionsRoutes);
app.route('/api/admin/bonuses', adminBonusesRoutes);
app.route('/api/admin/resources', adminResourcesRoutes);
app.route('/api/admin/skills', adminSkillsRoutes);
app.route('/api/admin/tags', adminTagsRoutes);
app.route('/api/admin/content', adminContentRoutes);
app.route('/api/admin/paths', adminPathsRoutes);
app.route('/api/admin/payments', adminPaymentsRoutes);
app.route('/api/admin/audit-logs', adminAuditLogsRoutes);
app.route('/api/admin/analytics-keys', adminAnalyticsKeysRoutes);
app.route('/api/admin/error-logs', adminErrorLogsRoutes);
app.route('/api/admin/certificates', adminCertificatesRoutes);
app.route('/api/admin/webinars', adminWebinarsRoutes);
app.route('/api/admin/recordings', adminRecordingsRoutes);
app.route('/api/admin/community', adminCommunityRoutes);
app.route('/api/admin/ai-fill', adminAiFillRoutes);
app.route('/api/admin/webhooks', adminWebhooksRoutes);
app.route('/api/admin/coupons', adminCouponsRoutes);
app.route('/api/admin/invoices', invoiceRoutes);
app.route('/api/membership', membershipRoutes);
app.route('/api/manual-payment', manualPaymentRoutes);
app.route('/api/admin/settings', settingsRoutes);
app.route('/api/admin/storage', storageRoutes);

// ─── Email Marketing ─────────────────────────────────────────────────────────
app.route('/api/email', emailRoutes);
app.route('/api/webhooks/mailketing', mailketingWebhookRoutes);
app.route('/api/admin/email', adminEmailRoutes);
app.route('/api/admin/push', adminPushRoutes);

// ─── Public Certificate Verification (no auth) ───────────────────────────────
app.route('/api/verify', verifyRoutes);

// ─── Analytics API (Bearer token — for AI tools) ─────────────────────────────
app.route('/api/analytics', analyticsRoutes);

// ─── Tools & Credits ─────────────────────────────────────────────────────────
app.route('/api/tools', toolsRoutes);
app.route('/api/tools', toolsCreditsRoutes);
app.route('/api/admin/tools', adminToolsRoutes);

// ─── Public SEO Data ────────────────────────────────────────────────────────
app.route('/api/public/webinars', publicWebinarsRoutes);
app.route('/api/public/community-blog', publicCommunityBlogRoutes);
app.route('/api/public/coupons', publicCouponsRoutes);
app.route('/api/public/digital-products', publicDigitalProductsRoutes);
app.route('/api/user/digital-products', userDigitalProductsRoutes);
app.route('/api/admin/digital-products', adminDigitalProductsRoutes);
app.route('/api/public/funnels', publicFunnelsRoutes);
app.route('/api/funnels', funnelsRoutes);
app.route('/api/admin/funnels', adminFunnelsRoutes);
app.route('/api/toko', tokoRoutes);
app.route('/api/purchases', purchasesRoutes);
app.route('/api/public/toko', publicTokoRoutes);
app.route('/api/admin/toko', adminTokoRoutes);

// ─── Shortlinks (user-created pejuangyen.link/l/{slug}) ──────────────────────
app.route('/api/shortlinks', shortlinksRoutes);
app.route('/api/public/shortlinks', publicShortlinksRoutes);

// ─── First-party Tracking (anonymous + logged-in) ────────────────────────────
app.route('/api/tracking', trackingRoutes);
app.route('/api/admin/analytics', adminAnalyticsRoutes);
app.route('/api/admin/talent-board', adminTalentBoardRoutes);
app.route('/api/admin/success-stories', adminSuccessStoriesRoutes);

// ─── Content Taxonomy (9 kategori utama — publik) ────────────────────────────
app.route('/api/categories', categoriesRoutes);

// ─── AI Content Automation (engine workflow template-driven, pengganti n8n) ───
app.route('/api/automations', automationsRoutes);

// ─── AI Pulse — Intelligence Terminal (publik & gratis; bookmark perlu login) ─
app.route('/api/ai-pulse', aiPulseRoutes);
app.route('/api/user/ai-pulse', userAiPulseRoutes);
app.route('/api/admin/ai-pulse', adminAiPulseRoutes);
app.route('/api/public/ai-pulse-blog', publicAiPulseBlogRoutes);

// ─── Public Unsubscribe (no auth — link in email footers) ────────────────────
app.get('/api/unsubscribe', async (c) => {
  const emailParam = c.req.query('email');
  if (!emailParam) return c.redirect('https://pejuangyen.com/', 302);

  const email = decodeURIComponent(emailParam).toLowerCase();
  const now = new Date().toISOString();

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first() as { id: string } | null;

  await suppressEmail(email, 'unsubscribe', 'email_link', c.env.DB).catch(console.error);

  // Notifikasi best-effort ke Mail Hub terpusat — tidak boleh mengganggu redirect.
  if (c.env.MAIL_HUB_API_KEY) {
    try {
      c.executionCtx.waitUntil(
        fetch('https://email.sahabatcuan.id/suppress', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${c.env.MAIL_HUB_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, reason: 'unsubscribe' }),
        }).catch((err) => console.error('[mail-hub suppress]', err))
      );
    } catch (err) {
      console.error('[mail-hub suppress]', err);
    }
  }

  if (user) {
    await c.env.DB.prepare(
      `UPDATE email_marketing_profiles SET email_status = 'unsubscribed', marketing_consent = 0, updated_at = ? WHERE user_id = ?`
    ).bind(now, user.id).run().catch(console.error);
    await cancelUserSequences(user.id, c.env.DB).catch(console.error);
  }

  return c.redirect('https://pejuangyen.com/', 302);
});

// ─── 404 Handler ─────────────────────────────────
app.notFound((c) => c.json({ success: false, error: 'Not Found' }, 404));

export default app;
