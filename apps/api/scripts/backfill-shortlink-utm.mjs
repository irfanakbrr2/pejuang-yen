/**
 * Backfill UTM kanonik untuk shortlinks lama — DRY-RUN by default (audit-only).
 *
 *   Dry-run (default, TIDAK menulis):
 *     npx tsx apps/api/scripts/backfill-shortlink-utm.mjs --env production --remote
 *   Apply (menulis; minta konfirmasi eksplisit via flag):
 *     npx tsx apps/api/scripts/backfill-shortlink-utm.mjs --env production --remote --apply
 *
 * Memakai normalizer SHARED (sumber kebenaran) — tidak menduplikasi aturan.
 */
import { execSync } from 'node:child_process';
import { normalizeUtmSet } from '../../../packages/shared/src/utm.ts';

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const REMOTE = args.has('--remote') ? '--remote' : '--local';
const ENV = args.has('--env') ? 'production' : ''; // sederhana: --env ⇒ production
const envFlag = ENV ? `--env ${ENV}` : '';

function d1(sql) {
  const cmd = `npx wrangler d1 execute growwithai-db ${envFlag} ${REMOTE} --json --command="${sql.replace(/"/g, '\\"')}"`;
  const out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const parsed = JSON.parse(out);
  const block = Array.isArray(parsed) ? parsed[0] : parsed;
  return block?.results || [];
}

function sqlStr(v) {
  return v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;
}

const rows = d1(
  `SELECT id, slug, utm_source, utm_medium, utm_campaign, utm_content FROM shortlinks ` +
  `WHERE utm_source IS NOT NULL OR utm_medium IS NOT NULL OR utm_campaign IS NOT NULL OR utm_content IS NOT NULL`
);

const beforeSources = new Set();
const afterSources = new Set();
const changes = [];

for (const r of rows) {
  const canon = normalizeUtmSet({
    source: r.utm_source, medium: r.utm_medium, campaign: r.utm_campaign, content: r.utm_content,
  });
  if (r.utm_source) beforeSources.add(r.utm_source);
  if (canon.utm_source) afterSources.add(canon.utm_source);

  const changed =
    (r.utm_source || null) !== canon.utm_source ||
    (r.utm_medium || null) !== canon.utm_medium ||
    (r.utm_campaign || null) !== canon.utm_campaign ||
    (r.utm_content || null) !== canon.utm_content;
  if (changed) changes.push({ r, canon });
}

console.log(`\n=== SHORTLINK UTM BACKFILL — ${APPLY ? 'APPLY' : 'DRY-RUN'} (${REMOTE}) ===`);
console.log(`Total shortlink dengan UTM : ${rows.length}`);
console.log(`Akan berubah               : ${changes.length}\n`);

console.log('DISTINCT utm_source — SEBELUM:', [...beforeSources].sort());
console.log('DISTINCT utm_source — SESUDAH:', [...afterSources].sort(), '\n');

for (const { r, canon } of changes) {
  console.log(`• ${r.slug}`);
  console.log(`    source : ${JSON.stringify(r.utm_source)} → ${JSON.stringify(canon.utm_source)}`);
  console.log(`    medium : ${JSON.stringify(r.utm_medium)} → ${JSON.stringify(canon.utm_medium)}`);
  if ((r.utm_campaign || null) !== canon.utm_campaign)
    console.log(`    campaign: ${JSON.stringify(r.utm_campaign)} → ${JSON.stringify(canon.utm_campaign)}`);
  if ((r.utm_content || null) !== canon.utm_content)
    console.log(`    content : ${JSON.stringify(r.utm_content)} → ${JSON.stringify(canon.utm_content)}`);
}

if (!APPLY) {
  console.log(`\nDRY-RUN selesai. TIDAK ada penulisan. Jalankan ulang dengan --apply untuk menulis.`);
  process.exit(0);
}

console.log(`\nMENULIS ${changes.length} perubahan...`);
for (const { r, canon } of changes) {
  const sql =
    `UPDATE shortlinks SET utm_source=${sqlStr(canon.utm_source)}, utm_medium=${sqlStr(canon.utm_medium)}, ` +
    `utm_campaign=${sqlStr(canon.utm_campaign)}, utm_content=${sqlStr(canon.utm_content)} WHERE id='${r.id}'`;
  d1(sql);
}
console.log('Selesai.');
