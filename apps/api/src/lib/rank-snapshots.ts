import type { Env } from '../env';
import { notifyUser } from './notify';

export type RankBoard = 'learning' | 'affiliate';

const MAX_RANKED = 300; // batasi kerja cron pada papan atas
const PUSH_RANK_CAP = 50; // hanya kirim push bila masuk top-50 (relevan & tak spam)

function monthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Hitung peringkat bulan berjalan untuk sebuah papan → array {user_id, rank} (1-based). */
async function computeMonthlyRanks(env: Env, board: RankBoard): Promise<{ user_id: string; rank: number }[]> {
  const since = monthStartIso();
  let rows;
  if (board === 'learning') {
    rows = await env.DB.prepare(
      `SELECT u.id as user_id
       FROM point_transactions pt JOIN users u ON u.id = pt.user_id
       WHERE u.status = 'active' AND pt.earned_at >= ?
       GROUP BY u.id
       ORDER BY SUM(pt.points) DESC, u.created_at ASC
       LIMIT ?`
    ).bind(since, MAX_RANKED).all();
  } else {
    rows = await env.DB.prepare(
      `SELECT aa.user_id as user_id
       FROM affiliate_commissions ac
       JOIN affiliate_accounts aa ON aa.affiliate_code = ac.affiliate_code
       JOIN users u ON u.id = aa.user_id
       WHERE aa.status = 'active' AND ac.status != 'rejected' AND ac.created_at >= ?
       GROUP BY aa.user_id
       ORDER BY SUM(ac.commission_amount) DESC, u.created_at ASC
       LIMIT ?`
    ).bind(since, MAX_RANKED).all();
  }
  return ((rows.results || []) as any[]).map((r, i) => ({ user_id: r.user_id, rank: i + 1 }));
}

/**
 * Job mingguan: hitung peringkat bulan berjalan, bandingkan dengan snapshot
 * sebelumnya, kirim push ke yang NAIK peringkat (dan masuk top-50), lalu simpan
 * snapshot baru. Dirancang untuk cron — never throws.
 */
export async function runWeeklyRankUp(env: Env): Promise<{ pushed: number }> {
  let pushed = 0;
  const now = new Date().toISOString();
  try {
    for (const board of ['learning', 'affiliate'] as RankBoard[]) {
      const ranks = await computeMonthlyRanks(env, board);
      if (ranks.length === 0) continue;

      // Snapshot sebelumnya untuk papan ini.
      const prevRows = await env.DB.prepare(
        `SELECT user_id, rank FROM leaderboard_rank_snapshots WHERE board = ?`
      ).bind(board).all();
      const prev = new Map<string, number>();
      for (const r of (prevRows.results || []) as any[]) prev.set(r.user_id, Number(r.rank));

      for (const { user_id, rank } of ranks) {
        const old = prev.get(user_id);
        // Naik peringkat = rank lebih kecil dari sebelumnya, dan masuk top-50.
        if (old !== undefined && rank < old && rank <= PUSH_RANK_CAP) {
          const climbed = old - rank;
          await notifyUser(env, user_id, {
            title: `Kamu naik ${climbed} peringkat! 🚀`,
            body:
              board === 'learning'
                ? `Dari #${old} ke #${rank} di leaderboard belajar minggu ini. Pertahankan!`
                : `Dari #${old} ke #${rank} di leaderboard komisi minggu ini. Mantap!`,
            url: '/growth-ambassador',
            tag: `rankup-${board}`,
          }).catch(() => {});
          pushed++;
        }
        await env.DB.prepare(
          `INSERT INTO leaderboard_rank_snapshots (user_id, board, rank, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(user_id, board) DO UPDATE SET rank = excluded.rank, updated_at = excluded.updated_at`
        ).bind(user_id, board, rank, now).run();
      }
    }
  } catch (err) {
    console.error('[rank-snapshots] runWeeklyRankUp failed:', err);
  }
  return { pushed };
}

/**
 * Peta rank snapshot (Senin lalu) untuk papan tertentu → dipakai leaderboard
 * menghitung delta: delta = lastRank - liveRank (positif = naik).
 */
export async function getSnapshotRankMap(db: D1Database, board: RankBoard): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const rows = await db.prepare(
      `SELECT user_id, rank FROM leaderboard_rank_snapshots WHERE board = ?`
    ).bind(board).all();
    for (const r of (rows.results || []) as any[]) map.set(r.user_id, Number(r.rank));
  } catch (err) {
    console.error('[rank-snapshots] getSnapshotRankMap failed:', err);
  }
  return map;
}
