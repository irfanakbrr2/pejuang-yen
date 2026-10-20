import type { Env } from '../../env';
import { notifyUser } from '../../lib/notify';

export type ChallengeMetric = 'lessons' | 'points' | 'referrals' | 'webinars';

/**
 * Tambah progress untuk semua challenge AKTIF yang diikuti user dengan metric
 * tertentu. Saat progress mencapai target, tandai selesai + kirim notifikasi.
 * Dirancang untuk executionCtx.waitUntil — never throws.
 */
export async function bumpChallengeProgress(
  env: Env,
  userId: string,
  metric: ChallengeMetric,
  amount: number
): Promise<void> {
  if (!amount || amount <= 0) return;
  try {
    const now = new Date().toISOString();
    // Challenge aktif (dalam jendela waktu) dengan metric ini yang diikuti user & belum selesai.
    const rows = await env.DB.prepare(
      `SELECT cp.id as cp_id, cp.progress, c.id as challenge_id, c.title, c.target, c.reward_label
       FROM challenge_participants cp
       JOIN challenges c ON c.id = cp.challenge_id
       WHERE cp.user_id = ? AND cp.completed_at IS NULL
         AND c.metric = ? AND c.status = 'active'
         AND c.starts_at <= ? AND c.ends_at > ?`
    ).bind(userId, metric, now, now).all();

    for (const r of (rows.results || []) as any[]) {
      const next = (Number(r.progress) || 0) + amount;
      const reached = next >= Number(r.target);
      await env.DB.prepare(
        `UPDATE challenge_participants
         SET progress = ?, completed_at = ?, updated_at = ?
         WHERE id = ?`
      ).bind(next, reached ? now : null, now, r.cp_id).run();

      if (reached) {
        await notifyUser(env, userId, {
          title: `Challenge Selesai: ${r.title} 🎯`,
          body: r.reward_label
            ? `Kamu menuntaskan challenge "${r.title}". Hadiah: ${r.reward_label}.`
            : `Kamu menuntaskan challenge "${r.title}". Kerja bagus!`,
          url: '/growth-ambassador',
          tag: 'challenge',
          data: { challenge_id: r.challenge_id },
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[challenges] bumpChallengeProgress failed:', userId, metric, err);
  }
}
