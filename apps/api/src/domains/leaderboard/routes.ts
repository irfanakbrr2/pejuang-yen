import { Hono } from 'hono';
import type { Env } from '../../env';
import { optionalAuthMiddleware } from '../../middleware/auth';
import { success, error } from '../../lib/response';
import { kvGetOrSet } from '../../lib/cache';
import { computeLevel } from '../../lib/gamification';
import { getActiveSeason } from '../../lib/seasons';
import { getSnapshotRankMap } from '../../lib/rank-snapshots';

const leaderboardRoutes = new Hono<{ Bindings: Env }>();

function periodStartIso(period: string): string | null {
  const now = new Date();
  if (period === 'weekly') {
    return new Date(now.getTime() - 7 * 86400000).toISOString();
  }
  if (period === 'monthly') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  }
  return null; // lifetime
}

// ─── GET /api/leaderboard/learning?period=weekly|monthly|lifetime ───────────
// Ranked by points earned in the period (sum of point_transactions).
leaderboardRoutes.get('/learning', optionalAuthMiddleware(), async (c) => {
  try {
    const period = c.req.query('period') || 'weekly';
    if (!['weekly', 'monthly', 'lifetime', 'season'].includes(period)) {
      return error(c, 'Invalid period', 400);
    }

    // Musim aktif menentukan jendela waktu untuk period=season.
    let since = periodStartIso(period);
    let seasonName = '';
    if (period === 'season') {
      const season = await getActiveSeason(c.env.DB);
      since = season ? season.starts_at : periodStartIso('monthly');
      seasonName = season?.name || '';
    }

    const data = await kvGetOrSet(c.env, `leaderboard:learning:${period}`, 300, async () => {
      const dateFilter = since ? 'AND pt.earned_at >= ?' : '';
      const params: unknown[] = since ? [since] : [];

      const rows = await c.env.DB.prepare(
        `SELECT u.id as user_id, u.name, u.avatar_url, u.current_streak,
                SUM(pt.points) as period_points,
                COALESCE((SELECT up.total_points FROM user_points up WHERE up.user_id = u.id), 0) as total_points,
                (SELECT json_group_array(badge_key) FROM user_badges ub WHERE ub.user_id = u.id) as badges_json
         FROM point_transactions pt
         JOIN users u ON u.id = pt.user_id
         WHERE u.status = 'active' ${dateFilter}
         GROUP BY u.id
         ORDER BY period_points DESC, u.created_at ASC
         LIMIT 20`
      ).bind(...params).all();

      // Delta peringkat (vs snapshot mingguan) hanya untuk view bulanan.
      const snapMap = period === 'monthly' ? await getSnapshotRankMap(c.env.DB, 'learning') : null;

      const leaderboard = rows.results.map((r: any, i: number) => {
        let badges: string[] = [];
        try { badges = JSON.parse(r.badges_json || '[]'); } catch { /* ignore */ }
        const lvl = computeLevel(Number(r.total_points) || 0);
        const liveRank = i + 1;
        const lastRank = snapMap?.get(r.user_id);
        return {
          rank: liveRank,
          user_id: r.user_id,
          name: r.name,
          initials: (r.name as string).split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
          avatar: r.avatar_url || null,
          points: Number(r.period_points) || 0,
          streak: Number(r.current_streak) || 0,
          level: lvl.level,
          level_title: lvl.title,
          delta: lastRank !== undefined ? lastRank - liveRank : null,
          badges,
        };
      });

      const contextStr = period === 'weekly'
        ? '7 Hari Terakhir'
        : period === 'monthly'
          ? new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' })
          : period === 'season'
            ? (seasonName || 'Musim Ini')
            : 'Sepanjang Masa';

      return { leaderboard, context: contextStr };
    });

    // Authenticated caller: include their own rank even outside top 20
    let myRank = null;
    const user = c.get('user');
    if (user) {
      const inTop = data.leaderboard.find((e: any) => e.user_id === user.id);
      if (inTop) {
        myRank = inTop;
      } else {
        const dateFilter = since ? 'AND earned_at >= ?' : '';
        const params: unknown[] = since ? [since] : [];
        const mine = await c.env.DB.prepare(
          `SELECT COALESCE(SUM(points), 0) as pts FROM point_transactions WHERE user_id = ? ${dateFilter}`
        ).bind(user.id, ...params).first();
        const myPoints = Number(mine?.pts || 0);

        const rankRow = await c.env.DB.prepare(
          `SELECT COUNT(*) + 1 as rank FROM (
             SELECT user_id, SUM(points) as pts FROM point_transactions
             WHERE 1=1 ${dateFilter}
             GROUP BY user_id HAVING pts > ?
           )`
        ).bind(...params, myPoints).first();

        const streakRow = await c.env.DB.prepare(
          `SELECT u.current_streak,
                  COALESCE((SELECT total_points FROM user_points WHERE user_id = u.id), 0) as total_points
           FROM users u WHERE u.id = ?`
        ).bind(user.id).first();
        const myLevel = computeLevel(Number(streakRow?.total_points || 0));

        myRank = {
          rank: myPoints > 0 ? Number(rankRow?.rank || 0) : 0,
          user_id: user.id,
          name: user.name,
          initials: user.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
          avatar: user.avatar_url || null,
          points: myPoints,
          streak: Number(streakRow?.current_streak || 0),
          level: myLevel.level,
          level_title: myLevel.title,
          badges: [],
        };
      }
    }

    c.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
    return success(c, { ...data, myRank });
  } catch (err) {
    console.error('[leaderboard:learning]', err);
    return error(c, 'Gagal memuat leaderboard', 500);
  }
});

export default leaderboardRoutes;
