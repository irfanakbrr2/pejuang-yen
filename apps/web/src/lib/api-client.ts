/* eslint-disable @typescript-eslint/no-explicit-any */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
  /** Override cache TTL in ms. Pass 0 to skip cache. Default: 60000 */
  cacheTtl?: number;
}

const DEFAULT_TTL = 60_000;
const SESSION_PREFIX = 'gwai_';

// In-memory cache — fast, cleared on refresh
const _mem = new Map<string, { data: unknown; ts: number }>();
const _inflight = new Map<string, Promise<{ success: boolean; data?: unknown; error?: string; details?: unknown }>>();

function readCache<T>(path: string, ttl: number): T | null {
  // 1. Check in-memory first (fastest)
  const mem = _mem.get(path);
  if (mem && Date.now() - mem.ts < ttl) return mem.data as T;

  // 2. Fallback to sessionStorage (survives intra-session navigation)
  if (typeof sessionStorage !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(SESSION_PREFIX + path);
      if (raw) {
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts < ttl) {
          _mem.set(path, { data, ts }); // warm in-memory
          return data as T;
        }
        sessionStorage.removeItem(SESSION_PREFIX + path);
      }
    } catch { /* storage unavailable or full */ }
  }
  return null;
}

function writeCache(path: string, data: unknown): void {
  const ts = Date.now();
  _mem.set(path, { data, ts });
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(SESSION_PREFIX + path, JSON.stringify({ data, ts }));
    } catch { /* storage full — in-memory still works */ }
  }
}

/** Invalidate cached GET responses (call after mutations) */
export function invalidateCache(pathPrefix?: string) {
  if (!pathPrefix) {
    _mem.clear();
    if (typeof sessionStorage !== 'undefined') {
      try {
        const keys = Object.keys(sessionStorage).filter(k => k.startsWith(SESSION_PREFIX));
        keys.forEach(k => sessionStorage.removeItem(k));
      } catch { /* ignore */ }
    }
    return;
  }
  for (const key of _mem.keys()) {
    if (key.startsWith(pathPrefix)) _mem.delete(key);
  }
  if (typeof sessionStorage !== 'undefined') {
    try {
      const keys = Object.keys(sessionStorage).filter(k => k.startsWith(SESSION_PREFIX + pathPrefix));
      keys.forEach(k => sessionStorage.removeItem(k));
    } catch { /* ignore */ }
  }
}

export async function api<T = any>(path: string, options: FetchOptions = {}): Promise<{ success: boolean; data?: T; error?: string; details?: unknown }> {
  const { method = 'GET', body, headers = {}, cacheTtl = DEFAULT_TTL } = options;
  const isGet = method === 'GET';
  const cacheKey = path;

  if (isGet && cacheTtl > 0) {
    const cached = readCache<{ success: boolean; data?: T }>(cacheKey, cacheTtl);
    if (cached) return cached;

    const inflight = _inflight.get(cacheKey) as Promise<{ success: boolean; data?: T; error?: string; details?: unknown }> | undefined;
    if (inflight) return inflight;
  }

  const config: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    credentials: 'include',
  };

  if (body && method !== 'GET') {
    config.body = JSON.stringify(body);
  }

  const request = (async () => {
    try {
      const res = await fetch(`${API_BASE}${path}`, config);
      const raw = await res.text();
      let data: { success?: boolean; data?: T; error?: string; details?: unknown };

      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {
          success: false,
          error: raw || `Server mengembalikan response tidak valid (${res.status}).`,
        };
      }

      if (!res.ok && data.success !== false) {
        data = {
          ...data,
          success: false,
          error: data.error || `Request gagal (${res.status}).`,
        };
      }

      if (isGet && cacheTtl > 0 && data?.success) {
        writeCache(cacheKey, data);
      } else if (!isGet && data?.success) {
        invalidateCache();
      }
      return data as { success: boolean; data?: T; error?: string; details?: unknown };
    } catch (err) {
      console.error('[api-client] network error:', path, err);
      return { success: false, error: 'Gagal terhubung ke server. Periksa koneksi kamu.' };
    }
  })();

  if (isGet && cacheTtl > 0) {
    const tracked = request.finally(() => _inflight.delete(cacheKey));
    _inflight.set(cacheKey, tracked);
    return tracked;
  }

  return request;
}

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api('/api/auth/login', { method: 'POST', body: { email, password } }),
  register: (data: { name: string; email: string; password: string; phone?: string }) =>
    api('/api/auth/register', { method: 'POST', body: data }),
  logout: () => api('/api/auth/logout', { method: 'POST' }),
  me: () => api('/api/auth/me'),
  forgotPassword: (email: string) =>
    api('/api/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (token: string, password: string) =>
    api('/api/auth/reset-password', { method: 'POST', body: { token, password } }),
};

// Courses
export const coursesApi = {
  list: (params?: string) => api(`/api/courses${params ? `?${params}` : ''}`),
  get: (slug: string) => api(`/api/courses/${slug}`),
  getModules: (courseId: string) => api(`/api/courses/${courseId}/modules`),
};

// Resources
export const resourcesApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? new URLSearchParams(params).toString() : '';
    return api(`/api/resources${qs ? `?${qs}` : ''}`);
  }
};

// Skills (taxonomy)
export const skillsApi = {
  list: () => api('/api/skills', { cacheTtl: 300_000 }),
  detail: (slug: string, format?: string) =>
    api(`/api/skills/${slug}${format ? `?format=${encodeURIComponent(format)}` : ''}`),
};

// Global search
export const searchApi = {
  query: (params: { q: string; skill?: string; type?: string }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v)) as Record<string, string>
    ).toString();
    return api(`/api/search?${qs}`, { cacheTtl: 30_000 });
  },
};

// Learning paths
export const pathsApi = {
  list: (featuredOnly?: boolean) => api(`/api/paths${featuredOnly ? '?featured=1' : ''}`, { cacheTtl: 30_000 }),
  detail: (slug: string) => api(`/api/paths/${slug}`, { cacheTtl: 15_000 }),
};

// AI Content Automation
export const automationApi = {
  templates: () => api('/api/automations/templates', { cacheTtl: 300_000 }),
  list: () => api('/api/automations', { cacheTtl: 0 }),
  get: (id: string) => api(`/api/automations/${id}`, { cacheTtl: 0 }),
  create: (body: unknown) => api('/api/automations', { method: 'POST', body, cacheTtl: 0 }),
  update: (id: string, body: unknown) => api(`/api/automations/${id}`, { method: 'PATCH', body, cacheTtl: 0 }),
  setStatus: (id: string, status: 'active' | 'paused' | 'draft') =>
    api(`/api/automations/${id}/status`, { method: 'POST', body: { status }, cacheTtl: 0 }),
  remove: (id: string) => api(`/api/automations/${id}`, { method: 'DELETE', cacheTtl: 0 }),
  runNow: (id: string) => api(`/api/automations/${id}/run`, { method: 'POST', cacheTtl: 0 }),
  addTopics: (id: string, topics: string[]) =>
    api(`/api/automations/${id}/topics`, { method: 'POST', body: { topics }, cacheTtl: 0 }),
  deleteTopic: (id: string, topicId: string) =>
    api(`/api/automations/${id}/topics/${topicId}`, { method: 'DELETE', cacheTtl: 0 }),
  listCredentials: () => api('/api/automations/credentials', { cacheTtl: 0 }),
  createCredential: (body: { type: string; label: string; fields: Record<string, string> }) =>
    api('/api/automations/credentials', { method: 'POST', body, cacheTtl: 0 }),
  deleteCredential: (id: string) =>
    api(`/api/automations/credentials/${id}`, { method: 'DELETE', cacheTtl: 0 }),
};

// AI Pulse — Intelligence Terminal (publik & gratis)
export const aiPulseApi = {
  feed: (params?: { page?: number; limit?: number; category?: string; impact?: string }) => {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params ?? {}).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
      )
    ).toString();
    return api(`/api/ai-pulse${qs ? `?${qs}` : ''}`, { cacheTtl: 30_000 });
  },
  overview: () => api('/api/ai-pulse/overview', { cacheTtl: 60_000 }),
  detail: (slug: string) => api(`/api/ai-pulse/${slug}`, { cacheTtl: 30_000 }),
  toggleBookmark: (id: string) => api(`/api/user/ai-pulse/${id}/bookmark`, { method: 'POST', cacheTtl: 0 }),
  bookmarks: () => api('/api/user/ai-pulse/bookmarks', { cacheTtl: 0 }),
};

// AI Pulse — admin review queue
export const aiPulseAdminApi = {
  list: (status?: string, page = 1) =>
    api(`/api/admin/ai-pulse?${new URLSearchParams({ ...(status ? { status } : {}), page: String(page) })}`, { cacheTtl: 0 }),
  get: (id: string) => api(`/api/admin/ai-pulse/${id}`, { cacheTtl: 0 }),
  update: (id: string, body: unknown) => api(`/api/admin/ai-pulse/${id}`, { method: 'PATCH', body, cacheTtl: 0 }),
  publish: (id: string) => api(`/api/admin/ai-pulse/${id}/publish`, { method: 'POST', cacheTtl: 0 }),
  archive: (id: string) => api(`/api/admin/ai-pulse/${id}/archive`, { method: 'POST', cacheTtl: 0 }),
  regenerate: (id: string) => api(`/api/admin/ai-pulse/${id}/regenerate`, { method: 'POST', cacheTtl: 0 }),
  ingest: () => api('/api/admin/ai-pulse/ingest', { method: 'POST', cacheTtl: 0 }),
  sources: () => api('/api/admin/ai-pulse/sources', { cacheTtl: 0 }),
  createSource: (body: { name: string; url: string; type?: string; category?: string }) =>
    api('/api/admin/ai-pulse/sources', { method: 'POST', body, cacheTtl: 0 }),
  updateSource: (id: string, body: unknown) => api(`/api/admin/ai-pulse/sources/${id}`, { method: 'PATCH', body, cacheTtl: 0 }),
  deleteSource: (id: string) => api(`/api/admin/ai-pulse/sources/${id}`, { method: 'DELETE', cacheTtl: 0 }),
};

// User
export const userApi = {
  dashboard: () => api('/api/user/dashboard', { cacheTtl: 30_000 }),
  myClasses: () => api('/api/user/my-classes'),
  transactions: () => api('/api/user/transactions'),
  membership: () => api('/api/user/membership'),
  progress: (courseId: string) => api(`/api/user/progress/${courseId}`),
  completeLesson: (enrollmentId: string, lessonId: string) =>
    api('/api/user/progress/complete', { method: 'POST', body: { enrollment_id: enrollmentId, lesson_id: lessonId } }),
  notifications: () => api('/api/user/notifications'),
  markNotificationRead: (id: string) =>
    api(`/api/user/notifications/${id}/read`, { method: 'PATCH', cacheTtl: 0 }),
  markAllNotificationsRead: () =>
    api('/api/user/notifications/read-all', { method: 'PATCH', cacheTtl: 0 }),
  profile: () => api('/api/user/profile'),
  recommendations: () => api('/api/resources/recommendations'),
  memberMap: () => api('/api/user/member-map', { cacheTtl: 60_000 }),
  memberMapCity: (code: string, page = 1) =>
    api(`/api/user/member-map/${encodeURIComponent(code)}?page=${page}`, { cacheTtl: 60_000 }),
  checklist: () => api('/api/user/checklist', { cacheTtl: 0 }),
};

/**
 * Catat kunjungan menu untuk checklist onboarding.
 * Sengaja di luar api() — wrapper itu me-wipe seluruh cache klien setiap POST sukses,
 * sedangkan ini terpicu pada navigasi rutin.
 */
export function recordMenuVisit(milestone: string): void {
  fetch(`${API_BASE}/api/user/milestones`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ milestone }),
  }).catch(() => { /* fire-and-forget */ });
}

function getAffiliateCookie(): string {
  if (typeof document === 'undefined') return '';
  return document.cookie.split(';').find(c => c.trim().startsWith('affiliate_code='))?.split('=')[1]?.trim() || '';
}

// Funnels — order bump & upsell pasca-bayar
export const funnelsApi = {
  getBump: (productType: string, productId: string) =>
    api(`/api/public/funnels/bump?product_type=${encodeURIComponent(productType)}&product_id=${encodeURIComponent(productId)}`, { cacheTtl: 0 }),
  getOffer: (orderId: string) => api(`/api/funnels/offer/${orderId}`, { cacheTtl: 0 }),
  accept: (orderId: string, stepType: string, paymentMethod = "qris") =>
    api(`/api/funnels/offer/${orderId}/accept`, { method: "POST", body: { step_type: stepType, payment_method: paymentMethod } }),
  decline: (orderId: string, stepType: string) =>
    api(`/api/funnels/offer/${orderId}/decline`, { method: "POST", body: { step_type: stepType } }),
};

// Checkout embedded (Pakasir) — pembayaran QRIS/VA di dalam app
export const checkoutApi = {
  createPayment: (data: { order_type: string; product_id: string; payment_method: string; coupon_code?: string; affiliate_code?: string; mobile?: string; addons?: Array<{ type: string; step_id?: string }> }) =>
    api('/api/checkout/create-payment', { method: 'POST', body: { ...data, affiliate_code: data.affiliate_code || getAffiliateCookie() || undefined } }),
  get: (orderId: string) => api(`/api/checkout/${orderId}`, { cacheTtl: 0 }),
  status: (orderId: string) => api(`/api/checkout/${orderId}/status`, { cacheTtl: 0 }),
  check: (orderId: string) => api(`/api/checkout/${orderId}/check`, { method: 'POST' }),
  repay: (orderId: string, paymentMethod: string) =>
    api(`/api/checkout/${orderId}/repay`, { method: 'POST', body: { payment_method: paymentMethod } }),
};

// Membership
export const membershipApi = {
  plans: () => api('/api/membership/plans'),
};

// Creator Store (toko)
export const tokoApi = {
  me: () => api('/api/toko/me', { cacheTtl: 0 }),
  create: (data: { slug: string; name: string; description?: string }) =>
    api('/api/toko', { method: 'POST', body: data }),
  update: (data: Record<string, unknown>) => api('/api/toko/me', { method: 'PATCH', body: data }),
  products: () => api('/api/toko/me/products', { cacheTtl: 0 }),
  createProduct: (data: Record<string, unknown>) => api('/api/toko/me/products', { method: 'POST', body: data }),
  updateProduct: (id: string, data: Record<string, unknown>) =>
    api(`/api/toko/me/products/${id}`, { method: 'PATCH', body: data }),
  archiveProduct: (id: string) => api(`/api/toko/me/products/${id}`, { method: 'DELETE' }),
  sales: (page = 1) => api(`/api/toko/me/sales?page=${page}`, { cacheTtl: 0 }),
  balance: () => api('/api/toko/me/balance', { cacheTtl: 0 }),
  payouts: () => api('/api/toko/me/payouts', { cacheTtl: 0 }),
  requestPayout: (amount: number) => api('/api/toko/me/payouts', { method: 'POST', body: { amount } }),
};

export const tokoPublicApi = {
  store: (slug: string) => api(`/api/public/toko/${slug}`, { cacheTtl: 30_000 }),
  product: (slug: string, productSlug: string) =>
    api(`/api/public/toko/${slug}/products/${productSlug}`, { cacheTtl: 30_000 }),
};

export const purchasesApi = {
  list: () => api('/api/purchases', { cacheTtl: 0 }),
};

// Affiliate
export const affiliateApi = {
  me: () => api('/api/affiliate/me'),
  register: () => api('/api/affiliate/register', { method: 'POST' }),
  commissions: () => api('/api/affiliate/commissions'),
  leaderboard: () => api('/api/affiliate/leaderboard'),
  trackClick: (data: { affiliate_code: string; landing_url?: string; referrer_url?: string; campaign?: string }) =>
    api('/api/affiliate/track-click', { method: 'POST', body: data, cacheTtl: 0 }),
};

// Webinars
export const webinarsApi = {
  list: () => api('/api/user/webinars', { cacheTtl: 30_000 }),
  detail: (slug: string) => api(`/api/user/webinars/${slug}`, { cacheTtl: 15_000 }),
  register: (id: string, affiliateCode?: string) =>
    api(`/api/user/webinars/${id}/register`, {
      method: 'POST',
      body: { affiliate_code: affiliateCode || getAffiliateCookie() || undefined },
      cacheTtl: 0,
    }),
  selectMethod: (id: string, method: string) =>
    api(`/api/user/webinars/${id}/select-method`, {
      method: 'POST',
      body: { method },
      cacheTtl: 0,
    }),
  confirmFreeShare: (id: string) =>
    api(`/api/user/webinars/${id}/confirm-free-share`, {
      method: 'POST',
      cacheTtl: 0,
    }),
};

export const communityApi = {
  list: (params?: string) => api(`/api/community/posts${params ? `?${params}` : ''}`, { cacheTtl: 15_000 }),
  detail: (id: string) => api(`/api/community/posts/${id}`, { cacheTtl: 15_000 }),
  comments: (id: string, params?: string) =>
    api(`/api/community/posts/${id}/comments${params ? `?${params}` : ''}`, { cacheTtl: 10_000 }),
  toggleLike: (id: string) =>
    api(`/api/community/posts/${id}/like`, { method: 'POST', cacheTtl: 0 }),
  createComment: (id: string, bodyText: string) =>
    api(`/api/community/posts/${id}/comments`, { method: 'POST', body: { body_text: bodyText }, cacheTtl: 0 }),
  deleteComment: (postId: string, commentId: string) =>
    api(`/api/community/posts/${postId}/comments/${commentId}`, { method: 'DELETE', cacheTtl: 0 }),
  create: async (formData: FormData): Promise<{ success: boolean; data?: any; error?: string; details?: unknown }> => {
    try {
      const res = await fetch(`${API_BASE}/api/community/posts`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({ success: false, error: `Request gagal (${res.status}).` }));
      if (data?.success) invalidateCache('/api/community');
      return data;
    } catch (err) {
      console.error('[api-client] community create error:', err);
      return { success: false, error: 'Gagal terhubung ke server. Periksa koneksi kamu.' };
    }
  },
};
