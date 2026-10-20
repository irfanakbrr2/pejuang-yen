// Link affiliate publik diarahkan ke domain utama (tanpa domain .link terpisah).
// Pages worker (cloudflare-pages-worker.js) menangani path /r/* dan /l/*.
// Ganti ORIGIN ke https://app.pejuangyen.com setelah custom domain aktif.
export const AFFILIATE_PUBLIC_ORIGIN = "https://app.pejuangyen.com";
export const DEFAULT_AFFILIATE_PRODUCT_SLUG = "membership-yearly";

export function publicAffiliateLink(publicRefCode: string) {
  return `${AFFILIATE_PUBLIC_ORIGIN}/r/${encodeURIComponent(publicRefCode)}`;
}

export function publicProductAffiliateLink(publicRefCode: string, productSlug: string) {
  return `${AFFILIATE_PUBLIC_ORIGIN}/r/p/${encodeURIComponent(productSlug)}/${encodeURIComponent(publicRefCode)}`;
}

export function publicWebinarAffiliateLink(publicRefCode: string, webinarSlug: string) {
  return `${AFFILIATE_PUBLIC_ORIGIN}/r/w/${encodeURIComponent(webinarSlug)}/${encodeURIComponent(publicRefCode)}`;
}
