import { FunnelsService } from './service.ts';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const USER = { id: 'user-1' };
const FUNNEL = {
  id: 'funnel-1',
  owner_user_id: null,
  name: 'Webinar → Premium',
  trigger_product_type: 'webinar_registration',
  trigger_product_id: '*',
  status: 'active',
  offer_window_minutes: 15,
  exit_url: null,
};
const STEP_BUMP = {
  id: 'step-bump', funnel_id: 'funnel-1', step_type: 'order_bump', enabled: 1,
  product_type: 'digital_product', product_id: 'dp-1', price_override: 49000,
  headline: 'Tambah ebook', description: null, badge_text: null, image_url: null, countdown_seconds: null,
};
const STEP_UPSELL = {
  id: 'step-upsell', funnel_id: 'funnel-1', step_type: 'upsell', enabled: 1,
  product_type: 'membership', product_id: 'plan-lifetime', price_override: null,
  headline: 'Upgrade Lifetime', description: null, badge_text: 'Sekali bayar', image_url: null, countdown_seconds: 300,
};
const STEP_DOWNSELL = {
  id: 'step-downsell', funnel_id: 'funnel-1', step_type: 'downsell', enabled: 1,
  product_type: 'membership', product_id: 'plan-yearly', price_override: 749000,
  headline: 'Atau Tahunan saja', description: null, badge_text: null, image_url: null, countdown_seconds: 300,
};

function futureIso(minutes) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function makeEnv({
  order = null,
  funnel = FUNNEL,
  steps = [STEP_BUMP, STEP_UPSELL, STEP_DOWNSELL],
  offer = null,
  transitionChanges = 1,
  downsellNullUpdateChanges = 1,
} = {}) {
  const calls = [];
  const db = {
    calls,
    batch: async (statements) => {
      calls.push({ method: 'batch', count: statements.length });
      for (const s of statements) await s.run();
      return [];
    },
    prepare(sql) {
      const makeBound = (args = []) => ({
        first: async () => {
          calls.push({ method: 'first', sql, args });
          if (sql.includes('FROM orders WHERE id = ? AND user_id = ?')) return order;
          if (sql.includes("FROM funnels") && sql.includes("status = 'active'")) return funnel;
          if (sql.includes('FROM funnels WHERE id = ?')) return funnel;
          if (sql.includes('FROM funnel_offers WHERE trigger_order_id = ?')) return offer;
          if (sql.includes('FROM funnel_offers WHERE id = ?')) return offer;
          if (sql.includes('FROM digital_products WHERE id = ?')) {
            return { id: 'dp-1', name: 'Ebook Mastery', price: 99000, slug: 'ebook-mastery' };
          }
          if (sql.includes('FROM membership_plans WHERE id = ?')) {
            return args[0] === 'plan-lifetime'
              ? { id: 'plan-lifetime', name: 'Membership Lifetime', price: 1299000, slug: 'lifetime' }
              : { id: 'plan-yearly', name: 'Membership Tahunan', price: 849000, slug: 'yearly' };
          }
          if (sql.includes('FROM webinars WHERE id = ?')) return { slug: 'webinar-keren' };
          // Ownership checks default: tidak punya apa-apa
          if (sql.includes('FROM enrollments')) return null;
          if (sql.includes('FROM memberships')) return null;
          if (sql.includes('FROM user_access')) return null;
          return null;
        },
        all: async () => {
          calls.push({ method: 'all', sql, args });
          if (sql.includes('FROM funnel_steps WHERE funnel_id = ?')) return { results: steps };
          return { results: [] };
        },
        run: async () => {
          calls.push({ method: 'run', sql, args });
          let changes = 1;
          if (sql.includes('UPDATE funnel_offers SET upsell_status') || sql.includes('UPDATE funnel_offers SET downsell_status')) {
            changes = transitionChanges;
          }
          if (sql.includes("SET downsell_status = 'offered'")) changes = downsellNullUpdateChanges;
          return { success: true, meta: { changes } };
        },
      });
      return { ...makeBound(), bind(...args) { return makeBound(args); } };
    },
  };
  return { DB: db, calls };
}

const paidOrder = {
  id: 'order-1', user_id: 'user-1', order_type: 'webinar_registration', product_id: 'web-1',
  status: 'paid', paid_at: new Date().toISOString(), amount: 99000, affiliate_code: null,
  metadata_json: '{}',
};

// 1. validateBumpAddon: harga dari price_override server-side
async function testValidateBumpHappy() {
  const env = makeEnv();
  const service = new FunnelsService(env);
  const addon = await service.validateBumpAddon('webinar_registration', 'web-1', 'step-bump');
  assert(addon, 'bump addon must resolve');
  assertEqual(addon.amount, 49000, 'bump amount must come from price_override');
  assertEqual(addon.product_id, 'dp-1', 'bump product id');
  assertEqual(addon.funnel_id, 'funnel-1', 'bump funnel id');
}

// 2. validateBumpAddon: step_id salah → null
async function testValidateBumpWrongStep() {
  const env = makeEnv();
  const service = new FunnelsService(env);
  const addon = await service.validateBumpAddon('webinar_registration', 'web-1', 'step-ngawur');
  assertEqual(addon, null, 'wrong step id must be rejected');
}

// 3. validateBumpAddon: step disabled → null
async function testValidateBumpDisabled() {
  const env = makeEnv({ steps: [{ ...STEP_BUMP, enabled: 0 }, STEP_UPSELL] });
  const service = new FunnelsService(env);
  const addon = await service.validateBumpAddon('webinar_registration', 'web-1', 'step-bump');
  assertEqual(addon, null, 'disabled step must be rejected');
}

// 4. getOffer: order paid → upsell ditawarkan + offer row dibuat
async function testGetOfferShowsUpsell() {
  const env = makeEnv({
    order: paidOrder,
    offer: {
      id: 'offer-1', funnel_id: 'funnel-1', trigger_order_id: 'order-1', user_id: 'user-1',
      status: 'open', upsell_status: 'offered', downsell_status: null,
      upsell_order_id: null, downsell_order_id: null, expires_at: futureIso(10),
    },
  });
  const service = new FunnelsService(env);
  const result = await service.getOffer(USER, 'order-1');
  assert(!('error' in result), 'getOffer must succeed');
  assertEqual(result.data.step, 'upsell', 'upsell step must be offered');
  assertEqual(result.data.content.amount, 1299000, 'upsell price = harga list lifetime');
  assertEqual(result.data.exit_url, '/webinar/webinar-keren', 'exit default webinar = halaman detail webinar');
  assert(env.calls.some((c) => c.sql?.includes('INSERT OR IGNORE INTO funnel_offers')), 'offer row must be created idempotently');
  assert(env.calls.some((c) => c.sql?.includes('INSERT OR IGNORE INTO funnel_events')), 'viewed event must be recorded');
}

// 5. getOffer: order belum paid → step null
async function testGetOfferUnpaid() {
  const env = makeEnv({ order: { ...paidOrder, status: 'pending' } });
  const service = new FunnelsService(env);
  const result = await service.getOffer(USER, 'order-1');
  assertEqual(result.data.step, null, 'unpaid order must not get offer');
}

// 6. getOffer: offer expired → step null + ditandai expired
async function testGetOfferExpired() {
  const env = makeEnv({
    order: paidOrder,
    offer: {
      id: 'offer-1', funnel_id: 'funnel-1', trigger_order_id: 'order-1', user_id: 'user-1',
      status: 'open', upsell_status: 'offered', downsell_status: null,
      upsell_order_id: null, downsell_order_id: null, expires_at: new Date(Date.now() - 60_000).toISOString(),
    },
  });
  const service = new FunnelsService(env);
  const result = await service.getOffer(USER, 'order-1');
  assertEqual(result.data.step, null, 'expired offer must return null step');
  assert(env.calls.some((c) => c.sql?.includes("SET status = 'expired'")), 'offer must be marked expired');
}

// 7. acceptOffer double-tap: transisi gagal (changes=0) → return order existing (idempoten)
async function testAcceptDoubleTapIdempotent() {
  const env = makeEnv({
    order: paidOrder,
    transitionChanges: 0,
    offer: {
      id: 'offer-1', funnel_id: 'funnel-1', trigger_order_id: 'order-1', user_id: 'user-1',
      status: 'open', upsell_status: 'accepted', downsell_status: null,
      upsell_order_id: 'order-upsell-99', downsell_order_id: null, expires_at: futureIso(10),
    },
  });
  const service = new FunnelsService(env);
  const result = await service.acceptOffer(USER, 'order-1', 'upsell', 'qris', { waitUntil: (p) => p });
  assert(!('error' in result), 'double-tap accept must not error');
  assertEqual(result.data.order_id, 'order-upsell-99', 'double-tap must return existing upsell order');
}

// 8. acceptOffer expired → 410
async function testAcceptExpired() {
  const env = makeEnv({
    order: paidOrder,
    offer: {
      id: 'offer-1', funnel_id: 'funnel-1', trigger_order_id: 'order-1', user_id: 'user-1',
      status: 'open', upsell_status: 'offered', downsell_status: null,
      upsell_order_id: null, downsell_order_id: null, expires_at: new Date(Date.now() - 1000).toISOString(),
    },
  });
  const service = new FunnelsService(env);
  const result = await service.acceptOffer(USER, 'order-1', 'upsell', 'qris', { waitUntil: (p) => p });
  assert('error' in result, 'expired accept must error');
  assertEqual(result.status, 410, 'expired accept must be 410');
}

// 9. declineOffer upsell → downsell ditawarkan sekali
async function testDeclineUpsellOffersDownsell() {
  const env = makeEnv({
    order: paidOrder,
    offer: {
      id: 'offer-1', funnel_id: 'funnel-1', trigger_order_id: 'order-1', user_id: 'user-1',
      status: 'open', upsell_status: 'offered', downsell_status: null,
      upsell_order_id: null, downsell_order_id: null, expires_at: futureIso(10),
    },
  });
  const service = new FunnelsService(env);
  const result = await service.declineOffer(USER, 'order-1', 'upsell');
  assert(!('error' in result), 'decline must succeed');
  assertEqual(result.data.step, 'downsell', 'downsell must be offered after upsell declined');
  assertEqual(result.data.content.amount, 749000, 'downsell pakai price_override');
}

// 10. declineOffer downsell → selesai + exit_url webinar
async function testDeclineDownsellEndsWithExit() {
  const env = makeEnv({
    order: paidOrder,
    offer: {
      id: 'offer-1', funnel_id: 'funnel-1', trigger_order_id: 'order-1', user_id: 'user-1',
      status: 'open', upsell_status: 'declined', downsell_status: 'offered',
      upsell_order_id: null, downsell_order_id: null, expires_at: futureIso(10),
    },
  });
  const service = new FunnelsService(env);
  const result = await service.declineOffer(USER, 'order-1', 'downsell');
  assert(!('error' in result), 'decline downsell must succeed');
  assertEqual(result.data.step, null, 'no more steps after downsell declined');
  assertEqual(result.data.exit_url, '/webinar/webinar-keren', 'exit url = halaman detail webinar');
  assert(env.calls.some((c) => c.sql?.includes("SET status = 'completed'")), 'offer must be completed');
}

const tests = [
  ['validate bump happy (server price)', testValidateBumpHappy],
  ['validate bump wrong step rejected', testValidateBumpWrongStep],
  ['validate bump disabled rejected', testValidateBumpDisabled],
  ['getOffer shows upsell + creates offer', testGetOfferShowsUpsell],
  ['getOffer unpaid returns null', testGetOfferUnpaid],
  ['getOffer expired returns null', testGetOfferExpired],
  ['accept double-tap idempotent', testAcceptDoubleTapIdempotent],
  ['accept expired returns 410', testAcceptExpired],
  ['decline upsell offers downsell', testDeclineUpsellOffersDownsell],
  ['decline downsell ends with exit url', testDeclineDownsellEndsWithExit],
];

for (const [name, fn] of tests) {
  await fn();
  console.log(`ok - ${name}`);
}

console.log('funnel tests passed');
