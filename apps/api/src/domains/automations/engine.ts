// Engine eksekusi automation — step bertipe (typed nodes), tanpa eval/JS untrusted.
// Tiap step memutasi ctx.data; runner menjalankan step sesuai urutan template.
import type { Env } from '../../env';
import { callSumopodChat } from '../../services/sumopod';
import { AutomationRepository } from './repository';
import { getTemplate, buildThreadSystemPrompt, DEFAULT_NEWS_FEEDS } from './templates';
import type { AutomationRow, AutomationConfig } from './types';

export interface RunContext {
  env: Env;
  repo: AutomationRepository;
  automation: AutomationRow;
  config: AutomationConfig;
  /** role credential -> field terdekripsi */
  credentials: Record<string, Record<string, string>>;
  data: Record<string, unknown>;
  log: (msg: string) => void;
}

type StepHandler = (ctx: RunContext) => Promise<void>;

// ─── Step: pickTopic ─────────────────────────────────────────────
const pickTopic: StepHandler = async (ctx) => {
  const topics = await ctx.repo.listTopics(ctx.automation.id);
  if (topics.length === 0) throw new Error('Belum ada topik. Tambahkan daftar topik dulu.');

  let unused = topics.filter((t) => !t.used_at);
  if (unused.length === 0) {
    // Semua terpakai → reset rotasi.
    await ctx.env.DB.prepare(
      `UPDATE automation_topics SET used_at = NULL WHERE automation_id = ?`
    ).bind(ctx.automation.id).run();
    unused = topics;
    ctx.log('Semua topik terpakai — rotasi direset.');
  }

  const picked = unused[Math.floor(Math.random() * unused.length)];
  ctx.data.topic = picked.topic;
  ctx.data.topicId = picked.id;
  ctx.log(`Topik dipilih: ${picked.topic}`);
};

// ─── Step: aiGenerate ────────────────────────────────────────────
const aiGenerate: StepHandler = async (ctx) => {
  // Override penuh > framework+persona. Persona dirakit dari field config user.
  const override = String(ctx.config.systemPromptOverride || '').trim();
  const system = override || buildThreadSystemPrompt({
    handle: ctx.config.personaHandle as string | undefined,
    bio: ctx.config.personaBio as string | undefined,
    audience: ctx.config.personaAudience as string | undefined,
    tone: ctx.config.personaTone as string | undefined,
  });
  const topic = String(ctx.data.topic || '');
  const userPrompt = [
    'Buat 1 thread viral lengkap sesuai semua instruksi.',
    '',
    `TOPIK SPESIFIK YANG HARUS DIBAHAS: ${topic}`,
    '',
    'PENTING:',
    '- Bahas TEPAT topik di atas, jangan ganti atau melenceng',
    '- Buat hook yang tidak bisa ditebak dari kalimat pertama',
    '- Sertakan data atau angka konkret',
    '- JANGAN gunakan * atau ** — pakai HURUF KAPITAL atau tanda petik untuk menekankan',
    '',
    'Output HANYA tweet bernomor. Tidak ada teks lain apapun.',
  ].join('\n');

  const raw = await callSumopodChat(ctx.env, { system, user: userPrompt, mode: 'deep', temperature: 0.8 });
  ctx.data.rawText = raw;
  ctx.log(`AI generate selesai (${raw.length} char).`);
};

// ─── Step: parseThread ───────────────────────────────────────────
// Port 3-tier parser dari node n8n "Parse Output AI".
const parseThread: StepHandler = async (ctx) => {
  const rawText = String(ctx.data.rawText || '');
  let parts: string[] = [];

  // Tier 1: blok dipisah "N.\n"
  const blocks = rawText.split(/\n(?=\d{1,2}\.\s*\n)/);
  for (const block of blocks) {
    const content = block.replace(/^\d{1,2}\.\s*\n+/, '').trim();
    if (content.length > 10) parts.push(content);
  }

  // Tier 2: regex penuh (juga menangani format inline "N. teks")
  if (parts.length < 8) {
    parts = [];
    const regex = /(?:^|\n)(\d{1,2})\.(\s*\n|\s+)([\s\S]*?)(?=\n\d{1,2}\.|$)/gm;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(rawText)) !== null) {
      const content = match[3].trim();
      if (content.length > 10) parts.push(content);
    }
  }

  // Tier 3: line-by-line — hanya bila tier 1 & 2 belum menghasilkan thread valid.
  // Ambang 8 (bukan 10) supaya thread valid 8-9 tweet tidak tergusur jadi 1.
  if (parts.length < 8) {
    parts = [];
    const lines = rawText.split('\n');
    let current = '';
    for (const line of lines) {
      if (/^\d{1,2}\.\s*$/.test(line.trim())) {
        if (current.trim().length > 10) parts.push(current.trim());
        current = '';
      } else {
        current += '\n' + line;
      }
    }
    if (current.trim().length > 10) parts.push(current.trim());
  }

  const posts = parts.slice(0, 15);
  if (posts.length < 8) {
    throw new Error(`Parsing thread gagal: hanya ${posts.length} tweet (minimum 8).`);
  }
  ctx.data.posts = posts;
  ctx.log(`Thread di-parse: ${posts.length} tweet.`);
};

// ─── Step: socialPost (Repliz) ───────────────────────────────────
const socialPost: StepHandler = async (ctx) => {
  const posts = ctx.data.posts as string[];
  const cred = ctx.credentials.repliz;
  // Header Repliz = "Basic base64(accessKey:secretKey)". Dirakit di server agar
  // user cukup memasukkan Access Key + Secret Key (bukan encode manual).
  let authHeader = cred?.authorization;
  if (!authHeader && cred?.accessKey && cred?.secretKey) {
    authHeader = 'Basic ' + btoa(`${cred.accessKey}:${cred.secretKey}`);
  }
  if (!authHeader) throw new Error('Credential Repliz belum diset (butuh Access Key & Secret Key).');

  const scheduleAt = String(ctx.data.scheduleAt || new Date(Date.now() + 3 * 60 * 1000).toISOString());
  const replies = posts.slice(1).map((desc) => ({ type: 'text', description: desc, medias: [] }));
  const body = {
    title: '',
    description: posts[0],
    type: 'text',
    medias: [],
    scheduleAt,
    accountId: ctx.config.replizAccountId,
    userId: ctx.config.replizUserId,
    replies,
  };

  const res = await fetch('https://api.repliz.com/public/schedule', {
    method: 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Repliz error ${res.status}: ${text.slice(0, 200)}`);
  }
  ctx.data.scheduledAt = scheduleAt;
  ctx.log(`Thread dijadwalkan di Repliz untuk ${scheduleAt}.`);
};

// ─── Step: notify (Telegram) ─────────────────────────────────────
const notify: StepHandler = async (ctx) => {
  const cred = ctx.credentials.telegram;
  const chatId = ctx.config.telegramChatId;
  if (!cred?.botToken || !chatId) {
    ctx.log('Telegram tidak dikonfigurasi — lewati notifikasi.');
    return;
  }
  const posts = ctx.data.posts as string[];
  const text = [
    `✅ Thread Dijadwalkan - ${ctx.automation.name}`,
    '',
    `Jam tayang: ${ctx.data.scheduledAt || '-'}`,
    'Preview:',
    posts[0].slice(0, 200),
    `Total post: ${posts.length}`,
  ].join('\n');

  await fetch(`https://api.telegram.org/bot${cred.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch((err) => ctx.log(`Notifikasi Telegram gagal: ${err}`));
  ctx.log('Notifikasi Telegram terkirim.');
};

// ─── Step: markUsed ──────────────────────────────────────────────
const markUsed: StepHandler = async (ctx) => {
  const topicId = ctx.data.topicId as string | undefined;
  if (!topicId) return;
  await ctx.env.DB.prepare(
    `UPDATE automation_topics SET used_at = ? WHERE id = ?`
  ).bind(new Date().toISOString(), topicId).run();
  ctx.log('Topik ditandai terpakai.');
};

// ─── Berita (RSS) ────────────────────────────────────────────────
interface NewsItem { title: string; link: string; description: string; pubDate: string }

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/gi, "'").replace(/&nbsp;/g, ' ')
    .trim();
}
function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
function pickTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? m[1] : '';
}
// Parser toleran untuk RSS 2.0 (<item>) & Atom (<entry>).
function parseFeed(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/(item|entry)>/gi) || [];
  for (const b of blocks) {
    const title = decodeXml(stripHtml(pickTag(b, 'title')));
    let link = decodeXml(pickTag(b, 'link'));
    if (!link) { const m = b.match(/<link[^>]*href=["']([^"']+)["']/i); if (m) link = m[1]; }
    const description = stripHtml(decodeXml(pickTag(b, 'description') || pickTag(b, 'summary') || pickTag(b, 'content'))).slice(0, 300);
    const pubDate = decodeXml(pickTag(b, 'pubDate') || pickTag(b, 'updated') || pickTag(b, 'published'));
    if (title && link) items.push({ title, link: link.trim(), description, pubDate });
  }
  return items;
}
function parseLines(v: unknown): string[] {
  return String(v || '').split('\n').map((s) => s.trim()).filter(Boolean);
}

const fetchNews: StepHandler = async (ctx) => {
  const feeds = parseLines(ctx.config.feeds);
  const feedUrls = feeds.length ? feeds : DEFAULT_NEWS_FEEDS;
  const lookbackH = Math.min(168, Math.max(1, Number(ctx.config.lookbackHours) || 48));
  const maxItems = Math.min(8, Math.max(1, Number(ctx.config.maxItems) || 3));

  const all: NewsItem[] = [];
  for (const url of feedUrls) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'PejuangYen-Automation/1.0', Accept: 'application/rss+xml, application/xml, text/xml' } });
      if (!res.ok) { ctx.log(`Feed gagal (${res.status}): ${url}`); continue; }
      const xml = await res.text();
      all.push(...parseFeed(xml));
    } catch {
      ctx.log(`Feed error: ${url}`);
    }
  }

  const now = Date.now();
  // Filter rentang waktu (item tanpa tanggal valid tetap diikutkan).
  let recent = all.filter((i) => {
    if (!i.pubDate) return true;
    const t = Date.parse(i.pubDate);
    return Number.isNaN(t) ? true : now - t <= lookbackH * 3600_000;
  });

  // Dedup vs artikel yang sudah pernah dibahas (disimpan di automation_topics).
  const seenRows = await ctx.repo.listTopics(ctx.automation.id);
  const seen = new Set(seenRows.map((r) => r.topic));
  const uniq: NewsItem[] = [];
  const batchSeen = new Set<string>();
  recent.sort((a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0));
  for (const i of recent) {
    if (seen.has(i.link) || batchSeen.has(i.link)) continue;
    batchSeen.add(i.link);
    uniq.push(i);
  }

  if (uniq.length === 0) {
    throw new Error('Tidak ada berita baru dari feed (semua sudah dibahas atau di luar rentang waktu).');
  }
  ctx.data.newsItems = uniq.slice(0, maxItems);
  ctx.log(`Ambil ${(ctx.data.newsItems as NewsItem[]).length} berita baru dari ${feedUrls.length} feed.`);
};

const aiThreadFromNews: StepHandler = async (ctx) => {
  const items = ctx.data.newsItems as NewsItem[];
  const override = String(ctx.config.systemPromptOverride || '').trim();
  const system = override || buildThreadSystemPrompt({
    handle: ctx.config.personaHandle as string | undefined,
    bio: ctx.config.personaBio as string | undefined,
    audience: ctx.config.personaAudience as string | undefined,
    tone: ctx.config.personaTone as string | undefined,
  });

  const newsBlock = items
    .map((it, idx) => `${idx + 1}. ${it.title}\n   ${it.description}\n   Sumber: ${it.link}`)
    .join('\n\n');

  const user = [
    'Buat 1 thread viral yang merangkum & memberi insight dari BERITA AI TERBARU berikut.',
    '',
    'BERITA:',
    newsBlock,
    '',
    'PENTING:',
    '- Fokus ke berita paling menarik; tidak harus membahas semua.',
    '- Beri konteks "kenapa ini penting buat pembaca", bukan sekadar menyalin headline.',
    '- Sebut nama produk/perusahaan dengan benar. Jangan mengarang fakta di luar berita.',
    '- Hook tetap kuat sesuai aturan. JANGAN gunakan * atau **.',
    '',
    'Output HANYA tweet bernomor. Tidak ada teks lain apapun.',
  ].join('\n');

  const raw = await callSumopodChat(ctx.env, { system, user, mode: 'deep', temperature: 0.75 });
  ctx.data.rawText = raw;
  ctx.log(`AI thread dari berita selesai (${raw.length} char).`);
};

const recordNews: StepHandler = async (ctx) => {
  const items = (ctx.data.newsItems as NewsItem[]) || [];
  const now = new Date().toISOString();
  for (const it of items) {
    await ctx.env.DB.prepare(
      `INSERT INTO automation_topics (id, automation_id, topic, used_at, created_at) VALUES (?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), ctx.automation.id, it.link, now, now).run();
  }
  ctx.log(`${items.length} artikel ditandai sudah dibahas (anti-duplikat).`);
};

const STEP_REGISTRY: Record<string, StepHandler> = {
  pickTopic,
  aiGenerate,
  parseThread,
  socialPost,
  notify,
  markUsed,
  fetchNews,
  aiThreadFromNews,
  recordNews,
};

export interface ExecuteResult {
  preview: string;
  totalPosts: number;
  logs: string[];
}

/**
 * Jalankan seluruh step chain template. Throw bila ada step gagal
 * (caller bertanggung jawab mencatat run + refund credit).
 */
export async function executeAutomation(
  env: Env,
  automation: AutomationRow,
  credentials: Record<string, Record<string, string>>
): Promise<ExecuteResult> {
  const template = getTemplate(automation.template_key);
  if (!template) throw new Error(`Template tidak dikenal: ${automation.template_key}`);

  const logs: string[] = [];
  const ctx: RunContext = {
    env,
    repo: new AutomationRepository(env),
    automation,
    config: JSON.parse(automation.config_json || '{}') as AutomationConfig,
    credentials,
    data: { scheduleAt: new Date(Date.now() + 3 * 60 * 1000).toISOString() },
    log: (msg: string) => {
      logs.push(`[${new Date().toISOString()}] ${msg}`);
    },
  };

  for (const stepName of template.steps) {
    const handler = STEP_REGISTRY[stepName];
    if (!handler) throw new Error(`Step tidak dikenal: ${stepName}`);
    await handler(ctx);
  }

  const posts = (ctx.data.posts as string[]) || [];
  return {
    preview: posts[0]?.slice(0, 120) || '',
    totalPosts: posts.length,
    logs,
  };
}
