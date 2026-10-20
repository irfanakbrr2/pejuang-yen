import type { Env } from '../../env';

/**
 * Sumber tunggal statement grant akses per tipe produk — dipakai fulfillment
 * (produk utama) dan addon funnel_bump. Semua INSERT OR IGNORE + unique index
 * → aman terhadap webhook dobel.
 *
 * Tipe yang didukung sebagai grant addon: course, digital_product, tool_credits.
 * membership & webinar_registration TIDAK boleh jadi bump (divalidasi admin):
 * membership unik per source_order_id, webinar butuh row registrasi existing.
 */
export interface GrantInput {
  userId: string;
  productType: string;
  productId: string;
  sourceOrderId: string;
  now: string;
}

export interface GrantResult {
  statements: D1PreparedStatement[];
  /** terisi untuk tool_credits — dipakai fulfillment utk post-batch balance/email */
  creditTransactionId?: string;
}

export function buildCourseGrantStatements(env: Env, input: GrantInput): D1PreparedStatement[] {
  const { userId, productId, sourceOrderId, now } = input;
  return [
    env.DB.prepare(
      `INSERT OR IGNORE INTO enrollments (id, user_id, course_id, status, enrolled_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, ?)`
    ).bind(crypto.randomUUID(), userId, productId, now, now),
    env.DB.prepare(
      `INSERT OR IGNORE INTO user_access (id, user_id, access_type, resource_type, resource_id, source_type, source_id, status, starts_at, expires_at, created_at, updated_at)
       VALUES (?, ?, 'lifetime', 'course', ?, 'order', ?, 'active', ?, NULL, ?, ?)`
    ).bind(crypto.randomUUID(), userId, productId, sourceOrderId, now, now, now),
  ];
}

export function buildDigitalProductGrantStatements(env: Env, input: GrantInput): D1PreparedStatement[] {
  const { userId, productId, sourceOrderId, now } = input;
  return [
    env.DB.prepare(
      `INSERT OR IGNORE INTO user_access (id, user_id, access_type, resource_type, resource_id, source_type, source_id, status, starts_at, expires_at, created_at, updated_at)
       VALUES (?, ?, 'lifetime', 'digital_product', ?, 'order', ?, 'active', ?, NULL, ?, ?)`
    ).bind(crypto.randomUUID(), userId, productId, sourceOrderId, now, now, now),
  ];
}

export function buildToolCreditsGrantStatements(
  env: Env,
  input: GrantInput,
  pkg: { creditsToAdd: number; pkgName: string }
): GrantResult {
  const { userId, sourceOrderId, now } = input;
  const creditTransactionId = crypto.randomUUID();
  return {
    creditTransactionId,
    statements: [
      env.DB.prepare(
        `INSERT OR IGNORE INTO tool_credit_transactions (id, user_id, type, amount, balance_after, order_id, description, created_at)
         VALUES (?, ?, 'purchase', ?, 0, ?, ?, ?)`
      ).bind(creditTransactionId, userId, pkg.creditsToAdd, sourceOrderId, `Pembelian paket ${pkg.pkgName}`, now),
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
      ).bind(crypto.randomUUID(), userId, pkg.creditsToAdd, pkg.creditsToAdd, now, now, creditTransactionId, sourceOrderId, now),
    ],
  };
}

/**
 * Grant untuk produk addon funnel_bump. Return null bila tipe tidak didukung
 * (caller log + skip — jangan gagalkan fulfillment order utama).
 */
export async function buildAddonGrantStatements(env: Env, input: GrantInput): Promise<D1PreparedStatement[] | null> {
  if (input.productType === 'course') return buildCourseGrantStatements(env, input);
  if (input.productType === 'digital_product') return buildDigitalProductGrantStatements(env, input);
  if (input.productType === 'tool_credits') {
    const pkg = await env.DB.prepare('SELECT name, credits FROM tool_credit_packages WHERE id = ?')
      .bind(input.productId).first();
    if (!pkg) return null;
    return buildToolCreditsGrantStatements(env, input, {
      creditsToAdd: Number(pkg.credits),
      pkgName: pkg.name as string,
    }).statements;
  }
  return null;
}
