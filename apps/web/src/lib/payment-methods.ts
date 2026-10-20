export type PaymentMethodId =
  | 'manual_transfer'
  | 'qris'
  | 'bni_va'
  | 'bri_va'
  | 'permata_va'
  | 'cimb_niaga_va'
  | 'maybank_va'
  | 'bnc_va'
  | 'sampoerna_va'
  | 'atm_bersama_va'
  | 'artha_graha_va';

// Pakasir AKTIF: QRIS & Virtual Account otomatis (konfirmasi via webhook).
// Transfer Manual tetap disediakan sebagai fallback (butuh verifikasi admin).
export const PAYMENT_METHODS: { id: PaymentMethodId; label: string; group: 'qris' | 'va' | 'manual' }[] = [
  { id: 'qris',           label: 'QRIS — semua e-wallet & m-banking', group: 'qris' },
  { id: 'bri_va',         label: 'BRI Virtual Account',               group: 'va' },
  { id: 'bni_va',         label: 'BNI Virtual Account',               group: 'va' },
  { id: 'permata_va',     label: 'Permata Virtual Account',           group: 'va' },
  { id: 'cimb_niaga_va',  label: 'CIMB Niaga Virtual Account',        group: 'va' },
  { id: 'maybank_va',     label: 'Maybank Virtual Account',           group: 'va' },
  { id: 'bnc_va',         label: 'BNC Virtual Account',               group: 'va' },
  { id: 'sampoerna_va',   label: 'Bank Sampoerna Virtual Account',    group: 'va' },
  { id: 'atm_bersama_va', label: 'ATM Bersama Virtual Account',       group: 'va' },
  { id: 'artha_graha_va', label: 'Artha Graha Virtual Account',       group: 'va' },
  { id: 'manual_transfer', label: 'Transfer Manual (verifikasi admin)', group: 'manual' },
];

export const methodLabel = (id: string): string =>
  PAYMENT_METHODS.find((m) => m.id === id)?.label ?? (id === 'manual_transfer' ? 'Transfer Manual' : id.toUpperCase());

// QRIS = default: paling cepat, otomatis, dan didukung semua e-wallet/m-banking.
export function recommendedMethod(_orderType?: string, _productSlug?: string): PaymentMethodId {
  return 'qris';
}
