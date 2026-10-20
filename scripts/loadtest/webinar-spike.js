// ─────────────────────────────────────────────────────────────────────────────
// k6 load test — Webinar Spike (GrowWithAI)
//
// Mereproduksi beban puncak saat ribuan orang membuka link webinar serentak:
//   1) BADAI BACA landing  → GET /api/public/webinars/:slug   (no-auth, edge cache)
//   2) POLLING checkout     → GET /api/checkout/:orderId/status (auth, read berat)
//   3) REGISTRASI           → POST /api/user/webinars/:id/register (auth, write)
//
// Token auth diambil SEKALI di setup() (login → cookie), lalu di-reuse — persis
// seperti user nyata yang memakai ulang cookie-nya. Ini menguji jalur session-cache
// (KV): poll pertama miss → D1, sisanya hit → KV.
//
// ⚠️  JALANKAN DI STAGING / PREVIEW, BUKAN PRODUKSI.
//     - Scenario auth butuh user test ter-seed → lihat gen-seed.mjs / README.md.
//     - ORDER_ID = satu order pending milik salah satu user test. Poll dari user
//       lain akan 404 — itu TETAP beban valid (query auth + cek-kepemilikan jalan).
//     - JANGAN uji create-payment massal ke produksi (memanggil Pakasir + buat order asli).
//
// Contoh:
//   k6 run \
//     -e BASE_URL=https://api-staging.growwithai.id \
//     -e SLUG=100m -e WEBINAR_ID=<uuid> -e ORDER_ID=<uuid-order-test> \
//     -e USER_PREFIX=loadtest+ -e USER_DOMAIN=example.com -e USER_PASSWORD=LoadTest123! \
//     -e TOKEN_POOL=200 -e LANDING_RPS=2000 -e POLL_RPS=800 \
//     -e SCENARIOS=landing,poll,register \
//     webinar-spike.js
// ─────────────────────────────────────────────────────────────────────────────

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// ─── Konfigurasi (via env) ───────────────────────────────────────────────────
const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8787').replace(/\/$/, '');
const SLUG = __ENV.SLUG || '100m';
const WEBINAR_ID = __ENV.WEBINAR_ID || '';
const ORDER_ID = __ENV.ORDER_ID || '';

const USER_PREFIX = __ENV.USER_PREFIX || 'loadtest+';
const USER_DOMAIN = __ENV.USER_DOMAIN || 'example.com';
const USER_PASSWORD = __ENV.USER_PASSWORD || 'LoadTest123!';
const TOKEN_POOL = parseInt(__ENV.TOKEN_POOL || '200', 10);

const LANDING_RPS = parseInt(__ENV.LANDING_RPS || '1000', 10);
const POLL_RPS = parseInt(__ENV.POLL_RPS || '400', 10);
const DURATION = __ENV.DURATION || '3m';

const ENABLED = (__ENV.SCENARIOS || 'landing').split(',').map((s) => s.trim());
const TOKENS_FILE = __ENV.TOKENS_FILE || 'tokens.json';

// Token session ter-seed (dari gen-seed.mjs). Dipakai LANGSUNG sebagai cookie —
// tanpa login (login di-rate-limit 5/menit per-IP; load test 1-IP tak bisa login massal).
const TOKENS = new SharedArray('tokens', () => {
  if (!(ENABLED.includes('poll') || ENABLED.includes('register'))) return [];
  try {
    return JSON.parse(open(TOKENS_FILE)).map((t) => t.token);
  } catch (e) {
    return [];
  }
});

// ─── Metrik kustom ───────────────────────────────────────────────────────────
const overloaded = new Counter('d1_overloaded_errors');
const landingLatency = new Trend('landing_latency', true);
const statusLatency = new Trend('status_latency', true);
const cacheHits = new Counter('landing_cache_hits');
const cacheMiss = new Counter('landing_cache_miss');

// ─── Scenarios ───────────────────────────────────────────────────────────────
function rampStages(rps) {
  return [
    { target: Math.ceil(rps * 0.3), duration: '30s' }, // warm-up
    { target: rps, duration: '30s' }, // spike
    { target: rps, duration: DURATION }, // sustain
    { target: 0, duration: '20s' }, // ramp-down
  ];
}

const scenarios = {};

if (ENABLED.includes('landing')) {
  scenarios.landing_read = {
    executor: 'ramping-arrival-rate',
    exec: 'landingRead',
    startRate: Math.ceil(LANDING_RPS * 0.1),
    timeUnit: '1s',
    preAllocatedVUs: Math.ceil(LANDING_RPS * 0.5),
    maxVUs: Math.ceil(LANDING_RPS * 2),
    stages: rampStages(LANDING_RPS),
  };
}

if (ENABLED.includes('poll') && ORDER_ID) {
  scenarios.poll_status = {
    executor: 'ramping-arrival-rate',
    exec: 'pollStatus',
    startRate: Math.ceil(POLL_RPS * 0.1),
    timeUnit: '1s',
    preAllocatedVUs: Math.ceil(POLL_RPS * 0.5),
    maxVUs: Math.ceil(POLL_RPS * 2),
    stages: rampStages(POLL_RPS),
  };
}

if (ENABLED.includes('register') && WEBINAR_ID) {
  scenarios.register = {
    executor: 'per-vu-iterations',
    exec: 'registerJourney',
    vus: Math.min(TOKEN_POOL, 100),
    iterations: 1,
    maxDuration: '2m',
  };
}

// Anggap status berikut "sukses" agar http_req_failed tidak terdistorsi oleh
// 404 polling (order palsu/bukan-owner) atau 201/409 registrasi.
http.setResponseCallback(http.expectedStatuses(200, 201, 404, 409));

export const options = {
  scenarios,
  thresholds: {
    http_req_failed: ['rate<0.01'], // <1% error
    http_req_duration: ['p(95)<800', 'p(99)<2000'],
    landing_latency: ['p(95)<300'], // landing harus cepat (cache edge)
    status_latency: ['p(95)<500'],
    d1_overloaded_errors: ['count<1'], // ZERO toleransi 'overloaded'
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function recordOverload(res) {
  if (res.status >= 500 && String(res.body).toLowerCase().includes('overload')) {
    overloaded.add(1);
  }
}

// ─── setup(): validasi token tersedia ────────────────────────────────────────
export function setup() {
  const needAuth = ENABLED.includes('poll') || ENABLED.includes('register');
  if (needAuth && TOKENS.length === 0) {
    throw new Error(
      `Tidak ada token session di ${TOKENS_FILE}. Jalankan gen-seed.mjs (WITH_SESSIONS=1) ` +
        `lalu apply seed.sql ke staging. Lihat README.md.`
    );
  }
  if (needAuth) console.log(`${TOKENS.length} token session siap dari ${TOKENS_FILE}`);
}

function pickToken() {
  return TOKENS[Math.floor(Math.random() * TOKENS.length)];
}

// ─── Scenario fns ─────────────────────────────────────────────────────────────

// 1) Badai baca landing (no-auth). Menguji Cache API edge + D1 read.
export function landingRead() {
  const res = http.get(`${BASE_URL}/api/public/webinars/${SLUG}`, { tags: { name: 'landing' } });
  landingLatency.add(res.timings.duration);
  recordOverload(res);
  check(res, { 'landing 200': (r) => r.status === 200 });
  const cs = res.headers['Cf-Cache-Status'] || '';
  if (cs === 'HIT') cacheHits.add(1);
  else if (cs === 'MISS') cacheMiss.add(1);
}

// 2) Polling storm pada /status — token ter-seed (warm session → uji session-cache KV).
export function pollStatus() {
  const token = pickToken();
  const res = http.get(`${BASE_URL}/api/checkout/${ORDER_ID}/status`, {
    headers: { Cookie: `session=${token}` },
    tags: { name: 'status' },
  });
  statusLatency.add(res.timings.duration);
  recordOverload(res);
  // 200 (owner) atau 404 (bukan owner) — keduanya menjalankan auth + cek kepemilikan.
  check(res, { 'status 200/404': (r) => r.status === 200 || r.status === 404 });
}

// 3) Registrasi (write sekali per VU).
export function registerJourney() {
  const token = TOKENS[(__VU - 1) % TOKENS.length];
  const res = http.post(
    `${BASE_URL}/api/user/webinars/${WEBINAR_ID}/register`,
    JSON.stringify({}),
    { headers: { 'Content-Type': 'application/json', Cookie: `session=${token}` }, tags: { name: 'register' } }
  );
  recordOverload(res);
  // 201 = terdaftar pertama kali, 200 = sudah terdaftar, 409 = kuota penuh.
  check(res, { 'register ok': (r) => r.status === 201 || r.status === 200 || r.status === 409 });
  sleep(1);
}

export default function () {
  landingRead();
}
