export async function getNumericSetting(db: D1Database, key: string, fallback: number): Promise<number> {
  const row = await db.prepare('SELECT value_json FROM app_settings WHERE key = ?').bind(key).first() as { value_json?: string } | null;
  if (!row?.value_json) return fallback;

  try {
    const parsed = JSON.parse(row.value_json);
    const value = Number(parsed);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    const value = Number(row.value_json);
    return Number.isFinite(value) ? value : fallback;
  }
}

// Default & batas maksimum komisi affiliate untuk produk non-membership (kelas, webinar, produk digital).
export const FREE_AFFILIATE_MAX_COMMISSION_RATE = 20;
// Komisi affiliate khusus penjualan membership premium — lebih tinggi dari produk lain.
export const MEMBERSHIP_AFFILIATE_COMMISSION_RATE = 40;

export async function getDefaultCommissionRate(db: D1Database): Promise<number> {
  const rate = await getNumericSetting(db, 'default_commission_rate', FREE_AFFILIATE_MAX_COMMISSION_RATE);
  return Math.min(Math.max(0, rate), FREE_AFFILIATE_MAX_COMMISSION_RATE);
}

// ─── Affiliate tiers ────────────────────────────────────────────────────────
// Tier dihitung dari total komisi yang sudah DIBAYAR (paid) secara kumulatif.
// Tier menaikkan batas maksimum rate komisi non-membership sebagai insentif loyalitas.
// Catatan: angka di bawah adalah default; konfirmasi ke admin sebelum produksi.
export type AffiliateTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface AffiliateTierDef {
  key: AffiliateTier;
  name: string;
  // Ambang total komisi paid (Rupiah) untuk mencapai tier ini.
  threshold: number;
  // Batas maksimum rate komisi non-membership untuk tier ini.
  maxRate: number;
}

// Semua tier di-cap 20% untuk order non-membership (affiliate biasa maksimal 20%).
// Order membership selalu 40% otomatis (MEMBERSHIP_AFFILIATE_COMMISSION_RATE, di luar tier).
// Rate per-affiliate tetap fleksibel: admin bisa set 0–20% di default_commission_rate akun.
export const AFFILIATE_TIERS: AffiliateTierDef[] = [
  { key: 'bronze', name: 'Bronze', threshold: 0, maxRate: 20 },
  { key: 'silver', name: 'Silver', threshold: 1_000_000, maxRate: 20 },
  { key: 'gold', name: 'Gold', threshold: 5_000_000, maxRate: 20 },
  { key: 'platinum', name: 'Platinum', threshold: 20_000_000, maxRate: 20 },
];

export interface AffiliateTierState {
  tier: AffiliateTier;
  name: string;
  max_rate: number;
  paid_total: number;
  current_threshold: number;
  next_tier: AffiliateTier | null;
  next_name: string | null;
  next_at: number | null; // total komisi paid untuk tier berikutnya (null di puncak)
  to_next: number; // sisa komisi paid menuju tier berikutnya
  progress_pct: number; // 0–100 menuju tier berikutnya
}

/**
 * Resolve tier affiliate dari total komisi paid kumulatif. Pure + synchronous.
 */
export function resolveAffiliateTier(paidTotal: number): AffiliateTierState {
  const total = Math.max(0, Math.floor(paidTotal || 0));
  let idx = 0;
  for (let i = 0; i < AFFILIATE_TIERS.length; i++) {
    if (total >= AFFILIATE_TIERS[i].threshold) idx = i;
    else break;
  }
  const cur = AFFILIATE_TIERS[idx];
  const next = AFFILIATE_TIERS[idx + 1] || null;
  if (!next) {
    return {
      tier: cur.key, name: cur.name, max_rate: cur.maxRate, paid_total: total,
      current_threshold: cur.threshold, next_tier: null, next_name: null,
      next_at: null, to_next: 0, progress_pct: 100,
    };
  }
  const span = next.threshold - cur.threshold;
  const gained = total - cur.threshold;
  const progress_pct = span > 0 ? Math.min(100, Math.round((gained / span) * 100)) : 0;
  return {
    tier: cur.key, name: cur.name, max_rate: cur.maxRate, paid_total: total,
    current_threshold: cur.threshold, next_tier: next.key, next_name: next.name,
    next_at: next.threshold, to_next: Math.max(0, next.threshold - total), progress_pct,
  };
}

/** Maksimum rate komisi non-membership untuk sebuah tier. */
export function tierMaxRate(tier: unknown): number {
  const def = AFFILIATE_TIERS.find((t) => t.key === tier);
  return def ? def.maxRate : FREE_AFFILIATE_MAX_COMMISSION_RATE;
}

export function resolveAffiliateCommissionRate(
  orderType: unknown,
  accountRate: unknown,
  defaultRate: number,
  tier?: unknown,
): number {
  if (orderType === 'membership') return MEMBERSHIP_AFFILIATE_COMMISSION_RATE;

  const numericAccountRate = Number(accountRate);
  const baseRate = Number.isFinite(numericAccountRate) ? numericAccountRate : defaultRate;
  // Cap mengikuti tier affiliate (default Bronze = 20%).
  const cap = tier !== undefined ? tierMaxRate(tier) : FREE_AFFILIATE_MAX_COMMISSION_RATE;
  return Math.min(Math.max(0, baseRate), cap);
}
