import { OrdersRepository } from './repository';
import type { Env } from '../../env';
import { FunnelsService } from '../funnels/service';
import { FunnelsRepository } from '../funnels/repository';
import { getNumericSetting } from '../../lib/settings';
import { paymentCreatedEmailHtml, creditOrderCreatedEmailHtml } from '../../lib/email-templates';
import { notifyAdminNewOrder } from '../../lib/admin-notifications';
import { enqueueEmail } from '../../lib/email-queue';
import { trackServerEvent } from '../../lib/tracking';

const MIN_PAYMENT_ADMIN_FEE = 2000;
const MAX_PAYMENT_ADMIN_FEE = 2500;
const PRIVATE_CONSULTATION_ADDON_ID = 'private_1on1_consultation';
const PRIVATE_CONSULTATION_PRICE = 2500000;
const PRIVATE_CONSULTATION_LABEL = 'Konsultasi 1:1 Private dengan Irfan';

type OrderAddonInput = {
  type?: string;
  step_id?: string;
};

export type OrderAddon = {
  type: string;
  label: string;
  amount: number;
  status: string;
  // funnel_bump
  step_id?: string;
  funnel_id?: string;
  product_type?: string;
  product_id?: string;
};

export type CreateOrderBody = {
  order_type: string;
  product_id: string;
  affiliate_code?: string;
  mobile?: string;
  addons?: OrderAddonInput[];
  coupon_code?: string;
};

export type PreparedOrder = {
  order: Record<string, unknown>;
  orderId: string;
  orderNumber: string;
  orderType: string;
  productId: string;
  productName: string;
  description: string;
  productAmount: number;
  discountAmount: number;
  subtotal: number;
  orderBumpAmount: number;
  paymentAdminFee: number;
  amount: number;
  mobile: string;
  validatedAffiliateCode: string | null;
  selectedAddons: OrderAddon[];
  couponCode: string;
  creditPackage: { name: string; credits: number } | null;
};

export type PrepareOrderResult = { error: string; status: number } | { ok: PreparedOrder };

/** Opsi internal (TIDAK pernah diisi dari HTTP body) — dipakai flow upsell funnel. */
export type PrepareOrderInternalOpts = {
  /** Override harga produk (harga step funnel, sudah divalidasi server-side) */
  priceOverride?: number;
  /** Metadata tambahan yang di-merge ke orders.metadata_json (mis. { funnel: {...} }) */
  metadataExtra?: Record<string, unknown>;
};

function randomPaymentAdminFee() {
  return Math.floor(Math.random() * (MAX_PAYMENT_ADMIN_FEE - MIN_PAYMENT_ADMIN_FEE + 1)) + MIN_PAYMENT_ADMIN_FEE;
}

export class OrdersService {
  private repository: OrdersRepository;

  constructor(private env: Env) {
    this.repository = new OrdersRepository(env);
  }

  /**
   * Validasi + pricing + pembuatan internal order (status pending), TANPA
   * memanggil payment gateway. Dipakai oleh flow Pakasir embedded
   * (CheckoutService.createPayment).
   */
  async prepareOrder(user: any, body: CreateOrderBody, internalOpts?: PrepareOrderInternalOpts): Promise<PrepareOrderResult> {
    const { order_type, product_id } = body;
    const affiliateCode = body.affiliate_code?.trim() || '';
    const couponCode = body.coupon_code?.trim() || '';
    const requestedAddons = Array.isArray(body.addons) ? body.addons : [];

    // ── Validate input ───────────────────────────────────────────────────────
    if (!order_type || !product_id) {
      return { error: 'Missing required fields', status: 400 };
    }

    if (body.addons !== undefined && !Array.isArray(body.addons)) {
      return { error: 'Format addon tidak valid', status: 400 };
    }
    const unknownAddon = requestedAddons.find(
      (addon) => addon?.type !== PRIVATE_CONSULTATION_ADDON_ID && addon?.type !== 'funnel_bump'
    );
    if (unknownAddon) {
      return { error: 'Addon tidak valid', status: 400 };
    }
    if (requestedAddons.some((a) => a?.type === PRIVATE_CONSULTATION_ADDON_ID) && order_type !== 'membership') {
      return { error: 'Konsultasi 1:1 private hanya tersedia untuk order membership', status: 400 };
    }

    const mobile = (body.mobile || user.phone || '').trim();
    if (!mobile) {
      return { error: 'Nomor WhatsApp wajib diisi untuk melanjutkan pembayaran', status: 400 };
    }

    console.log('CREATE_ORDER_INPUT', JSON.stringify({ userId: user.id, product_id, order_type, mobile: '***' }));

    // ── Resolve product ──────────────────────────────────────────────────────
    let productAmount = 0;
    let productName = '';
    let description = '';
    let creditPackage: { name: string; credits: number } | null = null;
    // creator_product: snapshot fee platform saat order dibuat (deterministik di fulfillment)
    let creatorMeta: { store_id: string; store_user_id: string; fee_rate: number; fee_amount: number; net_amount: number } | null = null;

    if (order_type === 'course') {
      const course = await this.repository.getCoursePriceAndTitle(product_id);
      if (!course) return { error: 'Course not found', status: 404 };
      productAmount = Number(course.price);
      productName = course.title as string;
      description = `Kelas: ${course.title}`;
    } else if (order_type === 'membership') {
      const plan = await this.repository.getMembershipPriceAndName(product_id);
      if (!plan) return { error: 'Membership plan not found', status: 404 };
      productAmount = Number(plan.price);
      productName = plan.name as string;
      description = `Membership: ${plan.name}`;
    } else if (order_type === 'webinar_registration') {
      const webinar = await this.env.DB.prepare('SELECT title, paid_registration_price FROM webinars WHERE id = ?').bind(product_id).first() as any;
      if (!webinar) return { error: 'Webinar not found', status: 404 };
      productAmount = Number(webinar.paid_registration_price || 99000);
      productName = webinar.title as string;
      description = `Webinar: ${webinar.title}`;
    } else if (order_type === 'tool_credits') {
      const pkg = await this.env.DB.prepare(
        'SELECT name, credits, price FROM tool_credit_packages WHERE id = ? AND is_active = 1'
      ).bind(product_id).first() as any;
      if (!pkg) return { error: 'Paket kredit tidak ditemukan', status: 404 };
      productAmount = Number(pkg.price);
      productName = `Tool Credits - ${pkg.name}`;
      description = `Kredit Tools PejuangYen - ${pkg.name} (${pkg.credits} kredit)`;
      creditPackage = { name: pkg.name as string, credits: Number(pkg.credits) };
    } else if (order_type === 'digital_product') {
      const dp = await this.repository.getDigitalProductPriceAndName(product_id);
      if (!dp) return { error: 'Produk digital tidak ditemukan', status: 404 };
      productAmount = Number(dp.price);
      productName = dp.name as string;
      description = `Produk Digital: ${dp.name}`;
    } else if (order_type === 'creator_product') {
      const cp = await this.env.DB.prepare(
        `SELECT p.id, p.title, p.price, p.status as product_status,
                s.id as store_id, s.user_id as store_user_id, s.name as store_name, s.status as store_status, s.platform_fee_rate
         FROM creator_products p JOIN creator_stores s ON s.id = p.store_id
         WHERE p.id = ?`
      ).bind(product_id).first() as any;
      if (!cp || cp.product_status !== 'active' || cp.store_status !== 'active') {
        return { error: 'Produk toko tidak ditemukan', status: 404 };
      }
      if (cp.store_user_id === user.id) {
        return { error: 'Tidak bisa membeli produk toko sendiri', status: 400 };
      }
      productAmount = Number(cp.price);
      productName = cp.title as string;
      description = `${cp.store_name}: ${cp.title}`;
      const globalRate = await getNumericSetting(this.env.DB, 'creator_store_fee_rate', 2);
      const feeRate = Math.min(50, Math.max(0, Math.floor(cp.platform_fee_rate != null ? Number(cp.platform_fee_rate) : globalRate)));
      const feeAmount = Math.floor(productAmount * feeRate / 100);
      creatorMeta = {
        store_id: cp.store_id as string,
        store_user_id: cp.store_user_id as string,
        fee_rate: feeRate,
        fee_amount: feeAmount,
        net_amount: productAmount - feeAmount,
      };
    } else {
      return { error: 'Invalid order type', status: 400 };
    }

    // Harga khusus dari step funnel (server-side, bukan dari client)
    if (internalOpts?.priceOverride != null && Number.isFinite(internalOpts.priceOverride) && internalOpts.priceOverride > 0) {
      productAmount = Math.floor(internalOpts.priceOverride);
    }

    if (!productAmount || productAmount <= 0) {
      return { error: 'Amount tidak valid untuk pembayaran', status: 400 };
    }

    let discountAmount = 0;
    let couponOpts: any = null;

    if (couponCode && (order_type === 'membership' || order_type === 'webinar_registration')) {
       const codeUpper = couponCode.toUpperCase();
       const coupon = await this.env.DB.prepare(`SELECT * FROM coupons WHERE code = ? LIMIT 1`).bind(codeUpper).first() as any;
       if (coupon && coupon.is_active) {
         const nowTime = new Date().getTime();
         const isStarted = !coupon.starts_at || new Date(coupon.starts_at).getTime() <= nowTime;
         const isNotExpired = !coupon.expires_at || new Date(coupon.expires_at).getTime() > nowTime;

         if (isStarted && isNotExpired) {
           let isEligible = true;
           if (order_type === 'membership') {
             const plans = await this.env.DB.prepare(`SELECT plan_id FROM coupon_plan_eligibility WHERE coupon_id = ?`).bind(coupon.id).all();
             if (plans.results.length > 0) {
               isEligible = plans.results.some((p: any) => p.plan_id === product_id);
             }
           } else if (order_type === 'webinar_registration') {
             const webinarCoupons = await this.env.DB.prepare(`SELECT webinar_id FROM webinar_coupons WHERE coupon_id = ?`).bind(coupon.id).all();
             if (webinarCoupons.results.length > 0) {
               isEligible = webinarCoupons.results.some((p: any) => p.webinar_id === product_id);
             }
           }

           if (isEligible) {
             let limitOk = true;
             if (coupon.usage_limit_total) {
                const usage = await this.env.DB.prepare(`SELECT COUNT(*) as count FROM coupon_redemptions WHERE coupon_id = ? AND status = 'paid'`).bind(coupon.id).first() as any;
                if (usage.count >= coupon.usage_limit_total) limitOk = false;
             }

             if (limitOk) {
                if (coupon.discount_type === 'percentage') {
                   discountAmount = Math.floor(productAmount * (coupon.discount_value / 100));
                   if (coupon.max_discount_amount && discountAmount > coupon.max_discount_amount) {
                      discountAmount = coupon.max_discount_amount;
                   }
                } else {
                   discountAmount = coupon.discount_value;
                }

                if (discountAmount > productAmount) discountAmount = productAmount;

                couponOpts = {
                  id: coupon.id,
                  code: coupon.code,
                  discount_type: coupon.discount_type,
                  discount_value: coupon.discount_value,
                  discount_amount: discountAmount,
                  subtotal_amount: productAmount - discountAmount
                };
             }
           }
         }
       }
    }

    const subtotal = productAmount - discountAmount;

    // ── Resolve addons: legacy konsultasi + funnel bump (harga selalu server-side) ──
    const selectedAddons: OrderAddon[] = [];
    for (const addon of requestedAddons) {
      if (addon?.type === PRIVATE_CONSULTATION_ADDON_ID) {
        if (!selectedAddons.some((a) => a.type === PRIVATE_CONSULTATION_ADDON_ID)) {
          selectedAddons.push({
            type: PRIVATE_CONSULTATION_ADDON_ID,
            label: PRIVATE_CONSULTATION_LABEL,
            amount: PRIVATE_CONSULTATION_PRICE,
            status: 'pending_followup',
          });
        }
      } else if (addon?.type === 'funnel_bump') {
        if (!addon.step_id) return { error: 'Penawaran tambahan tidak valid', status: 400 };
        const funnels = new FunnelsService(this.env);
        const bump = await funnels.validateBumpAddon(order_type, product_id, String(addon.step_id));
        if (!bump) return { error: 'Penawaran tambahan tidak valid', status: 400 };
        if (!selectedAddons.some((a) => a.type === 'funnel_bump')) {
          selectedAddons.push(bump);
        }
      }
    }
    const orderBumpAmount = selectedAddons.reduce((total, addon) => total + addon.amount, 0);
    const paymentAdminFee = randomPaymentAdminFee();
    const amount = subtotal + orderBumpAmount + paymentAdminFee;
    if (couponOpts) couponOpts.total_amount = amount;

    const orderMetadata = {
      addons: selectedAddons,
      pricing: {
        product_amount: productAmount,
        discount_amount: discountAmount,
        subtotal_amount: subtotal,
        order_bump_amount: orderBumpAmount,
        payment_admin_fee: paymentAdminFee,
        total_amount: amount,
      },
      ...(creatorMeta ? { creator: creatorMeta } : {}),
      ...(internalOpts?.metadataExtra || {}),
    };
    const metadataJson = JSON.stringify(orderMetadata);

    // ── Validate affiliate ───────────────────────────────────────────────────
    // tool_credits & creator_product: tanpa komisi affiliate platform
    // (komisi tidak boleh dibayar dari revenue milik creator)
    let validatedAffiliateCode: string | null = null;
    if (affiliateCode && order_type !== 'tool_credits' && order_type !== 'creator_product') {
      const affiliate = await this.repository.getActiveAffiliate(affiliateCode);
      if (affiliate && affiliate.user_id !== user.id) {
        validatedAffiliateCode = affiliateCode;
      }
    }

    // ── Create internal order ────────────────────────────────────────────────
    const now = new Date().toISOString();
    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000).toString(16).toUpperCase()}`;
    const orderNumber = `PY-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 9999).toString().padStart(4, '0')}`;

    await this.repository.createOrder(orderId, orderNumber, user.id, order_type, product_id, productName, amount, validatedAffiliateCode, metadataJson, now, couponOpts);

    if (couponOpts) {
      await this.env.DB.prepare(
        `INSERT INTO coupon_redemptions (id, coupon_id, coupon_code, user_id, order_id, membership_plan, subtotal_amount, discount_amount, total_amount, redeemed_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`
      ).bind(
        crypto.randomUUID(), couponOpts.id, couponOpts.code, user.id, orderId, product_id, couponOpts.subtotal_amount, couponOpts.discount_amount, amount, now
      ).run();
    }

    const order = await this.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
    if (!order) {
      return { error: 'Internal order gagal dibuat', status: 500 };
    }

    console.log('INTERNAL_ORDER_CREATED', JSON.stringify({ id: order.id, order_number: order.order_number, amount: order.amount, status: order.status }));

    // Event funnel: bump diterima saat order dibuat (converted dicatat di fulfillment)
    const bumpAddon = selectedAddons.find((a) => a.type === 'funnel_bump');
    if (bumpAddon?.funnel_id) {
      void new FunnelsRepository(this.env).recordEvent({
        funnelId: bumpAddon.funnel_id,
        stepType: 'order_bump',
        eventType: 'accepted',
        userId: user.id,
        triggerOrderId: orderId,
      });
    }

    return {
      ok: {
        order: order as Record<string, unknown>,
        orderId,
        orderNumber,
        orderType: order_type,
        productId: product_id,
        productName,
        description,
        productAmount,
        discountAmount,
        subtotal,
        orderBumpAmount,
        paymentAdminFee,
        amount,
        mobile,
        validatedAffiliateCode,
        selectedAddons,
        couponCode,
        creditPackage,
      },
    };
  }

  /**
   * Side effects setelah payment berhasil dibuat di gateway:
   * checkout_events + email invoice + tracking + notifikasi admin.
   * paymentUrl = halaman /checkout internal (Pakasir).
   */
  async recordPaymentCreatedSideEffects(user: any, prep: PreparedOrder, paymentUrl: string): Promise<void> {
    const now = new Date().toISOString();

    await this.env.DB.prepare(
      `INSERT INTO checkout_events (id, user_id, email, product_id, checkout_url, status, amount, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'started', ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      user.id,
      user.email,
      prep.productId,
      paymentUrl,
      prep.amount,
      now,
      now
    ).run().catch((err) => console.error('[orders:create] checkout event insert failed:', err));

    const firstName = ((user.name as string) || '').split(' ')[0] || 'Kamu';
    const invoiceEmail = prep.creditPackage
      ? {
          subject: `Pesanan Kredit Tools #${prep.orderNumber} - Selesaikan Pembayaran`,
          content: creditOrderCreatedEmailHtml({
            name: firstName,
            orderNumber: prep.orderNumber,
            packageName: prep.creditPackage.name,
            credits: prep.creditPackage.credits,
            productAmount: prep.productAmount,
            adminFee: prep.paymentAdminFee,
            totalAmount: prep.amount,
            paymentUrl,
          }),
        }
      : {
          subject: `Invoice pembayaran PejuangYen ${prep.orderNumber}`,
          content: paymentCreatedEmailHtml({
            name: firstName,
            orderNumber: prep.orderNumber,
            productName: prep.productName,
            productAmount: prep.productAmount,
            paymentAdminFee: prep.paymentAdminFee,
            totalAmount: prep.amount,
            paymentUrl,
            addons: prep.selectedAddons,
          }),
        };

    await enqueueEmail(this.env, {
      type: 'send_email',
      recipient: user.email,
      subject: invoiceEmail.subject,
      content: invoiceEmail.content,
      emailType: 'transactional',
    }).catch((err) => console.error('[orders:create] payment email queue failed:', err));

    void trackServerEvent(this.env, {
      event_name: 'checkout_started',
      event_category: 'commerce',
      user_id: user.id,
      order_id: prep.orderId,
      payment_amount: prep.amount,
      payment_status: 'pending',
      coupon_code: prep.couponCode || null,
      affiliate_code: prep.validatedAffiliateCode || null,
      metadata: { order_type: prep.orderType, product_id: prep.productId },
    }).catch((err) => console.error('[orders:create] tracking failed:', err));

    void notifyAdminNewOrder(this.env, {
      orderId: prep.orderId,
      orderNumber: prep.orderNumber,
      orderType: prep.orderType,
      productName: prep.productName,
      productAmount: prep.productAmount,
      paymentAdminFee: prep.paymentAdminFee,
      totalAmount: prep.amount,
      paymentUrl,
      addons: prep.selectedAddons,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: prep.mobile,
      },
      affiliateCode: prep.validatedAffiliateCode,
      createdAt: now,
    }).catch((err) => console.error('[orders:create] admin order notification failed:', err));
  }

  /** Catat error gateway ke error_logs + tandai order failed (alur pembayaran Pakasir). */
  async markOrderFailedAfterGatewayError(source: string, err: any, prep: { orderId: string; orderNumber: string; productId: string }, userId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.env.DB.prepare(
      `INSERT INTO error_logs (id, source, message, stack, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      source,
      err.message,
      err.stack || '',
      JSON.stringify({ orderId: prep.orderId, orderNumber: prep.orderNumber, userId, product_id: prep.productId }),
      now
    ).run().catch(() => {});

    await this.repository.updateOrderStatus(prep.orderId, 'failed', now);
  }

  async getOrdersByUser(userId: string, page = 1, limit = 50) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const [orders, total] = await Promise.all([
      this.repository.getOrdersByUser(userId, safeLimit, (safePage - 1) * safeLimit),
      this.repository.countOrdersByUser(userId),
    ]);
    return { success: true, data: orders, pagination: { page: safePage, limit: safeLimit, total } };
  }
}
