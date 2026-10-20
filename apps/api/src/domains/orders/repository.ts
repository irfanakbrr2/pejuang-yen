import type { Env } from '../../env';

export class OrdersRepository {
  constructor(private env: Env) {}

  async getCoursePriceAndTitle(productId: string) {
    return await this.env.DB.prepare('SELECT title, price FROM courses WHERE id = ?').bind(productId).first();
  }

  async getMembershipPriceAndName(productId: string) {
    return await this.env.DB.prepare('SELECT name, price FROM membership_plans WHERE id = ?').bind(productId).first();
  }

  async getDigitalProductPriceAndName(productId: string) {
    return await this.env.DB.prepare(
      "SELECT name, price, delivery_type FROM digital_products WHERE id = ? AND status = 'active'"
    ).bind(productId).first();
  }

  async getActiveAffiliate(affiliateCode: string) {
    return await this.env.DB.prepare(
      'SELECT user_id FROM affiliate_accounts WHERE affiliate_code = ? AND status = ?'
    ).bind(affiliateCode, 'active').first();
  }

  async createOrder(orderId: string, orderNumber: string, userId: string, orderType: string, productId: string, productName: string, amount: number, affiliateCode: string | null, metadataJson: string | null, now: string, couponOpts?: { id: string, code: string, discount_type: string, discount_value: number, discount_amount: number, subtotal_amount: number, total_amount: number }) {
    if (couponOpts) {
      return await this.env.DB.prepare(
        `INSERT INTO orders (id, user_id, order_number, order_type, product_id, product_name, amount, currency, status, affiliate_code, metadata_json, created_at, updated_at, coupon_id, coupon_code, discount_type, discount_value, discount_amount, subtotal_amount, total_amount)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'IDR', 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(orderId, userId, orderNumber, orderType, productId, productName, amount, affiliateCode, metadataJson, now, now, couponOpts.id, couponOpts.code, couponOpts.discount_type, couponOpts.discount_value, couponOpts.discount_amount, couponOpts.subtotal_amount, couponOpts.total_amount).run();
    } else {
      return await this.env.DB.prepare(
        `INSERT INTO orders (id, user_id, order_number, order_type, product_id, product_name, amount, currency, status, affiliate_code, metadata_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'IDR', 'pending', ?, ?, ?, ?)`
      ).bind(orderId, userId, orderNumber, orderType, productId, productName, amount, affiliateCode, metadataJson, now, now).run();
    }
  }

  async updateOrderStatus(orderId: string, status: string, now: string) {
    return await this.env.DB.prepare(
      `UPDATE orders SET status = ?, updated_at = ? WHERE id = ?`
    ).bind(status, now, orderId).run();
  }

  async cancelOrder(orderId: string) {
    return await this.env.DB.prepare(`UPDATE orders SET status = 'cancelled' WHERE id = ?`).bind(orderId).run();
  }

  async getOrdersByUser(userId: string, limit = 50, offset = 0) {
    const rows = await this.env.DB.prepare(
      `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(userId, limit, offset).all();
    return rows.results;
  }

  async countOrdersByUser(userId: string) {
    const row = await this.env.DB.prepare(
      `SELECT COUNT(*) as total FROM orders WHERE user_id = ?`
    ).bind(userId).first();
    return Number(row?.total || 0);
  }
}
