import { Env } from "../../src/env";

export default {
  async fetch(request: Request, env: Env) {
    try {
      let where = 'WHERE 1=1';
      const params: unknown[] = [];
      const status = "pending";
      
      if (status) { where += ' AND o.status = ?'; params.push(status); }

      const countResult = await env.DB.prepare(
        `SELECT COUNT(*) as total FROM orders o JOIN users u ON o.user_id = u.id ${where}`
      ).bind(...params).first();

      const limit = 20;
      const offset = 0;

      const rows = await env.DB.prepare(
        `SELECT o.*, u.name as user_name, u.email as user_email
         FROM orders o
         JOIN users u ON o.user_id = u.id
         ${where}
         ORDER BY o.created_at DESC LIMIT ? OFFSET ?`
      ).bind(...params, limit, offset).all();

      return new Response(JSON.stringify({ success: true, count: countResult?.total, rows: rows.results.length }), { headers: { "content-type": "application/json" } });
    } catch (err: any) {
      return new Response(JSON.stringify({ success: false, error: err.message, stack: err.stack }), { status: 500 });
    }
  }
};
