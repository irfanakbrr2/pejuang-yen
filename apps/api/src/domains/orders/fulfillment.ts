import type { Env } from '../../env';
import {
  paymentSucceededEmailHtml,
  commissionEarnedEmailHtml,
  creditPurchaseSuccessEmailHtml,
} from '../../lib/email-templates';
import { membershipExpiresAt } from '../../lib/dates';
import { notifyAdminOrderPaid, notifyAdminPrivateConsultationOrder } from '../../lib/admin-notifications';
import { getDefaultCommissionRate, resolveAffiliateCommissionRate } from '../../lib/settings';
import { enqueueEmail, type EmailQueueMessage } from '../../lib/email-queue';
import { trackServerEvent, recordUpgradeAttribution } from '../../lib/tracking';
import { buildAddonGrantStatements } from './grants';
import { getNumericSetting } from '../../lib/settings';

const PRIVATE_CONSULTATION_ADDON_ID = 'private_1on1_consultation';

export type OrderMetadataAddon = {
  type: string;
  label: string;
  amount: number;
  status?: string;
  // funnel_bump
  step_id?: string;
  funnel_id?: string;
  product_type?: string;
  product_id?: string;
};

export type OrderMetadata = {
  addons?: OrderMetadataAddon[];
  pricing?: {
    product_amount?: number;
    discount_amount?: number;
    subtotal_amount?: number;
    order_bump_amount?: number;
    payment_admin_fee?: number;
    total_amount?: number;
  };
  /** Order hasil upsell/downsell funnel */
  funnel?: {
    funnel_id?: string;
    offer_id?: string;
    step_type?: string;
    trigger_order_id?: string;
  };
  /** Order produk creator store — fee di-snapshot saat prepareOrder */
  creator?: {
    store_id?: string;
    store_user_id?: string;
    fee_rate?: number;
    fee_amount?: number;
    net_amount?: number;
  };
};

export function parseOrderMetadata(metadataJson: unknown): OrderMetadata {
  if (!metadataJson || typeof metadataJson !== 'string') return {};
  try {
    const parsed = JSON.parse(metadataJson);
    return parsed && typeof parsed === 'object' ? parsed as OrderMetadata : {};
  } catch {
    return {};
  }
}

export function privateConsultationAddon(addons: OrderMetadataAddon[] = []): OrderMetadataAddon | null {
  return addons.find((addon) => addon.type === PRIVATE_CONSULTATION_ADDON_ID) || null;
}

export interface FulfillPaidOrderInput {
  /** Row dari tabel orders (SELECT *) */
  order: Record<string, unknown>;
  provider: 'pakasir';
  /** pakasir: gateway order id (GWA-xxx[-Rn]) */
  providerTransactionId: string | null;
  /** qris / bni_va / ... — diisi untuk pakasir */
  paymentMethod?: string | null;
  /** untuk audit log + admin notify (mis. 'payment.received', 'pakasir.completed') */
  eventType: string;
  /** payload mentah (webhook / transaction detail) → payments.raw_payload_json */
  rawPayload: string;
  /** nominal produk untuk komisi + email; default: metadata pricing → order.amount */
  productAmount?: number;
  paymentAdminFee?: number;
  /** pakasir: attempt payments sudah ada → UPDATE jadi paid (bukan INSERT) */
  existingPaymentId?: string | null;
  /** bila diisi, UPDATE webhook_events 'processed' ikut dalam batch atomik */
  webhookEventId?: string | null;
}

export interface FulfillPaidOrderResult {
  /** true bila kredit tools sudah pernah ditambahkan oleh event lain (duplicate) */
  creditsAlreadyAdded: boolean;
}

/**
 * Fulfillment order berbayar — shared antara webhook Pakasir
 * dan manual check ("Saya sudah bayar"). HARUS dipanggil hanya setelah
 * pembayaran terverifikasi ke API provider.
 *
 * Idempotency struktural (aman dipanggil berulang untuk order yang sama):
 * - UPDATE orders ... WHERE status != 'paid'
 * - INSERT OR IGNORE + unique index: enrollments(user_id,course_id),
 *   memberships(source_order_id), user_access(source...), affiliate_commissions(order_id),
 *   tool_credit_transactions purchase per order.
 */
export async function fulfillPaidOrder(env: Env, ctx: ExecutionContext, input: FulfillPaidOrderInput): Promise<FulfillPaidOrderResult> {
  const { order, provider, providerTransactionId, eventType, rawPayload } = input;
  const resolvedOrderId = order.id as string;
  const now = new Date().toISOString();

  const queueEmailBg = (message: EmailQueueMessage, label: string) => {
    ctx.waitUntil(
      enqueueEmail(env, message).catch((err) => console.error(`[fulfillment] ${label} queue error:`, err))
    );
  };
  const queueBackground = (task: Promise<unknown>, label: string) => {
    ctx.waitUntil(task.catch((err) => console.error(`[fulfillment] ${label} error:`, err)));
  };

  // Fetch user for email notifications
  const orderUser = order.user_id
    ? await env.DB.prepare('SELECT id, name, email, phone FROM users WHERE id = ?').bind(order.user_id).first()
    : null;
  const userName = ((orderUser?.name as string) || '').split(' ')[0] || 'Kamu';
  const userEmail = orderUser?.email as string | undefined;

  const orderMetadata = parseOrderMetadata(order.metadata_json);
  const totalAmount = Number(order.amount || 0);
  const productAmount = input.productAmount ?? (Number(orderMetadata.pricing?.product_amount) || totalAmount);
  const paymentAdminFee = input.paymentAdminFee ?? (Number(orderMetadata.pricing?.payment_admin_fee) || 0);
  const orderAddons = Array.isArray(orderMetadata.addons) ? orderMetadata.addons : [];
  const privateConsultation = privateConsultationAddon(orderAddons);
  let accessDetail = 'Akses kamu sudah diproses ke akun PejuangYen yang melakukan pembayaran.';
  let toolCreditEmailMessage: EmailQueueMessage | null = null;
  let toolCreditsPending: { transactionId: string; creditsToAdd: number; pkgName: string } | null = null;
  let membershipPlanBefore: string | null = null;
  let serviceFollowupNeeded = false; // digital_product delivery_type 'service' → admin follow-up
  let creatorSalePending: { storeUserId: string; netAmount: number; productName: string } | null = null;
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(`UPDATE orders SET status = 'paid', updated_at = ?, paid_at = ? WHERE id = ? AND status != 'paid'`).bind(now, now, resolvedOrderId),
    env.DB.prepare(`UPDATE coupon_redemptions SET status = 'paid' WHERE order_id = ? AND status != 'paid'`).bind(resolvedOrderId),
    env.DB.prepare(
      `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, before_data_json, after_data_json, ip_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      null,
      'webhook_payment_received',
      'order',
      resolvedOrderId,
      JSON.stringify({ status: order.status }),
      JSON.stringify({ status: 'paid', event_type: eventType, provider_transaction_id: providerTransactionId }),
      null,
      now
    ),
  ];

  // Record payment attempt → paid
  if (input.existingPaymentId) {
    // Pakasir: attempt row sudah dibuat saat create-payment → tandai lunas
    statements.push(env.DB.prepare(
      `UPDATE payments SET status = 'paid', paid_at = ?, updated_at = ?, raw_payload_json = ? WHERE id = ? AND status != 'paid'`
    ).bind(now, now, rawPayload, input.existingPaymentId));
  } else if (providerTransactionId) {
    statements.push(env.DB.prepare(
      `INSERT OR IGNORE INTO payments (id, order_id, provider, provider_transaction_id, provider_payment_id, amount, currency, status, raw_payload_json, created_at, updated_at, paid_at, payment_method)
       VALUES (?, ?, ?, ?, ?, ?, 'IDR', 'paid', ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), resolvedOrderId, provider, providerTransactionId, providerTransactionId, order.amount, rawPayload, now, now, now, input.paymentMethod || null));
  } else {
    console.warn('[fulfillment] missing provider transaction id — payment record skipped', JSON.stringify({ orderId: resolvedOrderId, eventType }));
  }

  // Payment Notification
  if (order.user_id) {
    statements.push(env.DB.prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, data_json, status, sent_at, created_at)
       VALUES (?, ?, 'payment', ?, ?, ?, 'sent', ?, ?)`
    ).bind(
      crypto.randomUUID(),
      order.user_id,
      'Pembayaran Berhasil',
      `Pembayaran untuk pesanan ${order.order_number} berhasil dikonfirmasi.`,
      JSON.stringify({ url: '/transactions' }),
      now,
      now
    ));
  }

  if (order.order_type === 'course') {
    statements.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO enrollments (id, user_id, course_id, status, enrolled_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?)`
      ).bind(crypto.randomUUID(), order.user_id, order.product_id, now, now),
      env.DB.prepare(
        `INSERT OR IGNORE INTO user_access (id, user_id, access_type, resource_type, resource_id, source_type, source_id, status, starts_at, expires_at, created_at, updated_at)
         VALUES (?, ?, 'lifetime', 'course', ?, 'order', ?, 'active', ?, NULL, ?, ?)`
      ).bind(crypto.randomUUID(), order.user_id, order.product_id, resolvedOrderId, now, now, now),
      env.DB.prepare(
        `INSERT INTO notifications (id, user_id, type, title, body, data_json, status, sent_at, created_at)
         VALUES (?, ?, 'enrollment', ?, ?, ?, 'sent', ?, ?)`
      ).bind(
        crypto.randomUUID(),
        order.user_id,
        'Akses Kelas Aktif',
        `Akses kelas ${order.product_name} sudah aktif. Selamat belajar!`,
        JSON.stringify({ url: '/my-classes' }),
        now,
        now
      )
    );
    accessDetail = `Akses kelas <strong>${order.product_name}</strong> sudah aktif di akun kamu. Buka halaman Kelas Saya untuk mulai belajar dari modul pertama.`;

  } else if (order.order_type === 'membership') {
    const plan = await env.DB.prepare('SELECT name, duration_type, duration_days FROM membership_plans WHERE id = ?').bind(order.product_id).first();
    if (plan) {
      const existing = await env.DB.prepare(
        `SELECT expires_at, plan_id FROM memberships
         WHERE user_id = ? AND status = 'active'
           AND (expires_at IS NULL OR expires_at > ?)
         ORDER BY expires_at DESC LIMIT 1`
      ).bind(order.user_id, now).first();
      membershipPlanBefore = (existing?.plan_id as string | null) || 'free';
      const baseDate = (existing?.expires_at as string | null) || now;
      const expiresAt = membershipExpiresAt(baseDate, plan.duration_type as string, plan.duration_days as number | null);
      statements.push(env.DB.prepare(
        `INSERT OR IGNORE INTO memberships (id, user_id, plan_id, status, starts_at, expires_at, source_order_id, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), order.user_id, order.product_id, baseDate, expiresAt, resolvedOrderId, now, now));
      const expiry = expiresAt
        ? `berlaku hingga <strong>${new Date(expiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>`
        : 'berlaku seumur hidup';
      accessDetail = `Membership <strong>${plan.name}</strong> kamu sudah aktif dan ${expiry}. Kamu bisa membuka benefit premium dari dashboard PejuangYen.`;
    }

  } else if (order.order_type === 'tool_credits') {
    const pkg = await env.DB.prepare(
      'SELECT name, credits FROM tool_credit_packages WHERE id = ?'
    ).bind(order.product_id).first();

    if (pkg) {
      const creditsToAdd = pkg.credits as number;
      const pkgName = pkg.name as string;

      const creditTransactionId = crypto.randomUUID();

      statements.push(
        env.DB.prepare(
          `INSERT OR IGNORE INTO tool_credit_transactions (id, user_id, type, amount, balance_after, order_id, description, created_at)
           VALUES (?, ?, 'purchase', ?, 0, ?, ?, ?)`
        ).bind(creditTransactionId, order.user_id, creditsToAdd, resolvedOrderId, `Pembelian paket ${pkgName}`, now),
        env.DB.prepare(
          `INSERT INTO user_tool_credits (id, user_id, balance, total_purchased, created_at, updated_at)
           SELECT ?, ?, ?, ?, ?, ?
           WHERE EXISTS (
             SELECT 1 FROM tool_credit_transactions
             WHERE id = ? AND order_id = ? AND type = 'purchase'
           )
           ON CONFLICT(user_id) DO UPDATE SET
             balance = balance + excluded.balance,
             total_purchased = total_purchased + excluded.total_purchased,
             updated_at = ?`
        ).bind(crypto.randomUUID(), order.user_id, creditsToAdd, creditsToAdd, now, now, creditTransactionId, resolvedOrderId, now)
      );

      // Defer email and accessDetail — actual balance read after batch
      toolCreditsPending = { transactionId: creditTransactionId, creditsToAdd, pkgName };
    }
  } else if (order.order_type === 'webinar_registration') {
    statements.push(
      env.DB.prepare(
        `UPDATE webinar_registrations SET status = 'registered_paid', confirmed_at = ?, updated_at = ? WHERE user_id = ? AND webinar_id = ?`
      ).bind(now, now, order.user_id, order.product_id)
    );
    accessDetail = `Pendaftaran webinar <strong>${order.product_name}</strong> kamu sudah berhasil. Silakan cek detailnya di dashboard PejuangYen.`;
  } else if (order.order_type === 'digital_product') {
    const dp = await env.DB.prepare('SELECT slug, delivery_type FROM digital_products WHERE id = ?').bind(order.product_id).first();
    statements.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO user_access (id, user_id, access_type, resource_type, resource_id, source_type, source_id, status, starts_at, expires_at, created_at, updated_at)
         VALUES (?, ?, 'lifetime', 'digital_product', ?, 'order', ?, 'active', ?, NULL, ?, ?)`
      ).bind(crypto.randomUUID(), order.user_id, order.product_id, resolvedOrderId, now, now, now),
      env.DB.prepare(
        `INSERT INTO notifications (id, user_id, type, title, body, data_json, status, sent_at, created_at)
         VALUES (?, ?, 'enrollment', ?, ?, ?, 'sent', ?, ?)`
      ).bind(
        crypto.randomUUID(),
        order.user_id,
        'Produk Digital Aktif',
        `Akses produk ${order.product_name} sudah aktif.`,
        JSON.stringify({ url: '/products' }),
        now,
        now
      )
    );
    if (dp?.delivery_type === 'service') {
      serviceFollowupNeeded = true;
      accessDetail = `Pembelian <strong>${order.product_name}</strong> berhasil. Tim PejuangYen akan menghubungi kamu via WhatsApp untuk konfirmasi jadwal dan tindak lanjut.`;
    } else {
      accessDetail = `Produk digital <strong>${order.product_name}</strong> sudah bisa diakses. Buka halaman Produk Saya untuk mengunduh atau membukanya.`;
    }
  } else if (order.order_type === 'creator_product') {
    // Grant akses pembeli
    statements.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO user_access (id, user_id, access_type, resource_type, resource_id, source_type, source_id, status, starts_at, expires_at, created_at, updated_at)
         VALUES (?, ?, 'lifetime', 'creator_product', ?, 'order', ?, 'active', ?, NULL, ?, ?)`
      ).bind(crypto.randomUUID(), order.user_id, order.product_id, resolvedOrderId, now, now, now),
      env.DB.prepare(
        `INSERT INTO notifications (id, user_id, type, title, body, data_json, status, sent_at, created_at)
         VALUES (?, ?, 'enrollment', ?, ?, ?, 'sent', ?, ?)`
      ).bind(
        crypto.randomUUID(),
        order.user_id,
        'Pembelian Berhasil',
        `Produk ${order.product_name} sudah bisa diakses.`,
        JSON.stringify({ url: '/pembelian' }),
        now,
        now
      )
    );

    // Kredit saldo creator — INSERT OR IGNORE + unique partial idx (order_id, sale)
    // → webhook dobel / manual check TIDAK bisa double-credit
    const creator = orderMetadata.creator;
    if (creator?.store_id && creator.store_user_id) {
      const holdDays = await getNumericSetting(env.DB, 'creator_earnings_hold_days', 7);
      const eligibleAt = new Date(Date.now() + holdDays * 86_400_000).toISOString();
      const grossAmount = Number(orderMetadata.pricing?.product_amount) || totalAmount;
      const netAmount = Number(creator.net_amount) || Math.max(0, grossAmount - (Number(creator.fee_amount) || 0));

      statements.push(
        env.DB.prepare(
          `INSERT OR IGNORE INTO creator_earnings (id, store_id, user_id, entry_type, amount, gross_amount, fee_rate, fee_amount, order_id, eligible_at, note, created_at)
           VALUES (?, ?, ?, 'sale', ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(), creator.store_id, creator.store_user_id,
          netAmount, grossAmount, Number(creator.fee_rate) || 0, Number(creator.fee_amount) || 0,
          resolvedOrderId, eligibleAt, `Penjualan: ${order.product_name}`, now
        ),
        // sales_count hanya naik bila sale entry untuk order ini benar2 tercatat (guard idempoten)
        env.DB.prepare(
          `UPDATE creator_products SET sales_count = sales_count + 1, updated_at = ?
           WHERE id = ? AND EXISTS (
             SELECT 1 FROM creator_earnings WHERE order_id = ? AND entry_type = 'sale' AND created_at = ?
           )`
        ).bind(now, order.product_id, resolvedOrderId, now),
        env.DB.prepare(
          `INSERT INTO notifications (id, user_id, type, title, body, data_json, status, sent_at, created_at)
           VALUES (?, ?, 'commission', ?, ?, ?, 'sent', ?, ?)`
        ).bind(
          crypto.randomUUID(),
          creator.store_user_id,
          'Produk Tokomu Terjual! 🎉',
          `${order.product_name} terjual — Rp${netAmount.toLocaleString('id-ID')} masuk ke saldo tokomu.`,
          JSON.stringify({ url: '/toko-saya' }),
          now,
          now
        )
      );
      creatorSalePending = { storeUserId: creator.store_user_id, netAmount, productName: order.product_name as string };
    }

    accessDetail = `Produk <strong>${order.product_name}</strong> sudah bisa diakses. Buka halaman <strong>Pembelian</strong> di dashboard PejuangYen untuk mengunduh atau membukanya.`;
  }

  // Affiliate commission
  let affiliateEmailMessage: EmailQueueMessage | null = null;
  if (order.affiliate_code) {
    const affiliateAccount = await env.DB.prepare(
      'SELECT user_id, default_commission_rate, tier FROM affiliate_accounts WHERE affiliate_code = ? AND status = ?'
    ).bind(order.affiliate_code, 'active').first();

    // Cegah self-referral: jangan beri komisi bila affiliate = pembeli sendiri
    if (affiliateAccount && affiliateAccount.user_id !== order.user_id) {
      const defaultCommissionRate = await getDefaultCommissionRate(env.DB);
      // Tier affiliate menaikkan batas maksimum rate komisi non-membership.
      const rate = resolveAffiliateCommissionRate(order.order_type, affiliateAccount.default_commission_rate, defaultCommissionRate, affiliateAccount.tier);
      const commissionableAmount = productAmount || Number(order.amount);
      const commissionAmount = Math.floor(commissionableAmount * (rate / 100));

      statements.push(
        env.DB.prepare(
          `INSERT OR IGNORE INTO affiliate_commissions (id, affiliate_code, affiliate_user_id, order_id, buyer_user_id, amount, commission_rate, commission_amount, status, approved_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'approved', ?, ?)`
        ).bind(
          crypto.randomUUID(), order.affiliate_code, affiliateAccount.user_id,
          resolvedOrderId, order.user_id, commissionableAmount, rate, commissionAmount, now, now
        ),
        env.DB.prepare(
          `INSERT INTO notifications (id, user_id, type, title, body, data_json, status, sent_at, created_at)
           VALUES (?, ?, 'commission', ?, ?, ?, 'sent', ?, ?)`
        ).bind(
          crypto.randomUUID(),
          affiliateAccount.user_id,
          'Komisi Affiliate Baru',
          `Kamu mendapatkan komisi Rp${commissionAmount.toLocaleString('id-ID')} dari penjualan via kodemu.`,
          JSON.stringify({ url: '/affiliate' }),
          now,
          now
        )
      );

      const affiliateUser = await env.DB.prepare('SELECT name, email FROM users WHERE id = ?')
        .bind(affiliateAccount.user_id).first();
      if (affiliateUser?.email) {
        affiliateEmailMessage = {
          type: 'send_email',
          recipient: affiliateUser.email as string,
          subject: 'Kamu baru dapat komisi affiliate!',
          content: commissionEarnedEmailHtml(
            ((affiliateUser.name as string) || '').split(' ')[0] || 'Kamu',
            commissionAmount, rate
          ),
          emailType: 'transactional',
        };
      }
    }
  }

  // Funnel order bump: grant produk tambahan + event converted (idempoten via
  // INSERT OR IGNORE + unique idx (trigger_order_id, step_type, event_type))
  for (const bumpAddon of orderAddons.filter((a) => a.type === 'funnel_bump')) {
    if (!bumpAddon.product_type || !bumpAddon.product_id) continue;
    const grantStatements = await buildAddonGrantStatements(env, {
      userId: order.user_id as string,
      productType: bumpAddon.product_type,
      productId: bumpAddon.product_id,
      sourceOrderId: resolvedOrderId,
      now,
    });
    if (grantStatements) {
      statements.push(...grantStatements);
    } else {
      console.warn('[fulfillment] bump addon grant skipped', JSON.stringify({ orderId: resolvedOrderId, productType: bumpAddon.product_type, productId: bumpAddon.product_id }));
    }
    if (bumpAddon.funnel_id) {
      statements.push(env.DB.prepare(
        `INSERT OR IGNORE INTO funnel_events (id, funnel_id, step_type, event_type, user_id, trigger_order_id, amount, created_at)
         VALUES (?, ?, 'order_bump', 'converted', ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), bumpAddon.funnel_id, order.user_id, resolvedOrderId, bumpAddon.amount, now));
    }
  }

  if (input.webhookEventId) {
    statements.push(
      env.DB.prepare(`UPDATE webhook_events SET processing_status = 'processed', processed_at = ? WHERE id = ?`).bind(now, input.webhookEventId)
    );
  }

  await env.DB.batch(statements);
  console.log('FULFILLMENT_PROCESSED', JSON.stringify({ orderId: resolvedOrderId, provider, eventType }));

  // Order hasil upsell/downsell funnel → tandai converted + event revenue (idempoten)
  if (orderMetadata.funnel?.offer_id) {
    const { FunnelsService } = await import('../funnels/service');
    queueBackground(
      new FunnelsService(env).recordConversionIfFunnelOrder(orderMetadata.funnel, order),
      'funnel conversion'
    );
  }

  // First-party tracking — after the atomic payment batch, fire-and-forget.
  // Dedup against webhook retries is structural: unique (order_id, event_name)
  // index + INSERT OR IGNORE.
  queueBackground((async () => {
    const buyerUserId = (order.user_id as string | null) || null;
    const attribution = buyerUserId
      ? await env.DB.prepare(
          `SELECT last_source, last_medium, last_campaign, last_landing_page, last_webinar_id
           FROM user_attribution WHERE user_id = ?`
        ).bind(buyerUserId).first().catch(() => null) as {
          last_source?: string; last_medium?: string; last_campaign?: string;
          last_landing_page?: string; last_webinar_id?: string;
        } | null
      : null;

    await trackServerEvent(env, {
      event_name: 'payment_success',
      event_category: 'commerce',
      user_id: buyerUserId,
      order_id: resolvedOrderId,
      payment_amount: totalAmount,
      payment_status: 'paid',
      coupon_code: (order.coupon_code as string | null) || null,
      affiliate_code: (order.affiliate_code as string | null) || null,
      utm_source: attribution?.last_source || null,
      utm_medium: attribution?.last_medium || null,
      utm_campaign: attribution?.last_campaign || null,
      webinar_id: attribution?.last_webinar_id || null,
      metadata: { order_type: order.order_type, product_id: order.product_id },
    });

    if (order.order_type === 'membership' && buyerUserId) {
      await trackServerEvent(env, {
        event_name: 'membership_upgraded',
        event_category: 'commerce',
        user_id: buyerUserId,
        order_id: resolvedOrderId,
        payment_amount: totalAmount,
        payment_status: 'paid',
        plan_before: membershipPlanBefore,
        plan_after: order.product_id as string,
        coupon_code: (order.coupon_code as string | null) || null,
        affiliate_code: (order.affiliate_code as string | null) || null,
        utm_source: attribution?.last_source || null,
        utm_medium: attribution?.last_medium || null,
        utm_campaign: attribution?.last_campaign || null,
      });
      await recordUpgradeAttribution(env, buyerUserId, {
        upgrade_source: attribution?.last_source || ((order.affiliate_code as string | null) ? 'affiliate' : null),
        upgrade_medium: attribution?.last_medium || null,
        upgrade_campaign: attribution?.last_campaign || null,
        upgrade_page: attribution?.last_landing_page || null,
        upgrade_webinar_id: attribution?.last_webinar_id || null,
        upgraded_at: now,
      });
    }
  })(), 'tracking payment events');

  // Post-batch: read actual balance for tool credits email (must be after atomic batch)
  if (toolCreditsPending && userEmail) {
    const insertedCreditTx = await env.DB.prepare(
      `SELECT id FROM tool_credit_transactions WHERE id = ? LIMIT 1`
    ).bind(toolCreditsPending.transactionId).first();

    if (!insertedCreditTx) {
      // Kredit sudah pernah ditambahkan oleh event lain — jangan kirim email/notify ganda
      return { creditsAlreadyAdded: true };
    }

    const updatedCredit = await env.DB.prepare(
      'SELECT balance FROM user_tool_credits WHERE user_id = ?'
    ).bind(order.user_id).first();
    const newBalance = (updatedCredit?.balance as number) ?? toolCreditsPending.creditsToAdd;

    // Update balance_after in the transaction record (cosmetic, for admin dashboard)
    ctx.waitUntil(
      env.DB.prepare(
        `UPDATE tool_credit_transactions SET balance_after = ? WHERE id = ?`
      ).bind(newBalance, toolCreditsPending.transactionId).run().catch(() => {})
    );

    toolCreditEmailMessage = {
      type: 'send_email',
      recipient: userEmail,
      subject: `${toolCreditsPending.creditsToAdd} Kredit Tools Berhasil Ditambahkan!`,
      content: creditPurchaseSuccessEmailHtml({
        name: userName,
        orderNumber: order.order_number as string,
        packageName: toolCreditsPending.pkgName,
        credits: toolCreditsPending.creditsToAdd,
        totalAmount: Number(order.amount || 0),
        newBalance,
      }),
      emailType: 'transactional',
    };
    accessDetail = `<strong>${toolCreditsPending.creditsToAdd} kredit</strong> sudah ditambahkan ke akun kamu. Saldo sekarang: <strong>${newBalance} kredit</strong>. Gunakan untuk mengakses AI Tools PejuangYen.`;
  }

  queueBackground(notifyAdminOrderPaid(env, {
    orderId: resolvedOrderId,
    orderNumber: order.order_number as string,
    orderType: order.order_type as string,
    productName: order.product_name as string,
    productAmount,
    paymentAdminFee,
    totalAmount,
    addons: orderAddons,
    user: {
      id: (orderUser?.id as string) || (order.user_id as string),
      name: (orderUser?.name as string) || '-',
      email: (orderUser?.email as string) || '-',
      phone: (orderUser?.phone as string | null) || null,
    },
    affiliateCode: (order.affiliate_code as string | null) || null,
    providerTransactionId,
    eventType,
    paidAt: now,
  }), 'admin paid order notification');

  if (privateConsultation || serviceFollowupNeeded) {
    queueBackground(notifyAdminPrivateConsultationOrder(env, {
      orderId: resolvedOrderId,
      orderNumber: order.order_number as string,
      productName: order.product_name as string,
      totalAmount,
      paidAt: now,
      user: {
        id: (orderUser?.id as string) || (order.user_id as string),
        name: (orderUser?.name as string) || '-',
        email: (orderUser?.email as string) || '-',
        phone: (orderUser?.phone as string | null) || null,
      },
    }), 'admin private consultation notification');
  }

  if (userEmail && order.order_type !== 'tool_credits') {
    queueEmailBg({
      type: 'send_email',
      recipient: userEmail,
      subject: `Pembayaran PejuangYen berhasil - ${order.order_number}`,
      content: paymentSucceededEmailHtml({
        name: userName,
        orderNumber: order.order_number as string,
        productName: order.product_name as string,
        productAmount,
        paymentAdminFee,
        totalAmount,
        orderType: order.order_type as string,
        accessDetail,
        addons: orderAddons,
        hasPrivateConsultation: !!privateConsultation,
      }),
      emailType: 'transactional',
    }, 'payment success email');
  }

  if (affiliateEmailMessage) queueEmailBg(affiliateEmailMessage, 'commission email');
  if (toolCreditEmailMessage) queueEmailBg(toolCreditEmailMessage, 'credit success email');

  // Email ke creator saat produknya terjual
  if (creatorSalePending) {
    queueBackground((async () => {
      const creatorUser = await env.DB.prepare('SELECT name, email FROM users WHERE id = ?')
        .bind(creatorSalePending!.storeUserId).first();
      if (!creatorUser?.email) return;
      const firstName = ((creatorUser.name as string) || '').split(' ')[0] || 'Creator';
      await enqueueEmail(env, {
        type: 'send_email',
        recipient: creatorUser.email as string,
        subject: `Produk tokomu terjual: ${creatorSalePending!.productName}`,
        content: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
          <h2 style="color:#0F6E56;">Penjualan Baru! 🎉</h2>
          <p>Halo ${firstName},</p>
          <p>Produk <strong>${creatorSalePending!.productName}</strong> baru saja terjual di toko kamu.</p>
          <p style="font-size:18px;"><strong>Rp${creatorSalePending!.netAmount.toLocaleString('id-ID')}</strong> sudah masuk ke saldo tokomu (tersedia setelah masa penahanan).</p>
          <p><a href="${env.APP_URL}/toko-saya" style="display:inline-block;background:#0F6E56;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Lihat Saldo Toko →</a></p>
        </div>`,
        emailType: 'transactional',
      });
    })(), 'creator sale email');
  }

  // Start post-purchase onboarding and cancel any running abandoned checkout sequence
  if (order.user_id) {
    queueEmailBg({
      type: 'trigger_sequence',
      userId: order.user_id as string,
      sequenceName: 'post_purchase_onboarding',
    }, 'post_purchase sequence');
    queueBackground(env.DB.prepare(
      `UPDATE user_email_sequence_state SET status = 'cancelled', updated_at = ?
       WHERE user_id = ? AND status IN ('active', 'paused')
         AND sequence_id = (SELECT id FROM email_sequences WHERE name = 'abandoned_checkout' LIMIT 1)`
    ).bind(now, order.user_id).run(), 'abandoned checkout cancel');
  }

  return { creditsAlreadyAdded: false };
}
