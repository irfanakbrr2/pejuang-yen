import type { Env } from '../env';

const PAKASIR_BASE_URL = 'https://app.pakasir.com';

export const PAKASIR_METHODS = [
  'qris', 'bni_va', 'bri_va', 'permata_va', 'cimb_niaga_va', 'maybank_va',
  'bnc_va', 'sampoerna_va', 'atm_bersama_va', 'artha_graha_va',
] as const;
export type PakasirMethod = (typeof PAKASIR_METHODS)[number];

export function isPakasirMethod(value: unknown): value is PakasirMethod {
  return typeof value === 'string' && (PAKASIR_METHODS as readonly string[]).includes(value);
}

export interface PakasirTransaction {
  order_id: string;
  amount: number;
  payment_method: string;
  payment_number: string | null;  // QRIS: QR string; VA: nomor virtual account
  fee: number;
  total_payment: number;
  expired_at: string | null;
  status: string;                 // 'pending' | 'completed' | ...
  completed_at: string | null;
  raw: Record<string, unknown>;
}

function getPakasirConfig(env: Env) {
  const project = (env.PAKASIR_PROJECT_SLUG || '').trim();
  const apiKey = (env.PAKASIR_API_KEY || '').trim();
  if (!project || !apiKey) throw new Error('Pakasir belum dikonfigurasi (PAKASIR_PROJECT_SLUG / PAKASIR_API_KEY)');
  return { project, apiKey };
}

// Bentuk respons asli Pakasir (diverifikasi 2026-06-12):
// - transactioncreate  → { "payment":     { order_id, amount, fee, total_payment, payment_method, payment_number, expired_at, received } }
// - transactiondetail  → { "transaction": { order_id, amount, project, status, payment_method, completed_at, is_sandbox } }
function parsePakasirTransaction(json: Record<string, unknown>): PakasirTransaction {
  const d = (json.payment ?? json.transaction ?? json.data ?? json) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0);
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return {
    order_id: str(d.order_id) || '',
    amount: num(d.amount),
    payment_method: str(d.payment_method) || '',
    payment_number: str(d.payment_number) ?? str(d.payment_no) ?? str(d.qr_string),
    fee: num(d.fee),
    total_payment: num(d.total_payment) || num(d.amount) + num(d.fee),
    expired_at: str(d.expired_at),
    status: (str(d.status) || 'pending').toLowerCase(),
    completed_at: str(d.completed_at),
    raw: json,
  };
}

export async function createPakasirTransaction(
  env: Env,
  params: { method: PakasirMethod; orderId: string; amount: number }
): Promise<PakasirTransaction> {
  const { project, apiKey } = getPakasirConfig(env);
  const res = await fetch(`${PAKASIR_BASE_URL}/api/transactioncreate/${params.method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project, order_id: params.orderId, amount: params.amount, api_key: apiKey }),
  });
  const json = await res.json().catch(() => ({})) as Record<string, unknown>;
  console.log('PAKASIR_CREATE', JSON.stringify({ method: params.method, orderId: params.orderId, ok: res.ok, status: res.status }));
  if (!res.ok) {
    throw new Error(`Pakasir create gagal (${res.status}): ${JSON.stringify(json).slice(0, 500)}`);
  }
  const tx = parsePakasirTransaction(json);
  if (!tx.payment_number) throw new Error('Pakasir tidak mengembalikan payment_number');
  return tx;
}

export async function getPakasirTransactionDetail(
  env: Env,
  params: { orderId: string; amount: number }
): Promise<PakasirTransaction | null> {
  const { project, apiKey } = getPakasirConfig(env);
  const qs = new URLSearchParams({
    project, amount: String(params.amount), order_id: params.orderId, api_key: apiKey,
  });
  const res = await fetch(`${PAKASIR_BASE_URL}/api/transactiondetail?${qs}`);
  const json = await res.json().catch(() => ({})) as Record<string, unknown>;
  console.log('PAKASIR_DETAIL', JSON.stringify({ orderId: params.orderId, ok: res.ok, status: res.status }));
  if (!res.ok) return null;
  return parsePakasirTransaction(json);
}

// Sandbox only — menandai transaksi lunas di project sandbox Pakasir
export async function simulatePakasirPayment(
  env: Env,
  params: { orderId: string; amount: number }
): Promise<Record<string, unknown>> {
  const { project, apiKey } = getPakasirConfig(env);
  const res = await fetch(`${PAKASIR_BASE_URL}/api/paymentsimulation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project, order_id: params.orderId, amount: params.amount, api_key: apiKey }),
  });
  const json = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Pakasir simulate gagal (${res.status}): ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}
