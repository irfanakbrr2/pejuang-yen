import routesModule from './pakasir.routes.ts';

const pakasirRoutes = routesModule.default || routesModule;

const TEST_WEBHOOK_KEY = 'whsec-test-123';
const TEST_PROJECT = 'growwithai';
const GATEWAY_ORDER_ID = 'GWA-TEST-0001';
const ORDER_AMOUNT = 501231;

// Mock global fetch — Transaction Detail API Pakasir
const _realFetch = globalThis.fetch;
const detailResponse = {
  ok: true,
  body: () => ({
    transaction: {
      order_id: GATEWAY_ORDER_ID,
      amount: ORDER_AMOUNT,
      payment_method: 'qris',
      status: 'completed',
      completed_at: '2026-06-12T08:07:02.819+07:00',
      fee: 0,
      total_payment: ORDER_AMOUNT,
    },
  }),
};
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes('app.pakasir.com/api/transactiondetail')) {
    return new Response(JSON.stringify(detailResponse.body()), { status: detailResponse.ok ? 200 : 404 });
  }
  return _realFetch(input, init);
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function makePayload(overrides = {}) {
  return {
    amount: ORDER_AMOUNT,
    order_id: GATEWAY_ORDER_ID,
    project: TEST_PROJECT,
    status: 'completed',
    payment_method: 'qris',
    completed_at: '2026-06-12T08:07:02.819+07:00',
    ...overrides,
  };
}

function makeEnv({
  duplicateEvent = false,
  attemptFound = true,
  orderFound = true,
  orderOverrides = {},
  attemptOverrides = {},
  affiliateAccount = null,
} = {}) {
  const calls = [];
  const queuedMessages = [];
  const order = {
    id: 'order-1',
    user_id: 'user-1',
    order_number: GATEWAY_ORDER_ID,
    order_type: 'membership',
    product_id: 'plan-yearly',
    product_name: 'Membership Tahunan',
    amount: ORDER_AMOUNT,
    status: 'pending',
    affiliate_code: null,
    metadata_json: JSON.stringify({
      addons: [],
      pricing: { product_amount: 499000, payment_admin_fee: 2231, total_amount: ORDER_AMOUNT },
    }),
    ...orderOverrides,
  };
  const attempt = {
    id: 'attempt-1',
    order_id: 'order-1',
    provider: 'pakasir',
    provider_transaction_id: GATEWAY_ORDER_ID,
    payment_method: 'qris',
    amount: ORDER_AMOUNT,
    status: 'pending',
    ...attemptOverrides,
  };

  const db = {
    calls,
    batch: async (statements) => {
      calls.push({ method: 'batch', count: statements.length });
      const results = [];
      for (const statement of statements) {
        results.push(await statement.run());
      }
      return results;
    },
    prepare(sql) {
      const makeBound = (args = []) => ({
        first: async () => {
          calls.push({ method: 'first', sql, args });
          if (sql.includes("FROM payments WHERE provider = 'pakasir' AND provider_transaction_id")) {
            return attemptFound ? attempt : null;
          }
          if (sql.includes('SELECT * FROM orders WHERE id = ?')) return orderFound ? order : null;
          if (sql.includes('SELECT id, name, email, phone FROM users WHERE id = ?')) {
            return { id: 'user-1', name: 'Rubi', email: 'buyer@example.com', phone: '08123456789' };
          }
          if (sql.includes('SELECT name, email FROM users WHERE id = ?')) return { name: 'Rubi', email: 'buyer@example.com' };
          if (sql.includes('SELECT user_id, default_commission_rate FROM affiliate_accounts WHERE affiliate_code = ?')) {
            return affiliateAccount;
          }
          if (sql.includes('SELECT name, duration_type, duration_days FROM membership_plans WHERE id = ?')) {
            return { name: 'Membership Tahunan', duration_type: 'yearly', duration_days: null };
          }
          if (sql.includes('SELECT value_json FROM app_settings WHERE key = ?')) {
            return null;
          }
          return null;
        },
        all: async () => {
          calls.push({ method: 'all', sql, args });
          return { results: [] };
        },
        run: async () => {
          calls.push({ method: 'run', sql, args });
          const changes = sql.includes('INSERT OR IGNORE INTO webhook_events') && duplicateEvent ? 0 : 1;
          return { success: true, meta: { changes } };
        },
      });

      return {
        ...makeBound(),
        bind(...args) {
          return makeBound(args);
        },
      };
    },
  };

  return {
    DB: db,
    calls,
    queuedMessages,
    EMAIL_SEQUENCE_QUEUE: {
      send: async (message) => {
        queuedMessages.push(message);
      },
    },
    APP_URL: 'https://app.pejuangyen.com',
    PAKASIR_PROJECT_SLUG: TEST_PROJECT,
    PAKASIR_API_KEY: 'test-api-key',
    PAKASIR_WEBHOOK_SECRET: TEST_WEBHOOK_KEY,
  };
}

async function postPakasir(payload, env, { key = TEST_WEBHOOK_KEY } = {}) {
  const qs = key === null ? '' : `?key=${encodeURIComponent(key)}`;
  return pakasirRoutes.fetch(
    new Request(`https://api.pejuangyen.com/${qs}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    env,
    { waitUntil: (promise) => promise },
  );
}

// 1. Happy path: completed + key benar + amount cocok + detail completed → fulfillment
async function testCompletedMarksPaid() {
  const env = makeEnv();
  const res = await postPakasir(makePayload(), env);
  const body = await res.json();

  assertEqual(res.status, 200, 'completed webhook should be acknowledged');
  assertEqual(body.data.message, 'Processed successfully', 'completed webhook response');
  assert(env.calls.some((call) => call.sql?.includes("UPDATE orders SET status = 'paid'")), 'must mark order paid');
  assert(env.calls.some((call) => call.sql?.includes("UPDATE payments SET status = 'paid'")), 'must mark payment attempt paid');
  assert(env.calls.some((call) => call.sql?.includes('INTO memberships')), 'must grant membership');
  assert(env.calls.some((call) => call.method === 'batch'), 'must use D1 batch for business writes');
  assert(env.queuedMessages.some((msg) => msg.type === 'send_email' && msg.recipient === 'buyer@example.com'), 'payment success email must be queued');
}

// 2. Key salah → 401 tanpa DB write
async function testWrongKeyRejected() {
  const env = makeEnv();
  const res = await postPakasir(makePayload(), env, { key: 'wrong-key' });

  assertEqual(res.status, 401, 'wrong key must be rejected');
  assertEqual(env.calls.length, 0, 'wrong key must not touch DB');
}

// 2b. Tanpa key → 401
async function testMissingKeyRejected() {
  const env = makeEnv();
  const res = await postPakasir(makePayload(), env, { key: null });

  assertEqual(res.status, 401, 'missing key must be rejected');
  assertEqual(env.calls.length, 0, 'missing key must not touch DB');
}

// 3. Project mismatch → 401
async function testProjectMismatchRejected() {
  const env = makeEnv();
  const res = await postPakasir(makePayload({ project: 'project-lain' }), env);

  assertEqual(res.status, 401, 'project mismatch must be rejected');
  assert(!env.calls.some((call) => call.method === 'batch'), 'project mismatch must not run business batch');
}

// 4. Webhook double (event id sama) → Already recorded, tanpa fulfillment kedua
async function testDuplicateEventIsIdempotent() {
  const env = makeEnv({ duplicateEvent: true });
  const res = await postPakasir(makePayload(), env);
  const body = await res.json();

  assertEqual(res.status, 200, 'duplicate event should be acknowledged');
  assertEqual(body.data.message, 'Already recorded', 'duplicate event response');
  assert(!env.calls.some((call) => call.method === 'batch'), 'duplicate event must not run business batch');
  assert(!env.calls.some((call) => call.sql?.includes("UPDATE orders SET status = 'paid'")), 'duplicate event must not mark paid again');
}

// 5. order_id tidak dikenal → event failed, 200
async function testUnknownOrderIdRecordedAsFailed() {
  const env = makeEnv({ attemptFound: false });
  const res = await postPakasir(makePayload({ order_id: 'GWA-UNKNOWN-9999' }), env);
  const body = await res.json();

  assertEqual(res.status, 200, 'unknown order should still be acknowledged');
  assertEqual(body.data.message, 'Order not found', 'unknown order response');
  assert(env.calls.some((call) => call.sql?.includes("processing_status = 'failed'") && call.args?.[0] === 'Order not found'), 'event must be marked failed');
  assert(!env.calls.some((call) => call.sql?.includes("UPDATE orders SET status = 'paid'")), 'unknown order must not mark anything paid');
}

// 6. Amount tidak cocok → event failed, tanpa grant
async function testAmountMismatchRejected() {
  const env = makeEnv();
  const res = await postPakasir(makePayload({ amount: 99999 }), env);
  const body = await res.json();

  assertEqual(res.status, 200, 'amount mismatch should be acknowledged');
  assertEqual(body.data.message, 'Amount mismatch', 'amount mismatch response');
  assert(env.calls.some((call) => call.sql?.includes("processing_status = 'failed'")), 'event must be marked failed');
  assert(!env.calls.some((call) => call.sql?.includes("UPDATE orders SET status = 'paid'")), 'amount mismatch must not mark paid');
  assert(!env.calls.some((call) => call.sql?.includes('INTO memberships')), 'amount mismatch must not grant membership');
}

// 7. Detail API bilang belum completed → 401, event failed, tanpa grant
async function testUnverifiedDetailRejected() {
  const env = makeEnv();
  const originalBody = detailResponse.body;
  detailResponse.body = () => ({
    transaction: { order_id: GATEWAY_ORDER_ID, amount: ORDER_AMOUNT, payment_method: 'qris', status: 'pending' },
  });
  try {
    const res = await postPakasir(makePayload(), env);

    assertEqual(res.status, 401, 'unverified payment must be rejected');
    assert(env.calls.some((call) => call.sql?.includes("processing_status = 'failed'")), 'event must be marked failed');
    assert(!env.calls.some((call) => call.sql?.includes("UPDATE orders SET status = 'paid'")), 'unverified payment must not mark paid');
  } finally {
    detailResponse.body = originalBody;
  }
}

// 8. Order sudah paid (retry dengan completed_at beda) → Already paid, tanpa grant ulang
async function testAlreadyPaidOrderShortCircuits() {
  const env = makeEnv({ orderOverrides: { status: 'paid' } });
  const res = await postPakasir(makePayload({ completed_at: '2026-06-12T09:00:00.000+07:00' }), env);
  const body = await res.json();

  assertEqual(res.status, 200, 'already paid order should be acknowledged');
  assertEqual(body.data.message, 'Order already paid', 'already paid response');
  assert(!env.calls.some((call) => call.sql?.includes('INTO memberships')), 'already paid order must not grant membership again');
  assert(!env.calls.some((call) => call.sql?.includes('INTO affiliate_commissions')), 'already paid order must not create commission again');
}

// 9. Status non-completed (mis. expired) → attempt diupdate, event processed, tanpa grant
async function testNonCompletedStatusRecorded() {
  const env = makeEnv();
  const res = await postPakasir(makePayload({ status: 'expired', completed_at: null }), env);
  const body = await res.json();

  assertEqual(res.status, 200, 'non-completed status should be acknowledged');
  assertEqual(body.data.message, 'Recorded', 'non-completed response');
  assert(env.calls.some((call) => call.sql?.includes('UPDATE payments SET status = ?') && call.args?.[0] === 'expired'), 'attempt must be updated to expired');
  assert(!env.calls.some((call) => call.sql?.includes("UPDATE orders SET status = 'paid'")), 'non-completed must not mark paid');
  assert(!env.calls.some((call) => call.sql?.includes('INTO memberships')), 'non-completed must not grant membership');
}

// h. Komisi affiliate tidak double — INSERT OR IGNORE + unique(order_id) struktural;
// di level webhook, event duplikat sudah berhenti di dedup (test 4) dan order paid (test 8).
async function testAffiliateCommissionCreatedOnce() {
  const env = makeEnv({
    orderOverrides: { affiliate_code: 'AFF123' },
    affiliateAccount: { user_id: 'affiliate-user', default_commission_rate: 30 },
  });
  const res = await postPakasir(makePayload(), env);

  assertEqual(res.status, 200, 'affiliate order webhook should be acknowledged');
  const commissionInserts = env.calls.filter((call) => call.sql?.includes('INSERT OR IGNORE INTO affiliate_commissions'));
  assertEqual(commissionInserts.length, 1, 'exactly one commission insert statement (INSERT OR IGNORE + unique order_id)');
}

const tests = [
  ['completed marks paid', testCompletedMarksPaid],
  ['wrong key rejected', testWrongKeyRejected],
  ['missing key rejected', testMissingKeyRejected],
  ['project mismatch rejected', testProjectMismatchRejected],
  ['duplicate event idempotent', testDuplicateEventIsIdempotent],
  ['unknown order id recorded as failed', testUnknownOrderIdRecordedAsFailed],
  ['amount mismatch rejected', testAmountMismatchRejected],
  ['unverified detail rejected', testUnverifiedDetailRejected],
  ['already paid order short circuits', testAlreadyPaidOrderShortCircuits],
  ['non-completed status recorded', testNonCompletedStatusRecorded],
  ['affiliate commission created once', testAffiliateCommissionCreatedOnce],
];

for (const [name, fn] of tests) {
  await fn();
  console.log(`ok - ${name}`);
}

console.log('pakasir webhook tests passed');
