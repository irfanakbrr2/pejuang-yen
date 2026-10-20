// Penjadwalan: hitung next_run_at dari preset schedule, dan enqueue automation
// yang jatuh tempo. Dipanggil dari cron handler ('*/10 * * * *').
import type { Env } from '../../env';
import { AutomationRepository } from './repository';
import { enqueueAutomationRun } from '../../lib/automation-queue';
import type { Schedule, AutomationConfig } from './types';

const WIB_OFFSET_HOURS = 7;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.floor(Number.isFinite(n) ? n : lo)));
}

/**
 * Hitung instant berikutnya (ISO UTC) untuk sebuah jadwal.
 * Menit identik di WIB & UTC (offset 7 jam penuh); jam daily dikonversi.
 */
export function computeNextRun(schedule: Schedule, from: Date = new Date()): string {
  if (schedule.mode === 'interval') {
    const mins = clamp(schedule.everyMinutes, 10, 1440);
    return new Date(from.getTime() + mins * 60_000).toISOString();
  }

  if (schedule.mode === 'hourly') {
    const m = clamp(schedule.atMinute, 0, 59);
    const d = new Date(from.getTime());
    d.setUTCSeconds(0, 0);
    d.setUTCMinutes(m);
    if (d.getTime() <= from.getTime()) d.setUTCHours(d.getUTCHours() + 1);
    return d.toISOString();
  }

  // daily_times — beberapa jam/hari (WIB); pilih instant terdekat berikutnya
  if (schedule.mode === 'daily_times') {
    const times = (schedule.times || []).slice(0, 5);
    if (times.length === 0) return new Date(from.getTime() + 60 * 60_000).toISOString();
    const candidates = times.map((t) => nextDailyInstant(clamp(t.hour, 0, 23), clamp(t.minute, 0, 59), from));
    return new Date(Math.min(...candidates)).toISOString();
  }

  // daily — atHour dalam WIB
  const H = clamp(schedule.atHour, 0, 23);
  const M = clamp(schedule.atMinute, 0, 59);
  return new Date(nextDailyInstant(H, M, from)).toISOString();
}

/** Instant (ms) kemunculan berikutnya untuk jam HH:MM WIB, relatif terhadap `from`. */
function nextDailyInstant(hourWib: number, minute: number, from: Date): number {
  const utcHour = (hourWib - WIB_OFFSET_HOURS + 24) % 24;
  const d = new Date(from.getTime());
  d.setUTCSeconds(0, 0);
  d.setUTCMinutes(minute);
  d.setUTCHours(utcHour);
  if (d.getTime() <= from.getTime()) d.setUTCDate(d.getUTCDate() + 1);
  return d.getTime();
}

/** Label human-readable untuk ditampilkan di UI / disimpan di schedule_label. */
export function scheduleLabel(schedule: Schedule): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  if (schedule.mode === 'interval') return `Tiap ${schedule.everyMinutes} menit`;
  if (schedule.mode === 'hourly') return `Tiap jam menit :${pad(schedule.atMinute)} WIB`;
  if (schedule.mode === 'daily_times') {
    const ts = (schedule.times || []).slice(0, 5).map((t) => `${pad(t.hour)}:${pad(t.minute)}`).join(', ');
    return `Setiap hari ${ts || '—'} WIB`;
  }
  return `Setiap hari ${pad(schedule.atHour)}:${pad(schedule.atMinute)} WIB`;
}

/**
 * Cari automation aktif yang jatuh tempo, buat run, majukan next_run_at,
 * lalu enqueue. Mengembalikan jumlah yang di-enqueue.
 */
export async function runDueAutomations(env: Env): Promise<number> {
  const repo = new AutomationRepository(env);
  const now = new Date();
  const due = await repo.findDue(now.toISOString());
  let enqueued = 0;

  for (const a of due) {
    try {
      const config = JSON.parse(a.config_json || '{}') as AutomationConfig;
      const runId = crypto.randomUUID();
      await repo.createRun({ id: runId, automation_id: a.id, user_id: a.user_id, trigger: 'schedule' });

      // Majukan next_run_at SEBELUM enqueue agar tidak dobel-trigger di cron berikutnya.
      const next = config.schedule ? computeNextRun(config.schedule, now) : null;
      await repo.setNextRun(a.id, next, now.toISOString());

      await enqueueAutomationRun(env, { automationId: a.id, runId, trigger: 'schedule' });
      enqueued++;
    } catch (err) {
      console.error('[AUTOMATION][scheduler] enqueue failed for', a.id, err);
    }
  }
  return enqueued;
}
