import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error } from '../../lib/response';

const adminToolsRoutes = new Hono<{ Bindings: Env }>();
adminToolsRoutes.use('*', authMiddleware());
adminToolsRoutes.use('*', requireRole('admin', 'super_admin'));

adminToolsRoutes.get('/stats', async (c) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const endOfLastMonth = startOfMonth;

  const [revenueThis, revenueLast, creditsSold, creditsUsed, ordersCount, topTools, recentOrders] = await Promise.all([
    c.env.DB.prepare(
      `SELECT COALESCE(SUM(p.amount),0) as total
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE o.order_type = 'tool_credits'
         AND p.status = 'paid'
         AND COALESCE(p.paid_at, p.created_at) >= ?`
    ).bind(startOfMonth).first(),

    c.env.DB.prepare(
      `SELECT COALESCE(SUM(p.amount),0) as total
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE o.order_type = 'tool_credits'
         AND p.status = 'paid'
         AND COALESCE(p.paid_at, p.created_at) >= ?
         AND COALESCE(p.paid_at, p.created_at) < ?`
    ).bind(startOfLastMonth, endOfLastMonth).first(),

    c.env.DB.prepare(
      `SELECT COALESCE(SUM(tct.amount),0) as total FROM tool_credit_transactions tct WHERE tct.type = 'purchase'`
    ).first(),

    c.env.DB.prepare(
      `SELECT COALESCE(SUM(ABS(tct.amount)),0) as total FROM tool_credit_transactions tct WHERE tct.type = 'usage'`
    ).first(),

    c.env.DB.prepare(
      `SELECT COUNT(*) as n
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE o.order_type = 'tool_credits' AND p.status = 'paid'`
    ).first(),

    c.env.DB.prepare(
      `SELECT tool_name, COUNT(*) as uses, SUM(credits_used) as credits
       FROM tool_usage_logs WHERE status = 'success'
       GROUP BY tool_name ORDER BY uses DESC LIMIT 10`
    ).all(),

    // H1: include user_id and o.user_id for correct user links
    c.env.DB.prepare(
      `SELECT o.id, o.user_id, o.order_number, o.amount, o.status, o.paid_at, o.created_at,
              u.name as user_name, u.email as user_email,
              p.name as package_name, p.credits as package_credits
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       LEFT JOIN tool_credit_packages p ON p.id = o.product_id
       WHERE o.order_type = 'tool_credits'
       ORDER BY o.created_at DESC LIMIT 10`
    ).all(),
  ]);

  const dailyRevenue = await c.env.DB.prepare(
    `SELECT date(COALESCE(p.paid_at, p.created_at)) as date,
            SUM(p.amount) as revenue,
            COUNT(*) as orders
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     WHERE o.order_type = 'tool_credits'
       AND p.status = 'paid'
       AND COALESCE(p.paid_at, p.created_at) >= datetime('now', '-30 days')
     GROUP BY date(COALESCE(p.paid_at, p.created_at)) ORDER BY date ASC`
  ).all();

  return success(c, {
    revenue_this_month: Number((revenueThis as any)?.total || 0),
    revenue_last_month: Number((revenueLast as any)?.total || 0),
    total_credits_sold: Number((creditsSold as any)?.total || 0),
    total_credits_used: Number((creditsUsed as any)?.total || 0),
    total_orders: Number((ordersCount as any)?.n || 0),
    top_tools: topTools.results,
    recent_orders: recentOrders.results,
    daily_revenue: dailyRevenue.results,
  });
});

adminToolsRoutes.get('/orders', async (c) => {
  // H6: safe parseInt — fallback to default if NaN
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20', 10) || 20));
  const offset = (page - 1) * limit;
  const statusFilter = c.req.query('status') || '';
  const packageId = c.req.query('package_id') || '';

  // Validate status value
  const allowedStatuses = ['paid', 'pending', 'cancelled', 'failed'];
  const safeStatus = allowedStatuses.includes(statusFilter) ? statusFilter : '';

  let where = `WHERE o.order_type = 'tool_credits'`;
  const params: unknown[] = [];
  if (safeStatus) { where += ' AND o.status = ?'; params.push(safeStatus); }
  if (packageId) { where += ' AND o.product_id = ?'; params.push(packageId); }

  const total = ((await c.env.DB.prepare(
    `SELECT COUNT(*) as n FROM orders o ${where}`
  ).bind(...params).first())?.n as number) || 0;

  // H1: include user_id for correct user links
  const rows = await c.env.DB.prepare(
    `SELECT o.id, o.user_id, o.order_number, o.amount, o.status, o.paid_at, o.created_at,
            u.name as user_name, u.email as user_email,
            p.name as package_name, p.credits as package_credits
     FROM orders o
     LEFT JOIN users u ON u.id = o.user_id
     LEFT JOIN tool_credit_packages p ON p.id = o.product_id
     ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`
  ).bind(...params, limit, offset).all();

  // Revenue aggregate from paid payment records only.
  const paidParams: unknown[] = [];
  let paidWhere = `WHERE o.order_type = 'tool_credits' AND p.status = 'paid'`;
  if (packageId) { paidWhere += ' AND o.product_id = ?'; paidParams.push(packageId); }
  const revenueRow = await c.env.DB.prepare(
    `SELECT COALESCE(SUM(p.amount),0) as total
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     ${paidWhere}`
  ).bind(...paidParams).first();

  // C5: Return custom response (paginated() doesn't support totalRevenue)
  return success(c, {
    orders: rows.results,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    totalRevenue: Number((revenueRow as any)?.total || 0),
  });
});

adminToolsRoutes.get('/packages', async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT * FROM tool_credit_packages ORDER BY sort_order ASC'
  ).all();
  return success(c, rows.results);
});

adminToolsRoutes.post('/packages', async (c) => {
  let body: { name: string; credits: number; price: number; sort_order?: number };
  try { body = await c.req.json(); } catch { return error(c, 'Invalid JSON', 400); }

  if (!body.name?.trim() || !body.credits || !body.price) {
    return error(c, 'name, credits, dan price wajib diisi', 400);
  }

  // M3: Range validation
  if (body.credits < 1 || body.credits > 10000) return error(c, 'Kredit harus antara 1-10000', 400);
  if (body.price < 1000 || body.price > 50000000) return error(c, 'Harga tidak valid (1.000 - 50.000.000)', 400);
  if (body.name.trim().length > 100) return error(c, 'Nama paket maksimal 100 karakter', 400);

  const id = `pkg_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  await c.env.DB.prepare(
    `INSERT INTO tool_credit_packages (id, name, credits, price, is_active, sort_order, created_at)
     VALUES (?, ?, ?, ?, 1, ?, ?)`
  ).bind(id, body.name.trim(), body.credits, body.price, body.sort_order || 99, new Date().toISOString()).run();

  const pkg = await c.env.DB.prepare('SELECT * FROM tool_credit_packages WHERE id = ?').bind(id).first();
  return success(c, pkg, 201);
});

adminToolsRoutes.patch('/packages/:id', async (c) => {
  const id = c.req.param('id');
  const pkg = await c.env.DB.prepare('SELECT * FROM tool_credit_packages WHERE id = ?').bind(id).first();
  if (!pkg) return error(c, 'Paket tidak ditemukan', 404);

  let body: { name?: string; credits?: number; price?: number; is_active?: number; sort_order?: number };
  try { body = await c.req.json(); } catch { return error(c, 'Invalid JSON', 400); }

  // M3: Range validation on update
  if (body.credits !== undefined && (body.credits < 1 || body.credits > 10000)) return error(c, 'Kredit harus antara 1-10000', 400);
  if (body.price !== undefined && (body.price < 1000 || body.price > 50000000)) return error(c, 'Harga tidak valid', 400);
  if (body.name !== undefined && body.name.trim().length > 100) return error(c, 'Nama paket maksimal 100 karakter', 400);

  const name = body.name !== undefined ? body.name.trim() : (pkg.name as string);
  const credits = body.credits !== undefined ? body.credits : (pkg.credits as number);
  const price = body.price !== undefined ? body.price : (pkg.price as number);
  const is_active = body.is_active !== undefined ? body.is_active : (pkg.is_active as number);
  const sort_order = body.sort_order !== undefined ? body.sort_order : (pkg.sort_order as number);

  await c.env.DB.prepare(
    `UPDATE tool_credit_packages SET name = ?, credits = ?, price = ?, is_active = ?, sort_order = ? WHERE id = ?`
  ).bind(name, credits, price, is_active, sort_order, id).run();

  const updated = await c.env.DB.prepare('SELECT * FROM tool_credit_packages WHERE id = ?').bind(id).first();
  return success(c, updated);
});

adminToolsRoutes.get('/usage', async (c) => {
  const rawDays = parseInt(c.req.query('days') || '30', 10) || 30;
  const days = Math.min(365, Math.max(1, rawDays));

  const [topTools, topUsers, dailyUsage] = await Promise.all([
    c.env.DB.prepare(
      `SELECT tool_name, COUNT(*) as uses, SUM(credits_used) as credits
       FROM tool_usage_logs WHERE status = 'success' AND created_at >= datetime('now', ?)
       GROUP BY tool_name ORDER BY uses DESC`
    ).bind(`-${days} days`).all(),

    c.env.DB.prepare(
      `SELECT tl.user_id, u.name, u.email, COUNT(*) as uses, SUM(tl.credits_used) as credits
       FROM tool_usage_logs tl LEFT JOIN users u ON u.id = tl.user_id
       WHERE tl.status = 'success' AND tl.created_at >= datetime('now', ?)
       GROUP BY tl.user_id ORDER BY uses DESC LIMIT 20`
    ).bind(`-${days} days`).all(),

    c.env.DB.prepare(
      `SELECT date(created_at) as date, COUNT(*) as uses, SUM(credits_used) as credits
       FROM tool_usage_logs WHERE status = 'success' AND created_at >= datetime('now', ?)
       GROUP BY date(created_at) ORDER BY date ASC`
    ).bind(`-${days} days`).all(),
  ]);

  return success(c, { top_tools: topTools.results, top_users: topUsers.results, daily_usage: dailyUsage.results });
});

adminToolsRoutes.get('/credits/:userId', async (c) => {
  const userId = c.req.param('userId');
  const user = await c.env.DB.prepare('SELECT id, name, email FROM users WHERE id = ?').bind(userId).first();
  if (!user) return error(c, 'User tidak ditemukan', 404);

  const creditRow = await c.env.DB.prepare(
    'SELECT * FROM user_tool_credits WHERE user_id = ?'
  ).bind(userId).first();

  const transactions = await c.env.DB.prepare(
    `SELECT * FROM tool_credit_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
  ).bind(userId).all();

  return success(c, {
    user,
    credits: creditRow || { balance: 0, total_purchased: 0, total_used: 0 },
    transactions: transactions.results,
  });
});

adminToolsRoutes.post('/credits/:userId/adjust', async (c) => {
  const userId = c.req.param('userId');
  const adminUser = c.get('user');

  let body: { amount: number; description: string };
  try { body = await c.req.json(); } catch { return error(c, 'Invalid JSON', 400); }

  // M4: check undefined/null not falsy (so 0 is valid), plus range check
  if (body.amount === undefined || body.amount === null) return error(c, 'amount wajib diisi', 400);
  if (!body.description?.trim()) return error(c, 'description wajib diisi', 400);
  if (Math.abs(body.amount) > 100000) return error(c, 'Jumlah adjustment maksimal 100.000 kredit', 400);

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first();
  if (!user) return error(c, 'User tidak ditemukan', 404);

  const creditRow = await c.env.DB.prepare(
    'SELECT balance FROM user_tool_credits WHERE user_id = ?'
  ).bind(userId).first();

  const currentBalance = (creditRow?.balance as number) || 0;
  const newBalance = Math.max(0, currentBalance + body.amount);
  const now = new Date().toISOString();

  if (creditRow) {
    await c.env.DB.prepare(
      `UPDATE user_tool_credits SET balance = ?, updated_at = ? WHERE user_id = ?`
    ).bind(newBalance, now, userId).run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO user_tool_credits (id, user_id, balance, total_purchased, total_used, created_at, updated_at)
       VALUES (?, ?, ?, 0, 0, ?, ?)`
    ).bind(crypto.randomUUID(), userId, newBalance, now, now).run();
  }

  await c.env.DB.prepare(
    `INSERT INTO tool_credit_transactions (id, user_id, type, amount, balance_after, description, created_at)
     VALUES (?, ?, 'admin_adjust', ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(), userId, body.amount, newBalance,
    `${body.description} (by admin: ${adminUser.email})`,
    now
  ).run();

  return success(c, { balance: newBalance });
});

export default adminToolsRoutes;
