import { Hono } from 'hono';
import { apiReference } from '@scalar/hono-api-reference';
import type { Env } from '../../env';

const analyticsRoutes = new Hono<{ Bindings: Env }>();

// ─── Open CORS (analytics is meant for external AI tools) ────────────────────
analyticsRoutes.use('*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (c.req.method === 'OPTIONS') return c.text('', 204 as never);
  await next();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkRateLimit(kv: KVNamespace, prefix: string): Promise<boolean> {
  const min = Math.floor(Date.now() / 60000);
  const rlKey = `analytics_rl:${prefix}:${min}`;
  const cur = parseInt((await kv.get(rlKey)) ?? '0', 10);
  if (cur >= 60) return false;
  await kv.put(rlKey, String(cur + 1), { expirationTtl: 120 });
  return true;
}

// ─── Auth Middleware ─────────────────────────────────────────────────────────
analyticsRoutes.use('*', async (c, next) => {
  const path = c.req.path;
  if (path.endsWith('/openapi.json') || path.endsWith('/context') || path.endsWith('/docs') || path.endsWith('/metrics')) {
    return next();
  }

  const auth = c.req.header('Authorization') ?? '';
  const key = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!key) {
    return c.json({ success: false, error: 'Unauthorized — provide: Authorization: Bearer <API_KEY>' }, 401);
  }

  const hash = await sha256hex(key);
  const row = await c.env.DB.prepare(
    `SELECT id, key_prefix, is_active, expires_at FROM analytics_api_keys WHERE key_hash = ?`
  ).bind(hash).first() as { id: string; key_prefix: string; is_active: number; expires_at: string | null } | null;

  if (!row || !row.is_active) {
    return c.json({ success: false, error: 'Unauthorized — invalid or revoked API key' }, 401);
  }
  if (row.expires_at && row.expires_at < new Date().toISOString()) {
    return c.json({ success: false, error: 'Unauthorized — API key expired' }, 401);
  }

  const allowed = await checkRateLimit(c.env.KV, row.key_prefix);
  if (!allowed) {
    return c.json({ success: false, error: 'Rate limit exceeded — max 60 requests/minute per key' }, 429);
  }

  // fire-and-forget stats update
  c.env.DB.prepare(
    `UPDATE analytics_api_keys SET last_used_at = ?, request_count = request_count + 1 WHERE id = ?`
  ).bind(new Date().toISOString(), row.id).run().catch(console.error);

  await next();
});

// ─── Helper ──────────────────────────────────────────────────────────────────
const idr = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

const API_VERSION = '3.0.0';

// ─── Date range helper ───────────────────────────────────────────────────────
// Mendukung ?days=N (default 30, maks 730) ATAU ?from=YYYY-MM-DD (mulai tanggal,
// data hingga sekarang). fromExpr = batas bawah ISO 'YYYY-MM-DDT00:00:00.000Z'.
function dateRange(c: { req: { query: (k: string) => string | undefined } }): {
  days: number; from: string; to: string; fromExpr: string; toExpr: string;
} {
  const isIso = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const utcDate = (offset: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - offset);
    return d.toISOString().slice(0, 10);
  };
  const today = utcDate(0);
  const fromQ = c.req.query('from');
  if (isIso(fromQ)) {
    const from = fromQ as string;
    const span = Math.max(
      1,
      Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1
    );
    return { days: Math.min(span, 730), from, to: today, fromExpr: `${from}T00:00:00.000Z`, toExpr: `${today}T23:59:59.999Z` };
  }
  const raw = parseInt(c.req.query('days') || '30', 10);
  const days = Number.isFinite(raw) ? Math.min(730, Math.max(1, raw)) : 30;
  const from = utcDate(days - 1);
  return { days, from, to: today, fromExpr: `${from}T00:00:00.000Z`, toExpr: `${today}T23:59:59.999Z` };
}

// ─── Endpoint catalog — SATU sumber kebenaran untuk /context & /openapi.json ──
// Tambah endpoint baru? Cukup tambahkan handler + 1 entri di sini → otomatis
// muncul di /context dan /openapi.json (tidak akan pernah drift dari AI).
type CatalogParam = { name: string; type?: string; default?: number; max?: number; desc: string };
type CatalogEntry = { path: string; tag: string; operationId: string; summary: string; description: string; auth?: boolean; params?: CatalogParam[] };

const DAYS_ONLY: CatalogParam[] = [
  { name: 'days', type: 'integer', default: 30, max: 730, desc: 'Periode hari ke belakang (default 30, maks 730).' },
];
const DAYS_FROM: CatalogParam[] = [
  { name: 'days', type: 'integer', default: 30, max: 730, desc: 'Periode hari ke belakang (default 30, maks 730). Diabaikan jika from diisi.' },
  { name: 'from', type: 'string', desc: 'Tanggal mulai YYYY-MM-DD (data dihitung dari tanggal ini hingga sekarang).' },
];

const CATALOG: CatalogEntry[] = [
  // ── Meta (publik, tanpa key) ──
  { path: '/api/analytics/context', tag: 'Overview', operationId: 'getContext', auth: false, summary: 'Deskripsi platform + daftar seluruh endpoint (publik)', description: 'Deskripsi platform, daftar semua endpoint, dan tips untuk AI. Tidak memerlukan API key.' },
  { path: '/api/analytics/metrics', tag: 'Overview', operationId: 'getMetrics', auth: false, summary: 'Kamus metrik: arti tiap field + satuan (publik)', description: 'Daftar machine-readable semua metrik yang dikembalikan API beserta definisi & satuannya — agar AI menafsirkan angka dengan benar. Tidak memerlukan API key.' },
  { path: '/api/analytics/openapi.json', tag: 'Overview', operationId: 'getOpenApi', auth: false, summary: 'OpenAPI 3.1 spec untuk diimpor ke AI tools (publik)', description: 'Spesifikasi OpenAPI 3.1 — import ke ChatGPT/Claude/Gemini/Copilot. Tidak memerlukan API key.' },
  // ── Data inti (lama) ──
  { path: '/api/analytics/summary', tag: 'Overview', operationId: 'getSummary', summary: 'Ringkasan bisnis menyeluruh + engagement & funnel dalam satu panggilan', description: 'Total user aktif, kelas, enrollment, revenue (IDR), sertifikat, membership, plus DAU/WAU/MAU dan revenue funnel. Endpoint pertama yang sebaiknya dipanggil AI untuk gambaran umum.' },
  { path: '/api/analytics/courses', tag: 'Courses', operationId: 'getCourseStats', summary: 'Performa tiap kelas: enrollment, completion, revenue, sertifikat', description: 'Jumlah enrollment, completion rate, sertifikat terbit, dan revenue per kelas. Diurutkan by enrollment.' },
  { path: '/api/analytics/users', tag: 'Users', operationId: 'getUserStats', summary: 'Pertumbuhan user, breakdown role, konversi, top enrollers', description: 'User baru per hari, breakdown role/status, conversion paying-rate, top user by enrollment.', params: DAYS_ONLY },
  { path: '/api/analytics/revenue', tag: 'Revenue', operationId: 'getRevenueStats', summary: 'Revenue harian & per produk (IDR), perbandingan periode', description: 'Revenue harian, per produk, per tipe, dan growth vs periode sebelumnya. Semua dalam IDR.', params: DAYS_ONLY },
  { path: '/api/analytics/orders', tag: 'Orders', operationId: 'getOrdersGranular', summary: 'Order/transaksi granular per user (paginated)', description: 'Daftar transaksi detail per user (bukan agregat). Mendukung filter status & paginasi.', params: [ { name: 'days', type: 'integer', default: 30, max: 730, desc: 'Periode hari ke belakang' }, { name: 'limit', type: 'integer', default: 50, max: 100, desc: 'Item per halaman' }, { name: 'page', type: 'integer', default: 1, desc: 'Halaman ke berapa' }, { name: 'status', type: 'string', desc: 'Filter status, mis. paid / pending' } ] },
  { path: '/api/analytics/enrollments', tag: 'Courses', operationId: 'getEnrollmentStats', summary: 'Enrollment baru, progress, penyelesaian', description: 'Enrollment baru per hari, rata-rata progress, breakdown status, penyelesaian terbaru.', params: DAYS_ONLY },
  { path: '/api/analytics/certificates', tag: 'Certificates', operationId: 'getCertificateStats', summary: 'Sertifikat terbit per kelas, tren bulanan', description: 'Total sertifikat aktif/revoked, per kelas, tren bulanan, dan penerima terbaru.' },
  { path: '/api/analytics/memberships', tag: 'Memberships', operationId: 'getMembershipStats', summary: 'Membership aktif, churn, revenue subscription', description: 'Ringkasan membership aktif/expired/cancelled, per plan, dan tren bulanan.' },
  { path: '/api/analytics/affiliates', tag: 'Affiliates', operationId: 'getAffiliateStats', summary: 'Performa afiliasi: klik, konversi, komisi', description: 'Total afiliator aktif, klik, konversi, attributed revenue, dan top affiliate.' },
  // ── Data baru (v3) ──
  { path: '/api/analytics/traffic', tag: 'Traffic', operationId: 'getTraffic', summary: 'Traffic & engagement: DAU/WAU/MAU, page view, landing, device, geo, akuisisi', description: 'Active users (DAU/WAU/MAU), tren aktif harian, page view, top landing page, device, geo, sumber akuisisi (source/medium/campaign) & atribusi (first-touch/signup).', params: DAYS_FROM },
  { path: '/api/analytics/funnels', tag: 'Funnels', operationId: 'getFunnels', summary: 'Sales funnel: order-bump/upsell/downsell, take-rate, AOV uplift', description: 'Performa funnel per langkah (viewed→accepted→converted+revenue), take-rate upsell/downsell, downsell rescue rate, dan AOV uplift.', params: DAYS_FROM },
  { path: '/api/analytics/webinars', tag: 'Webinars', operationId: 'getWebinars', summary: 'Corong webinar: registrasi→hadir→konversi + revenue', description: 'Funnel webinar: registrasi, kehadiran (attendance rate), konversi ke pembelian, attributed revenue, dan breakdown status membership saat registrasi.', params: DAYS_FROM },
  { path: '/api/analytics/retention', tag: 'Retention', operationId: 'getRetention', summary: 'Cohort retention, churn/renewal membership, time-to-convert', description: 'Cohort retention bulanan (12 bulan), pergerakan membership (new/churn/active + churn_rate), dan distribusi waktu signup→pembelian pertama. Berbasis bulan (tanpa parameter).' },
  { path: '/api/analytics/payments', tag: 'Payments', operationId: 'getPaymentHealth', summary: 'Kesehatan pembayaran: success rate, retry recovery, gateway fee', description: 'Success rate per metode/provider, failed rate, pemulihan via retry, dan total biaya gateway (IDR).', params: DAYS_FROM },
  { path: '/api/analytics/products', tag: 'Products', operationId: 'getProducts', summary: 'Penjualan produk digital & ekonomi kredit AI tools', description: 'Katalog & penjualan produk digital (IDR) plus ekonomi kredit AI tools: dibeli, terpakai, saldo outstanding, revenue, top tools.', params: DAYS_FROM },
  { path: '/api/analytics/gamification', tag: 'Gamification', operationId: 'getGamification', summary: 'Gamifikasi: check-in, distribusi streak, badge, poin', description: 'Daily check-in, total poin diberikan, distribusi streak user aktif, dan badge terpopuler.', params: DAYS_FROM },
  { path: '/api/analytics/coupons', tag: 'Coupons', operationId: 'getCoupons', summary: 'Performa kupon & ROI diskon', description: 'Kupon paling banyak ditebus (diskon vs revenue), total redemption, dan daftar kupon aktif. Semua IDR.', params: DAYS_FROM },
  { path: '/api/analytics/community', tag: 'Community', operationId: 'getCommunity', summary: 'Aktivitas komunitas: post, komentar, like, top kontributor', description: 'Jumlah post/komentar/like, breakdown post published vs pending, dan top kontributor.', params: DAYS_FROM },
  { path: '/api/analytics/email', tag: 'Email', operationId: 'getEmail', summary: 'Email marketing: campaign, sequence, event, suppression', description: 'Total kirim/open/click/bounce/unsub + rate, campaign terbaru, performa sequence, breakdown event, dan pertumbuhan suppression.', params: DAYS_FROM },
  // ── Data baru (v3.1) ──
  { path: '/api/analytics/member-health', tag: 'Retention', operationId: 'getMemberHealth', summary: 'Kesehatan member berbayar: active / at-risk / dormant', description: 'Segmentasi member berbayar (membership aktif) berdasarkan aktivitas terakhir: active (≥3 hari aktif dalam 30 hari), at_risk (ada aktivitas tapi <3 hari), dormant (tak ada aktivitas 14 hari). Untuk aksi retensi & antisipasi churn, bukan sekadar observasi traffic.' },
  { path: '/api/analytics/learning', tag: 'Courses', operationId: 'getLearning', summary: 'Drop-off level lesson & learner berisiko (di lesson mana orang berhenti)', description: 'Engagement level-lesson: rata-rata watch% per lesson, ringkasan drop-off per kelas + lesson dengan penurunan tertajam, plus daftar buyer berprogres rendah. Melengkapi /courses (yang hanya level kelas).' },
  { path: '/api/analytics/creator', tag: 'Creator', operationId: 'getCreator', summary: 'Ekonomi Creator Store: GMV, fee platform, earning & payout creator', description: 'Marketplace creator (UGC): jumlah store/produk, penjualan (GMV) & fee platform per periode, net earning creator, saldo terutang ke creator (liability), status payout, dan top creator. Semua IDR.', params: DAYS_FROM },
];

// ─── Metric dictionary — dipakai GET /metrics agar AI paham arti angka ────────
type MetricDef = { endpoint: string; key: string; description: string; unit: string };
const METRICS_CATALOG: MetricDef[] = [
  { endpoint: '/summary', key: 'revenue.total_idr', description: 'Total pendapatan paid sepanjang waktu', unit: 'idr' },
  { endpoint: '/summary', key: 'enrollments.completion_rate_pct', description: 'completed/total enrollment', unit: 'percent' },
  { endpoint: '/summary', key: 'engagement.dau|wau|mau', description: 'User unik aktif hari ini / 7 hari / 30 hari', unit: 'count' },
  { endpoint: '/summary', key: 'funnels.total_revenue_idr', description: 'Revenue dari seluruh offer funnel yang converted', unit: 'idr' },
  { endpoint: '/traffic', key: 'dau|wau|mau', description: 'Active users snapshot (today/7d/30d), independen dari periode', unit: 'count' },
  { endpoint: '/traffic', key: 'acquisition[]', description: 'Per source/medium/campaign: signups, checkouts, payments, revenue', unit: 'list' },
  { endpoint: '/funnels', key: 'accept_rate', description: 'accepted/viewed per langkah funnel', unit: 'ratio_0_1' },
  { endpoint: '/funnels', key: 'downsell_rescue_rate', description: 'downsell converted / upsell declined', unit: 'ratio_0_1' },
  { endpoint: '/funnels', key: 'aov_uplift.combined_aov_idr', description: 'AOV gabungan = base + uplift dari funnel', unit: 'idr' },
  { endpoint: '/webinars', key: 'summary.attendance_rate', description: 'attended/registered', unit: 'ratio_0_1' },
  { endpoint: '/webinars', key: 'summary.conversion_rate', description: 'converted/registered (registran yang membeli setelah daftar)', unit: 'ratio_0_1' },
  { endpoint: '/retention', key: 'cohorts[].retained[].pct', description: '% cohort signup yang masih aktif di bulan ke-N', unit: 'percent' },
  { endpoint: '/retention', key: 'membership_movement[].churn_rate', description: 'churned / (active_end + churned) per bulan', unit: 'ratio_0_1' },
  { endpoint: '/retention', key: 'time_to_convert.median_days', description: 'Median hari signup→pembelian pertama', unit: 'days' },
  { endpoint: '/payments', key: 'method_success[].success_rate', description: 'paid/(paid+failed) per metode', unit: 'ratio_0_1' },
  { endpoint: '/payments', key: 'retry_recovery.recovery_rate', description: 'order retry yang akhirnya paid', unit: 'ratio_0_1' },
  { endpoint: '/payments', key: 'gateway_fee.total_fee_idr', description: 'Total biaya gateway dari payment paid', unit: 'idr' },
  { endpoint: '/products', key: 'digital_products.total_revenue_idr', description: 'Total revenue produk digital', unit: 'idr' },
  { endpoint: '/products', key: 'tool_credits.outstanding_balance', description: 'Saldo kredit tool yang belum terpakai (liability)', unit: 'count' },
  { endpoint: '/gamification', key: 'streak_distribution[].users', description: 'Jumlah user per bucket streak (0/1-6/7-29/30+)', unit: 'count' },
  { endpoint: '/coupons', key: 'top_coupons[].discount_pct_of_revenue', description: 'Diskon sebagai % dari revenue order berkupon', unit: 'percent' },
  { endpoint: '/community', key: 'top_contributors[].total', description: 'post + komentar per user dalam periode', unit: 'count' },
  { endpoint: '/email', key: 'totals.open_rate|click_rate|bounce_rate|unsub_rate', description: 'Rasio terhadap sent_count', unit: 'percent' },
  { endpoint: '/affiliates', key: 'summary.conversion_rate_pct', description: 'konversi/klik', unit: 'percent' },
  { endpoint: '/member-health', key: 'counts.active|at_risk|dormant', description: 'Jumlah member berbayar per segmen kesehatan', unit: 'count' },
  { endpoint: '/member-health', key: 'at_risk[]|dormant[].active_days_30', description: 'Hari aktif member dalam 30 hari terakhir', unit: 'count' },
  { endpoint: '/learning', key: 'course_dropoff_summary[].avg_watch_percent', description: 'Rata-rata watch% seluruh lesson published per kelas (makin rendah = drop-off makin tajam)', unit: 'percent' },
  { endpoint: '/learning', key: 'lesson_dropoff[].avg_watch_percent', description: 'Rata-rata watch% per lesson (urut sesuai kelas & urutan lesson)', unit: 'percent' },
  { endpoint: '/creator', key: 'sales.gmv_idr', description: 'Gross Merchandise Value penjualan creator dalam periode', unit: 'idr' },
  { endpoint: '/creator', key: 'sales.platform_fee_idr', description: 'Fee platform (revenue app) dari penjualan creator dalam periode', unit: 'idr' },
  { endpoint: '/creator', key: 'outstanding_creator_balance_idr', description: 'Saldo bersih terutang ke creator (liability, all-time)', unit: 'idr' },
];

// ─── GET /api/analytics/context  (PUBLIC — no key) ───────────────────────────
// Plain-language description of the platform for AI tools
analyticsRoutes.get('/context', (c) => {
  return c.json({
    platform: 'PejuangYen',
    description: 'Platform kelas online AI berbasis subscription di Indonesia: kursus video, sertifikat, membership, sales funnel, webinar, AI tools berkredit, afiliasi, dan komunitas. Semua nilai uang dalam IDR.',
    base_url: c.env.APP_URL || 'https://app.pejuangyen.com',
    currency: 'IDR (Indonesian Rupiah)',
    language: 'Bahasa Indonesia',
    api_version: API_VERSION,
    // Di-generate dari CATALOG → selalu sinkron dengan endpoint yang ada.
    available_endpoints: CATALOG.map((e) => ({
      path: e.path,
      auth: e.auth !== false,
      description: e.summary,
      ...(e.params && e.params.length ? { params: e.params.map((p) => p.name) } : {}),
    })),
    authentication: 'Bearer token — generate API key di Admin → Developer → API Keys, lalu set header: Authorization: Bearer <key>',
    tips_for_ai: [
      'Mulai dari /summary untuk gambaran bisnis menyeluruh dalam satu panggilan',
      'Panggil /metrics untuk kamus arti tiap field + satuannya (count/idr/ratio/percent)',
      'Semua nilai uang dalam IDR (Rupiah); field *_formatted tersedia untuk tampilan',
      'Time-series: ?days=N (maks 730) atau ?from=YYYY-MM-DD untuk mulai dari tanggal tertentu',
      'Rasio dikembalikan 0..1 (kalikan 100 untuk persen); field bernama *_pct/*_rate sudah persen',
      'Field generated_at menunjukkan kapan data diambil (realtime dari database)',
    ],
  });
});

// ─── GET /api/analytics/docs  (PUBLIC — Scalar UI) ───────────────────────────
analyticsRoutes.get(
  '/docs',
  apiReference({
    theme: 'purple',
    spec: { url: '/api/analytics/openapi.json' },
  })
);

// ─── GET /api/analytics/openapi.json  (PUBLIC — no key) ──────────────────────
analyticsRoutes.get('/openapi.json', async (c) => {
  const base = (c.env.APP_URL || 'https://app.pejuangyen.com').replace('app.', 'api.');
  const tags = [...new Set(CATALOG.map((e) => e.tag))].map((name) => ({ name }));
  const paths: Record<string, unknown> = {};
  for (const e of CATALOG) {
    paths[e.path] = {
      get: {
        tags: [e.tag],
        operationId: e.operationId,
        summary: e.summary,
        description: e.description,
        ...(e.auth === false ? { security: [] } : {}),
        parameters: (e.params || []).map((p) => ({
          name: p.name,
          in: 'query',
          required: false,
          schema: {
            type: p.type || 'string',
            ...(p.default !== undefined ? { default: p.default } : {}),
            ...(p.max !== undefined ? { maximum: p.max } : {}),
          },
          description: p.desc,
        })),
        responses: { '200': { description: 'Berhasil' } },
      },
    };
  }
  return c.json({
    openapi: '3.1.0',
    info: {
      title: 'PejuangYen Analytics API',
      version: API_VERSION,
      description: 'Analytics API real-time untuk platform PejuangYen (Indonesia). Data bisnis lengkap: user, kelas, revenue (IDR), sertifikat, membership, traffic/engagement, sales funnel, webinar, retensi, pembayaran, produk digital & kredit AI, gamifikasi, kupon, komunitas, email, afiliasi. Semua nilai uang dalam IDR. Lihat /api/analytics/metrics untuk kamus metrik.',
    },
    servers: [{ url: base, description: 'PejuangYen API' }],
    security: [{ BearerAuth: [] }],
    tags,
    paths,
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http', scheme: 'bearer',
          description: 'API key — generate di Admin → Developer → API Keys. Header: Authorization: Bearer <key>',
        },
      },
    },
  });
});

// ─── GET /api/analytics/metrics  (PUBLIC — no key) ───────────────────────────
// Kamus metrik machine-readable agar AI menafsirkan angka dengan benar.
analyticsRoutes.get('/metrics', (c) => {
  return c.json({
    success: true,
    generated_at: new Date().toISOString(),
    api_version: API_VERSION,
    description: 'Kamus metrik: arti tiap field yang dikembalikan endpoint analytics + satuannya.',
    units: {
      count: 'jumlah/bilangan bulat',
      idr: 'Rupiah (nilai uang)',
      ratio_0_1: 'rasio 0..1 (kalikan 100 untuk persen)',
      percent: 'persen 0..100',
      days: 'hari',
      months: 'bulan',
      series: 'deret waktu (array per tanggal)',
      list: 'daftar/array objek',
    },
    metrics: METRICS_CATALOG,
  });
});

// ─── GET /api/analytics/summary ───────────────────────────────────────────────
analyticsRoutes.get('/summary', async (c) => {
  const db = c.env.DB;
  const utcDay = (o: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - o); return d.toISOString().slice(0, 10); };
  const today = utcDay(0), d7 = utcDay(6), d30 = utcDay(29);
  const [users, newUsers, buyers, courses, enrollments, certs, newCerts, revenue, rev30d, activeMs, engagement, funnelAgg] = await Promise.all([
    db.prepare("SELECT COUNT(*) as n FROM users WHERE status = 'active'").first(),
    db.prepare("SELECT COUNT(*) as n FROM users WHERE created_at >= datetime('now','-30 days')").first(),
    db.prepare("SELECT COUNT(DISTINCT user_id) as n FROM orders WHERE status = 'paid' AND paid_at >= datetime('now','-30 days')").first(),
    db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN status='published' THEN 1 ELSE 0 END) as published FROM courses").first(),
    db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN completed_at IS NOT NULL THEN 1 ELSE 0 END) as completed FROM enrollments").first(),
    db.prepare("SELECT COUNT(*) as n FROM certificates WHERE revoked_at IS NULL").first(),
    db.prepare("SELECT COUNT(*) as n FROM certificates WHERE revoked_at IS NULL AND issued_at >= datetime('now','-30 days')").first(),
    db.prepare("SELECT COALESCE(SUM(amount),0) as n FROM payments WHERE status='paid'").first(),
    db.prepare("SELECT COALESCE(SUM(amount),0) as n FROM payments WHERE status='paid' AND COALESCE(paid_at, created_at) >= datetime('now','-30 days')").first(),
    db.prepare(`
      SELECT 
        COUNT(*) as total_active,
        SUM(CASE WHEN m.source_order_id IS NOT NULL AND COALESCE(o.amount, 0) > 0 THEN 1 ELSE 0 END) as paid_active,
        SUM(CASE WHEN m.source_order_id IS NULL OR COALESCE(o.amount, 0) <= 0 THEN 1 ELSE 0 END) as free_active
      FROM memberships m
      LEFT JOIN orders o ON m.source_order_id = o.id
      WHERE m.status='active' AND (m.expires_at IS NULL OR m.expires_at > datetime('now'))
    `).first(),
    db.prepare("SELECT (SELECT COUNT(DISTINCT user_id) FROM user_activity_days WHERE activity_date=?) as dau, (SELECT COUNT(DISTINCT user_id) FROM user_activity_days WHERE activity_date>=?) as wau, (SELECT COUNT(DISTINCT user_id) FROM user_activity_days WHERE activity_date>=?) as mau").bind(today, d7, d30).first(),
    db.prepare("SELECT (SELECT COUNT(*) FROM funnels WHERE status='active') as active_funnels, (SELECT COALESCE(SUM(amount),0) FROM funnel_events WHERE event_type='converted') as funnel_revenue").first(),
  ]);

  const totalRev = (revenue?.n as number) ?? 0;
  const rev30 = (rev30d?.n as number) ?? 0;
  const totalEnr = (enrollments?.total as number) ?? 0;
  const completedEnr = (enrollments?.completed as number) ?? 0;

  return c.json({
    success: true,
    generated_at: new Date().toISOString(),
    data: {
      users: {
        total_active: users?.n ?? 0,
        new_last_30d: newUsers?.n ?? 0,
        buyers_last_30d: buyers?.n ?? 0,
      },
      courses: {
        total: courses?.total ?? 0,
        published: courses?.published ?? 0,
        draft: (courses?.total as number ?? 0) - (courses?.published as number ?? 0),
      },
      enrollments: {
        total: totalEnr,
        completed: completedEnr,
        completion_rate_pct: totalEnr ? Math.round((completedEnr / totalEnr) * 100) : 0,
      },
      revenue: {
        total_idr: totalRev,
        total_idr_formatted: idr(totalRev),
        last_30d_idr: rev30,
        last_30d_formatted: idr(rev30),
      },
      certificates: {
        total_issued: certs?.n ?? 0,
        issued_last_30d: newCerts?.n ?? 0,
      },
      memberships: {
        active: activeMs?.total_active ?? 0,
        paid_active: activeMs?.paid_active ?? 0,
        free_active: activeMs?.free_active ?? 0,
      },
      engagement: {
        dau: engagement?.dau ?? 0,
        wau: engagement?.wau ?? 0,
        mau: engagement?.mau ?? 0,
      },
      funnels: {
        active_funnels: funnelAgg?.active_funnels ?? 0,
        total_revenue_idr: (funnelAgg?.funnel_revenue as number) ?? 0,
        total_revenue_formatted: idr((funnelAgg?.funnel_revenue as number) ?? 0),
      },
    },
  });
});

// ─── GET /api/analytics/courses ───────────────────────────────────────────────
analyticsRoutes.get('/courses', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT co.id, co.title, co.category, co.level, co.access_type, co.price, co.status,
            co.created_at,
            COUNT(DISTINCT e.id)                                                          AS total_enrollments,
            COUNT(DISTINCT CASE WHEN e.completed_at IS NOT NULL THEN e.id END)            AS completed_enrollments,
            ROUND(AVG(e.progress_percent), 1)                                             AS avg_progress_pct,
            COUNT(DISTINCT cert.id)                                                       AS certificates_issued,
            COALESCE(SUM(p.amount), 0)                                                    AS revenue_idr,
            (SELECT COUNT(*) FROM lessons l WHERE l.course_id = co.id AND l.status='published') AS total_lessons
     FROM courses co
     LEFT JOIN enrollments e    ON e.course_id = co.id
     LEFT JOIN certificates cert ON cert.course_id = co.id AND cert.revoked_at IS NULL
     LEFT JOIN orders o          ON o.product_id = co.id
     LEFT JOIN payments p        ON p.order_id = o.id AND p.status = 'paid'
     GROUP BY co.id
     ORDER BY total_enrollments DESC`
  ).all();

  const data = (rows.results as any[]).map(r => ({
    id: r.id,
    title: r.title,
    category: r.category ?? null,
    level: r.level ?? null,
    access_type: r.access_type,
    price_idr: r.price,
    price_idr_formatted: idr(r.price),
    status: r.status,
    total_lessons: r.total_lessons,
    total_enrollments: r.total_enrollments,
    completed_enrollments: r.completed_enrollments,
    completion_rate_pct: r.total_enrollments
      ? Math.round((r.completed_enrollments / r.total_enrollments) * 100)
      : 0,
    avg_progress_pct: r.avg_progress_pct ?? 0,
    certificates_issued: r.certificates_issued,
    revenue_idr: r.revenue_idr,
    revenue_idr_formatted: idr(r.revenue_idr),
    created_at: r.created_at,
  }));

  return c.json({ success: true, generated_at: new Date().toISOString(), total: data.length, data });
});

// ─── GET /api/analytics/users ────────────────────────────────────────────────
analyticsRoutes.get('/users', async (c) => {
  const days = Math.min(parseInt(c.req.query('days') || '30', 10), 730);
  const db = c.env.DB;

  const [roles, daily, topEnrollers, retention] = await Promise.all([
    db.prepare("SELECT role, status, COUNT(*) as count FROM users GROUP BY role, status ORDER BY count DESC").all(),
    db.prepare(
      `SELECT date(created_at) as date, COUNT(*) as new_users
       FROM users WHERE created_at >= datetime('now', ?) GROUP BY date(created_at) ORDER BY date ASC`
    ).bind(`-${days} days`).all(),
    db.prepare(
      `SELECT u.name, u.created_at, u.role,
              COUNT(e.id) as enrollment_count,
              COUNT(CASE WHEN e.completed_at IS NOT NULL THEN 1 END) as completed_count
       FROM users u LEFT JOIN enrollments e ON e.user_id = u.id
       GROUP BY u.id ORDER BY enrollment_count DESC LIMIT 15`
    ).all(),
    db.prepare(
      `SELECT
         COUNT(DISTINCT CASE WHEN o.status='paid' THEN o.user_id END) as paying_users,
         COUNT(DISTINCT CASE WHEN m.status='active' THEN m.user_id END) as members,
         COUNT(DISTINCT u.id) as total_active
       FROM users u
       LEFT JOIN orders o ON o.user_id = u.id
       LEFT JOIN memberships m ON m.user_id = u.id AND m.status = 'active'
       WHERE u.status = 'active'`
    ).first(),
  ]);

  return c.json({
    success: true,
    generated_at: new Date().toISOString(),
    period_days: days,
    data: {
      breakdown_by_role_status: roles.results,
      conversion: {
        total_active_users: retention?.total_active ?? 0,
        paying_users: retention?.paying_users ?? 0,
        active_members: retention?.members ?? 0,
        paying_rate_pct: retention?.total_active
          ? Math.round(((retention.paying_users as number) / (retention.total_active as number)) * 100)
          : 0,
      },
      new_users_daily: daily.results,
      top_users_by_enrollment: topEnrollers.results,
    },
  });
});

// ─── GET /api/analytics/revenue ──────────────────────────────────────────────
analyticsRoutes.get('/revenue', async (c) => {
  const days = Math.min(parseInt(c.req.query('days') || '30', 10), 730);
  const db = c.env.DB;

  const [daily, byProduct, byType, totals, prevPeriod, dailyByProduct] = await Promise.all([
    db.prepare(
      `SELECT date(COALESCE(p.paid_at, p.created_at)) as date, COUNT(*) as transactions, SUM(p.amount) as revenue_idr
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE p.status='paid' AND COALESCE(p.paid_at, p.created_at) >= datetime('now', ?)
       GROUP BY date(COALESCE(p.paid_at, p.created_at)) ORDER BY date ASC`
    ).bind(`-${days} days`).all(),
    db.prepare(
      `SELECT o.product_name, o.order_type, COUNT(*) as transactions,
              SUM(p.amount) as revenue_idr, AVG(p.amount) as avg_order_idr
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE p.status='paid'
       GROUP BY o.product_name, o.order_type ORDER BY revenue_idr DESC LIMIT 20`
    ).all(),
    db.prepare(
      `SELECT o.order_type, COUNT(*) as transactions, SUM(p.amount) as revenue_idr
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE p.status='paid' GROUP BY o.order_type`
    ).all(),
    db.prepare(
      `SELECT COUNT(*) as paid_orders, COALESCE(SUM(amount),0) as revenue_idr,
              COUNT(CASE WHEN COALESCE(paid_at, created_at) >= datetime('now', ?) THEN 1 END) as orders_period,
              COALESCE(SUM(CASE WHEN COALESCE(paid_at, created_at) >= datetime('now', ?) THEN amount ELSE 0 END),0) as revenue_period_idr
       FROM payments WHERE status='paid'`
    ).bind(`-${days} days`, `-${days} days`).first(),
    db.prepare(
      `SELECT COALESCE(SUM(amount),0) as revenue_idr, COUNT(*) as orders
       FROM payments WHERE status='paid'
         AND COALESCE(paid_at, created_at) >= datetime('now', ?)
         AND COALESCE(paid_at, created_at) < datetime('now', ?)`
    ).bind(`-${days * 2} days`, `-${days} days`).first(),
    db.prepare(
      `SELECT date(COALESCE(p.paid_at, p.created_at)) as date, o.product_name, o.order_type, COUNT(*) as transactions, SUM(p.amount) as revenue_idr
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE p.status='paid' AND COALESCE(p.paid_at, p.created_at) >= datetime('now', ?)
       GROUP BY date(COALESCE(p.paid_at, p.created_at)), o.product_name, o.order_type ORDER BY date ASC`
    ).bind(`-${days} days`).all(),
  ]);

  const curRev = (totals?.revenue_period_idr as number) ?? 0;
  const prevRev = (prevPeriod?.revenue_idr as number) ?? 0;
  const growthPct = prevRev > 0 ? Math.round(((curRev - prevRev) / prevRev) * 100) : null;

  return c.json({
    success: true,
    generated_at: new Date().toISOString(),
    period_days: days,
    data: {
      summary: {
        total_revenue_idr: totals?.revenue_idr ?? 0,
        total_revenue_formatted: idr((totals?.revenue_idr as number) ?? 0),
        total_paid_orders: totals?.paid_orders ?? 0,
        this_period_idr: curRev,
        this_period_formatted: idr(curRev),
        prev_period_idr: prevRev,
        prev_period_formatted: idr(prevRev),
        growth_pct: growthPct,
        this_period_orders: totals?.orders_period ?? 0,
      },
      by_type: byType.results,
      top_products: (byProduct.results as any[]).map(r => ({
        product_name: r.product_name,
        order_type: r.order_type,
        transactions: r.transactions,
        revenue_idr: r.revenue_idr,
        revenue_formatted: idr(r.revenue_idr),
        avg_order_idr: Math.round(r.avg_order_idr),
        avg_order_formatted: idr(Math.round(r.avg_order_idr)),
      })),
      daily: daily.results,
      daily_by_product: dailyByProduct.results,
    },
  });
});

// ─── GET /api/analytics/enrollments ──────────────────────────────────────────
analyticsRoutes.get('/enrollments', async (c) => {
  const days = Math.min(parseInt(c.req.query('days') || '30', 10), 730);
  const db = c.env.DB;

  const [daily, progress, recentCompletions, byCourse] = await Promise.all([
    db.prepare(
      `SELECT date(enrolled_at) as date, COUNT(*) as new_enrollments
       FROM enrollments WHERE enrolled_at >= datetime('now', ?)
       GROUP BY date(enrolled_at) ORDER BY date ASC`
    ).bind(`-${days} days`).all(),
    db.prepare(
      `SELECT COUNT(*) as total, ROUND(AVG(progress_percent),1) as avg_progress_pct,
              COUNT(CASE WHEN completed_at IS NOT NULL THEN 1 END) as completed,
              COUNT(CASE WHEN progress_percent = 0 THEN 1 END) as not_started,
              COUNT(CASE WHEN progress_percent > 0 AND completed_at IS NULL THEN 1 END) as in_progress
       FROM enrollments`
    ).first(),
    db.prepare(
      `SELECT u.name, co.title as course_title, e.completed_at, e.progress_percent
       FROM enrollments e JOIN users u ON e.user_id = u.id JOIN courses co ON e.course_id = co.id
       WHERE e.completed_at IS NOT NULL ORDER BY e.completed_at DESC LIMIT 10`
    ).all(),
    db.prepare(
      `SELECT co.title, COUNT(e.id) as enrollments,
              COUNT(CASE WHEN e.completed_at IS NOT NULL THEN 1 END) as completed
       FROM enrollments e JOIN courses co ON e.course_id = co.id
       GROUP BY e.course_id ORDER BY enrollments DESC`
    ).all(),
  ]);

  const total = (progress?.total as number) ?? 0;
  const completed = (progress?.completed as number) ?? 0;

  return c.json({
    success: true,
    generated_at: new Date().toISOString(),
    period_days: days,
    data: {
      overall: {
        total, completed,
        not_started: progress?.not_started ?? 0,
        in_progress: progress?.in_progress ?? 0,
        avg_progress_pct: progress?.avg_progress_pct ?? 0,
        completion_rate_pct: total ? Math.round((completed / total) * 100) : 0,
      },
      new_enrollments_daily: daily.results,
      by_course: byCourse.results,
      recent_completions: recentCompletions.results,
    },
  });
});

// ─── GET /api/analytics/certificates ─────────────────────────────────────────
analyticsRoutes.get('/certificates', async (c) => {
  const db = c.env.DB;

  const [totals, byCourse, monthly, recent] = await Promise.all([
    db.prepare(
      `SELECT COUNT(*) as total,
              COUNT(CASE WHEN revoked_at IS NULL THEN 1 END) as active,
              COUNT(CASE WHEN revoked_at IS NOT NULL THEN 1 END) as revoked,
              COUNT(CASE WHEN issued_at >= datetime('now','-30 days') AND revoked_at IS NULL THEN 1 END) as last_30d
       FROM certificates`
    ).first(),
    db.prepare(
      `SELECT co.title, COUNT(cert.id) as certificates_issued,
              COUNT(CASE WHEN cert.revoked_at IS NOT NULL THEN 1 END) as revoked
       FROM certificates cert JOIN courses co ON cert.course_id = co.id
       GROUP BY cert.course_id ORDER BY certificates_issued DESC`
    ).all(),
    db.prepare(
      `SELECT strftime('%Y-%m', issued_at) as month, COUNT(*) as issued
       FROM certificates WHERE revoked_at IS NULL
       GROUP BY month ORDER BY month DESC LIMIT 12`
    ).all(),
    db.prepare(
      `SELECT cert.certificate_number, u.name as user_name, co.title as course_title, cert.issued_at
       FROM certificates cert JOIN users u ON cert.user_id = u.id JOIN courses co ON cert.course_id = co.id
       WHERE cert.revoked_at IS NULL ORDER BY cert.issued_at DESC LIMIT 10`
    ).all(),
  ]);

  return c.json({
    success: true,
    generated_at: new Date().toISOString(),
    data: {
      totals,
      by_course: byCourse.results,
      monthly_trend: monthly.results,
      recent_issued: recent.results,
    },
  });
});

// ─── GET /api/analytics/memberships ──────────────────────────────────────────
analyticsRoutes.get('/memberships', async (c) => {
  const db = c.env.DB;

  const [summary, byPlan, monthly] = await Promise.all([
    db.prepare(
      `SELECT
         COUNT(*) as total,
         COUNT(CASE WHEN m.status='active' AND (m.expires_at IS NULL OR m.expires_at > datetime('now')) THEN 1 END) as active,
         SUM(CASE WHEN m.status='active' AND (m.expires_at IS NULL OR m.expires_at > datetime('now')) AND m.source_order_id IS NOT NULL AND COALESCE(o.amount, 0) > 0 THEN 1 ELSE 0 END) as paid_active,
         SUM(CASE WHEN m.status='active' AND (m.expires_at IS NULL OR m.expires_at > datetime('now')) AND (m.source_order_id IS NULL OR COALESCE(o.amount, 0) <= 0) THEN 1 ELSE 0 END) as free_active,
         COUNT(CASE WHEN m.status='cancelled' THEN 1 END) as cancelled,
         COUNT(CASE WHEN m.expires_at IS NOT NULL AND m.expires_at <= datetime('now') THEN 1 END) as expired,
         COUNT(CASE WHEN m.created_at >= datetime('now','-30 days') THEN 1 END) as new_last_30d
       FROM memberships m
       LEFT JOIN orders o ON m.source_order_id = o.id`
    ).first(),
    db.prepare(
      `SELECT mp.name as plan_name, mp.price as price_idr, mp.duration_type, mp.duration_days,
              COUNT(m.id) as total_members,
              COUNT(CASE WHEN m.status='active' AND (m.expires_at IS NULL OR m.expires_at > datetime('now')) THEN 1 END) as active_members
       FROM membership_plans mp LEFT JOIN memberships m ON m.plan_id = mp.id
       GROUP BY mp.id ORDER BY active_members DESC`
    ).all(),
    db.prepare(
      `SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as new_memberships
       FROM memberships GROUP BY month ORDER BY month DESC LIMIT 12`
    ).all(),
  ]);

  return c.json({
    success: true,
    generated_at: new Date().toISOString(),
    data: { summary, by_plan: byPlan.results, monthly_trend: monthly.results },
  });
});

// ─── GET /api/analytics/affiliates ───────────────────────────────────────────
analyticsRoutes.get('/affiliates', async (c) => {
  const db = c.env.DB;

  const [summary, topAffiliates] = await Promise.all([
    db.prepare(
      // Definisi resmi:
      //   LEAD       = referral → SIGNUP  (sumber: affiliate_attributions; order_id selalu NULL)
      //   CONVERSION = referral → PENJUALAN(sumber: affiliate_commissions, status terbayar/pending)
      // conversion_rate = conversions / clicks ; lead_rate = leads / clicks.
      // Subquery agar fan-out (klik vs lead vs komisi) tidak saling menggandakan.
      `SELECT
         (SELECT COUNT(*) FROM affiliate_accounts) as total_affiliates,
         (SELECT COUNT(*) FROM affiliate_accounts WHERE status='active') as active_affiliates,
         (SELECT COUNT(*) FROM affiliate_clicks) as total_clicks,
         (SELECT COUNT(*) FROM affiliate_attributions) as total_leads,
         (SELECT COUNT(*) FROM affiliate_commissions WHERE status IN ('pending','approved','paid')) as total_conversions,
         (SELECT COALESCE(SUM(amount), 0) FROM affiliate_commissions WHERE status IN ('pending','approved','paid')) as total_attributed_revenue_idr,
         (SELECT COALESCE(SUM(commission_amount), 0) FROM affiliate_commissions WHERE status IN ('pending','approved','paid')) as total_commission_idr`
    ).first(),
    db.prepare(
      `SELECT u.name, aa.affiliate_code, aa.status,
              (SELECT COUNT(*) FROM affiliate_clicks ac WHERE ac.affiliate_code = aa.affiliate_code) as clicks,
              (SELECT COUNT(*) FROM affiliate_attributions a WHERE a.affiliate_code = aa.affiliate_code) as leads,
              (SELECT COUNT(*) FROM affiliate_commissions c WHERE c.affiliate_code = aa.affiliate_code AND c.status IN ('pending','approved','paid')) as conversions,
              (SELECT COALESCE(SUM(amount), 0) FROM affiliate_commissions c WHERE c.affiliate_code = aa.affiliate_code AND c.status IN ('pending','approved','paid')) as attributed_revenue_idr,
              (SELECT COALESCE(SUM(commission_amount), 0) FROM affiliate_commissions c WHERE c.affiliate_code = aa.affiliate_code AND c.status IN ('pending','approved','paid')) as commission_idr
       FROM affiliate_accounts aa
       JOIN users u ON aa.user_id = u.id
       ORDER BY conversions DESC, attributed_revenue_idr DESC LIMIT 10`
    ).all(),
  ]);

  // Persentase 1 desimal; konversi affiliate kecil (mis. 0.98%) tak boleh
  // dibulatkan jadi 1% kasar. Guard pembagian saat clicks = 0.
  const rate = (num: number, denom: number) => (denom > 0 ? Math.round((num / denom) * 1000) / 10 : 0);

  const totalClicks = (summary?.total_clicks as number) ?? 0;
  const totalLeads = (summary?.total_leads as number) ?? 0;
  const totalConv = (summary?.total_conversions as number) ?? 0;
  const totalRev = (summary?.total_attributed_revenue_idr as number) ?? 0;
  const totalCommission = (summary?.total_commission_idr as number) ?? 0;

  return c.json({
    success: true,
    generated_at: new Date().toISOString(),
    data: {
      summary: {
        total_affiliates: summary?.total_affiliates ?? 0,
        active_affiliates: summary?.active_affiliates ?? 0,
        total_clicks: totalClicks,
        total_leads: totalLeads,
        total_conversions: totalConv,
        lead_rate_pct: rate(totalLeads, totalClicks),
        conversion_rate_pct: rate(totalConv, totalClicks),
        total_attributed_revenue_idr: totalRev,
        total_attributed_revenue_formatted: idr(totalRev),
        total_commission_idr: totalCommission,
        total_commission_formatted: idr(totalCommission),
      },
      top_affiliates: (topAffiliates.results as any[]).map(r => ({
        ...r,
        attributed_revenue_formatted: idr(r.attributed_revenue_idr),
        commission_formatted: idr(r.commission_idr),
        lead_rate_pct: rate(r.leads, r.clicks),
        conversion_rate_pct: rate(r.conversions, r.clicks),
      })),
    },
  });
});

// ─── GET /api/analytics/orders ───────────────────────────────────────────────
analyticsRoutes.get('/orders', async (c) => {
  const page = Math.max(parseInt(c.req.query('page') || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '50', 10), 1), 100);
  const offset = (page - 1) * limit;
  const statusFilter = c.req.query('status'); // e.g., 'paid', 'pending'
  const days = parseInt(c.req.query('days') || '30', 10);
  
  let query = `
    SELECT o.id, o.order_number, o.order_type, o.product_name, o.amount, o.status,
           o.created_at, o.paid_at, u.name as user_name, u.email as user_email
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    WHERE o.created_at >= datetime('now', ?)
  `;
  const params: any[] = [`-${days} days`];

  if (statusFilter) {
    query += ` AND o.status = ?`;
    params.push(statusFilter);
  }

  // Count query
  const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
  
  query += ` ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const db = c.env.DB;
  const [dataRow, countRow] = await Promise.all([
    db.prepare(query).bind(...params).all(),
    db.prepare(countQuery).bind(...params.slice(0, params.length - 2)).first()
  ]);

  const total = (countRow?.total as number) ?? 0;
  
  return c.json({
    success: true,
    generated_at: new Date().toISOString(),
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit)
    },
    data: (dataRow.results as any[]).map(r => ({
      id: r.id,
      order_number: r.order_number,
      order_type: r.order_type,
      product_name: r.product_name,
      amount_idr: r.amount,
      amount_formatted: idr(r.amount),
      status: r.status,
      user_name: r.user_name,
      user_email: r.user_email,
      created_at: r.created_at,
      paid_at: r.paid_at
    }))
  });
});

// ─── GET /api/analytics/traffic ──────────────────────────────────────────────
// Traffic & engagement: DAU/WAU/MAU, tren aktif harian, page view, top landing,
// device, geo, sumber akuisisi & atribusi.
analyticsRoutes.get('/traffic', async (c) => {
  const { days, fromExpr } = dateRange(c);
  const db = c.env.DB;
  const fromDate = fromExpr.slice(0, 10);

  const utcDayT = (offset: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - offset);
    return d.toISOString().slice(0, 10);
  };
  const today = utcDayT(0);
  const d7 = utcDayT(6);
  const d30 = utcDayT(29);

  const [active, activeTrend, pageViews, landingPages, devices, geo, acquisition, firstTouch, signupSources] =
    await Promise.all([
      db.prepare(
        `SELECT
           (SELECT COUNT(DISTINCT user_id) FROM user_activity_days WHERE activity_date = ?) as dau,
           (SELECT COUNT(DISTINCT user_id) FROM user_activity_days WHERE activity_date >= ?) as wau,
           (SELECT COUNT(DISTINCT user_id) FROM user_activity_days WHERE activity_date >= ?) as mau`
      ).bind(today, d7, d30).first(),
      db.prepare(
        `SELECT activity_date, COUNT(DISTINCT user_id) as active_users
         FROM user_activity_days WHERE activity_date >= ?
         GROUP BY activity_date ORDER BY activity_date ASC`
      ).bind(fromDate).all(),
      db.prepare(
        `SELECT COUNT(*) as total, COUNT(DISTINCT user_id) as unique_users
         FROM tracking_events WHERE event_name = 'page_view' AND created_at >= ?`
      ).bind(fromExpr).first(),
      db.prepare(
        `SELECT COALESCE(NULLIF(landing_page, ''), '(none)') as landing_page, COUNT(*) as views
         FROM tracking_events WHERE event_name = 'page_view' AND created_at >= ?
         GROUP BY 1 ORDER BY views DESC LIMIT 20`
      ).bind(fromExpr).all(),
      db.prepare(
        `SELECT COALESCE(NULLIF(device_type, ''), '(unknown)') as device_type, COUNT(*) as count
         FROM tracking_events WHERE event_name = 'page_view' AND created_at >= ?
         GROUP BY 1 ORDER BY count DESC`
      ).bind(fromExpr).all(),
      db.prepare(
        `SELECT COALESCE(NULLIF(country, ''), '(unknown)') as country, COUNT(*) as events
         FROM tracking_events WHERE event_name = 'page_view' AND created_at >= ?
         GROUP BY 1 ORDER BY events DESC LIMIT 12`
      ).bind(fromExpr).all(),
      db.prepare(
        `SELECT source, medium, campaign,
                SUM(signups) as signups, SUM(checkouts) as checkouts,
                SUM(payments) as payments, SUM(revenue) as revenue
         FROM acquisition_daily WHERE event_date >= ?
         GROUP BY source, medium, campaign
         ORDER BY revenue DESC, signups DESC LIMIT 100`
      ).bind(fromDate).all(),
      db.prepare(
        `SELECT COALESCE(NULLIF(first_source, ''), '(none)') as source, COUNT(*) as users
         FROM user_attribution GROUP BY 1 ORDER BY users DESC LIMIT 20`
      ).all(),
      db.prepare(
        `SELECT COALESCE(NULLIF(signup_source, ''), '(none)') as source, COUNT(*) as users
         FROM user_attribution GROUP BY 1 ORDER BY users DESC LIMIT 20`
      ).all(),
    ]);

  return c.json({
    success: true,
    generated_at: new Date().toISOString(),
    period_days: days,
    data: {
      dau: (active?.dau as number) || 0,
      wau: (active?.wau as number) || 0,
      mau: (active?.mau as number) || 0,
      active_trend: activeTrend.results,
      page_views: {
        total: (pageViews?.total as number) || 0,
        unique_users: (pageViews?.unique_users as number) || 0,
      },
      top_landing_pages: landingPages.results,
      devices: devices.results,
      geo: geo.results,
      acquisition: acquisition.results,
      first_touch_sources: firstTouch.results,
      signup_sources: signupSources.results,
    },
  });
});

// ─── GET /api/analytics/funnels ──────────────────────────────────────────────
// Sales funnel: per langkah viewed→accepted→declined→converted + revenue,
// take-rate offer (upsell/downsell), dan AOV uplift.
analyticsRoutes.get('/funnels', async (c) => {
  const { days, fromExpr } = dateRange(c);
  const db = c.env.DB;

  const [perfRows, offerRows, triggerAovRow] = await Promise.all([
    db.prepare(
      `SELECT f.id AS funnel_id, f.name AS funnel_name, f.trigger_product_type, fe.step_type,
              SUM(CASE WHEN fe.event_type = 'viewed'    THEN 1 ELSE 0 END) AS viewed,
              SUM(CASE WHEN fe.event_type = 'accepted'  THEN 1 ELSE 0 END) AS accepted,
              SUM(CASE WHEN fe.event_type = 'declined'  THEN 1 ELSE 0 END) AS declined,
              SUM(CASE WHEN fe.event_type = 'converted' THEN 1 ELSE 0 END) AS converted,
              COALESCE(SUM(CASE WHEN fe.event_type = 'converted' THEN fe.amount ELSE 0 END), 0) AS revenue
       FROM funnel_events fe
       JOIN funnels f ON f.id = fe.funnel_id
       WHERE fe.created_at >= ?
       GROUP BY f.id, fe.step_type
       ORDER BY revenue DESC`
    ).bind(fromExpr).all(),
    db.prepare(
      `SELECT upsell_status, downsell_status, status
       FROM funnel_offers
       WHERE created_at >= ?`
    ).bind(fromExpr).all(),
    db.prepare(
      `SELECT COUNT(DISTINCT fo.trigger_order_id) AS trigger_orders,
              COALESCE(SUM(o.amount), 0) AS trigger_revenue
       FROM funnel_offers fo
       JOIN orders o ON o.id = fo.trigger_order_id AND o.status = 'paid'
       WHERE fo.created_at >= ?`
    ).bind(fromExpr).first(),
  ]);

  const funnel_performance = (perfRows.results as Record<string, unknown>[]).map((row) => {
    const viewed = Number(row.viewed || 0);
    const accepted = Number(row.accepted || 0);
    const converted = Number(row.converted || 0);
    const revenue = Number(row.revenue || 0);
    return {
      funnel_id: row.funnel_id,
      funnel_name: row.funnel_name,
      trigger_product_type: row.trigger_product_type,
      step_type: row.step_type,
      viewed,
      accepted,
      declined: Number(row.declined || 0),
      converted,
      revenue_idr: revenue,
      revenue_idr_formatted: idr(revenue),
      accept_rate: viewed > 0 ? accepted / viewed : null,
      convert_rate: viewed > 0 ? converted / viewed : null,
    };
  });

  const upsell_status: Record<string, number> = {};
  const downsell_status: Record<string, number> = {};
  let expired = 0;
  let total = 0;
  let upsellDeclined = 0;
  let downsellConverted = 0;
  for (const row of offerRows.results as Record<string, unknown>[]) {
    total++;
    if (row.status === 'expired') expired++;
    const us = (row.upsell_status as string) || null;
    const ds = (row.downsell_status as string) || null;
    if (us) {
      upsell_status[us] = (upsell_status[us] || 0) + 1;
      if (us === 'declined') upsellDeclined++;
    }
    if (ds) {
      downsell_status[ds] = (downsell_status[ds] || 0) + 1;
      if (ds === 'converted') downsellConverted++;
    }
  }
  const downsell_rescue_rate = upsellDeclined > 0 ? downsellConverted / upsellDeclined : null;

  const total_funnel_revenue_idr = funnel_performance.reduce((s, r) => s + r.revenue_idr, 0);
  const triggerOrders = Number(triggerAovRow?.trigger_orders || 0);
  const triggerRevenue = Number(triggerAovRow?.trigger_revenue || 0);
  const base_aov_idr = triggerOrders > 0 ? Math.round(triggerRevenue / triggerOrders) : 0;
  const aov_uplift_idr = triggerOrders > 0 ? Math.round(total_funnel_revenue_idr / triggerOrders) : 0;
  const combined_aov_idr = base_aov_idr + aov_uplift_idr;

  return c.json({
    success: true,
    generated_at: new Date().toISOString(),
    period_days: days,
    data: {
      funnel_performance,
      offer_summary: { upsell_status, downsell_status, downsell_rescue_rate, expired, total },
      aov_uplift: {
        trigger_orders: triggerOrders,
        trigger_revenue_idr: triggerRevenue,
        trigger_revenue_formatted: idr(triggerRevenue),
        base_aov_idr,
        base_aov_formatted: idr(base_aov_idr),
        aov_uplift_idr,
        aov_uplift_formatted: idr(aov_uplift_idr),
        combined_aov_idr,
        combined_aov_formatted: idr(combined_aov_idr),
      },
      total_funnel_revenue_idr,
      total_funnel_revenue_formatted: idr(total_funnel_revenue_idr),
    },
  });
});

// ─── GET /api/analytics/webinars ──────────────────────────────────────────────
// Corong webinar: registered → attended → converted (+ attributed revenue).
// per_webinar bersifat ALL-TIME; summary & breakdown mengikuti rentang.
analyticsRoutes.get('/webinars', async (c) => {
  const { days, fromExpr } = dateRange(c);

  const [summary, perWebinar, byMembership] = await Promise.all([
    c.env.DB.prepare(
      `SELECT
         COUNT(*) AS total_registered,
         SUM(CASE WHEN wr.attended_at IS NOT NULL THEN 1 ELSE 0 END) AS total_attended,
         SUM(CASE WHEN EXISTS (
                SELECT 1 FROM orders o
                WHERE o.user_id = wr.user_id AND o.status = 'paid'
                  AND o.paid_at IS NOT NULL AND o.paid_at > wr.registered_at
              ) THEN 1 ELSE 0 END) AS total_converted,
         COALESCE(SUM((
                SELECT COALESCE(SUM(o.amount), 0) FROM orders o
                WHERE o.user_id = wr.user_id AND o.status = 'paid'
                  AND o.paid_at IS NOT NULL AND o.paid_at > wr.registered_at
              )), 0) AS attributed_revenue
       FROM webinar_registrations wr
       WHERE wr.status IN ('registered', 'registered_free', 'registered_paid')
         AND wr.registered_at >= ?`
    ).bind(fromExpr).first(),
    c.env.DB.prepare(
      `SELECT
         w.id AS id, w.title AS title, w.starts_at AS starts_at,
         COUNT(wr.id) AS registered,
         SUM(CASE WHEN wr.attended_at IS NOT NULL THEN 1 ELSE 0 END) AS attended,
         SUM(CASE WHEN EXISTS (
                SELECT 1 FROM orders o
                WHERE o.user_id = wr.user_id AND o.status = 'paid'
                  AND o.paid_at IS NOT NULL AND o.paid_at > wr.registered_at
              ) THEN 1 ELSE 0 END) AS converted,
         COALESCE(SUM((
                SELECT COALESCE(SUM(o.amount), 0) FROM orders o
                WHERE o.user_id = wr.user_id AND o.status = 'paid'
                  AND o.paid_at IS NOT NULL AND o.paid_at > wr.registered_at
              )), 0) AS revenue
       FROM webinars w
       JOIN webinar_registrations wr
         ON wr.webinar_id = w.id
        AND wr.status IN ('registered', 'registered_free', 'registered_paid')
       GROUP BY w.id
       ORDER BY registered DESC`
    ).all(),
    c.env.DB.prepare(
      `SELECT
         COALESCE(wr.membership_status_at_registration, 'free') AS membership_status_at_registration,
         COUNT(*) AS registered
       FROM webinar_registrations wr
       WHERE wr.status IN ('registered', 'registered_free', 'registered_paid')
         AND wr.registered_at >= ?
       GROUP BY 1
       ORDER BY registered DESC`
    ).bind(fromExpr).all(),
  ]);

  const totalRegistered = (summary?.total_registered as number) || 0;
  const totalAttended = (summary?.total_attended as number) || 0;
  const totalConverted = (summary?.total_converted as number) || 0;
  const attributedRevenue = (summary?.attributed_revenue as number) || 0;

  return c.json({
    success: true,
    generated_at: new Date().toISOString(),
    period_days: days,
    data: {
      summary: {
        total_registered: totalRegistered,
        total_attended: totalAttended,
        attendance_rate: totalRegistered > 0 ? totalAttended / totalRegistered : 0,
        total_converted: totalConverted,
        conversion_rate: totalRegistered > 0 ? totalConverted / totalRegistered : 0,
        attributed_revenue_idr: attributedRevenue,
        attributed_revenue_formatted: idr(attributedRevenue),
      },
      per_webinar: (perWebinar.results as any[]).map((r) => ({
        id: r.id,
        title: r.title,
        starts_at: r.starts_at,
        registered: r.registered || 0,
        attended: r.attended || 0,
        converted: r.converted || 0,
        revenue_idr: r.revenue || 0,
        revenue_formatted: idr((r.revenue as number) || 0),
      })),
      registration_by_membership_status: byMembership.results,
    },
  });
});

// ─── GET /api/analytics/retention ─────────────────────────────────────────────
// Cohort retention bulanan (12 bulan), pergerakan membership, time-to-convert.
analyticsRoutes.get('/retention', async (c) => {
  const db = c.env.DB;
  const now = new Date();
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const windowStartTs = windowStart.toISOString();
  const windowStartMonth = windowStartTs.slice(0, 7);

  const [cohortSizes, cohortRetention, movementNew, movementChurn, movementActive, convertRows] =
    await Promise.all([
      db.prepare(
        `SELECT substr(created_at, 1, 7) AS cohort, COUNT(*) AS size
         FROM users WHERE created_at >= ?
         GROUP BY cohort ORDER BY cohort ASC`
      ).bind(windowStartTs).all(),
      db.prepare(
        `SELECT cohort,
                (CAST(substr(act_month,1,4) AS INTEGER) * 12 + CAST(substr(act_month,6,2) AS INTEGER))
                  - (CAST(substr(cohort,1,4) AS INTEGER) * 12 + CAST(substr(cohort,6,2) AS INTEGER)) AS month_offset,
                COUNT(DISTINCT user_id) AS active_users
         FROM (
           SELECT u.id AS user_id,
                  substr(u.created_at, 1, 7) AS cohort,
                  substr(uad.activity_date, 1, 7) AS act_month
           FROM users u
           JOIN user_activity_days uad ON uad.user_id = u.id
           WHERE u.created_at >= ?
             AND substr(uad.activity_date, 1, 7) >= substr(u.created_at, 1, 7)
         )
         GROUP BY cohort, month_offset
         HAVING month_offset >= 0
         ORDER BY cohort ASC, month_offset ASC`
      ).bind(windowStartTs).all(),
      db.prepare(
        `SELECT substr(created_at, 1, 7) AS month, COUNT(*) AS new
         FROM memberships WHERE created_at >= ? GROUP BY month`
      ).bind(windowStartTs).all(),
      db.prepare(
        `SELECT month, COUNT(*) AS churned FROM (
           SELECT substr(cancelled_at, 1, 7) AS month FROM memberships
           WHERE status = 'cancelled' AND cancelled_at IS NOT NULL AND cancelled_at >= ?
           UNION ALL
           SELECT substr(expires_at, 1, 7) AS month FROM memberships
           WHERE status = 'expired' AND expires_at IS NOT NULL AND expires_at >= ?
         ) GROUP BY month`
      ).bind(windowStartTs, windowStartTs).all(),
      db.prepare(
        `WITH RECURSIVE months(m) AS (
           SELECT ?
           UNION ALL
           SELECT strftime('%Y-%m', date(m || '-01', '+1 month'))
           FROM months WHERE m < strftime('%Y-%m', 'now')
         )
         SELECT months.m AS month,
                (SELECT COUNT(*) FROM memberships ms
                  WHERE substr(ms.starts_at, 1, 7) <= months.m
                    AND (ms.expires_at IS NULL OR substr(ms.expires_at, 1, 7) > months.m)
                    AND (ms.cancelled_at IS NULL OR substr(ms.cancelled_at, 1, 7) > months.m)
                ) AS active_end
         FROM months`
      ).bind(windowStartMonth).all(),
      db.prepare(
        `SELECT CAST(julianday(first_paid) - julianday(u.created_at) AS INTEGER) AS days
         FROM users u
         JOIN (
           SELECT user_id, MIN(paid_at) AS first_paid
           FROM orders WHERE status = 'paid' AND paid_at IS NOT NULL
           GROUP BY user_id
         ) fp ON fp.user_id = u.id
         WHERE first_paid >= u.created_at`
      ).all(),
    ]);

  const sizeByCohort = new Map<string, number>();
  for (const r of cohortSizes.results as { cohort: string; size: number }[]) {
    sizeByCohort.set(r.cohort, Number(r.size) || 0);
  }
  const retByCohort = new Map<string, { month_offset: number; active_users: number; pct: number }[]>();
  for (const r of cohortRetention.results as { cohort: string; month_offset: number; active_users: number }[]) {
    const size = sizeByCohort.get(r.cohort) || 0;
    const active = Number(r.active_users) || 0;
    const arr = retByCohort.get(r.cohort) || [];
    arr.push({
      month_offset: Number(r.month_offset) || 0,
      active_users: active,
      pct: size > 0 ? Math.round((active / size) * 1000) / 10 : 0,
    });
    retByCohort.set(r.cohort, arr);
  }
  const cohorts = [...sizeByCohort.keys()].sort().slice(0, 12).map((cohort) => ({
    cohort,
    size: sizeByCohort.get(cohort) || 0,
    retained: (retByCohort.get(cohort) || []).sort((a, b) => a.month_offset - b.month_offset),
  }));

  const newByMonth = new Map<string, number>();
  for (const r of movementNew.results as { month: string; new: number }[]) {
    newByMonth.set(r.month, Number(r.new) || 0);
  }
  const churnByMonth = new Map<string, number>();
  for (const r of movementChurn.results as { month: string; churned: number }[]) {
    if (r.month) churnByMonth.set(r.month, Number(r.churned) || 0);
  }
  const membership_movement = (movementActive.results as { month: string; active_end: number }[]).map((r) => {
    const newCount = newByMonth.get(r.month) || 0;
    const churned = churnByMonth.get(r.month) || 0;
    const activeEnd = Number(r.active_end) || 0;
    const base = activeEnd + churned;
    return {
      month: r.month,
      new: newCount,
      churned,
      active_end: activeEnd,
      churn_rate: base > 0 ? Math.round((churned / base) * 1000) / 1000 : null,
    };
  });

  const dayValues = (convertRows.results as { days: number }[])
    .map((r) => Number(r.days))
    .filter((d) => Number.isFinite(d) && d >= 0)
    .sort((a, b) => a - b);
  const buckets = [
    { bucket: '0', count: 0 },
    { bucket: '1-3', count: 0 },
    { bucket: '4-7', count: 0 },
    { bucket: '8-30', count: 0 },
    { bucket: '31+', count: 0 },
  ];
  for (const d of dayValues) {
    if (d === 0) buckets[0].count++;
    else if (d <= 3) buckets[1].count++;
    else if (d <= 7) buckets[2].count++;
    else if (d <= 30) buckets[3].count++;
    else buckets[4].count++;
  }
  const median_days = dayValues.length ? dayValues[Math.floor((dayValues.length - 1) / 2)] : null;

  return c.json({
    success: true,
    generated_at: new Date().toISOString(),
    data: { cohorts, membership_movement, time_to_convert: { buckets, median_days } },
  });
});

// ─── GET /api/analytics/payments ─────────────────────────────────────────────
// Kesehatan pembayaran: success rate per metode/provider, failed rate,
// retry recovery, total gateway fee.
analyticsRoutes.get('/payments', async (c) => {
  const { days, fromExpr } = dateRange(c);

  const [methodRows, retryRow, feeRow] = await Promise.all([
    c.env.DB.prepare(
      `SELECT COALESCE(NULLIF(payment_method, ''), '(unknown)') as payment_method,
              COALESCE(NULLIF(provider, ''), '(unknown)') as provider,
              SUM(CASE WHEN status = 'paid'    THEN 1 ELSE 0 END) as paid,
              SUM(CASE WHEN status = 'failed'  THEN 1 ELSE 0 END) as failed,
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
              COUNT(*) as total
       FROM payments WHERE created_at >= ?
       GROUP BY 1, 2 ORDER BY total DESC`
    ).bind(fromExpr).all(),
    c.env.DB.prepare(
      `WITH retry_orders AS (
         SELECT DISTINCT p.order_id FROM payments p
         WHERE p.created_at >= ? AND p.provider_transaction_id LIKE '%-R%'
       )
       SELECT
         (SELECT COUNT(*) FROM retry_orders) as orders_with_retry,
         (SELECT COUNT(*) FROM retry_orders ro JOIN orders o ON o.id = ro.order_id WHERE o.status = 'paid') as recovered_orders`
    ).bind(fromExpr).first(),
    c.env.DB.prepare(
      `SELECT COALESCE(SUM(fee), 0) as total_fee,
              COALESCE(SUM(COALESCE(total_payment, amount)), 0) as total_payment,
              COALESCE(SUM(amount), 0) as total_amount
       FROM payments WHERE status = 'paid' AND created_at >= ?`
    ).bind(fromExpr).first(),
  ]);

  const method_success = (methodRows.results as Record<string, unknown>[]).map((r) => {
    const paid = Number(r.paid || 0);
    const failed = Number(r.failed || 0);
    const denom = paid + failed;
    return {
      payment_method: r.payment_method,
      provider: r.provider,
      paid,
      failed,
      pending: Number(r.pending || 0),
      total: Number(r.total || 0),
      success_rate: denom > 0 ? paid / denom : null,
    };
  });

  const ordersWithRetry = Number(retryRow?.orders_with_retry || 0);
  const recoveredOrders = Number(retryRow?.recovered_orders || 0);
  const totalPaid = method_success.reduce((s, m) => s + m.paid, 0);
  const totalFailed = method_success.reduce((s, m) => s + m.failed, 0);
  const failedDenom = totalPaid + totalFailed;
  const totalFee = Number(feeRow?.total_fee || 0);
  const totalPayment = Number(feeRow?.total_payment || 0);
  const totalAmount = Number(feeRow?.total_amount || 0);

  return c.json({
    success: true,
    generated_at: new Date().toISOString(),
    period_days: days,
    data: {
      method_success,
      failed_summary: {
        total_paid: totalPaid,
        total_failed: totalFailed,
        failed_rate: failedDenom > 0 ? totalFailed / failedDenom : null,
      },
      retry_recovery: {
        orders_with_retry: ordersWithRetry,
        recovered_orders: recoveredOrders,
        recovery_rate: ordersWithRetry > 0 ? recoveredOrders / ordersWithRetry : null,
      },
      gateway_fee: {
        total_fee_idr: totalFee,
        total_fee_idr_formatted: idr(totalFee),
        total_payment_idr: totalPayment,
        total_payment_idr_formatted: idr(totalPayment),
        total_amount_idr: totalAmount,
        total_amount_idr_formatted: idr(totalAmount),
      },
    },
  });
});

// ─── GET /api/analytics/products ─────────────────────────────────────────────
// Penjualan produk digital + ekonomi kredit AI tools.
analyticsRoutes.get('/products', async (c) => {
  const { days, fromExpr } = dateRange(c);
  const fromDt = fromExpr.slice(0, 10) + ' 00:00:00';
  const db = c.env.DB;

  const [products, creditsSummary, topTools] = await Promise.all([
    db.prepare(
      `SELECT p.id, p.slug, p.name, p.price, p.status, p.delivery_type,
              COALESCE((SELECT COUNT(*) FROM orders o
                          WHERE o.order_type = 'digital_product'
                            AND o.product_id = p.id AND o.status = 'paid'), 0) AS orders_paid,
              COALESCE((SELECT SUM(o.amount) FROM orders o
                          WHERE o.order_type = 'digital_product'
                            AND o.product_id = p.id AND o.status = 'paid'), 0) AS revenue_idr
       FROM digital_products p
       ORDER BY revenue_idr DESC, p.sort_order ASC, p.created_at DESC`
    ).all(),
    db.prepare(
      `SELECT
         (SELECT COALESCE(SUM(amount), 0) FROM tool_credit_transactions
            WHERE type = 'purchase' AND created_at >= ?) AS credits_purchased,
         (SELECT COALESCE(SUM(credits_used), 0) FROM tool_usage_logs
            WHERE status = 'success' AND created_at >= ?) AS credits_used,
         (SELECT COALESCE(SUM(amount), 0) FROM orders
            WHERE order_type = 'tool_credits' AND status = 'paid' AND paid_at >= ?) AS revenue_from_credits,
         (SELECT COALESCE(SUM(balance), 0) FROM user_tool_credits) AS outstanding_balance`
    ).bind(fromDt, fromDt, fromExpr).first(),
    db.prepare(
      `SELECT tool_name,
              COUNT(*) AS uses,
              COALESCE(SUM(credits_used), 0) AS credits_used,
              ROUND(
                100.0 * SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END)
                / NULLIF(SUM(CASE WHEN status IN ('success','failed') THEN 1 ELSE 0 END), 0)
              , 1) AS success_rate
       FROM tool_usage_logs WHERE created_at >= ?
       GROUP BY tool_name ORDER BY uses DESC LIMIT 15`
    ).bind(fromDt).all(),
  ]);

  const productRows = (products.results as any[]).map((r) => {
    const revenue = Number(r.revenue_idr) || 0;
    const price = Number(r.price) || 0;
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      status: r.status,
      delivery_type: r.delivery_type,
      price_idr: price,
      price_idr_formatted: idr(price),
      orders_paid: Number(r.orders_paid) || 0,
      revenue_idr: revenue,
      revenue_idr_formatted: idr(revenue),
    };
  });

  const totalProductRevenue = productRows.reduce((s, p) => s + p.revenue_idr, 0);
  const totalProductOrders = productRows.reduce((s, p) => s + p.orders_paid, 0);
  const creditsPurchased = Number(creditsSummary?.credits_purchased) || 0;
  const creditsUsed = Number(creditsSummary?.credits_used) || 0;
  const revenueFromCredits = Number(creditsSummary?.revenue_from_credits) || 0;
  const outstandingBalance = Number(creditsSummary?.outstanding_balance) || 0;

  return c.json({
    success: true,
    generated_at: new Date().toISOString(),
    period_days: days,
    data: {
      digital_products: {
        total_products: productRows.length,
        total_orders_paid: totalProductOrders,
        total_revenue_idr: totalProductRevenue,
        total_revenue_idr_formatted: idr(totalProductRevenue),
        items: productRows,
      },
      tool_credits: {
        credits_purchased: creditsPurchased,
        credits_used: creditsUsed,
        outstanding_balance: outstandingBalance,
        revenue_from_credits_idr: revenueFromCredits,
        revenue_from_credits_idr_formatted: idr(revenueFromCredits),
        top_tools: topTools.results,
      },
    },
  });
});

// ─── GET /api/analytics/gamification ─────────────────────────────────────────
// Daily check-in, distribusi streak, badge populer, total poin diberikan.
analyticsRoutes.get('/gamification', async (c) => {
  const { days, fromExpr } = dateRange(c);
  const db = c.env.DB;

  const [checkins, pointsAwarded, streakDist, topBadges] = await Promise.all([
    db.prepare(
      `SELECT COUNT(*) AS n FROM point_transactions
       WHERE action = 'daily_checkin' AND earned_at >= ?`
    ).bind(fromExpr).first(),
    db.prepare(
      `SELECT COALESCE(SUM(points), 0) AS total FROM point_transactions WHERE earned_at >= ?`
    ).bind(fromExpr).first(),
    db.prepare(
      `SELECT
         SUM(CASE WHEN current_streak = 0 THEN 1 ELSE 0 END) AS b0,
         SUM(CASE WHEN current_streak BETWEEN 1 AND 6 THEN 1 ELSE 0 END) AS b1,
         SUM(CASE WHEN current_streak BETWEEN 7 AND 29 THEN 1 ELSE 0 END) AS b2,
         SUM(CASE WHEN current_streak >= 30 THEN 1 ELSE 0 END) AS b3
       FROM users WHERE status = 'active'`
    ).first(),
    db.prepare(
      `SELECT badge_key, COUNT(*) AS count
       FROM user_badges GROUP BY badge_key ORDER BY count DESC LIMIT 10`
    ).all(),
  ]);

  const sd = streakDist as Record<string, number> | null;
  const streak_distribution = [
    { bucket: '0', users: Number(sd?.b0) || 0 },
    { bucket: '1-6', users: Number(sd?.b1) || 0 },
    { bucket: '7-29', users: Number(sd?.b2) || 0 },
    { bucket: '30+', users: Number(sd?.b3) || 0 },
  ];

  return c.json({
    success: true,
    generated_at: new Date().toISOString(),
    period_days: days,
    data: {
      checkins: Number(checkins?.n) || 0,
      total_points_awarded: Number(pointsAwarded?.total) || 0,
      streak_distribution,
      top_badges: topBadges.results,
    },
  });
});

// ─── GET /api/analytics/coupons ──────────────────────────────────────────────
analyticsRoutes.get('/coupons', async (c) => {
  const { days, fromExpr } = dateRange(c);
  const db = c.env.DB;

  const [topCoupons, totals, activeCoupons] = await Promise.all([
    db.prepare(
      `SELECT coupon_code,
              COUNT(*)                              AS redemptions,
              COALESCE(SUM(discount_amount), 0)     AS discount_total_idr,
              COALESCE(SUM(total_amount), 0)        AS revenue_idr
       FROM coupon_redemptions
       WHERE status = 'paid' AND redeemed_at >= ?
       GROUP BY coupon_code ORDER BY redemptions DESC LIMIT 10`
    ).bind(fromExpr).all(),
    db.prepare(
      `SELECT COUNT(*)                          AS total_redemptions,
              COALESCE(SUM(discount_amount), 0) AS total_discount_idr,
              COALESCE(SUM(total_amount), 0)    AS total_revenue_idr
       FROM coupon_redemptions
       WHERE status = 'paid' AND redeemed_at >= ?`
    ).bind(fromExpr).first(),
    db.prepare(
      `SELECT code, name, discount_type, discount_value,
              max_discount_amount, minimum_order_amount,
              starts_at, expires_at, usage_limit_total, usage_limit_per_user
       FROM coupons WHERE is_active = 1 ORDER BY created_at DESC`
    ).all(),
  ]);

  const top = (topCoupons.results as any[]).map((r) => {
    const revenue = (r.revenue_idr as number) ?? 0;
    const discount = (r.discount_total_idr as number) ?? 0;
    return {
      coupon_code: r.coupon_code,
      redemptions: r.redemptions ?? 0,
      discount_total_idr: discount,
      discount_total_formatted: idr(discount),
      revenue_idr: revenue,
      revenue_formatted: idr(revenue),
      discount_pct_of_revenue: revenue > 0 ? Math.round((discount / revenue) * 100) : null,
    };
  });

  const totalRedemptions = (totals?.total_redemptions as number) ?? 0;
  const totalDiscount = (totals?.total_discount_idr as number) ?? 0;
  const totalRevenue = (totals?.total_revenue_idr as number) ?? 0;

  return c.json({
    success: true,
    generated_at: new Date().toISOString(),
    period_days: days,
    data: {
      totals: {
        total_redemptions: totalRedemptions,
        total_discount_idr: totalDiscount,
        total_discount_formatted: idr(totalDiscount),
        total_revenue_idr: totalRevenue,
        total_revenue_formatted: idr(totalRevenue),
        discount_pct_of_revenue: totalRevenue > 0 ? Math.round((totalDiscount / totalRevenue) * 100) : null,
      },
      top_coupons: top,
      active_coupons: (activeCoupons.results as any[]).map((r) => ({
        code: r.code,
        name: r.name,
        discount_type: r.discount_type,
        discount_value: r.discount_value,
        discount_value_formatted: r.discount_type === 'percentage' ? `${r.discount_value}%` : idr(r.discount_value),
        max_discount_idr: r.max_discount_amount ?? null,
        minimum_order_idr: r.minimum_order_amount ?? null,
        starts_at: r.starts_at ?? null,
        expires_at: r.expires_at ?? null,
        usage_limit_total: r.usage_limit_total ?? null,
        usage_limit_per_user: r.usage_limit_per_user ?? null,
      })),
    },
  });
});

// ─── GET /api/analytics/community ────────────────────────────────────────────
analyticsRoutes.get('/community', async (c) => {
  const { days, fromExpr } = dateRange(c);
  const db = c.env.DB;

  const [postsInRange, postsByStatus, comments, likes, topContributors] = await Promise.all([
    db.prepare(
      `SELECT COUNT(*) AS n FROM community_posts WHERE status = 'published' AND created_at >= ?`
    ).bind(fromExpr).first(),
    db.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published,
              SUM(CASE WHEN status = 'pending'   THEN 1 ELSE 0 END) AS pending
       FROM community_posts WHERE created_at >= ?`
    ).bind(fromExpr).first(),
    db.prepare(`SELECT COUNT(*) AS n FROM community_comments WHERE created_at >= ?`).bind(fromExpr).first(),
    db.prepare(`SELECT COUNT(*) AS n FROM community_post_likes WHERE created_at >= ?`).bind(fromExpr).first(),
    db.prepare(
      `SELECT u.name,
              COALESCE(p.posts, 0)                          AS posts,
              COALESCE(cm.comments, 0)                      AS comments,
              COALESCE(p.posts, 0) + COALESCE(cm.comments, 0) AS total
       FROM users u
       LEFT JOIN (
         SELECT author_user_id, COUNT(*) AS posts FROM community_posts
         WHERE created_at >= ? GROUP BY author_user_id
       ) p ON p.author_user_id = u.id
       LEFT JOIN (
         SELECT author_user_id, COUNT(*) AS comments FROM community_comments
         WHERE created_at >= ? GROUP BY author_user_id
       ) cm ON cm.author_user_id = u.id
       WHERE COALESCE(p.posts, 0) + COALESCE(cm.comments, 0) > 0
       ORDER BY total DESC LIMIT 10`
    ).bind(fromExpr, fromExpr).all(),
  ]);

  return c.json({
    success: true,
    generated_at: new Date().toISOString(),
    period_days: days,
    data: {
      activity: {
        published_posts: (postsInRange?.n as number) ?? 0,
        comments: (comments?.n as number) ?? 0,
        likes: (likes?.n as number) ?? 0,
      },
      posts_by_status: {
        total: (postsByStatus?.total as number) ?? 0,
        published: (postsByStatus?.published as number) ?? 0,
        pending: (postsByStatus?.pending as number) ?? 0,
      },
      top_contributors: (topContributors.results as any[]).map((r) => ({
        name: r.name,
        posts: r.posts ?? 0,
        comments: r.comments ?? 0,
        total: r.total ?? 0,
      })),
    },
  });
});

// ─── GET /api/analytics/email ────────────────────────────────────────────────
// Email marketing: campaigns, sequence funnel, event breakdown, suppression.
analyticsRoutes.get('/email', async (c) => {
  const { days, fromExpr } = dateRange(c);
  const db = c.env.DB;

  const [campaignsRes, totalsRow, seqPerfRes, eventTrendRes, suppTotalRow, suppNewRow] = await Promise.all([
    db.prepare(
      `SELECT id, name, status, sent_count, open_count, click_count,
              bounce_count, unsubscribe_count, revenue_attributed
       FROM email_campaigns ORDER BY created_at DESC LIMIT 20`
    ).all(),
    db.prepare(
      `SELECT
         COALESCE(SUM(sent_count), 0)         AS sent,
         COALESCE(SUM(open_count), 0)         AS open,
         COALESCE(SUM(click_count), 0)        AS click,
         COALESCE(SUM(bounce_count), 0)       AS bounce,
         COALESCE(SUM(unsubscribe_count), 0)  AS unsub,
         COALESCE(SUM(revenue_attributed), 0) AS revenue
       FROM email_campaigns WHERE created_at >= ?`
    ).bind(fromExpr).first(),
    db.prepare(
      `SELECT s.id, s.name, s.trigger_event, s.status,
         COALESCE(SUM(CASE WHEN st.status = 'active'    THEN 1 ELSE 0 END), 0) AS active,
         COALESCE(SUM(CASE WHEN st.status = 'completed' THEN 1 ELSE 0 END), 0) AS completed,
         COALESCE(SUM(CASE WHEN st.status = 'paused'    THEN 1 ELSE 0 END), 0) AS paused
       FROM email_sequences s
       LEFT JOIN user_email_sequence_state st ON st.sequence_id = s.id
       GROUP BY s.id, s.name, s.trigger_event, s.status
       ORDER BY (active + completed + paused) DESC, s.name ASC`
    ).all(),
    db.prepare(
      `SELECT event_type, COUNT(*) AS count FROM email_events
       WHERE created_at >= ? GROUP BY event_type ORDER BY count DESC`
    ).bind(fromExpr).all(),
    db.prepare(`SELECT COUNT(*) AS total FROM email_suppression_list`).first(),
    db.prepare(`SELECT COUNT(*) AS n FROM email_suppression_list WHERE created_at >= ?`).bind(fromExpr).first(),
  ]);

  const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);

  const campaigns = (campaignsRes.results as any[]).map((r) => {
    const sent = (r.sent_count as number) || 0;
    const revenue = (r.revenue_attributed as number) || 0;
    return {
      name: r.name,
      status: r.status,
      sent,
      open: (r.open_count as number) || 0,
      click: (r.click_count as number) || 0,
      open_rate: pct((r.open_count as number) || 0, sent),
      click_rate: pct((r.click_count as number) || 0, sent),
      revenue_idr: revenue,
      revenue_formatted: idr(revenue),
    };
  });

  const sent = (totalsRow?.sent as number) || 0;
  const open = (totalsRow?.open as number) || 0;
  const click = (totalsRow?.click as number) || 0;
  const bounce = (totalsRow?.bounce as number) || 0;
  const unsub = (totalsRow?.unsub as number) || 0;
  const revenue = (totalsRow?.revenue as number) || 0;

  return c.json({
    success: true,
    generated_at: new Date().toISOString(),
    period_days: days,
    data: {
      totals: {
        sent, open, click, bounce, unsub,
        revenue_idr: revenue,
        revenue_formatted: idr(revenue),
        open_rate: pct(open, sent),
        click_rate: pct(click, sent),
        bounce_rate: pct(bounce, sent),
        unsub_rate: pct(unsub, sent),
      },
      campaigns,
      sequence_performance: (seqPerfRes.results as any[]).map((r) => ({
        id: r.id,
        name: r.name,
        trigger_event: r.trigger_event,
        status: r.status,
        active: (r.active as number) || 0,
        completed: (r.completed as number) || 0,
        paused: (r.paused as number) || 0,
      })),
      event_trend: eventTrendRes.results,
      suppression: {
        total: (suppTotalRow?.total as number) || 0,
        new_in_range: (suppNewRow?.n as number) || 0,
      },
    },
  });
});


// ─── GET /api/analytics/member-health ────────────────────────────────────────
// Segmentasi member berbayar (membership aktif) berdasarkan aktivitas terakhir.
// Snapshot — tanpa parameter waktu. Selaras dengan /api/admin/analytics/member-health.
//   active  — ≥3 hari aktif dalam 30 hari terakhir
//   at_risk — ada aktivitas dalam 30 hari, tapi <3 hari aktif
//   dormant — tak ada aktivitas sama sekali dalam 14 hari terakhir
analyticsRoutes.get('/member-health', async (c) => {
  const now = new Date().toISOString();
  const dayAgo = (n: number) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const d30 = dayAgo(29);
  const d14 = dayAgo(13);

  const members = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.current_streak,
            p.name as plan_name,
            (SELECT COUNT(*) FROM user_activity_days uad
             WHERE uad.user_id = u.id AND uad.activity_date >= ?) as active_days_30,
            (SELECT MAX(activity_date) FROM user_activity_days uad
             WHERE uad.user_id = u.id) as last_active
     FROM memberships m
     JOIN users u ON u.id = m.user_id
     JOIN membership_plans p ON p.id = m.plan_id
     WHERE m.status = 'active' AND (m.expires_at IS NULL OR m.expires_at > ?)
       AND u.status = 'active'
     GROUP BY u.id`
  ).bind(d30, now).all();

  const active: unknown[] = [];
  const atRisk: any[] = [];
  const dormant: any[] = [];

  for (const row of members.results as any[]) {
    const activeDays = Number(row.active_days_30) || 0;
    const lastActive = (row.last_active as string | null) || null;
    const entry = {
      id: row.id,
      name: row.name,
      email: row.email,
      plan_name: row.plan_name,
      active_days_30: activeDays,
      last_active: lastActive,
      current_streak: Number(row.current_streak) || 0,
    };
    if (!lastActive || lastActive < d14) dormant.push(entry);
    else if (activeDays >= 3) active.push(entry);
    else atRisk.push(entry);
  }

  const sortByLastActive = (a: any, b: any) => (a.last_active || '').localeCompare(b.last_active || '');
  dormant.sort(sortByLastActive);
  atRisk.sort(sortByLastActive);

  return c.json({
    success: true,
    generated_at: now,
    data: {
      total_paid_members: members.results.length,
      counts: { active: active.length, at_risk: atRisk.length, dormant: dormant.length },
      at_risk: atRisk.slice(0, 50),
      dormant: dormant.slice(0, 50),
    },
  });
});

// ─── GET /api/analytics/learning ─────────────────────────────────────────────
// Engagement level-lesson: di lesson mana orang berhenti menonton. Snapshot —
// tanpa parameter waktu. Melengkapi /courses (yang hanya level kelas).
analyticsRoutes.get('/learning', async (c) => {
  const db = c.env.DB;
  const [courseDropoff, lessonDropoff, lowProgress] = await Promise.all([
    // Per kelas published: rata-rata watch% + lesson dengan drop tertajam.
    db.prepare(
      `SELECT c2.id as course_id,
              c2.title as course_title,
              ROUND(AVG(lp.watch_percent), 1) as avg_watch_percent,
              COUNT(lp.id) as viewers,
              (SELECT l3.title FROM lessons l3
                 JOIN lesson_progress lp3 ON lp3.lesson_id = l3.id
               WHERE l3.course_id = c2.id AND l3.status = 'published'
               GROUP BY l3.id
               ORDER BY AVG(lp3.watch_percent) ASC, l3.sort_order ASC
               LIMIT 1) as steepest_drop_lesson_title
       FROM courses c2
       JOIN lessons l ON l.course_id = c2.id AND l.status = 'published'
       LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id
       WHERE c2.status = 'published'
       GROUP BY c2.id
       ORDER BY avg_watch_percent ASC
       LIMIT 100`
    ).all(),
    // Per lesson published: rata-rata watch% + jumlah viewer, urut sesuai kelas & urutan lesson.
    db.prepare(
      `SELECT l.course_id as course_id,
              c2.title as course_title,
              l.id as lesson_id,
              l.title as lesson_title,
              l.sort_order as lesson_order,
              ROUND(AVG(lp.watch_percent), 1) as avg_watch_percent,
              COUNT(lp.id) as viewers
       FROM lessons l
       JOIN courses c2 ON c2.id = l.course_id
       LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id
       WHERE c2.status = 'published' AND l.status = 'published'
       GROUP BY l.id
       ORDER BY c2.sort_order ASC, c2.title ASC, l.sort_order ASC, l.created_at ASC, l.id ASC
       LIMIT 250`
    ).all(),
    // Buyer berprogres rendah (<20%) >7 hari setelah bayar — kandidat aksi onboarding.
    db.prepare(
      `SELECT u.id, u.name, u.email, e.progress_percent, c2.title as course_title, o.paid_at
       FROM enrollments e
       JOIN users u ON u.id = e.user_id
       JOIN courses c2 ON c2.id = e.course_id
       JOIN orders o ON o.user_id = u.id AND o.status = 'paid'
       WHERE e.progress_percent < 20
         AND o.paid_at < datetime('now', '-7 days')
       GROUP BY e.id
       ORDER BY o.paid_at DESC
       LIMIT 50`
    ).all(),
  ]);

  return c.json({
    success: true,
    generated_at: new Date().toISOString(),
    data: {
      course_dropoff_summary: courseDropoff.results,
      lesson_dropoff: lessonDropoff.results,
      low_progress_paid_users: lowProgress.results,
    },
  });
});

// ─── GET /api/analytics/creator ──────────────────────────────────────────────
// Ekonomi Creator Store (marketplace UGC). Penjualan & fee per periode (days/from),
// liability ke creator & status payout bersifat snapshot all-time.
analyticsRoutes.get('/creator', async (c) => {
  const { days, fromExpr } = dateRange(c);
  const fromDt = fromExpr.slice(0, 10) + ' 00:00:00';
  const db = c.env.DB;

  const [stores, products, sales, owed, payouts, topCreators] = await Promise.all([
    db.prepare(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
       FROM creator_stores`
    ).first(),
    db.prepare(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
              COALESCE(SUM(sales_count), 0) as lifetime_sales
       FROM creator_products`
    ).first(),
    db.prepare(
      `SELECT COUNT(*) as sales,
              COALESCE(SUM(gross_amount), 0) as gmv,
              COALESCE(SUM(fee_amount), 0) as platform_fee,
              COALESCE(SUM(amount), 0) as creator_net
       FROM creator_earnings
       WHERE entry_type = 'sale' AND created_at >= ?`
    ).bind(fromDt).first(),
    db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as owed FROM creator_earnings`
    ).first(),
    db.prepare(
      `SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as amount
       FROM creator_payouts GROUP BY status`
    ).all(),
    db.prepare(
      `SELECT s.id as store_id, s.name as store_name, s.slug,
              COALESCE(SUM(CASE WHEN e.entry_type = 'sale' AND e.created_at >= ? THEN e.gross_amount ELSE 0 END), 0) as gmv_idr,
              COALESCE(SUM(CASE WHEN e.entry_type = 'sale' AND e.created_at >= ? THEN e.amount ELSE 0 END), 0) as creator_net_idr,
              COUNT(CASE WHEN e.entry_type = 'sale' AND e.created_at >= ? THEN 1 END) as sales
       FROM creator_stores s
       LEFT JOIN creator_earnings e ON e.store_id = s.id
       GROUP BY s.id
       ORDER BY gmv_idr DESC
       LIMIT 15`
    ).bind(fromDt, fromDt, fromDt).all(),
  ]);

  const gmv = Number(sales?.gmv) || 0;
  const platformFee = Number(sales?.platform_fee) || 0;
  const creatorNet = Number(sales?.creator_net) || 0;
  const owedBalance = Number(owed?.owed) || 0;

  return c.json({
    success: true,
    generated_at: new Date().toISOString(),
    period_days: days,
    data: {
      stores: {
        total: Number(stores?.total) || 0,
        active: Number(stores?.active) || 0,
      },
      products: {
        total: Number(products?.total) || 0,
        active: Number(products?.active) || 0,
        lifetime_sales: Number(products?.lifetime_sales) || 0,
      },
      sales: {
        sales: Number(sales?.sales) || 0,
        gmv_idr: gmv,
        gmv_idr_formatted: idr(gmv),
        platform_fee_idr: platformFee,
        platform_fee_idr_formatted: idr(platformFee),
        creator_net_idr: creatorNet,
        creator_net_idr_formatted: idr(creatorNet),
      },
      outstanding_creator_balance_idr: owedBalance,
      outstanding_creator_balance_idr_formatted: idr(owedBalance),
      payouts: (payouts.results as any[]).map((r) => ({
        status: r.status,
        count: Number(r.count) || 0,
        amount_idr: Number(r.amount) || 0,
        amount_idr_formatted: idr(Number(r.amount) || 0),
      })),
      top_creators: (topCreators.results as any[]).map((r) => ({
        store_id: r.store_id,
        store_name: r.store_name,
        slug: r.slug,
        sales: Number(r.sales) || 0,
        gmv_idr: Number(r.gmv_idr) || 0,
        gmv_idr_formatted: idr(Number(r.gmv_idr) || 0),
        creator_net_idr: Number(r.creator_net_idr) || 0,
        creator_net_idr_formatted: idr(Number(r.creator_net_idr) || 0),
      })),
    },
  });
});

export default analyticsRoutes;
