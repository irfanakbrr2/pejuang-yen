#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Generator SQL seed user + SESSION test untuk load test (webinar-spike.js).
//
// Menghasilkan N user test ter-verifikasi + (default) satu session siap-pakai per
// user. Token session ditulis ke tokens.json agar k6 memakainya LANGSUNG sebagai
// cookie — tanpa login. Ini perlu karena /login di-rate-limit 5/menit per-IP:
// load test dari satu IP tak bisa login banyak user. Memakai session ter-seed
// juga lebih realistis (user nyata sudah punya cookie saat polling).
//
// Hash:
//   - password_hash: PBKDF2 (cocok dgn apps/api/src/lib/password.ts) — untuk login manual.
//   - session token_hash: SHA-256 hex (cocok dgn apps/api/src/lib/utils.ts sha256()).
//
// Pakai:
//   node gen-seed.mjs > seed.sql                 # 200 user + session, tokens.json
//   COUNT=2000 node gen-seed.mjs > seed.sql
//   WITH_SESSIONS=0 node gen-seed.mjs > seed.sql # user saja (tanpa session)
//
// Lalu (DI STAGING):
//   cd apps/api && npx wrangler d1 execute growwithai-db-staging --remote --file=../../scripts/loadtest/seed.sql
//   # tokens.json otomatis dipakai webinar-spike.js (-e TOKENS_FILE=...)
//
// Bersihkan:
//   DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'loadtest+%');
//   DELETE FROM users WHERE email LIKE 'loadtest+%@example.com';
// ─────────────────────────────────────────────────────────────────────────────

import { webcrypto as crypto } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const COUNT = parseInt(process.env.COUNT || '200', 10);
const PASSWORD = process.env.PASSWORD || 'LoadTest123!';
const PREFIX = process.env.PREFIX || 'loadtest+';
const DOMAIN = process.env.DOMAIN || 'example.com';
const WITH_SESSIONS = process.env.WITH_SESSIONS !== '0';
const TOKENS_OUT = process.env.TOKENS_OUT || 'tokens.json';
const ITERATIONS = 100000;

const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const km = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    km,
    256
  );
  return `pbkdf2:${ITERATIONS}:${hex(salt)}:${hex(bits)}`;
}

async function sha256hex(input) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return hex(buf);
}

const passwordHash = await hashPassword(PASSWORD);
const now = '2026-06-16T00:00:00.000Z';
const expires = '2027-06-16T00:00:00.000Z'; // jauh di masa depan

const lines = [];
const tokens = [];
lines.push('-- Seed user + session test load-test. JANGAN jalankan di produksi.');
lines.push(`-- ${COUNT} user, password: ${PASSWORD}, sessions: ${WITH_SESSIONS}`);
// Tanpa BEGIN/COMMIT — D1 menolak transaksi SQL eksplisit via execute.

for (let i = 1; i <= COUNT; i++) {
  const userId = crypto.randomUUID();
  const email = `${PREFIX}${i}@${DOMAIN}`;
  lines.push(
    `INSERT OR IGNORE INTO users (id, email, password_hash, name, role, status, email_verified_at, created_at, updated_at) ` +
      `VALUES ('${userId}', '${email}', '${passwordHash}', 'LoadTest ${i}', 'user', 'active', '${now}', '${now}', '${now}');`
  );

  if (WITH_SESSIONS) {
    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
    const tokenHash = await sha256hex(token);
    const sessionId = crypto.randomUUID();
    lines.push(
      `INSERT OR IGNORE INTO sessions (id, user_id, token_hash, expires_at, created_at) ` +
        `VALUES ('${sessionId}', '${userId}', '${tokenHash}', '${expires}', '${now}');`
    );
    tokens.push({ email, token });
  }
}

if (WITH_SESSIONS) {
  writeFileSync(TOKENS_OUT, JSON.stringify(tokens, null, 0));
  process.stderr.write(`✅ ${tokens.length} token ditulis ke ${TOKENS_OUT}\n`);
}

console.log(lines.join('\n'));
