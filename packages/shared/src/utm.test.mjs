// Run: npx tsx packages/shared/src/utm.test.mjs
import assert from 'node:assert';
import { normalizeUtmSet, slugifyUtm } from './utm.ts';

let pass = 0;
function eq(actual, expected, label) {
  assert.deepStrictEqual(actual, expected, label);
  pass++;
}

// slugify basics
eq(slugifyUtm('  Hello World  '), 'hello-world', 'slugify trims+lowercases+dashes');
eq(slugifyUtm('Café Promo'), 'cafe-promo', 'slugify strips diacritics');
eq(slugifyUtm('a__b  c'), 'a-b-c', 'slugify collapses separators');
eq(slugifyUtm(null), '', 'slugify null → empty');

// The 3 real dirty whatsapp variants must collapse to ONE source.
const a = normalizeUtmSet({ source: 'whatsapp' });
const b = normalizeUtmSet({ source: 'Whatsapp komunitas' });
const c = normalizeUtmSet({ source: 'whatsapp grup' });
eq(a.utm_source, 'whatsapp', 'whatsapp → whatsapp');
eq(b.utm_source, 'whatsapp', 'Whatsapp komunitas → source whatsapp');
eq(b.utm_medium, 'community', 'Whatsapp komunitas → medium community');
eq(c.utm_source, 'whatsapp', 'whatsapp grup → source whatsapp');
eq(c.utm_medium, 'group', 'whatsapp grup → medium group');
assert.strictEqual(new Set([a.utm_source, b.utm_source, c.utm_source]).size, 1, '3 variants → 1 source');
pass++;

// Alias map
eq(normalizeUtmSet({ source: 'WA' }).utm_source, 'whatsapp', 'WA alias');
eq(normalizeUtmSet({ source: 'IG' }).utm_source, 'instagram', 'IG alias');
eq(normalizeUtmSet({ source: 'yt' }).utm_source, 'youtube', 'yt alias');
eq(normalizeUtmSet({ source: 'Twitter' }).utm_source, 'x', 'Twitter → x');

// Explicit medium wins; source split does not override it.
const d = normalizeUtmSet({ source: 'whatsapp grup', medium: 'broadcast' });
eq(d.utm_source, 'whatsapp', 'explicit medium: source kept whatsapp (grup dropped if medium set)');
eq(d.utm_medium, 'broadcast', 'explicit medium broadcast wins');

// Unknown source accepted but flagged.
const e = normalizeUtmSet({ source: 'Kaskus Thread' });
eq(e.utm_source, 'kaskus-thread', 'unknown source slugged, not rejected');
eq(e.is_known, false, 'unknown source flagged is_known=false');

// Known set flagged true
eq(normalizeUtmSet({ source: 'instagram', medium: 'story' }).is_known, true, 'known set is_known=true');

// campaign/content slugged
const f = normalizeUtmSet({ source: 'email', campaign: 'Promo Juni 2026!', content: 'Hero CTA' });
eq(f.utm_campaign, 'promo-juni-2026', 'campaign slugged');
eq(f.utm_content, 'hero-cta', 'content slugged');

console.log(`✅ UTM normalizer: ${pass} assertions passed`);
