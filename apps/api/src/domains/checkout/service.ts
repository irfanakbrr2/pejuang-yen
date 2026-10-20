import type { Env } from '../../env';
import { OrdersService, type CreateOrderBody, type PrepareOrderInternalOpts } from '../orders/service';
import { fulfillPaidOrder, parseOrderMetadata } from '../orders/fulfillment';
import {
  createPakasirTransaction,
  getPakasirTransactionDetail,
  simulatePakasirPayment,
  isPakasirMethod,
  type PakasirMethod,
  type PakasirTransaction,
} from '../../services/pakasir';
import { notifyAdminsInApp } from '../../lib/admin-notifications';

type OrderRow = Record<string, unknown>;
type AttemptRow = Record<string, unknown>;

export type CheckoutPaymentStatus = 'pending' | 'paid' | 'expired' | 'failed';

export type CreatePaymentBody = CreateOrderBody & { payment_method: string };

/** Opsi internal createPayment — TIDAK pernah dari HTTP body (flow upsell funnel). */
export type CreatePaymentInternalOpts = PrepareOrderInternalOpts & {
  /** Lewati guard order-pending-duplikat 2 jam (order upsell harus selalu baru) */
  skipDuplicateGuard?: boolean;
};

type ServiceError = { error: string; status: number };
type ServiceOk<T> = { success: true; data: T };

export class CheckoutService {
  private orders: OrdersService;

  constructor(private env: Env) {
    this.orders = new OrdersService(env);
  }

  private async getOwnedOrder(userId: string, orderId: string): Promise<OrderRow | null> {
    return await this.env.DB.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
      .bind(orderId, userId).first() as OrderRow | null;
  }

  private async getLatestAttempt(orderId: string): Promise<AttemptRow | null> {
    return await this.env.DB.prepare(
      `SELECT * FROM payments WHERE order_id = ? AND provider IN ('pakasir','manual') ORDER BY created_at DESC LIMIT 1`
    ).bind(orderId).first() as AttemptRow | null;
  }

  private computePaymentStatus(order: OrderRow, attempt: AttemptRow | null): CheckoutPaymentStatus {
    const status = String(order.status || 'pending');
    if (status === 'paid') return 'paid';
    if (status === 'cancelled' || status === 'failed') return 'failed';
    if (status === 'expired') return 'expired';
    if (attempt?.expired_at && new Date(String(attempt.expired_at)).getTime() <= Date.now()) return 'expired';
    return 'pending';
  }

  private attemptDto(attempt: AttemptRow | null) {
    if (!attempt) return null;
    return {
      method: (attempt.payment_method as string) || '',
      payment_number: (attempt.payment_number as string | null) || null,
      fee: Number(attempt.fee || 0),
      total_payment: Number(attempt.total_payment || attempt.amount || 0),
      expired_at: (attempt.expired_at as string | null) || null,
      status: (attempt.status as string) || 'pending',
    };
  }

  private async insertAttempt(orderId: string, gatewayOrderId: string, method: PakasirMethod, tx: PakasirTransaction, now: string) {
    return this.env.DB.prepare(
      `INSERT INTO payments (id, order_id, provider, provider_transaction_id, amount, currency, status,
         raw_payload_json, created_at, updated_at, payment_method, fee, total_payment, payment_number, expired_at)
       VALUES (?, ?, 'pakasir', ?, ?, 'IDR', 'pending', ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(), orderId, gatewayOrderId, tx.amount, JSON.stringify(tx.raw), now, now,
      method, tx.fee, tx.total_payment, tx.payment_number, tx.expired_at
    );
  }

  private async orderPageUrl(order: OrderRow): Promise<string> {
    const type = String(order.order_type || '');
    const productId = String(order.product_id || '');
    try {
      if (type === 'course') {
        const row = await this.env.DB.prepare('SELECT slug FROM courses WHERE id = ?').bind(productId).first();
        return row?.slug ? `/order/${row.slug}` : '/dashboard';
      }
      if (type === 'membership') {
        const row = await this.env.DB.prepare('SELECT slug FROM membership_plans WHERE id = ?').bind(productId).first();
        return row?.slug ? `/order/membership-${row.slug}` : '/dashboard';
      }
      if (type === 'webinar_registration') {
        const row = await this.env.DB.prepare('SELECT slug FROM webinars WHERE id = ?').bind(productId).first();
        return row?.slug ? `/webinar/${row.slug}` : '/dashboard';
      }
      if (type === 'tool_credits') return '/tools/credits';
      if (type === 'digital_product') {
        const row = await this.env.DB.prepare('SELECT slug FROM digital_products WHERE id = ?').bind(productId).first();
        return row?.slug ? `/order/${row.slug}` : '/dashboard';
      }
      if (type === 'creator_product') {
        const row = await this.env.DB.prepare(
          `SELECT p.slug as product_slug, s.slug as store_slug
           FROM creator_products p JOIN creator_stores s ON s.id = p.store_id WHERE p.id = ?`
        ).bind(productId).first();
        return row?.store_slug ? `/toko/${row.store_slug}/${row.product_slug}` : '/dashboard';
      }
    } catch { /* ignore */ }
    return '/dashboard';
  }

  /** POST /api/checkout/create-payment */
  async createPayment(user: any, body: CreatePaymentBody, internalOpts?: CreatePaymentInternalOpts): Promise<ServiceError | ServiceOk<{ order_id: string; existing?: boolean }>> {
    // ── Transfer manual (tanpa Pakasir): buat order pending; admin konfirmasi LUNAS di /admin/orders ──
    if (body.payment_method === 'manual_transfer') {
      const prepared = await this.orders.prepareOrder(user, body, internalOpts);
      if ('error' in prepared) return prepared;
      const prep = prepared.ok;
      const now = new Date().toISOString();
      await this.env.DB.batch([
        this.env.DB.prepare(`UPDATE orders SET payment_provider = 'manual', payment_method = 'manual_transfer', updated_at = ? WHERE id = ?`)
          .bind(now, prep.orderId),
        this.env.DB.prepare(
          `INSERT INTO payments (id, order_id, provider, provider_transaction_id, amount, currency, status, created_at, updated_at, payment_method, total_payment)
           VALUES (?, ?, 'manual', ?, ?, 'IDR', 'pending', ?, ?, 'manual_transfer', ?)`
        ).bind(crypto.randomUUID(), prep.orderId, prep.orderNumber, prep.amount, now, now, prep.amount),
      ]);
      await notifyAdminsInApp(this.env, {
        type: 'admin_order_manual',
        title: 'Order transfer manual baru',
        body: `${user?.name || user?.email || 'User'} • ${prep.orderNumber} • Rp${Number(prep.amount).toLocaleString('id-ID')} — menunggu konfirmasi`,
        data: { orderId: prep.orderId, orderNumber: prep.orderNumber },
      });
      return { success: true, data: { order_id: prep.orderId } };
    }

    if (!isPakasirMethod(body.payment_method)) {
      return { error: 'Metode pembayaran tidak valid', status: 400 };
    }

    // Guard duplikat: order pending untuk produk sama < 2 jam dengan attempt
    // pakasir yang masih hidup → arahkan ke halaman checkout existing.
    // Di-skip untuk order upsell funnel (harus selalu order baru).
    if (!internalOpts?.skipDuplicateGuard) {
      const nowIso = new Date().toISOString();
      const existing = await this.env.DB.prepare(
        `SELECT o.id FROM orders o
         JOIN payments p ON p.order_id = o.id AND p.provider = 'pakasir' AND p.status = 'pending'
         WHERE o.user_id = ? AND o.product_id = ? AND o.order_type = ? AND o.status = 'pending'
           AND o.created_at > datetime('now', '-2 hours') AND (p.expired_at IS NULL OR p.expired_at > ?)
         ORDER BY o.created_at DESC LIMIT 1`
      ).bind(user.id, body.product_id, body.order_type, nowIso).first();
      if (existing?.id) {
        return { success: true, data: { order_id: existing.id as string, existing: true } };
      }
    }

    const prepared = await this.orders.prepareOrder(user, body, internalOpts);
    if ('error' in prepared) return prepared;
    const prep = prepared.ok;
    const now = new Date().toISOString();

    try {
      const tx = await createPakasirTransaction(this.env, {
        method: body.payment_method,
        orderId: prep.orderNumber,
        amount: prep.amount,
      });

      await this.env.DB.batch([
        this.env.DB.prepare(`UPDATE orders SET payment_provider = 'pakasir', payment_method = ?, updated_at = ? WHERE id = ?`)
          .bind(body.payment_method, now, prep.orderId),
        await this.insertAttempt(prep.orderId, prep.orderNumber, body.payment_method, tx, now),
      ]);

      await this.orders.recordPaymentCreatedSideEffects(user, prep, `${this.env.APP_URL}/checkout/${prep.orderId}`);

      return { success: true, data: { order_id: prep.orderId } };
    } catch (err: any) {
      await this.orders.markOrderFailedAfterGatewayError('pakasir_create_transaction', err, prep, user.id);
      return { error: `Payment gateway error: ${err.message}`, status: 502 };
    }
  }

  /** GET /api/checkout/:orderId */
  async getCheckout(user: any, orderId: string): Promise<ServiceError | ServiceOk<Record<string, unknown>>> {
    const order = await this.getOwnedOrder(user.id, orderId);
    if (!order) return { error: 'Order tidak ditemukan', status: 404 };
    const attempt = await this.getLatestAttempt(orderId);
    const metadata = parseOrderMetadata(order.metadata_json);

    return {
      success: true,
      data: {
        order_id: order.id,
        order_number: order.order_number,
        order_type: order.order_type,
        product_name: order.product_name,
        amount: Number(order.amount || 0),
        status: order.status,
        payment_status: this.computePaymentStatus(order, attempt),
        paid_at: order.paid_at || null,
        created_at: order.created_at,
        pricing: metadata.pricing || null,
        order_page_url: await this.orderPageUrl(order),
        payment: this.attemptDto(attempt),
      },
    };
  }

  /** GET /api/checkout/:orderId/status — polling ringan */
  async getStatus(user: any, orderId: string): Promise<ServiceError | ServiceOk<{ status: CheckoutPaymentStatus; paid_at: string | null }>> {
    const order = await this.getOwnedOrder(user.id, orderId);
    if (!order) return { error: 'Order tidak ditemukan', status: 404 };
    const attempt = await this.getLatestAttempt(orderId);
    return {
      success: true,
      data: {
        status: this.computePaymentStatus(order, attempt),
        paid_at: (order.paid_at as string | null) || null,
      },
    };
  }

  /** POST /api/checkout/:orderId/check — tombol "Saya sudah bayar" */
  async check(user: any, orderId: string, ctx: ExecutionContext): Promise<ServiceError | ServiceOk<{ status: CheckoutPaymentStatus; paid_at: string | null }>> {
    const order = await this.getOwnedOrder(user.id, orderId);
    if (!order) return { error: 'Order tidak ditemukan', status: 404 };
    if (order.status === 'paid') {
      return { success: true, data: { status: 'paid', paid_at: (order.paid_at as string | null) || null } };
    }

    const attempt = await this.getLatestAttempt(orderId);
    if (!attempt) {
      return { success: true, data: { status: this.computePaymentStatus(order, attempt), paid_at: null } };
    }

    const gatewayOrderId = String(attempt.provider_transaction_id || '');
    let detail: PakasirTransaction | null = null;
    try {
      detail = await getPakasirTransactionDetail(this.env, {
        orderId: gatewayOrderId,
        amount: Number(attempt.amount || 0),
      });
    } catch (err) {
      console.error('[checkout:check] pakasir detail error:', err);
    }

    if (detail && detail.status === 'completed' && detail.amount === Number(attempt.amount)) {
      const now = new Date().toISOString();
      const eventId = `pakasir:${gatewayOrderId}:${detail.amount}:completed:${detail.completed_at || 'manual'}`;
      const webhookEventId = crypto.randomUUID();
      const inserted = await this.env.DB.prepare(
        `INSERT OR IGNORE INTO webhook_events (id, provider, event_type, provider_event_id, provider_transaction_id, order_id, raw_payload_json, processing_status, received_at)
         VALUES (?, 'pakasir', 'pakasir.manual_check', ?, ?, ?, ?, 'pending', ?)`
      ).bind(webhookEventId, eventId, gatewayOrderId, order.id, JSON.stringify(detail.raw), now).run();

      if ((inserted.meta?.changes || 0) > 0) {
        await fulfillPaidOrder(this.env, ctx, {
          order,
          provider: 'pakasir',
          providerTransactionId: gatewayOrderId,
          paymentMethod: (attempt.payment_method as string) || detail.payment_method || null,
          eventType: 'pakasir.manual_check',
          rawPayload: JSON.stringify(detail.raw),
          existingPaymentId: attempt.id as string,
          webhookEventId,
        });
      }
      return { success: true, data: { status: 'paid', paid_at: detail.completed_at || now } };
    }

    return { success: true, data: { status: this.computePaymentStatus(order, attempt), paid_at: null } };
  }

  /** POST /api/checkout/:orderId/repay — buat ulang pembayaran / ganti metode */
  async repay(user: any, orderId: string, paymentMethod: string): Promise<ServiceError | ServiceOk<{ order_id: string }>> {
    if (!isPakasirMethod(paymentMethod)) {
      return { error: 'Metode pembayaran tidak valid', status: 400 };
    }
    const order = await this.getOwnedOrder(user.id, orderId);
    if (!order) return { error: 'Order tidak ditemukan', status: 404 };
    if (order.status === 'paid') return { error: 'Order sudah dibayar', status: 409 };
    if (order.status !== 'pending') {
      return { error: 'Order sudah kadaluarsa, silakan buat order baru', status: 410 };
    }

    const countRow = await this.env.DB.prepare(
      `SELECT COUNT(*) as total FROM payments WHERE order_id = ? AND provider = 'pakasir'`
    ).bind(orderId).first();
    const attemptNo = Number(countRow?.total || 0) + 1;
    const gatewayOrderId = attemptNo === 1
      ? (order.order_number as string)
      : `${order.order_number}-R${attemptNo}`;
    const now = new Date().toISOString();

    try {
      const tx = await createPakasirTransaction(this.env, {
        method: paymentMethod,
        orderId: gatewayOrderId,
        amount: Number(order.amount || 0),
      });

      await this.env.DB.batch([
        this.env.DB.prepare(`UPDATE payments SET status = 'expired', updated_at = ? WHERE order_id = ? AND provider = 'pakasir' AND status = 'pending'`)
          .bind(now, orderId),
        this.env.DB.prepare(`UPDATE orders SET payment_provider = 'pakasir', payment_method = ?, updated_at = ? WHERE id = ?`)
          .bind(paymentMethod, now, orderId),
        await this.insertAttempt(orderId, gatewayOrderId, paymentMethod, tx, now),
      ]);

      return { success: true, data: { order_id: orderId } };
    } catch (err: any) {
      await this.env.DB.prepare(
        `INSERT INTO error_logs (id, source, message, stack, metadata_json, created_at)
         VALUES (?, 'pakasir_repay_transaction', ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(), err.message, err.stack || '',
        JSON.stringify({ orderId, gatewayOrderId, userId: user.id }), now
      ).run().catch(() => {});
      return { error: `Payment gateway error: ${err.message}`, status: 502 };
    }
  }

  /** POST /api/checkout/:orderId/simulate — sandbox only */
  async simulate(user: any, orderId: string): Promise<ServiceError | ServiceOk<Record<string, unknown>>> {
    if ((this.env.PAKASIR_MODE || '').toLowerCase() === 'production') {
      return { error: 'Not Found', status: 404 };
    }
    const order = await this.getOwnedOrder(user.id, orderId);
    if (!order) return { error: 'Order tidak ditemukan', status: 404 };
    const attempt = await this.getLatestAttempt(orderId);
    if (!attempt) return { error: 'Belum ada attempt pembayaran', status: 404 };

    try {
      const result = await simulatePakasirPayment(this.env, {
        orderId: String(attempt.provider_transaction_id || ''),
        amount: Number(attempt.amount || 0),
      });
      return { success: true, data: result };
    } catch (err: any) {
      return { error: `Pakasir simulate error: ${err.message}`, status: 502 };
    }
  }
}
