import { Hono } from 'hono';
import type { Env } from '../../env';
import { authMiddleware, optionalAuthMiddleware } from '../../middleware/auth';
import { success, error } from '../../lib/response';

const challengeRoutes = new Hono<{ Bindings: Env }>();

// ─── GET /api/challenges/active ─────────────────────────────────────────────
// Daftar challenge aktif + (jika login) progress & status join user.
challengeRoutes.get('/active', optionalAuthMiddleware(), async (c) => {
  try {
    const now = new Date().toISOString();
    const user = c.get('user');

    const rows = await c.env.DB.prepare(
      `SELECT c.id, c.title, c.description, c.metric, c.target, c.reward_label,
              c.starts_at, c.ends_at,
              (SELECT COUNT(*) FROM challenge_participants cp WHERE cp.challenge_id = c.id) as participants
       FROM challenges c
       WHERE c.status = 'active' AND c.starts_at <= ? AND c.ends_at > ?
       ORDER BY c.ends_at ASC`
    ).bind(now, now).all();

    let myProgress: Record<string, { progress: number; completed: boolean; joined: boolean }> = {};
    if (user && (rows.results || []).length > 0) {
      const mine = await c.env.DB.prepare(
        `SELECT challenge_id, progress, completed_at FROM challenge_participants WHERE user_id = ?`
      ).bind(user.id).all();
      for (const m of (mine.results || []) as any[]) {
        myProgress[m.challenge_id] = {
          progress: Number(m.progress) || 0,
          completed: !!m.completed_at,
          joined: true,
        };
      }
    }

    const challenges = (rows.results || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      metric: r.metric,
      target: Number(r.target) || 0,
      reward_label: r.reward_label,
      starts_at: r.starts_at,
      ends_at: r.ends_at,
      participants: Number(r.participants) || 0,
      me: myProgress[r.id] || { progress: 0, completed: false, joined: false },
    }));

    return success(c, { challenges });
  } catch (err) {
    console.error('[challenges:active]', err);
    return error(c, 'Gagal memuat challenge', 500);
  }
});

// ─── GET /api/challenges/:id/leaderboard ────────────────────────────────────
challengeRoutes.get('/:id/leaderboard', optionalAuthMiddleware(), async (c) => {
  try {
    const id = c.req.param('id');
    const rows = await c.env.DB.prepare(
      `SELECT cp.user_id, cp.progress, cp.completed_at, u.name, u.avatar_url
       FROM challenge_participants cp JOIN users u ON u.id = cp.user_id
       WHERE cp.challenge_id = ? AND u.status = 'active'
       ORDER BY cp.progress DESC, cp.updated_at ASC
       LIMIT 20`
    ).bind(id).all();

    const leaderboard = (rows.results || []).map((r: any, i: number) => ({
      rank: i + 1,
      user_id: r.user_id,
      name: r.name,
      initials: (r.name as string).split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase(),
      avatar: r.avatar_url || null,
      progress: Number(r.progress) || 0,
      completed: !!r.completed_at,
    }));

    return success(c, { leaderboard });
  } catch (err) {
    console.error('[challenges:leaderboard]', err);
    return error(c, 'Gagal memuat leaderboard challenge', 500);
  }
});

// ─── POST /api/challenges/:id/join ──────────────────────────────────────────
challengeRoutes.post('/:id/join', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    const user = c.get('user');
    const now = new Date().toISOString();

    const challenge = await c.env.DB.prepare(
      `SELECT id FROM challenges WHERE id = ? AND status = 'active' AND starts_at <= ? AND ends_at > ?`
    ).bind(id, now, now).first();
    if (!challenge) return error(c, 'Challenge tidak ditemukan atau sudah berakhir', 404);

    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO challenge_participants (id, challenge_id, user_id, progress, joined_at, updated_at)
       VALUES (?, ?, ?, 0, ?, ?)`
    ).bind(crypto.randomUUID(), id, user.id, now, now).run();

    return success(c, { joined: true });
  } catch (err) {
    console.error('[challenges:join]', err);
    return error(c, 'Gagal bergabung ke challenge', 500);
  }
});

export default challengeRoutes;
