import { Hono } from 'hono';
import type { Env } from '../../env';
import { success, error } from '../../lib/response';
import { getPakasirTransactionDetail } from '../../services/pakasir';
import { fulfillPaidOrder } from '../orders/fulfillment';

const pakasirWebhookRoutes = new Hono<{ Bindings: Env }>();

/**
 * Webhook Pakasir. Pakasir TIDAK mengirim signature — keamanan via:
 * 1. Secret di query string (?key=...) yang hanya ada di URL webhook tersimpan di dashboard Pakasir.
 * 2. Validasi project + amount terhadap order internal.
 * 3. Konfirmasi WAJIB ke Transaction Detail API sebelum grant akses.
 *
 * Payload: { amount, order_id, project, status, payment_method, completed_at }
 * order_id Pakasir = payments.provider_transaction_id (GWA-xxx[-Rn]).
 */
pakasirWebhookRoutes.post('/', async (c) => {
  // 1. Auth: secret di query
  const secret = (c.env.PAKASIR_WEBHOOK_SECRET || '').trim();
  if (secret && c.req.query('key') !== secret) {
    return error(c, 'Unauthorized', 401);
  }

  const payload = await c.req.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any;
  try { data = JSON.parse(payload); } catch { return error(c, 'Invalid JSON', 400); }

  const { amount, order_id, project, status, payment_method, completed_at } = data ?? {};
  console.log('PAKASIR_WEBHOOK', JSON.stringify({ order_id, amount, status, payment_method }));

  // 2. Validasi project
  if (!order_id || project !== c.env.PAKASIR_PROJECT_SLUG) {
    return error(c, 'Invalid project', 401);
  }

  const now = new Date().toISOString();
  // Idempotency key sesuai spec: kombinasi provider + order_id + amount + status + completed_at
  const eventId = `pakasir:${order_id}:${amount}:${status}:${completed_at || ''}`;
  const webhookEventId = crypto.randomUUID();

  // 3. Idempotency — unique index provider_event_id
  const inserted = await c.env.DB.prepare(
    `INSERT OR IGNORE INTO webhook_events (id, provider, event_type, provider_event_id, provider_transaction_id, order_id, raw_payload_json, processing_status, received_at)
     VALUES (?, 'pakasir', ?, ?, ?, NULL, ?, 'pending', ?)`
  ).bind(webhookEventId, `pakasir.${status || 'unknown'}`, eventId, String(order_id), payload, now).run();

  if ((inserted.meta?.changes || 0) === 0) {
    return success(c, { message: 'Already recorded' });
  }

  const markFailed = (msg: string) => c.env.DB.prepare(
    `UPDATE webhook_events SET processing_status = 'failed', error_message = ?, processed_at = ? WHERE id = ?`
  ).bind(msg, now, webhookEventId).run();
  const markProcessed = () => c.env.DB.prepare(
    `UPDATE webhook_events SET processing_status = 'processed', processed_at = ? WHERE id = ?`
  ).bind(now, webhookEventId).run();

  // 4. Lookup attempt → order
  const attempt = await c.env.DB.prepare(
    `SELECT * FROM payments WHERE provider = 'pakasir' AND provider_transaction_id = ? LIMIT 1`
  ).bind(String(order_id)).first();
  if (!attempt) {
    await markFailed('Order not found');
    console.log('PAKASIR_WEBHOOK_ORDER_NOT_FOUND', JSON.stringify({ order_id }));
    return success(c, { message: 'Order not found' });
  }

  const order = await c.env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(attempt.order_id).first();
  if (!order) {
    await markFailed('Internal order not found');
    return success(c, { message: 'Order not found' });
  }
  await c.env.DB.prepare(`UPDATE webhook_events SET order_id = ? WHERE id = ?`)
    .bind(order.id, webhookEventId).run().catch(() => {});

  // 5. Validasi amount (webhook vs attempt vs order)
  if (Number(amount) !== Number(attempt.amount) || Number(amount) !== Number(order.amount)) {
    await markFailed(`Amount mismatch: webhook=${amount} attempt=${attempt.amount} order=${order.amount}`);
    return success(c, { message: 'Amount mismatch' });
  }

  if (order.status === 'paid') {
    await markProcessed();
    return success(c, { message: 'Order already paid' });
  }

  if (status !== 'completed') {
    // Informasional (expired/failed/dsb) → catat di attempt, tandai processed, tanpa grant
    await c.env.DB.batch([
      c.env.DB.prepare(`UPDATE payments SET status = ?, updated_at = ? WHERE id = ? AND status = 'pending'`)
        .bind(String(status || 'unknown'), now, attempt.id),
      c.env.DB.prepare(`UPDATE webhook_events SET processing_status = 'processed', processed_at = ? WHERE id = ?`)
        .bind(now, webhookEventId),
    ]);
    return success(c, { message: 'Recorded' });
  }

  // 6. JANGAN percaya payload — konfirmasi ke Transaction Detail API
  let detail = null;
  try {
    detail = await getPakasirTransactionDetail(c.env, {
      orderId: String(order_id),
      amount: Number(attempt.amount),
    });
  } catch (err) {
    console.error('[webhook:pakasir] detail error:', err);
  }
  if (!detail || detail.status !== 'completed' || detail.amount !== Number(attempt.amount)) {
    await markFailed(`Pakasir verification failed: ${detail ? `status=${detail.status} amount=${detail.amount}` : 'detail not found'}`);
    return error(c, 'Unverified payment', 401);
  }

  // 7. Fulfillment shared (atomic batch + INSERT OR IGNORE → tidak double)
  await fulfillPaidOrder(c.env, c.executionCtx, {
    order,
    provider: 'pakasir',
    providerTransactionId: String(order_id),
    paymentMethod: String(payment_method || attempt.payment_method || ''),
    eventType: 'pakasir.completed',
    rawPayload: payload,
    existingPaymentId: attempt.id as string,
    webhookEventId,
  });

  console.log('PAKASIR_WEBHOOK_PROCESSED', JSON.stringify({ orderId: order.id, order_id }));
  return success(c, { message: 'Processed successfully' });
});

export default pakasirWebhookRoutes;
