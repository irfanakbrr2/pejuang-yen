#!/usr/bin/env node
/**
 * html-to-lesson-sql.mjs
 * Ubah satu file HTML (materi bacaan / quiz) menjadi statement
 * `INSERT OR IGNORE INTO lessons (...)` dengan content_embed yang sudah di-escape.
 *
 * Kenapa perlu: konten HTML penuh harus masuk kolom content_embed sebagai string SQL.
 * Di SQLite/D1 hanya single-quote yang perlu di-escape (' -> ''). Script ini mengurusnya.
 *
 * Contoh:
 *   node html-to-lesson-sql.mjs \
 *     --file template-quiz.html \
 *     --course course-n8n-automation \
 *     --module mod-n8n-001 \
 *     --title "Post Test N8N" \
 *     --slug post-test-n8n \
 *     --type quiz \
 *     --sort 9 >> ../apps/api/src/db/migrations/0047_n8n_posttest.sql
 *
 * Flags:
 *   --file     (wajib) path file HTML
 *   --course   (wajib) course_id
 *   --module   (wajib) module_id
 *   --title    (wajib) judul lesson
 *   --slug     (wajib) slug lesson (huruf kecil, angka, strip)
 *   --type     lesson_type: text | quiz | video | resource   (default: text)
 *   --id       id lesson                                       (default: lesson-<slug>)
 *   --sort     sort_order                                      (default: 0)
 *   --preview  is_preview 0/1                                  (default: 0)
 *   --status   draft | published                              (default: published)
 *   --desc     description singkat                             (default: "")
 *   --date     ISO timestamp                                   (default: hari ini)
 */

import { readFileSync } from "node:fs";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out[key] = val;
    }
  }
  return out;
}

// String literal SQL: bungkus single-quote, escape ' -> ''. Null jika kosong.
function sq(v) {
  if (v === undefined || v === null || v === "") return "NULL";
  return "'" + String(v).replace(/'/g, "''") + "'";
}

const args = parseArgs(process.argv.slice(2));

const required = ["file", "course", "module", "title", "slug"];
const missing = required.filter((k) => !args[k]);
if (missing.length) {
  console.error("ERROR: flag wajib hilang: " + missing.map((m) => "--" + m).join(", "));
  console.error("Jalankan dengan --help untuk melihat contoh, atau buka komentar di atas file ini.");
  process.exit(1);
}

if (!/^[a-z0-9-]+$/.test(args.slug)) {
  console.error('ERROR: --slug harus huruf kecil/angka/strip saja (regex ^[a-z0-9-]+$). Dapat: "' + args.slug + '"');
  process.exit(1);
}

const type = args.type || "text";
const allowedTypes = ["text", "quiz", "video", "resource"];
if (!allowedTypes.includes(type)) {
  console.error("ERROR: --type harus salah satu dari: " + allowedTypes.join(", "));
  process.exit(1);
}

let html;
try {
  html = readFileSync(args.file, "utf8");
} catch (err) {
  console.error("ERROR: gagal baca file " + args.file + " -> " + err.message);
  process.exit(1);
}

const id = args.id || "lesson-" + args.slug;
const sort = Number.isFinite(Number(args.sort)) ? Number(args.sort) : 0;
const preview = args.preview === "1" ? 1 : 0;
const status = args.status || "published";
const date = args.date || new Date().toISOString();
const desc = args.desc || "";

const sql =
`-- Lesson "${args.title}" (${type}) untuk course ${args.course}
INSERT OR IGNORE INTO lessons
  (id, course_id, module_id, title, slug, lesson_type, content_embed, content_format, description, is_preview, sort_order, status, created_at, updated_at)
VALUES
  (${sq(id)}, ${sq(args.course)}, ${sq(args.module)}, ${sq(args.title)}, ${sq(args.slug)}, ${sq(type)},
   ${sq(html)},
   'html', ${sq(desc)}, ${preview}, ${sort}, ${sq(status)}, ${sq(date)}, ${sq(date)});
`;

process.stdout.write(sql);
