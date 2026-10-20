import { z } from 'zod';

/**
 * UTM kanonik — SUMBER KEBENARAN tunggal.
 * Dipakai bersama oleh: create shortlink, resolve shortlink, dan ingest tracking.
 * Jangan duplikasi aturan normalisasi di tempat lain — import dari sini.
 */

// ─── Allowlist ──────────────────────────────────────────────────────────────
export const UTM_SOURCE_ALLOWLIST = [
  'whatsapp', 'instagram', 'tiktok', 'facebook', 'youtube', 'telegram',
  'x', 'email', 'google', 'threads', 'linkedin',
] as const;

export const UTM_MEDIUM_ALLOWLIST = [
  'social', 'broadcast', 'bio', 'story', 'dm', 'group', 'community',
  'lifecycle', 'cpc', 'organic', 'referral',
] as const;

// ─── Alias map (auto-koreksi) ───────────────────────────────────────────────
// Kunci HARUS sudah ter-slug (lowercase, '-'); pencocokan dilakukan setelah slugify.
export const UTM_SOURCE_ALIAS: Record<string, string> = {
  wa: 'whatsapp', whatsapp: 'whatsapp', whatsup: 'whatsapp',
  ig: 'instagram', insta: 'instagram', instagram: 'instagram',
  yt: 'youtube', youtube: 'youtube',
  fb: 'facebook', facebook: 'facebook',
  tt: 'tiktok', tiktok: 'tiktok',
  tele: 'telegram', tg: 'telegram', telegram: 'telegram',
  x: 'x', twitter: 'x',
  email: 'email', mail: 'email', newsletter: 'email',
  google: 'google', goog: 'google',
  threads: 'threads',
  li: 'linkedin', linkedin: 'linkedin',
};

// Kata yang sebenarnya MEDIUM walau sering ditulis menempel di source.
export const UTM_MEDIUM_ALIAS: Record<string, string> = {
  komunitas: 'community', community: 'community', komuniti: 'community',
  grup: 'group', group: 'group', gc: 'group', groups: 'group',
  story: 'story', stories: 'story', stori: 'story',
  dm: 'dm', pesan: 'dm',
  bio: 'bio', linktree: 'bio', linkinbio: 'bio',
  broadcast: 'broadcast', bc: 'broadcast', blast: 'broadcast',
  social: 'social', sosmed: 'social',
  cpc: 'cpc', ads: 'cpc', ad: 'cpc', iklan: 'cpc', paid: 'cpc',
  organic: 'organic', organik: 'organic',
  referral: 'referral', ref: 'referral', referral_program: 'referral',
  lifecycle: 'lifecycle',
};

// ─── Slugify ────────────────────────────────────────────────────────────────
/** trim → lowercase → buang diakritik → spasi/underscore jadi '-' → buang char
 *  selain a-z0-9- → rapikan dash → batasi panjang. Mengembalikan '' bila kosong. */
export function slugifyUtm(raw: unknown, maxLen = 60): string {
  if (typeof raw !== 'string') return '';
  return raw
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip diakritik
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')      // spasi & underscore → -
    .replace(/[^a-z0-9-]/g, '')   // buang sisa
    .replace(/-+/g, '-')          // dash ganda → satu
    .replace(/^-|-$/g, '')        // trim dash tepi
    .slice(0, maxLen);
}

export interface NormalizedUtm {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  /** false bila source/medium di luar allowlist (untuk audit, tetap diterima) */
  is_known: boolean;
}

export interface UtmInput {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
  term?: string | null;
}

/**
 * Normalisasi satu set UTM ke bentuk kanonik. Tidak menolak nilai asing
 * (supaya kampanye baru tidak terblokir) — hanya men-slug + alias + memisahkan
 * info medium yang nyangkut di source ("whatsapp komunitas" → wa + community).
 */
export function normalizeUtmSet(input: UtmInput): NormalizedUtm {
  // Medium eksplisit dulu.
  let medium = slugifyUtm(input.medium);
  if (medium) medium = UTM_MEDIUM_ALIAS[medium] ?? medium;

  // Source: slugify, lalu pisahkan token yang sebenarnya medium.
  const sourceSlug = slugifyUtm(input.source);
  let source = '';
  if (sourceSlug) {
    // Coba alias langsung untuk frasa utuh (mis. "twitter").
    const directAlias = UTM_SOURCE_ALIAS[sourceSlug];
    if (directAlias && !sourceSlug.includes('-')) {
      source = directAlias;
    } else {
      const tokens = sourceSlug.split('-');
      const keep: string[] = [];
      for (const t of tokens) {
        if (!medium && UTM_MEDIUM_ALIAS[t]) {
          medium = UTM_MEDIUM_ALIAS[t]; // token ini medium → pindahkan
        } else {
          keep.push(t);
        }
      }
      const base = keep.join('-');
      source = UTM_SOURCE_ALIAS[base] ?? UTM_SOURCE_ALIAS[keep[0]] ?? base;
    }
  }

  const sourceKnown = source === '' || (UTM_SOURCE_ALLOWLIST as readonly string[]).includes(source);
  const mediumKnown = medium === '' || (UTM_MEDIUM_ALLOWLIST as readonly string[]).includes(medium);

  return {
    utm_source: source || null,
    utm_medium: medium || null,
    utm_campaign: slugifyUtm(input.campaign) || null,
    utm_content: slugifyUtm(input.content) || null,
    utm_term: slugifyUtm(input.term) || null,
    is_known: sourceKnown && mediumKnown,
  };
}

// ─── Zod schema (validasi bentuk) ───────────────────────────────────────────
// Lenient: menerima string apa pun lalu menormalkan. Refine memastikan hasil
// slug valid (a-z0-9-) — tidak pernah gagal untuk input string wajar.
const slugField = z
  .string()
  .max(120)
  .transform((v) => slugifyUtm(v))
  .refine((v) => v === '' || /^[a-z0-9-]+$/.test(v), 'UTM harus slug (a-z0-9-)');

export const utmInputSchema = z.object({
  utm_source: slugField.optional().nullable(),
  utm_medium: slugField.optional().nullable(),
  utm_campaign: slugField.optional().nullable(),
  utm_content: slugField.optional().nullable(),
  utm_term: slugField.optional().nullable(),
});

export type UtmInputSchema = z.infer<typeof utmInputSchema>;
