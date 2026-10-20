import { Hono } from 'hono';
import type { Env } from '../../env';
import { success } from '../../lib/response';

// GET /api/manual-payment — info rekening transfer manual (publik, non-rahasia).
const manualPaymentRoutes = new Hono<{ Bindings: Env }>();

const KEYS = ['manual_bank_name', 'manual_bank_account', 'manual_bank_holder', 'manual_whatsapp', 'manual_payment_note'];

manualPaymentRoutes.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT key, value_json FROM app_settings WHERE key IN (${KEYS.map(() => '?').join(',')})`
  ).bind(...KEYS).all<{ key: string; value_json: string }>();
  const out: Record<string, string> = {};
  for (const row of rows.results || []) {
    try { out[row.key] = JSON.parse(row.value_json); } catch { out[row.key] = row.value_json; }
  }
  return success(c, out);
});

export default manualPaymentRoutes;
