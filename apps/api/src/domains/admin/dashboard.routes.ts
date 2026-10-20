import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error } from '../../lib/response';

const adminDashboardRoutes = new Hono<{ Bindings: Env }>();

adminDashboardRoutes.use('*', authMiddleware());
adminDashboardRoutes.use('*', requireRole('admin', 'super_admin'));

adminDashboardRoutes.get('/stats', async (c) => {
  try {
    const db = c.env.DB;

    const [
      totalUsers,
      activeMembers,
      totalRevenue,
      pendingOrders,
      recentOrders,
      pendingCommissions,
      totalCourses,
      totalEnrollments,
      // Revenue by order_type (lifetime totals)
      revenueByType,
      // Revenue this month by order_type & membership duration
      revenueThisMonth,
      // MRR: monthly membership orders paid this month
      mrrResult,
      // New members this month
      newMembersThisMonth,
      // Orders by status
      ordersByStatus,
      // New users per day (last 7 days)
      newUsersByDay,
      // Revenue chart last 90 days split by order_type
      revenueByDayAndType,
    ] = await Promise.all([
      db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'user'").first(),
      db.prepare("SELECT COUNT(*) as count FROM memberships WHERE status = 'active'").first(),
      db.prepare(`
        SELECT COALESCE(SUM(p.amount), 0) as total
        FROM payments p
        JOIN orders o ON o.id = p.order_id
        WHERE p.status = 'paid'
      `).first(),
      db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'").first(),
      db.prepare(`
        SELECT o.order_number as orderId, u.name as user,
               COALESCE(p.amount, o.amount) as amount,
               p.id as payment_id,
               o.status, o.order_type, o.product_name
        FROM orders o
        JOIN users u ON u.id = o.user_id
        LEFT JOIN payments p ON p.order_id = o.id AND p.status = 'paid'
        ORDER BY o.created_at DESC
        LIMIT 5
      `).all(),
      db.prepare("SELECT COUNT(*) as count FROM affiliate_commissions WHERE status = 'pending'").first(),
      db.prepare("SELECT COUNT(*) as count FROM courses WHERE status != 'archived'").first(),
      db.prepare("SELECT COUNT(*) as count FROM enrollments").first(),

      // ── Revenue by type (all time) ───────────────────────────────────
      db.prepare(`
        SELECT o.order_type, SUM(p.amount) as total, COUNT(*) as count
        FROM payments p
        JOIN orders o ON o.id = p.order_id
        WHERE p.status = 'paid'
        GROUP BY o.order_type
      `).all(),

      // ── Revenue bulan ini by order_type ─────────────────────────────
      db.prepare(`
        SELECT o.order_type, SUM(p.amount) as total, COUNT(*) as count
        FROM payments p
        JOIN orders o ON o.id = p.order_id
        WHERE p.status = 'paid'
          AND COALESCE(p.paid_at, p.created_at) >= date('now', 'start of month')
        GROUP BY o.order_type
      `).all(),

      // ── MRR: membership dari plan MONTHLY dibayar bulan ini ─────────
      // Join ke membership_plans untuk filter duration_type = 'monthly'
      db.prepare(`
        SELECT SUM(p.amount) as mrr
        FROM payments p
        JOIN orders o ON o.id = p.order_id
        JOIN membership_plans mp ON o.product_id = mp.id
        WHERE p.status = 'paid'
          AND o.order_type = 'membership'
          AND mp.duration_type = 'monthly'
          AND COALESCE(p.paid_at, p.created_at) >= date('now', 'start of month')
      `).first(),

      // ── New memberships created this month ───────────────────────────
      db.prepare(`
        SELECT COUNT(*) as count
        FROM memberships
        WHERE created_at >= date('now', 'start of month')
      `).first(),

      // ── Orders by status ─────────────────────────────────────────────
      db.prepare(`
        SELECT status, COUNT(*) as count
        FROM orders
        GROUP BY status
      `).all(),

      // ── New users per day (last 7 days) ──────────────────────────────
      db.prepare(`
        SELECT
          date(created_at) as date,
          COUNT(*) as count
        FROM users
        WHERE created_at >= date('now', '-6 days')
        GROUP BY date(created_at)
        ORDER BY date ASC
      `).all(),

      // ── Revenue per day (last 90 days) split by order_type ───────────
      db.prepare(`
        SELECT
          date(COALESCE(p.paid_at, p.created_at)) as date,
          o.order_type,
          SUM(p.amount) as revenue
        FROM payments p
        JOIN orders o ON o.id = p.order_id
        WHERE p.status = 'paid'
          AND COALESCE(p.paid_at, p.created_at) >= date('now', '-89 days')
        GROUP BY date(COALESCE(p.paid_at, p.created_at)), o.order_type
        ORDER BY date ASC
      `).all(),
    ]);

    // ── Compute revenue breakdowns ───────────────────────────────────────
    const byTypeMap: Record<string, { total: number; count: number }> = {};
    for (const row of (revenueByType.results as any[])) {
      byTypeMap[row.order_type] = { total: row.total || 0, count: row.count || 0 };
    }
    const membershipRevenueTotal = byTypeMap['membership']?.total || 0;
    const courseRevenueTotal = byTypeMap['course']?.total || 0;
    const toolCreditsRevenueTotal = byTypeMap['tool_credits']?.total || 0;

    const thisMonthMap: Record<string, { total: number; count: number }> = {};
    for (const row of (revenueThisMonth.results as any[])) {
      thisMonthMap[row.order_type] = { total: row.total || 0, count: row.count || 0 };
    }
    const membershipRevenueThisMonth = thisMonthMap['membership']?.total || 0;
    const courseRevenueThisMonth = thisMonthMap['course']?.total || 0;
    const toolCreditsRevenueThisMonth = thisMonthMap['tool_credits']?.total || 0;
    const totalRevenueThisMonth = membershipRevenueThisMonth + courseRevenueThisMonth + toolCreditsRevenueThisMonth;

    const mrr = (mrrResult as any)?.mrr || 0;
    const arr = mrr * 12;

    // ── Build stacked revenue chart (last 90 days) ───────────────────────
    // Map: date -> { membership: number; course: number; toolCredits: number }
    const revStackMap: Record<string, { membership: number; course: number; toolCredits: number }> = {};
    for (const row of (revenueByDayAndType.results as any[])) {
      if (!revStackMap[row.date]) revStackMap[row.date] = { membership: 0, course: 0, toolCredits: 0 };
      if (row.order_type === 'membership') revStackMap[row.date].membership = row.revenue || 0;
      if (row.order_type === 'course') revStackMap[row.date].course = row.revenue || 0;
      if (row.order_type === 'tool_credits') revStackMap[row.date].toolCredits = row.revenue || 0;
    }

    const revenueChart = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      revenueChart.push({
        date: key,
        membership: revStackMap[key]?.membership || 0,
        course: revStackMap[key]?.course || 0,
        toolCredits: revStackMap[key]?.toolCredits || 0,
        revenue: (revStackMap[key]?.membership || 0) + (revStackMap[key]?.course || 0) + (revStackMap[key]?.toolCredits || 0),
      });
    }

    // ── Build user growth chart (last 7 days) ────────────────────────────
    const userMap: Record<string, number> = {};
    for (const row of (newUsersByDay.results as any[])) {
      userMap[row.date] = row.count;
    }
    const userChart = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
      userChart.push({ date: label, count: userMap[key] || 0 });
    }

    return success(c, {
      stats: {
        totalUsers: (totalUsers as any)?.count || 0,
        activeMembers: (activeMembers as any)?.count || 0,
        totalRevenue: (totalRevenue as any)?.total || 0,
        pendingOrders: (pendingOrders as any)?.count || 0,
        pendingCommissions: (pendingCommissions as any)?.count || 0,
        totalCourses: (totalCourses as any)?.count || 0,
        totalEnrollments: (totalEnrollments as any)?.count || 0,
      },
      revenueStats: {
        // Recurring (MRR/ARR)
        mrr,
        arr,
        // This month breakdown
        totalRevenueThisMonth,
        membershipRevenueThisMonth,
        courseRevenueThisMonth,
        toolCreditsRevenueThisMonth,
        newMembersThisMonth: (newMembersThisMonth as any)?.count || 0,
        // All-time breakdown by type
        membershipRevenueTotal,
        courseRevenueTotal,
        toolCreditsRevenueTotal,
      },
      recentOrders: recentOrders.results,
      revenueChart,   // 90 days, with { date, membership, course, toolCredits, revenue }
      userChart,
      ordersByStatus: ordersByStatus.results,
    });
  } catch (err: any) {
    return error(c, `Failed to load stats: ${err.message}`, 500);
  }
});

export default adminDashboardRoutes;
