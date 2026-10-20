import type { Env } from '../../env';
import { FunnelsRepository, type FunnelStepRow, type FunnelWithSteps } from './repository';

export const FUNNEL_TRIGGER_TYPES = ['course', 'membership', 'webinar_registration', 'tool_credits', 'digital_product'] as const;
export const FUNNEL_STEP_TYPES = ['order_bump', 'upsell', 'downsell'] as const;

// Tipe produk yang boleh jadi item step. webinar_registration tidak boleh
// (butuh row registrasi existing). membership tidak boleh jadi BUMP
// (memberships.source_order_id unik per order) tapi boleh jadi upsell/downsell.
export const STEP_PRODUCT_TYPES = ['course', 'membership', 'digital_product', 'tool_credits'] as const;
export const BUMP_PRODUCT_TYPES = ['course', 'digital_product', 'tool_credits'] as const;

export interface ResolvedProduct {
  id: string;
  name: string;
  price: number;
  slug?: string | null;
}

export interface BumpDto {
  step_id: string;
  headline: string | null;
  description: string | null;
  badge_text: string | null;
  image_url: string | null;
  label: string;
  amount: number;
  compare_at_price: number | null;
}

export interface FunnelBumpAddon {
  type: 'funnel_bump';
  step_id: string;
  funnel_id: string;
  product_type: string;
  product_id: string;
  label: string;
  amount: number;
  status: string;
}

/** Resolve nama+harga produk per tipe — hanya produk aktif/published. */
export async function resolveStepProduct(env: Env, productType: string, productId: string): Promise<ResolvedProduct | null> {
  if (productType === 'course') {
    const row = await env.DB.prepare("SELECT id, title as name, price, slug FROM courses WHERE id = ? AND status = 'published'").bind(productId).first();
    return row ? { id: row.id as string, name: row.name as string, price: Number(row.price), slug: row.slug as string } : null;
  }
  if (productType === 'membership') {
    const row = await env.DB.prepare("SELECT id, name, price, slug FROM membership_plans WHERE id = ? AND status = 'active'").bind(productId).first();
    return row ? { id: row.id as string, name: row.name as string, price: Number(row.price), slug: row.slug as string } : null;
  }
  if (productType === 'digital_product') {
    const row = await env.DB.prepare("SELECT id, name, price, slug FROM digital_products WHERE id = ? AND status = 'active'").bind(productId).first();
    return row ? { id: row.id as string, name: row.name as string, price: Number(row.price), slug: row.slug as string } : null;
  }
  if (productType === 'tool_credits') {
    const row = await env.DB.prepare('SELECT id, name, price FROM tool_credit_packages WHERE id = ? AND is_active = 1').bind(productId).first();
    return row ? { id: row.id as string, name: `Tool Credits - ${row.name}`, price: Number(row.price) } : null;
  }
  return null;
}

export class FunnelsService {
  private repo: FunnelsRepository;

  constructor(private env: Env) {
    this.repo = new FunnelsRepository(env);
  }

  get repository(): FunnelsRepository {
    return this.repo;
  }

  /** Bump DTO untuk halaman order/webinar (public). Null bila tidak ada bump aktif. */
  async resolveBump(productType: string, productId: string): Promise<{ funnelId: string; dto: BumpDto } | null> {
    const resolved = await this.repo.getActiveFunnelForProduct(productType, productId);
    if (!resolved) return null;
    const step = resolved.steps.find((s) => s.step_type === 'order_bump' && Number(s.enabled) === 1);
    if (!step) return null;

    const product = await resolveStepProduct(this.env, step.product_type as string, step.product_id as string);
    if (!product) return null;

    const amount = step.price_override != null ? Number(step.price_override) : product.price;
    return {
      funnelId: resolved.funnel.id as string,
      dto: {
        step_id: step.id as string,
        headline: (step.headline as string | null) || null,
        description: (step.description as string | null) || null,
        badge_text: (step.badge_text as string | null) || null,
        image_url: (step.image_url as string | null) || null,
        label: product.name,
        amount,
        compare_at_price: amount < product.price ? product.price : null,
      },
    };
  }

  /**
   * Validasi addon funnel_bump saat create order. step_id dari client hanyalah
   * selector — funnel, enabled flag, dan HARGA selalu dibaca dari DB.
   */
  async validateBumpAddon(orderType: string, productId: string, stepId: string): Promise<FunnelBumpAddon | null> {
    const resolved = await this.repo.getActiveFunnelForProduct(orderType, productId);
    if (!resolved) return null;
    const step = resolved.steps.find(
      (s) => s.id === stepId && s.step_type === 'order_bump' && Number(s.enabled) === 1
    );
    if (!step) return null;
    if (!(BUMP_PRODUCT_TYPES as readonly string[]).includes(step.product_type as string)) return null;

    const product = await resolveStepProduct(this.env, step.product_type as string, step.product_id as string);
    if (!product) return null;

    const amount = step.price_override != null ? Number(step.price_override) : product.price;
    if (!Number.isFinite(amount) || amount <= 0) return null;

    return {
      type: 'funnel_bump',
      step_id: step.id as string,
      funnel_id: resolved.funnel.id as string,
      product_type: step.product_type as string,
      product_id: step.product_id as string,
      label: product.name,
      amount,
      status: 'pending_fulfillment',
    };
  }

  /** Cek kepemilikan produk step oleh user (skip offer bila sudah punya). */
  async userOwnsProduct(userId: string, productType: string, productId: string): Promise<boolean> {
    const now = new Date().toISOString();
    if (productType === 'course') {
      const row = await this.env.DB.prepare(
        `SELECT id FROM enrollments WHERE user_id = ? AND course_id = ? AND status = 'active'`
      ).bind(userId, productId).first();
      return !!row;
    }
    if (productType === 'membership') {
      // Sudah punya membership lifetime → tawaran plan apa pun di-skip;
      // selain itu hanya skip bila plan yang sama masih aktif.
      const lifetime = await this.env.DB.prepare(
        `SELECT m.id FROM memberships m JOIN membership_plans p ON p.id = m.plan_id
         WHERE m.user_id = ? AND m.status = 'active' AND p.duration_type = 'lifetime'
           AND (m.expires_at IS NULL OR m.expires_at > ?) LIMIT 1`
      ).bind(userId, now).first();
      if (lifetime) return true;
      const samePlan = await this.env.DB.prepare(
        `SELECT id FROM memberships WHERE user_id = ? AND plan_id = ? AND status = 'active'
           AND (expires_at IS NULL OR expires_at > ?) LIMIT 1`
      ).bind(userId, productId, now).first();
      return !!samePlan;
    }
    if (productType === 'digital_product') {
      const row = await this.env.DB.prepare(
        `SELECT id FROM user_access WHERE user_id = ? AND resource_type = 'digital_product' AND resource_id = ?
           AND status = 'active' AND (expires_at IS NULL OR expires_at > ?) LIMIT 1`
      ).bind(userId, productId, now).first();
      return !!row;
    }
    return false; // tool_credits selalu bisa dibeli ulang
  }

  /** Konten step untuk halaman offer. */
  async buildStepContent(step: FunnelStepRow): Promise<Record<string, unknown> | null> {
    const product = await resolveStepProduct(this.env, step.product_type as string, step.product_id as string);
    if (!product) return null;
    const amount = step.price_override != null ? Number(step.price_override) : product.price;
    return {
      step_id: step.id,
      step_type: step.step_type,
      headline: step.headline || null,
      description: step.description || null,
      badge_text: step.badge_text || null,
      image_url: step.image_url || null,
      product_name: product.name,
      product_type: step.product_type,
      amount,
      compare_at_price: amount < product.price ? product.price : null,
      countdown_seconds: step.countdown_seconds != null ? Number(step.countdown_seconds) : null,
    };
  }

  /** Exit URL default per tipe order trigger (dipakai bila funnel.exit_url kosong). */
  async defaultExitUrl(orderType: string, productId: string): Promise<string | null> {
    if (orderType === 'webinar_registration') {
      const row = await this.env.DB.prepare('SELECT slug FROM webinars WHERE id = ?').bind(productId).first();
      return row?.slug ? `/webinar/${row.slug}` : null;
    }
    return null; // FE pakai CTA default per tipe (dashboard/my-classes/dll)
  }

  private async getOwnedPaidOrder(userId: string, orderId: string): Promise<Record<string, unknown> | null> {
    return await this.env.DB.prepare(
      `SELECT * FROM orders WHERE id = ? AND user_id = ?`
    ).bind(orderId, userId).first() as Record<string, unknown> | null;
  }

  /**
   * GET offer untuk order yang sudah paid. Refresh-safe: state tersimpan di
   * funnel_offers (1 row per order, INSERT OR IGNORE).
   */
  async getOffer(user: any, orderId: string): Promise<{ error: string; status: number } | { success: true; data: Record<string, unknown> }> {
    const order = await this.getOwnedPaidOrder(user.id, orderId);
    if (!order) return { error: 'Order tidak ditemukan', status: 404 };

    const none = (exitUrl: string | null = null) => ({ success: true as const, data: { step: null, exit_url: exitUrl } });
    if (order.status !== 'paid') return none();
    // Order hasil upsell tidak memicu funnel lagi (anti-chain tak berujung)
    const metadata = (() => { try { return JSON.parse(String(order.metadata_json || '{}')); } catch { return {}; } })();
    if (metadata?.funnel?.offer_id) return none();

    const resolved = await this.repo.getActiveFunnelForProduct(order.order_type as string, order.product_id as string);
    if (!resolved) return none();
    const funnel = resolved.funnel;
    const exitUrl = (funnel.exit_url as string | null)
      || await this.defaultExitUrl(order.order_type as string, order.product_id as string);

    const upsellStep = resolved.steps.find((s) => s.step_type === 'upsell' && Number(s.enabled) === 1) || null;
    const downsellStep = resolved.steps.find((s) => s.step_type === 'downsell' && Number(s.enabled) === 1) || null;
    if (!upsellStep && !downsellStep) return none(exitUrl);

    // Tentukan status awal (skip step yang produknya sudah dimiliki)
    let initialUpsell: string | null = 'skipped';
    if (upsellStep) {
      const owns = await this.userOwnsProduct(user.id, upsellStep.product_type as string, upsellStep.product_id as string);
      initialUpsell = owns ? 'skipped' : 'offered';
    }
    let initialDownsell: string | null = null;
    if (initialUpsell !== 'offered') {
      if (downsellStep) {
        const owns = await this.userOwnsProduct(user.id, downsellStep.product_type as string, downsellStep.product_id as string);
        initialDownsell = owns ? 'skipped' : 'offered';
      } else {
        initialDownsell = 'skipped';
      }
      if (initialDownsell !== 'offered') return none(exitUrl);
    }

    const windowMinutes = Math.max(1, Number(funnel.offer_window_minutes) || 15);
    const baseTime = order.paid_at ? new Date(String(order.paid_at)).getTime() : Date.now();
    const expiresAt = new Date(baseTime + windowMinutes * 60_000).toISOString();

    const offer = await this.repo.getOrCreateOffer({
      funnelId: funnel.id as string,
      triggerOrderId: orderId,
      userId: user.id,
      expiresAt,
      initialUpsellStatus: initialUpsell,
      initialDownsellStatus: initialDownsell,
    });
    if (!offer) return none(exitUrl);

    // Expiry check
    if (offer.status === 'open' && new Date(String(offer.expires_at)).getTime() <= Date.now()) {
      await this.repo.markOfferExpired(offer.id as string);
      return none(exitUrl);
    }
    if (offer.status !== 'open') return none(exitUrl);

    const activeStepType = offer.upsell_status === 'offered' ? 'upsell'
      : offer.downsell_status === 'offered' ? 'downsell' : null;
    if (!activeStepType) return none(exitUrl);

    const stepRow = activeStepType === 'upsell' ? upsellStep : downsellStep;
    if (!stepRow) return none(exitUrl);
    const content = await this.buildStepContent(stepRow);
    if (!content) return none(exitUrl);

    await this.repo.recordEvent({
      funnelId: funnel.id as string,
      stepType: activeStepType,
      eventType: 'viewed',
      userId: user.id,
      offerId: offer.id as string,
    });

    return {
      success: true,
      data: {
        step: activeStepType,
        offer_id: offer.id,
        expires_at: offer.expires_at,
        exit_url: exitUrl,
        content,
      },
    };
  }

  /** Accept offer → buat order baru (idempoten: double-tap return order yang sama). */
  async acceptOffer(user: any, orderId: string, stepType: string, paymentMethod: string, _ctx: ExecutionContext): Promise<{ error: string; status: number } | { success: true; data: { order_id: string } }> {
    if (stepType !== 'upsell' && stepType !== 'downsell') return { error: 'step_type tidak valid', status: 400 };

    const order = await this.getOwnedPaidOrder(user.id, orderId);
    if (!order) return { error: 'Order tidak ditemukan', status: 404 };

    const offer = await this.env.DB.prepare(
      `SELECT * FROM funnel_offers WHERE trigger_order_id = ? AND user_id = ?`
    ).bind(orderId, user.id).first() as Record<string, unknown> | null;
    if (!offer) return { error: 'Penawaran tidak ditemukan', status: 404 };
    if (new Date(String(offer.expires_at)).getTime() <= Date.now()) {
      await this.repo.markOfferExpired(offer.id as string);
      return { error: 'Penawaran sudah kadaluarsa', status: 410 };
    }

    const resolved = await this.repo.getFunnelById(offer.funnel_id as string);
    const stepRow = resolved?.steps.find((s) => s.step_type === stepType && Number(s.enabled) === 1);
    if (!stepRow) return { error: 'Penawaran sudah tidak tersedia', status: 410 };

    // Mutex anti double-tap: offered → accepted
    const transitioned = await this.repo.transitionOfferStep(offer.id as string, stepType, 'offered', 'accepted');
    if (!transitioned) {
      // Sudah accepted sebelumnya → return order yang sama (idempoten)
      const current = await this.env.DB.prepare('SELECT * FROM funnel_offers WHERE id = ?').bind(offer.id).first() as Record<string, unknown> | null;
      const existingOrderId = stepType === 'upsell' ? current?.upsell_order_id : current?.downsell_order_id;
      if (existingOrderId) return { success: true, data: { order_id: existingOrderId as string } };
      return { error: 'Penawaran sudah direspons', status: 409 };
    }

    await this.repo.recordEvent({
      funnelId: offer.funnel_id as string,
      stepType,
      eventType: 'accepted',
      userId: user.id,
      offerId: offer.id as string,
    });

    // Buat order baru via pipeline checkout (dynamic import: hindari circular)
    const { CheckoutService } = await import('../checkout/service');
    const checkout = new CheckoutService(this.env);
    const result = await checkout.createPayment(user, {
      order_type: stepRow.product_type as string,
      product_id: stepRow.product_id as string,
      payment_method: paymentMethod || 'qris',
      affiliate_code: (order.affiliate_code as string | null) || undefined,
    }, {
      priceOverride: stepRow.price_override != null ? Number(stepRow.price_override) : undefined,
      metadataExtra: {
        funnel: {
          funnel_id: offer.funnel_id,
          offer_id: offer.id,
          step_type: stepType,
          trigger_order_id: orderId,
        },
      },
      skipDuplicateGuard: true,
    });

    if ('error' in result) {
      // Gagal bikin order → kembalikan ke offered supaya bisa dicoba lagi
      await this.repo.transitionOfferStep(offer.id as string, stepType, 'accepted', 'offered');
      return result;
    }

    const newOrderId = result.data.order_id;
    const orderCol = stepType === 'upsell' ? 'upsell_order_id' : 'downsell_order_id';
    await this.env.DB.prepare(
      `UPDATE funnel_offers SET ${orderCol} = ?, updated_at = ? WHERE id = ?`
    ).bind(newOrderId, new Date().toISOString(), offer.id).run().catch(() => {});

    return { success: true, data: { order_id: newOrderId } };
  }

  /** Decline offer → downsell (sekali) atau selesai + exit_url. */
  async declineOffer(user: any, orderId: string, stepType: string): Promise<{ error: string; status: number } | { success: true; data: Record<string, unknown> }> {
    if (stepType !== 'upsell' && stepType !== 'downsell') return { error: 'step_type tidak valid', status: 400 };

    const order = await this.getOwnedPaidOrder(user.id, orderId);
    if (!order) return { error: 'Order tidak ditemukan', status: 404 };

    const offer = await this.env.DB.prepare(
      `SELECT * FROM funnel_offers WHERE trigger_order_id = ? AND user_id = ?`
    ).bind(orderId, user.id).first() as Record<string, unknown> | null;
    if (!offer) return { error: 'Penawaran tidak ditemukan', status: 404 };

    const resolved = await this.repo.getFunnelById(offer.funnel_id as string);
    const funnel = resolved?.funnel;
    const exitUrl = (funnel?.exit_url as string | null)
      || await this.defaultExitUrl(order.order_type as string, order.product_id as string);

    const transitioned = await this.repo.transitionOfferStep(offer.id as string, stepType, 'offered', 'declined');
    if (transitioned) {
      await this.repo.recordEvent({
        funnelId: offer.funnel_id as string,
        stepType,
        eventType: 'declined',
        userId: user.id,
        offerId: offer.id as string,
      });
    }

    // Upsell ditolak → tawarkan downsell sekali (bila ada, belum dimiliki, belum pernah ditawarkan)
    if (stepType === 'upsell') {
      const downsellStep = resolved?.steps.find((s) => s.step_type === 'downsell' && Number(s.enabled) === 1);
      if (downsellStep && offer.downsell_status == null) {
        const owns = await this.userOwnsProduct(user.id, downsellStep.product_type as string, downsellStep.product_id as string);
        if (!owns) {
          const res = await this.env.DB.prepare(
            `UPDATE funnel_offers SET downsell_status = 'offered', updated_at = ? WHERE id = ? AND downsell_status IS NULL`
          ).bind(new Date().toISOString(), offer.id).run();
          if ((res.meta?.changes || 0) > 0) {
            const content = await this.buildStepContent(downsellStep);
            if (content) {
              await this.repo.recordEvent({
                funnelId: offer.funnel_id as string,
                stepType: 'downsell',
                eventType: 'viewed',
                userId: user.id,
                offerId: offer.id as string,
              });
              return { success: true, data: { step: 'downsell', offer_id: offer.id, expires_at: offer.expires_at, exit_url: exitUrl, content } };
            }
          }
        }
      }
    }

    // Tidak ada step lagi → offer selesai
    await this.env.DB.prepare(
      `UPDATE funnel_offers SET status = 'completed', updated_at = ? WHERE id = ? AND status = 'open'`
    ).bind(new Date().toISOString(), offer.id).run().catch(() => {});

    return { success: true, data: { step: null, exit_url: exitUrl } };
  }

  /** Dipanggil fulfillment saat order hasil upsell/downsell terbayar. */
  async recordConversionIfFunnelOrder(orderMetadataFunnel: {
    funnel_id?: string; offer_id?: string; step_type?: string; trigger_order_id?: string;
  } | null | undefined, order: Record<string, unknown>): Promise<void> {
    if (!orderMetadataFunnel?.funnel_id || !orderMetadataFunnel.offer_id || !orderMetadataFunnel.step_type) return;
    const stepType = orderMetadataFunnel.step_type as 'upsell' | 'downsell';
    if (stepType !== 'upsell' && stepType !== 'downsell') return;

    await this.repo.transitionOfferStep(orderMetadataFunnel.offer_id, stepType, 'accepted', 'converted', {
      offerStatus: 'completed',
    });
    await this.repo.recordEvent({
      funnelId: orderMetadataFunnel.funnel_id,
      stepType,
      eventType: 'converted',
      userId: (order.user_id as string) || null,
      offerId: orderMetadataFunnel.offer_id,
      resultOrderId: order.id as string,
      amount: Number(order.amount || 0),
    });
  }
}

/** Step DTO yang valid utk funnel (admin guard) — return pesan error atau null. */
export async function validateStepConfig(env: Env, funnel: FunnelWithSteps['funnel'], stepType: string, body: {
  product_type?: string; product_id?: string; price_override?: number | null;
}): Promise<string | null> {
  if (!(FUNNEL_STEP_TYPES as readonly string[]).includes(stepType)) return 'step_type tidak valid';
  const productType = String(body.product_type || '');
  const productId = String(body.product_id || '');

  if (!(STEP_PRODUCT_TYPES as readonly string[]).includes(productType)) return 'Tipe produk step tidak valid';
  if (stepType === 'order_bump' && !(BUMP_PRODUCT_TYPES as readonly string[]).includes(productType)) {
    return 'Membership tidak bisa jadi order bump (gunakan upsell)';
  }
  if (stepType === 'order_bump' && productType === 'tool_credits' && funnel.trigger_product_type === 'tool_credits') {
    return 'Bump kredit tidak bisa dipasang pada trigger kredit (grant akan tertelan)';
  }
  if (productType === funnel.trigger_product_type && productId === funnel.trigger_product_id) {
    return 'Produk step tidak boleh sama dengan produk trigger';
  }

  const product = await resolveStepProduct(env, productType, productId);
  if (!product) return 'Produk step tidak ditemukan / tidak aktif';

  if (body.price_override != null) {
    const po = Number(body.price_override);
    if (!Number.isFinite(po) || po <= 0) return 'price_override harus > 0';
  }
  return null;
}
