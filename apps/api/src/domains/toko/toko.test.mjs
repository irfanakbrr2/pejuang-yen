import { TokoService } from './service.ts';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

const USER = { id: 'user-1', role: 'user' };
const STORE = {
  id: 'store-1', user_id: 'user-1', slug: 'toko-keren', name: 'Toko Keren',
  status: 'active', platform_fee_rate: null,
  payout_account_holder: 'Budi', payout_bank_name: 'BCA', payout_bank_account: '1234567890',
};

function makeEnv({
  store = STORE,
  available = 500000,
  pending = 0,
  inflightPayout = null,
  settings = { creator_payout_min_amount: 100000, creator_store_max_products: 20 },
  hasSale = null,
  recheckAvailable = null, // null = sama dengan available - amount (no race)
} = {}) {
  const calls = [];
  let balanceCallCount = 0;
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
          if (sql.includes('FROM creator_stores WHERE user_id = ?')) return store;
          if (sql.includes('FROM app_settings WHERE key = ?')) {
            const key = args[0];
            if (settings[key] != null) return { value_json: String(settings[key]) };
            return null;
          }
          if (sql.includes("FROM creator_payouts WHERE store_id = ? AND status IN ('pending', 'approved')")) return inflightPayout;
          if (sql.includes('FROM creator_earnings WHERE store_id = ?') && sql.includes('available')) {
            balanceCallCount += 1;
            // Panggilan balance kedua (re-check) bisa disimulasikan minus (race)
            if (balanceCallCount > 1 && recheckAvailable != null) {
              return { available: recheckAvailable, pending, lifetime_net: 0, lifetime_gross: 0, total_paid_out: 0 };
            }
            return { available, pending, lifetime_net: available, lifetime_gross: available, total_paid_out: 0 };
          }
          if (sql.includes("FROM creator_earnings WHERE store_id = ? AND entry_type = 'sale' LIMIT 1")) return hasSale;
          if (sql.includes('COUNT(*) as total FROM creator_products')) return { total: 0 };
          return null;
        },
        all: async () => {
          calls.push({ method: 'all', sql, args });
          return { results: [] };
        },
        run: async () => {
          calls.push({ method: 'run', sql, args });
          return { success: true, meta: { changes: 1 } };
        },
      });
      return { ...makeBound(), bind(...args) { return makeBound(args); } };
    },
  };
  return { DB: db, calls };
}

// 1. Payout happy path: debit ledger + insert payout dalam satu batch
async function testPayoutHappyPath() {
  const env = makeEnv({ available: 500000 });
  const service = new TokoService(env);
  const result = await service.requestPayout(USER, 200000);
  assert(!('error' in result), `payout must succeed: ${JSON.stringify(result)}`);
  assert(env.calls.some((c) => c.method === 'batch' && c.count === 2), 'payout must batch insert payout + ledger debit');
  const ledgerInsert = env.calls.find((c) => c.sql?.includes("'payout'") && c.method === 'run');
  assert(ledgerInsert, 'ledger debit must be inserted');
  assert(ledgerInsert.args.includes(-200000), 'ledger debit must be negative amount');
}

// 2. Payout di bawah minimum → 400
async function testPayoutBelowMinimum() {
  const env = makeEnv();
  const service = new TokoService(env);
  const result = await service.requestPayout(USER, 50000);
  assert('error' in result, 'below minimum must error');
  assertEqual(result.status, 400, 'below minimum status');
}

// 3. Payout melebihi saldo tersedia → 400
async function testPayoutExceedsBalance() {
  const env = makeEnv({ available: 100000 });
  const service = new TokoService(env);
  const result = await service.requestPayout(USER, 200000);
  assert('error' in result, 'exceeding balance must error');
}

// 4. Payout saat masih ada penarikan in-flight → 409
async function testPayoutInflightBlocked() {
  const env = makeEnv({ inflightPayout: { id: 'payout-old' } });
  const service = new TokoService(env);
  const result = await service.requestPayout(USER, 200000);
  assert('error' in result, 'inflight payout must block');
  assertEqual(result.status, 409, 'inflight payout status');
}

// 5. Race: re-check saldo minus → rollback (delete kedua row) + 409
async function testPayoutRaceRollback() {
  const env = makeEnv({ available: 200000, recheckAvailable: -50000 });
  const service = new TokoService(env);
  const result = await service.requestPayout(USER, 200000);
  assert('error' in result, 'race must be rolled back');
  assertEqual(result.status, 409, 'race rollback status');
  const deletes = env.calls.filter((c) => c.sql?.startsWith('DELETE FROM creator_'));
  assertEqual(deletes.length, 2, 'rollback must delete payout + ledger rows');
}

// 6. Rekening belum lengkap → 400
async function testPayoutNoBankInfo() {
  const env = makeEnv({ store: { ...STORE, payout_bank_account: null } });
  const service = new TokoService(env);
  const result = await service.requestPayout(USER, 200000);
  assert('error' in result, 'missing bank info must error');
}

// 7. Toko suspended → payout diblokir
async function testPayoutSuspendedStore() {
  const env = makeEnv({ store: { ...STORE, status: 'suspended' } });
  const service = new TokoService(env);
  const result = await service.requestPayout(USER, 200000);
  assert('error' in result, 'suspended store must block payout');
  assertEqual(result.status, 403, 'suspended payout status');
}

// 8. Slug toko tidak bisa diganti setelah ada penjualan
async function testSlugLockedAfterSale() {
  const env = makeEnv({ hasSale: { id: 'sale-1' } });
  const service = new TokoService(env);
  const result = await service.updateStore(USER, { slug: 'slug-baru' });
  assert('error' in result, 'slug change after sale must error');
}

// 9. Produk harga < 1000 ditolak
async function testProductMinPrice() {
  const env = makeEnv();
  const service = new TokoService(env);
  const result = await service.upsertProduct(USER, {
    slug: 'ebook-a', title: 'Ebook A', price: 500, delivery_type: 'link', external_url: 'https://x.com',
  });
  assert('error' in result, 'price below 1000 must error');
}

// 10. Produk link wajib https
async function testProductLinkHttps() {
  const env = makeEnv();
  const service = new TokoService(env);
  const result = await service.upsertProduct(USER, {
    slug: 'ebook-a', title: 'Ebook A', price: 50000, delivery_type: 'link', external_url: 'http://insecure.com',
  });
  assert('error' in result, 'non-https link must error');
}

const tests = [
  ['payout happy path (batch debit)', testPayoutHappyPath],
  ['payout below minimum rejected', testPayoutBelowMinimum],
  ['payout exceeds balance rejected', testPayoutExceedsBalance],
  ['payout inflight blocked', testPayoutInflightBlocked],
  ['payout race rolled back', testPayoutRaceRollback],
  ['payout missing bank info rejected', testPayoutNoBankInfo],
  ['payout suspended store blocked', testPayoutSuspendedStore],
  ['slug locked after sale', testSlugLockedAfterSale],
  ['product min price enforced', testProductMinPrice],
  ['product link must be https', testProductLinkHttps],
];

for (const [name, fn] of tests) {
  await fn();
  console.log(`ok - ${name}`);
}

console.log('toko tests passed');
