import type { Env } from '../../env';

export type FunnelRow = Record<string, unknown>;
export type FunnelStepRow = Record<string, unknown>;
export type FunnelOfferRow = Record<string, unknown>;

export type FunnelWithSteps = { funnel: FunnelRow; steps: FunnelStepRow[] };

export class FunnelsRepository {
  constructor(private env: Env) {}

  /** Resolve funnel aktif: exact product id menang atas wildcard '*'. */
  async getActiveFunnelForProduct(productType: string, productId: string): Promise<FunnelWithSteps | null> {
    const funnel = await this.env.DB.prepare(
      `SELECT * FROM funnels
       WHERE status = 'active' AND trigger_product_type = ? AND trigger_product_id IN (?, '*')
       ORDER BY CASE WHEN trigger_product_id = ? THEN 0 ELSE 1 END
       LIMIT 1`
    ).bind(productType, productId, productId).first() as FunnelRow | null;
    if (!funnel) return null;

    const steps = await this.env.DB.prepare(
      `SELECT * FROM funnel_steps WHERE funnel_id = ? ORDER BY step_type ASC`
    ).bind(funnel.id).all();

    return { funnel, steps: steps.results as FunnelStepRow[] };
  }

  async getFunnelById(funnelId: string): Promise<FunnelWithSteps | null> {
    const funnel = await this.env.DB.prepare('SELECT * FROM funnels WHERE id = ?').bind(funnelId).first() as FunnelRow | null;
    if (!funnel) return null;
    const steps = await this.env.DB.prepare(
      `SELECT * FROM funnel_steps WHERE funnel_id = ? ORDER BY step_type ASC`
    ).bind(funnelId).all();
    return { funnel, steps: steps.results as FunnelStepRow[] };
  }

  async getStepById(stepId: string): Promise<FunnelStepRow | null> {
    return await this.env.DB.prepare('SELECT * FROM funnel_steps WHERE id = ?').bind(stepId).first() as FunnelStepRow | null;
  }

  /** INSERT OR IGNORE offer per trigger order; return row terkini (existing bila duplikat). */
  async getOrCreateOffer(params: {
    funnelId: string;
    triggerOrderId: string;
    userId: string;
    expiresAt: string;
    initialUpsellStatus: string | null;
    initialDownsellStatus: string | null;
  }): Promise<FunnelOfferRow | null> {
    const now = new Date().toISOString();
    await this.env.DB.prepare(
      `INSERT OR IGNORE INTO funnel_offers (id, funnel_id, trigger_order_id, user_id, status, upsell_status, downsell_status, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(), params.funnelId, params.triggerOrderId, params.userId,
      params.initialUpsellStatus, params.initialDownsellStatus,
      params.expiresAt, now, now
    ).run();

    return await this.env.DB.prepare('SELECT * FROM funnel_offers WHERE trigger_order_id = ?')
      .bind(params.triggerOrderId).first() as FunnelOfferRow | null;
  }

  /**
   * Transisi status step yang di-guard (mutex anti double-tap).
   * Return true bila transisi terjadi (meta.changes > 0).
   */
  async transitionOfferStep(
    offerId: string,
    stepType: 'upsell' | 'downsell',
    fromStatus: string,
    toStatus: string,
    extra?: { orderId?: string; offerStatus?: string }
  ): Promise<boolean> {
    const now = new Date().toISOString();
    const col = stepType === 'upsell' ? 'upsell_status' : 'downsell_status';
    const orderCol = stepType === 'upsell' ? 'upsell_order_id' : 'downsell_order_id';

    const sets = [`${col} = ?`, `updated_at = ?`];
    const binds: unknown[] = [toStatus, now];
    if (extra?.orderId) { sets.push(`${orderCol} = ?`); binds.push(extra.orderId); }
    if (extra?.offerStatus) { sets.push(`status = ?`); binds.push(extra.offerStatus); }
    binds.push(offerId, fromStatus);

    const res = await this.env.DB.prepare(
      `UPDATE funnel_offers SET ${sets.join(', ')} WHERE id = ? AND ${col} = ?`
    ).bind(...binds).run();
    return (res.meta?.changes || 0) > 0;
  }

  async markOfferExpired(offerId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.env.DB.prepare(
      `UPDATE funnel_offers SET status = 'expired', updated_at = ? WHERE id = ? AND status = 'open'`
    ).bind(now, offerId).run().catch(() => {});
  }

  /** Event analytics — INSERT OR IGNORE pada unique index dedupe. */
  async recordEvent(params: {
    funnelId: string;
    stepType: string;
    eventType: string;
    userId?: string | null;
    offerId?: string | null;
    triggerOrderId?: string | null;
    resultOrderId?: string | null;
    amount?: number | null;
  }): Promise<void> {
    await this.env.DB.prepare(
      `INSERT OR IGNORE INTO funnel_events (id, funnel_id, step_type, event_type, user_id, offer_id, trigger_order_id, result_order_id, amount, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(), params.funnelId, params.stepType, params.eventType,
      params.userId || null, params.offerId || null, params.triggerOrderId || null,
      params.resultOrderId || null, params.amount ?? null, new Date().toISOString()
    ).run().catch((err) => console.error('[funnels] event insert failed:', err));
  }
}
