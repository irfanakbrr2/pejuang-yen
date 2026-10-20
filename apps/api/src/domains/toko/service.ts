import type { Env } from '../../env';
import { getNumericSetting } from '../../lib/settings';

const SLUG_RE = /^[a-z0-9-]{3,50}$/;
const RESERVED_SLUGS = new Set([
  'api', 'app', 'www', 'admin', 'toko', 'store', 'l', 'w', 'p', 's',
  'dashboard', 'login', 'register', 'checkout', 'order', 'products', 'premium',
  'webinar', 'webinars', 'community', 'tools', 'affiliate', 'account', 'growwithai',
]);

type ServiceError = { error: string; status: number };
type ServiceOk<T> = { success: true; data: T };
type Row = Record<string, unknown>;

export const DELIVERY_TYPES = new Set(['file', 'link']);
export const PRODUCT_STATUSES = new Set(['draft', 'active', 'archived']);

export async function getStoreFeeRate(env: Env, store: Row): Promise<number> {
  const globalRate = await getNumericSetting(env.DB, 'creator_store_fee_rate', 2);
  const rate = store.platform_fee_rate != null ? Number(store.platform_fee_rate) : globalRate;
  return Math.min(50, Math.max(0, Math.floor(rate)));
}

const CUSTOM_HTML_MAX = 20_000;
const PRODUCT_DESC_MAX = 10_000;

/** Guard ringan konten HTML user (isolasi utama = iframe sandbox di FE). */
function validateUserHtml(value: unknown, maxLen: number, label: string): string | null {
  if (value == null || value === '') return null;
  const html = String(value);
  if (html.length > maxLen) return `${label} maksimal ${maxLen.toLocaleString('id-ID')} karakter`;
  if (/srcdoc\s*=/i.test(html)) return `${label} tidak boleh mengandung srcdoc`;
  return null;
}

export class TokoService {
  constructor(private env: Env) {}

  /** Hapus cache storefront publik (store + semua produk) — best effort. */
  private async invalidatePublicCache(storeSlug: string): Promise<void> {
    try {
      const listed = await this.env.KV.list({ prefix: `toko:public:${storeSlug}` });
      await Promise.all(listed.keys.map(({ name }) => this.env.KV.delete(name)));
    } catch { /* cache best-effort */ }
  }

  // ── Store ───────────────────────────────────────────────────────────────
  async getStoreByUser(userId: string): Promise<Row | null> {
    return await this.env.DB.prepare('SELECT * FROM creator_stores WHERE user_id = ?').bind(userId).first() as Row | null;
  }

  async createStore(user: any, body: { slug?: string; name?: string; description?: string }): Promise<ServiceError | ServiceOk<{ id: string; slug: string }>> {
    const slug = String(body.slug || '').trim().toLowerCase();
    const name = String(body.name || '').trim();
    if (!SLUG_RE.test(slug)) return { error: 'Slug toko tidak valid (huruf kecil, angka, strip, 3-50 karakter)', status: 400 };
    if (RESERVED_SLUGS.has(slug)) return { error: 'Slug ini tidak tersedia', status: 400 };
    if (!name || name.length < 3) return { error: 'Nama toko minimal 3 karakter', status: 400 };

    const existing = await this.getStoreByUser(user.id);
    if (existing) return { error: 'Kamu sudah punya toko', status: 409 };

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    try {
      await this.env.DB.prepare(
        `INSERT INTO creator_stores (id, user_id, slug, name, description, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`
      ).bind(id, user.id, slug, name, body.description?.trim() || null, now, now).run();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('UNIQUE')) return { error: 'Slug toko sudah dipakai', status: 409 };
      throw err;
    }
    return { success: true, data: { id, slug } };
  }

  async updateStore(user: any, body: Row): Promise<ServiceError | ServiceOk<{ id: string }>> {
    const store = await this.getStoreByUser(user.id);
    if (!store) return { error: 'Toko tidak ditemukan', status: 404 };
    if (store.status === 'suspended') return { error: 'Toko sedang ditangguhkan', status: 403 };

    let slug = store.slug as string;
    if (body.slug !== undefined && body.slug !== store.slug) {
      // Ganti slug hanya bila belum ada penjualan (link publik beredar)
      const hasSale = await this.env.DB.prepare(
        `SELECT id FROM creator_earnings WHERE store_id = ? AND entry_type = 'sale' LIMIT 1`
      ).bind(store.id).first();
      if (hasSale) return { error: 'Slug tidak bisa diganti setelah ada penjualan', status: 400 };
      slug = String(body.slug).trim().toLowerCase();
      if (!SLUG_RE.test(slug) || RESERVED_SLUGS.has(slug)) return { error: 'Slug tidak valid / tidak tersedia', status: 400 };
    }

    const name = body.name !== undefined ? String(body.name).trim() : (store.name as string);
    if (!name || name.length < 3) return { error: 'Nama toko minimal 3 karakter', status: 400 };

    // Section HTML custom — dirender sandboxed di FE
    if (body.custom_html !== undefined) {
      const htmlError = validateUserHtml(body.custom_html, CUSTOM_HTML_MAX, 'Section HTML');
      if (htmlError) return { error: htmlError, status: 400 };
    }

    const now = new Date().toISOString();
    try {
      await this.env.DB.prepare(
        `UPDATE creator_stores SET slug = ?, name = ?, description = ?, logo_url = ?, accent_color = ?, custom_html = ?,
           payout_account_holder = ?, payout_bank_name = ?, payout_bank_account = ?, updated_at = ?
         WHERE id = ?`
      ).bind(
        slug, name,
        body.description !== undefined ? (body.description || null) : store.description,
        body.logo_url !== undefined ? (body.logo_url || null) : store.logo_url,
        body.accent_color !== undefined ? (body.accent_color || null) : store.accent_color,
        body.custom_html !== undefined ? (body.custom_html || null) : store.custom_html,
        body.payout_account_holder !== undefined ? (body.payout_account_holder || null) : store.payout_account_holder,
        body.payout_bank_name !== undefined ? (body.payout_bank_name || null) : store.payout_bank_name,
        body.payout_bank_account !== undefined ? (body.payout_bank_account || null) : store.payout_bank_account,
        now, store.id
      ).run();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('UNIQUE')) return { error: 'Slug toko sudah dipakai', status: 409 };
      throw err;
    }

    // Perubahan langsung tampil di storefront (hapus cache slug lama & baru)
    await this.invalidatePublicCache(store.slug as string);
    if (slug !== store.slug) await this.invalidatePublicCache(slug);

    return { success: true, data: { id: store.id as string } };
  }

  // ── Produk ──────────────────────────────────────────────────────────────
  async listProducts(userId: string): Promise<Row[]> {
    const store = await this.getStoreByUser(userId);
    if (!store) return [];
    const rows = await this.env.DB.prepare(
      `SELECT p.*, u.original_name as file_name, u.size as file_size
       FROM creator_products p
       LEFT JOIN creator_uploads u ON u.id = p.upload_id
       WHERE p.store_id = ? ORDER BY p.created_at DESC`
    ).bind(store.id).all();
    return rows.results as Row[];
  }

  async upsertProduct(user: any, body: Row, productId?: string): Promise<ServiceError | ServiceOk<{ id: string }>> {
    const store = await this.getStoreByUser(user.id);
    if (!store) return { error: 'Buat toko dulu', status: 404 };
    if (store.status === 'suspended') return { error: 'Toko sedang ditangguhkan', status: 403 };

    const slug = String(body.slug || '').trim().toLowerCase();
    const title = String(body.title || '').trim();
    const price = Math.floor(Number(body.price));
    const deliveryType = String(body.delivery_type || 'file');
    const status = String(body.status || 'draft');

    if (!SLUG_RE.test(slug)) return { error: 'Slug produk tidak valid', status: 400 };
    if (!title) return { error: 'Judul produk wajib diisi', status: 400 };
    if (!Number.isFinite(price) || price < 1000) return { error: 'Harga minimal Rp1.000', status: 400 };
    // Deskripsi mendukung HTML — dirender sandboxed di FE
    const descError = validateUserHtml(body.description, PRODUCT_DESC_MAX, 'Deskripsi');
    if (descError) return { error: descError, status: 400 };
    if (!DELIVERY_TYPES.has(deliveryType)) return { error: 'delivery_type tidak valid', status: 400 };
    if (!PRODUCT_STATUSES.has(status)) return { error: 'status tidak valid', status: 400 };
    if (deliveryType === 'link' && !/^https:\/\//.test(String(body.external_url || ''))) {
      return { error: 'Link produk wajib https://', status: 400 };
    }
    if (deliveryType === 'file') {
      if (!body.upload_id) return { error: 'Upload file produk dulu', status: 400 };
      const upload = await this.env.DB.prepare(
        `SELECT id FROM creator_uploads WHERE id = ? AND user_id = ? AND status = 'active'`
      ).bind(body.upload_id, user.id).first();
      if (!upload) return { error: 'File upload tidak ditemukan', status: 400 };
    }

    const now = new Date().toISOString();

    if (productId) {
      const product = await this.env.DB.prepare(
        'SELECT * FROM creator_products WHERE id = ? AND store_id = ?'
      ).bind(productId, store.id).first() as Row | null;
      if (!product) return { error: 'Produk tidak ditemukan', status: 404 };
      if (product.status === 'suspended') return { error: 'Produk ditangguhkan admin', status: 403 };

      try {
        await this.env.DB.prepare(
          `UPDATE creator_products SET slug = ?, title = ?, description = ?, thumbnail_url = ?, price = ?, compare_at_price = ?,
             delivery_type = ?, upload_id = ?, external_url = ?, status = ?,
             published_at = COALESCE(published_at, CASE WHEN ? = 'active' THEN ? END), updated_at = ?
           WHERE id = ?`
        ).bind(
          slug, title, body.description || null, body.thumbnail_url || null, price,
          body.compare_at_price ? Math.floor(Number(body.compare_at_price)) : null,
          deliveryType, deliveryType === 'file' ? body.upload_id : null,
          deliveryType === 'link' ? body.external_url : null, status,
          status, now, now, productId
        ).run();
      } catch (err: unknown) {
        if (err instanceof Error && err.message.includes('UNIQUE')) return { error: 'Slug produk sudah dipakai di tokomu', status: 409 };
        throw err;
      }
      await this.invalidatePublicCache(store.slug as string);
      return { success: true, data: { id: productId } };
    }

    // Kuota jumlah produk
    const maxProducts = await getNumericSetting(this.env.DB, 'creator_store_max_products', 20);
    const countRow = await this.env.DB.prepare(
      `SELECT COUNT(*) as total FROM creator_products WHERE store_id = ? AND status != 'archived'`
    ).bind(store.id).first();
    if (Number(countRow?.total || 0) >= maxProducts) {
      return { error: `Maksimal ${maxProducts} produk aktif`, status: 400 };
    }

    const id = crypto.randomUUID();
    try {
      await this.env.DB.prepare(
        `INSERT INTO creator_products (id, store_id, slug, title, description, thumbnail_url, price, compare_at_price, delivery_type, upload_id, external_url, status, published_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 'active' THEN ? END, ?, ?)`
      ).bind(
        id, store.id, slug, title, body.description || null, body.thumbnail_url || null, price,
        body.compare_at_price ? Math.floor(Number(body.compare_at_price)) : null,
        deliveryType, deliveryType === 'file' ? body.upload_id : null,
        deliveryType === 'link' ? body.external_url : null, status,
        status, now, now, now
      ).run();
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('UNIQUE')) return { error: 'Slug produk sudah dipakai di tokomu', status: 409 };
      throw err;
    }
    await this.invalidatePublicCache(store.slug as string);
    return { success: true, data: { id } };
  }

  async archiveProduct(user: any, productId: string): Promise<ServiceError | ServiceOk<{ id: string }>> {
    const store = await this.getStoreByUser(user.id);
    if (!store) return { error: 'Toko tidak ditemukan', status: 404 };
    const res = await this.env.DB.prepare(
      `UPDATE creator_products SET status = 'archived', updated_at = ? WHERE id = ? AND store_id = ? AND status != 'suspended'`
    ).bind(new Date().toISOString(), productId, store.id).run();
    if ((res.meta?.changes || 0) === 0) return { error: 'Produk tidak ditemukan', status: 404 };
    await this.invalidatePublicCache(store.slug as string);
    return { success: true, data: { id: productId } };
  }

  // ── Saldo & payout ──────────────────────────────────────────────────────
  async getBalance(userId: string): Promise<ServiceError | ServiceOk<Row>> {
    const store = await this.getStoreByUser(userId);
    if (!store) return { error: 'Toko tidak ditemukan', status: 404 };
    const now = new Date().toISOString();
    const row = await this.env.DB.prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN eligible_at <= ? THEN amount ELSE 0 END), 0) as available,
         COALESCE(SUM(CASE WHEN eligible_at > ? THEN amount ELSE 0 END), 0) as pending,
         COALESCE(SUM(CASE WHEN entry_type = 'sale' THEN amount ELSE 0 END), 0) as lifetime_net,
         COALESCE(SUM(CASE WHEN entry_type = 'sale' THEN gross_amount ELSE 0 END), 0) as lifetime_gross,
         COALESCE(-SUM(CASE WHEN entry_type = 'payout' THEN amount ELSE 0 END), 0) as total_paid_out
       FROM creator_earnings WHERE store_id = ?`
    ).bind(now, now, store.id).first() as Row;
    return { success: true, data: { ...row, store_status: store.status } };
  }

  async requestPayout(user: any, amountInput: unknown): Promise<ServiceError | ServiceOk<{ id: string }>> {
    const store = await this.getStoreByUser(user.id);
    if (!store) return { error: 'Toko tidak ditemukan', status: 404 };
    if (store.status === 'suspended') return { error: 'Toko sedang ditangguhkan — penarikan diblokir', status: 403 };

    const amount = Math.floor(Number(amountInput));
    const minAmount = await getNumericSetting(this.env.DB, 'creator_payout_min_amount', 100000);
    if (!Number.isFinite(amount) || amount < minAmount) {
      return { error: `Minimal penarikan Rp${minAmount.toLocaleString('id-ID')}`, status: 400 };
    }
    if (!store.payout_account_holder || !store.payout_bank_name || !store.payout_bank_account) {
      return { error: 'Lengkapi rekening bank di Pengaturan Toko dulu', status: 400 };
    }

    const inflight = await this.env.DB.prepare(
      `SELECT id FROM creator_payouts WHERE store_id = ? AND status IN ('pending', 'approved') LIMIT 1`
    ).bind(store.id).first();
    if (inflight) return { error: 'Masih ada penarikan yang sedang diproses', status: 409 };

    const balanceResult = await this.getBalance(user.id);
    if ('error' in balanceResult) return balanceResult;
    const available = Number(balanceResult.data.available || 0);
    if (amount > available) return { error: 'Saldo tersedia tidak mencukupi', status: 400 };

    const now = new Date().toISOString();
    const payoutId = crypto.randomUUID();
    const ledgerId = crypto.randomUUID();

    // Debit saat request — invariant: balance = SUM(ledger)
    await this.env.DB.batch([
      this.env.DB.prepare(
        `INSERT INTO creator_payouts (id, store_id, user_id, amount, status, account_holder, bank_name, bank_account, requested_at)
         VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, ?)`
      ).bind(payoutId, store.id, user.id, amount, store.payout_account_holder, store.payout_bank_name, store.payout_bank_account, now),
      this.env.DB.prepare(
        `INSERT INTO creator_earnings (id, store_id, user_id, entry_type, amount, payout_id, eligible_at, note, created_at)
         VALUES (?, ?, ?, 'payout', ?, ?, ?, 'Penarikan saldo', ?)`
      ).bind(ledgerId, store.id, user.id, -amount, payoutId, now, now),
    ]);

    // Re-check race: dua request paralel bisa lolos validasi → rollback bila minus
    const recheck = await this.getBalance(user.id);
    if (!('error' in recheck) && Number(recheck.data.available || 0) < 0) {
      await this.env.DB.batch([
        this.env.DB.prepare('DELETE FROM creator_earnings WHERE id = ?').bind(ledgerId),
        this.env.DB.prepare('DELETE FROM creator_payouts WHERE id = ?').bind(payoutId),
      ]);
      return { error: 'Saldo tersedia tidak mencukupi', status: 409 };
    }

    return { success: true, data: { id: payoutId } };
  }
}
