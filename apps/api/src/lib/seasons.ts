import type { Env } from '../env';
import { notifyUser } from './notify';

export interface Season {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  status: string;
}

/**
 * Ambil musim aktif saat ini (status='active' dan now di dalam jendela). Bila
 * tidak ada, kembalikan musim active terbaru sebagai fallback (boleh null).
 */
export async function getActiveSeason(db: D1Database): Promise<Season | null> {
  const now = new Date().toISOString();
  const row = await db.prepare(
    `SELECT id, name, starts_at, ends_at, status FROM seasons
     WHERE status = 'active' AND starts_at <= ? AND ends_at > ?
     ORDER BY starts_at DESC LIMIT 1`
  ).bind(now, now).first();
  if (row) return row as unknown as Season;

  const fallback = await db.prepare(
    `SELECT id, name, starts_at, ends_at, status FROM seasons
     WHERE status = 'active' ORDER BY starts_at DESC LIMIT 1`
  ).first();
  return (fallback as unknown as Season) || null;
}

function nextMonthWindow(after: Date): { name: string; starts: string; ends: string; id: string } {
  const y = after.getUTCFullYear();
  const m = after.getUTCMonth(); // 0-based; `after` adalah awal bulan baru
  const starts = new Date(Date.UTC(y, m, 1));
  const ends = new Date(Date.UTC(y, m + 1, 1));
  const monthName = starts.toLocaleString('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const id = `season-${y}-${String(m + 1).padStart(2, '0')}`;
  return { name: `Musim ${monthName}`, starts: starts.toISOString(), ends: ends.toISOString(), id };
}

/**
 * Tutup musim yang sudah lewat ends_at: arsipkan juara learning & affiliate ke
 * season_winners, set status='closed', lalu buka musim bulan berikutnya.
 * Dirancang untuk cron daily — tidak pernah throw. Mengembalikan jumlah musim ditutup.
 */
export async function rolloverSeasons(env: Env): Promise<{ closed: number; opened: number }> {
  const db = env.DB;
  let closed = 0;
  let opened = 0;
  try {
    const now = new Date().toISOString();
    const due = await db.prepare(
      `SELECT id, name, starts_at, ends_at FROM seasons WHERE status = 'active' AND ends_at <= ?`
    ).bind(now).all();

    for (const s of (due.results || []) as any[]) {
      const createdAt = new Date().toISOString();

      // Arsip top 10 learning (poin dalam jendela musim)
      const learners = await db.prepare(
        `SELECT u.id as user_id, u.name, SUM(pt.points) as score
         FROM point_transactions pt JOIN users u ON u.id = pt.user_id
         WHERE u.status = 'active' AND pt.earned_at >= ? AND pt.earned_at < ?
         GROUP BY u.id ORDER BY score DESC, u.created_at ASC LIMIT 10`
      ).bind(s.starts_at, s.ends_at).all();

      // Arsip top 10 affiliate (komisi dalam jendela musim, non-rejected)
      const affiliates = await db.prepare(
        `SELECT aa.user_id, u.name, SUM(ac.commission_amount) as score
         FROM affiliate_commissions ac
         JOIN affiliate_accounts aa ON aa.affiliate_code = ac.affiliate_code
         JOIN users u ON u.id = aa.user_id
         WHERE ac.status != 'rejected' AND ac.created_at >= ? AND ac.created_at < ?
         GROUP BY aa.user_id ORDER BY score DESC, u.created_at ASC LIMIT 10`
      ).bind(s.starts_at, s.ends_at).all();

      const archive = async (board: string, rows: any[]) => {
        let rank = 0;
        for (const r of rows) {
          rank++;
          await db.prepare(
            `INSERT INTO season_winners (id, season_id, board, rank, user_id, display_name, score, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(crypto.randomUUID(), s.id, board, rank, r.user_id, r.name || null, Number(r.score) || 0, createdAt).run();
        }
        return rows;
      };
      const learnerRows = await archive('learning', (learners.results || []) as any[]);
      await archive('affiliate', (affiliates.results || []) as any[]);

      await db.prepare(`UPDATE seasons SET status = 'closed' WHERE id = ?`).bind(s.id).run();
      closed++;

      // Buka musim berikutnya bila belum ada yang aktif menutupi sekarang.
      const win = nextMonthWindow(new Date(s.ends_at));
      const ins = await db.prepare(
        `INSERT OR IGNORE INTO seasons (id, name, starts_at, ends_at, status, created_at)
         VALUES (?, ?, ?, ?, 'active', ?)`
      ).bind(win.id, win.name, win.starts, win.ends, createdAt).run();
      if ((ins.meta?.changes || 0) > 0) opened++;

      // Notifikasi juara #1 learning (in-app + push, best-effort).
      const champ = learnerRows[0];
      if (champ) {
        await notifyUser(env, champ.user_id, {
          title: `Juara ${s.name}! 👑`,
          body: `Selamat! Kamu menempati peringkat #1 leaderboard belajar di ${s.name}. Pertahankan di musim baru!`,
          url: '/growth-ambassador',
          tag: 'season-champion',
          data: { season_id: s.id },
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[seasons] rolloverSeasons failed:', err);
  }
  return { closed, opened };
}
