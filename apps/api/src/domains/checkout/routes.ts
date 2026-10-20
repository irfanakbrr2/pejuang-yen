import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware } from '../../middleware/auth';
import { rateLimit } from '../../middleware/rate-limit';
import { success, error } from '../../lib/response';
import { CheckoutService } from './service';

const checkoutRoutes = new Hono<{ Bindings: Env }>();

checkoutRoutes.use('*', authMiddleware());

checkoutRoutes.post('/create-payment', rateLimit({
  max: 10,
  windowSec: 60,
  keyFn: (c) => `checkout:${c.get('user')?.id || c.req.header('cf-connecting-ip') || 'unknown'}`,
}), async (c) => {
  try {
    const service = new CheckoutService(c.env);
    const user = c.get('user');
    const body = await c.req.json();

    const result = await service.createPayment(user, body);
    if ('error' in result) return error(c, result.error, result.status || 400);
    return success(c, result.data);
  } catch (err) {
    console.error('[checkout:create-payment]', err);
    return error(c, 'Gagal membuat pembayaran', 500);
  }
});

checkoutRoutes.get('/:orderId', async (c) => {
  try {
    const service = new CheckoutService(c.env);
    const result = await service.getCheckout(c.get('user'), c.req.param('orderId'));
    if ('error' in result) return error(c, result.error, result.status || 400);
    return success(c, result.data);
  } catch (err) {
    console.error('[checkout:detail]', err);
    return error(c, 'Gagal memuat checkout', 500);
  }
});

checkoutRoutes.get('/:orderId/status', async (c) => {
  try {
    const service = new CheckoutService(c.env);
    const result = await service.getStatus(c.get('user'), c.req.param('orderId'));
    if ('error' in result) return error(c, result.error, result.status || 400);
    return success(c, result.data);
  } catch (err) {
    console.error('[checkout:status]', err);
    return error(c, 'Gagal memuat status', 500);
  }
});

checkoutRoutes.post('/:orderId/check', rateLimit({
  max: 6,
  windowSec: 60,
  keyFn: (c) => `checkout-check:${c.get('user')?.id || c.req.header('cf-connecting-ip') || 'unknown'}`,
}), async (c) => {
  try {
    const service = new CheckoutService(c.env);
    const result = await service.check(c.get('user'), c.req.param('orderId') || '', c.executionCtx);
    if ('error' in result) return error(c, result.error, result.status || 400);
    return success(c, result.data);
  } catch (err) {
    console.error('[checkout:check]', err);
    return error(c, 'Gagal mengecek pembayaran', 500);
  }
});

checkoutRoutes.post('/:orderId/repay', rateLimit({
  max: 5,
  windowSec: 60,
  keyFn: (c) => `checkout-repay:${c.get('user')?.id || c.req.header('cf-connecting-ip') || 'unknown'}`,
}), async (c) => {
  try {
    const service = new CheckoutService(c.env);
    const body = await c.req.json().catch(() => ({}));
    const result = await service.repay(c.get('user'), c.req.param('orderId') || '', String(body.payment_method || ''));
    if ('error' in result) return error(c, result.error, result.status || 400);
    return success(c, result.data);
  } catch (err) {
    console.error('[checkout:repay]', err);
    return error(c, 'Gagal membuat ulang pembayaran', 500);
  }
});

// Sandbox only — dimatikan saat PAKASIR_MODE=production
checkoutRoutes.post('/:orderId/simulate', async (c) => {
  try {
    const service = new CheckoutService(c.env);
    const result = await service.simulate(c.get('user'), c.req.param('orderId'));
    if ('error' in result) return error(c, result.error, result.status || 400);
    return success(c, result.data);
  } catch (err) {
    console.error('[checkout:simulate]', err);
    return error(c, 'Gagal simulasi pembayaran', 500);
  }
});

export default checkoutRoutes;
