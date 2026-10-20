import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware } from '../../middleware/auth';
import { success } from '../../lib/response';

const creditsRoutes = new Hono<{ Bindings: Env }>();
creditsRoutes.use('*', authMiddleware());

creditsRoutes.get('/credits', async (c) => {
  const user = c.get('user');

  const creditRow = await c.env.DB.prepare(
    'SELECT balance, total_purchased, total_used FROM user_tool_credits WHERE user_id = ?'
  ).bind(user.id).first();

  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;

  const total = ((await c.env.DB.prepare(
    'SELECT COUNT(*) as n FROM tool_credit_transactions WHERE user_id = ?'
  ).bind(user.id).first())?.n as number) || 0;

  const transactions = await c.env.DB.prepare(
    `SELECT id, type, amount, balance_after, tool_name, description, created_at
     FROM tool_credit_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(user.id, limit, offset).all();

  return success(c, {
    balance: (creditRow?.balance as number) || 0,
    total_purchased: (creditRow?.total_purchased as number) || 0,
    total_used: (creditRow?.total_used as number) || 0,
    transactions: transactions.results,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

creditsRoutes.get('/credits/packages', async (c) => {
  const rows = await c.env.DB.prepare(
    'SELECT * FROM tool_credit_packages WHERE is_active = 1 ORDER BY sort_order ASC'
  ).all();
  return success(c, rows.results);
});

export default creditsRoutes;
