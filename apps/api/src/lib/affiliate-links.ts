// Origin link affiliate publik = domain utama (path /r/* & /l/* ditangani Pages worker).
// Ganti ke https://app.pejuangyen.com setelah custom domain aktif.
export const AFFILIATE_PUBLIC_ORIGIN = 'https://app.pejuangyen.com';
export const DEFAULT_AFFILIATE_PRODUCT_SLUG = 'membership-yearly';

const AFFILIATE_CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function publicAffiliateLink(publicRefCode: string): string {
  return `${AFFILIATE_PUBLIC_ORIGIN}/r/${encodeURIComponent(publicRefCode)}`;
}

export function publicWebinarAffiliateLink(slug: string, publicRefCode: string): string {
  return `${AFFILIATE_PUBLIC_ORIGIN}/r/w/${encodeURIComponent(slug)}/${encodeURIComponent(publicRefCode)}`;
}

export function randomAffiliateToken(length = 7): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => AFFILIATE_CODE_ALPHABET[byte % AFFILIATE_CODE_ALPHABET.length]).join('');
}

export function sanitizePublicRefCode(code: string): string {
  return code.trim().toLowerCase();
}

export function isSafeSlug(value: string): boolean {
  return /^[a-z0-9-]{1,120}$/.test(value);
}
