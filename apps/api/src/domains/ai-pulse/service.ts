// AI Pulse — engine ingestion (curated + AI-assist).
// Cron memanggil runAiPulseIngestion(): fetch sumber -> parse RSS/Atom -> dedup
// -> LLM buat learning package (draft) -> simpan status='draft' untuk direview admin.
import type { Env } from '../../env';
import { callSumopodChat } from '../../services/sumopod';
import { AiPulseRepository } from './repository';
import type { AiDraft, AiPulseItemRow, ImpactLevel, RawFeedItem } from './types';

const MAX_ITEMS_PER_SOURCE = 5;     // batasi biaya LLM per run
const MAX_ITEMS_PER_RUN = 25;       // cap global per cron
const VALID_CATEGORY_IDS = [
  'cat_01', 'cat_02', 'cat_03', 'cat_04', 'cat_05', 'cat_06', 'cat_07', 'cat_08', 'cat_09',
];
const CATEGORY_HINT = `Pilih satu category_id paling cocok dari daftar ini (atau null bila tak ada yang pas):
- cat_01 AI Fundamentals & Prompting
- cat_02 Vibecoding & Web Dev
- cat_03 Vibe Design & Visual Creation
- cat_04 Vibe Marketing, Sales & Growth
- cat_05 AI Automation & Workflow
- cat_06 Content Creation & Personal Branding
- cat_07 Business, Monetization & Solopreneurship
- cat_08 Career, Freelance & Portfolio
- cat_09 Productivity, Learning & Self-Development`;

export interface IngestionSummary {
  sources: number;
  fetched: number;
  inserted: number;
  skippedDuplicate: number;
  skippedOld: number;
  skippedLowValue: number;
  failed: number;
}

const MAX_AGE_DAYS = 21; // item lebih tua dari ini dilewati (hemat token + jaga freshness)

// ─── XML helpers (parser ringan tanpa dependency) ──────────────────
function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function stripHtml(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function extractTag(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1] : null;
}

function extractAttr(block: string, tag: string, attr: string): string | null {
  const m = block.match(new RegExp(`<${tag}[^>]*\\b${attr}=["']([^"']+)["'][^>]*>`, 'i'));
  return m ? m[1] : null;
}

function extractImage(block: string, contentHtml: string): string | null {
  const media = extractAttr(block, 'media:thumbnail', 'url') || extractAttr(block, 'media:content', 'url');
  if (media) return media;
  const enclosure = block.match(/<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image/i);
  if (enclosure) return enclosure[1];
  const img = contentHtml.match(/<img[^>]*src=["']([^"']+)["']/i);
  return img ? img[1] : null;
}

/** Ekstrak og:image (atau twitter:image) dari HTML halaman artikel. */
export function extractOgImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && /^https?:\/\//i.test(m[1])) return decodeEntities(m[1]);
  }
  return null;
}

/** Ekstrak teks isi artikel (buang script/style/nav/header/footer) untuk konteks AI. */
function extractArticleText(html: string): string {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
  return stripHtml(cleaned).slice(0, 9500);
}

/** Fetch halaman artikel sekali: ambil og:image + teks isi (best-effort, timeout pendek). */
async function fetchArticleData(url: string): Promise<{ ogImage: string | null; text: string }> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'PejuangYen-AIPulse/1.0', Accept: 'text/html' },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return { ogImage: null, text: '' };
    const html = (await res.text()).slice(0, 500000);
    return { ogImage: extractOgImage(html), text: extractArticleText(html) };
  } catch {
    return { ogImage: null, text: '' };
  }
}

/** Parse RSS <item> atau Atom <entry>. */
export function parseFeed(xml: string): RawFeedItem[] {
  const items: RawFeedItem[] = [];
  const isAtom = /<entry[\s>]/i.test(xml) && !/<item[\s>]/i.test(xml);
  const blockRe = isAtom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi;
  const blocks = xml.match(blockRe) ?? [];

  for (const block of blocks) {
    const title = extractTag(block, 'title');
    if (!title) continue;

    let link: string | null = null;
    if (isAtom) {
      link = extractAttr(block, 'link', 'href') || extractTag(block, 'id');
    } else {
      link = extractTag(block, 'link') || extractAttr(block, 'link', 'href');
    }
    if (!link) continue;

    const publishedRaw =
      extractTag(block, 'pubDate') || extractTag(block, 'published') ||
      extractTag(block, 'updated') || extractTag(block, 'dc:date');
    const contentHtml =
      extractTag(block, 'content:encoded') || extractTag(block, 'content') ||
      extractTag(block, 'description') || extractTag(block, 'summary') || '';

    let publishedAt: string | null = null;
    if (publishedRaw) {
      const d = new Date(decodeEntities(publishedRaw));
      if (!Number.isNaN(d.getTime())) publishedAt = d.toISOString();
    }

    items.push({
      title: decodeEntities(title),
      link: decodeEntities(link).trim(),
      publishedAt,
      thumbnailUrl: extractImage(block, contentHtml),
      contentText: stripHtml(contentHtml).slice(0, 4000),
    });
  }
  return items;
}

// ─── Util ──────────────────────────────────────────────────────────
async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function normalizeForHash(url: string, title: string): string {
  const u = url.toLowerCase().replace(/[?#].*$/, '').replace(/\/+$/, '');
  return `${u}::${title.toLowerCase().trim()}`;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 70) || 'ai-pulse';
}

function clampImpact(v: unknown): ImpactLevel {
  return v === 'major' || v === 'breaking' || v === 'update' ? v : 'update';
}

function stripJsonFences(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

// ─── AI draft ──────────────────────────────────────────────────────
const DRAFT_SYSTEM = `Kamu adalah analis senior intelligence AI untuk PejuangYen, platform belajar AI berbahasa Indonesia.
Tugasmu mengubah satu update/berita AI menjadi "learning package" yang MENDALAM, AKURAT, BERBOBOT, dan langsung bisa dipraktikkan.

Prinsip:
- Gunakan ISI ARTIKEL sebagai sumber utama. Jangan mengarang fakta, angka, atau fitur yang tidak ada di artikel. Bila detail tidak tersedia, beri panduan umum yang tetap akurat dan jujur.
- WAJIB spesifik: sebut nama fitur, angka, versi, model, atau benchmark yang nyata dari artikel. Hindari kalimat umum/kosong seperti "ini penting untuk masa depan AI".
- Nada analitis dan mengajar, seakan menjelaskan ke praktisi yang ingin benar-benar paham dan langsung praktik.
- Tulis Bahasa Indonesia yang jelas dan padat berisi. Jangan gunakan em dash. Jangan gunakan asterisk.
- PENILAIAN KELAYAKAN: nilai apakah item ini benar-benar tentang AI/teknologi yang relevan DAN bernilai bagi audiens belajar AI. Jika off-topic, spam, sekadar iklan/marketing kosong, lowongan kerja, atau terlalu remeh, set is_worthy=false.
- Output WAJIB JSON valid tanpa teks lain, tanpa code fence.`;

function buildDraftUserPrompt(item: RawFeedItem, content: string): string {
  return `Judul asli: ${item.title}
Sumber: ${item.link}
Tanggal: ${item.publishedAt ?? 'tidak diketahui'}

ISI ARTIKEL:
${content || '(isi tidak tersedia, gunakan judul sebagai dasar dan beri panduan umum yang akurat)'}

${CATEGORY_HINT}

Kembalikan JSON dengan struktur persis ini (isi setiap field dengan substansi konkret, bukan kalimat umum):
{
  "is_worthy": true/false (true bila benar-benar tentang AI/teknologi relevan dan bernilai untuk audiens belajar AI),
  "worthiness_reason": "alasan singkat penilaian kelayakan",
  "title_id": "judul ringkas, jelas, menarik dalam Bahasa Indonesia (maks 70 karakter, tanpa tanda kutip)",
  "summary": "ringkasan informatif 4-6 kalimat: APA yang dirilis/terjadi, BAGAIMANA cara kerjanya, dan KONTEKS pentingnya. Spesifik dengan detail nyata.",
  "deep_dive": "penjelasan mendalam 1-2 paragraf: cara kerja teknis, mekanisme, atau detail penting yang membuat pembaca benar-benar paham. Sertakan angka/nama fitur konkret dari artikel.",
  "key_points": ["3-6 poin paling krusial sebagai TL;DR, tiap poin satu kalimat padat dan spesifik"],
  "why_it_matters": "kenapa penting bagi praktisi AI Indonesia, 2-3 kalimat dengan alasan konkret",
  "who_should_use": "siapa yang paling cocok memanfaatkan ini, 1-2 kalimat",
  "use_cases": ["3-5 contoh use case konkret dan spesifik"],
  "how_to_start": ["3-5 langkah praktis dan urut untuk mulai memanfaatkan ini hari ini"],
  "prompt_example": "SATU prompt siap pakai Bahasa Indonesia untuk dijalankan di AI (ChatGPT/Claude/Gemini), relevan untuk memanfaatkan update ini. WAJIB ikuti format ini PERSIS dengan baris baru (newline) di antara bagian, isi konkret bukan placeholder:\\nPeran: <peran ahli relevan>\\nKonteks: <latar singkat dan sebut update/tool ini>\\nTugas: <permintaan spesifik dan konkret>\\nFormat Output: <bentuk hasil yang diinginkan>\\nBatasan: <aturan, Bahasa Indonesia, panjang, dsb>",
  "faq": [{"q": "pertanyaan yang sering muncul", "a": "jawaban singkat dan akurat"}],
  "business_insight": "peluang bisnis/monetisasi konkret dari update ini, 1-2 kalimat",
  "tags": ["3-6 tag pendek lowercase"],
  "suggested_category_id": "cat_0X atau null",
  "impact_level": "major | update | breaking"
}`;
}

function parseDraft(raw: string): AiDraft | null {
  try {
    const obj = JSON.parse(stripJsonFences(raw)) as Record<string, unknown>;
    const suggested = typeof obj.suggested_category_id === 'string' && VALID_CATEGORY_IDS.includes(obj.suggested_category_id)
      ? obj.suggested_category_id
      : null;
    return {
      is_worthy: obj.is_worthy !== false, // default true bila tak disebut
      worthiness_reason: String(obj.worthiness_reason ?? '').trim().slice(0, 300),
      title_id: String(obj.title_id ?? '').trim().replace(/^["']|["']$/g, '').slice(0, 160),
      summary: String(obj.summary ?? '').trim(),
      deep_dive: String(obj.deep_dive ?? '').trim(),
      key_points: Array.isArray(obj.key_points) ? obj.key_points.map(String).slice(0, 8) : [],
      why_it_matters: String(obj.why_it_matters ?? '').trim(),
      who_should_use: String(obj.who_should_use ?? '').trim(),
      use_cases: Array.isArray(obj.use_cases) ? obj.use_cases.map(String).slice(0, 8) : [],
      how_to_start: Array.isArray(obj.how_to_start) ? obj.how_to_start.map(String).slice(0, 8) : [],
      prompt_example: String(obj.prompt_example ?? '').trim().slice(0, 2000),
      faq: Array.isArray(obj.faq)
        ? (obj.faq as Record<string, unknown>[])
            .filter((f) => f && typeof f.q === 'string' && typeof f.a === 'string')
            .map((f) => ({ q: String(f.q), a: String(f.a) }))
            .slice(0, 8)
        : [],
      business_insight: String(obj.business_insight ?? '').trim(),
      tags: Array.isArray(obj.tags) ? obj.tags.map(String).slice(0, 8) : [],
      suggested_category_id: suggested,
      impact_level: clampImpact(obj.impact_level),
    };
  } catch {
    return null;
  }
}

async function generateDraft(env: Env, item: RawFeedItem, content?: string): Promise<AiDraft | null> {
  const raw = await callSumopodChat(env, {
    system: DRAFT_SYSTEM,
    user: buildDraftUserPrompt(item, content ?? item.contentText),
    mode: 'fast',
    maxCompletionTokens: 4000,
    temperature: 0.4,
  });
  return parseDraft(raw);
}

// ─── Build row ─────────────────────────────────────────────────────
async function buildDraftRow(
  repo: AiPulseRepository,
  source: { id: string; name: string },
  item: RawFeedItem,
  draft: AiDraft,
  dedupHash: string,
  model: string,
  now: string
): Promise<AiPulseItemRow> {
  const displayTitle = (draft.title_id || item.title).slice(0, 300);
  let slug = slugify(draft.title_id || item.title);
  if (await repo.slugExists(slug)) {
    slug = `${slug}-${dedupHash.slice(0, 6)}`;
  }
  return {
    id: crypto.randomUUID(),
    slug,
    title: displayTitle,
    original_title: item.title.slice(0, 300),
    source_id: source.id,
    source_name: source.name,
    source_url: item.link,
    thumbnail_url: item.thumbnailUrl,
    published_at: item.publishedAt ?? now,
    dedup_hash: dedupHash,
    summary: draft.summary,
    deep_dive: draft.deep_dive || null,
    key_points_json: JSON.stringify(draft.key_points),
    why_it_matters: draft.why_it_matters,
    who_should_use: draft.who_should_use,
    use_cases_json: JSON.stringify(draft.use_cases),
    how_to_start_json: JSON.stringify(draft.how_to_start),
    prompt_example: draft.prompt_example || null,
    faq_json: JSON.stringify(draft.faq),
    business_insight: draft.business_insight,
    primary_category_id: draft.suggested_category_id,
    tags_json: JSON.stringify(draft.tags),
    impact_level: draft.impact_level,
    related_course_ids_json: null,
    related_bonus_ids_json: null,
    related_automation_template_keys_json: null,
    status: 'published',          // auto-post: langsung tayang (sumber jelas via source_name/url)
    featured: 0,
    view_count: 0,
    ai_model: model,
    published_at_internal: now,
    created_at: now,
    updated_at: now,
  };
}

// ─── Entry point (dipanggil cron / admin manual) ───────────────────
export async function runAiPulseIngestion(env: Env): Promise<IngestionSummary> {
  const repo = new AiPulseRepository(env.DB);
  const summary: IngestionSummary = { sources: 0, fetched: 0, inserted: 0, skippedDuplicate: 0, skippedOld: 0, skippedLowValue: 0, failed: 0 };
  const oldestAllowed = Date.now() - MAX_AGE_DAYS * 24 * 3600 * 1000;
  const model = env.SUMOPOD_MODEL || 'gemini/gemini-2.5-flash-lite';

  const sources = await repo.listEnabledSources();
  summary.sources = sources.length;

  for (const source of sources) {
    if (summary.inserted >= MAX_ITEMS_PER_RUN) break;
    const now = new Date().toISOString();
    try {
      const res = await fetch(source.url, {
        headers: { 'User-Agent': 'PejuangYen-AIPulse/1.0', Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) { summary.failed++; continue; }
      const xml = await res.text();
      const items = parseFeed(xml).slice(0, MAX_ITEMS_PER_SOURCE);
      summary.fetched += items.length;

      for (const item of items) {
        if (summary.inserted >= MAX_ITEMS_PER_RUN) break;
        // Gerbang recency (gratis, sebelum LLM): lewati item terlalu lama.
        if (item.publishedAt && new Date(item.publishedAt).getTime() < oldestAllowed) {
          summary.skippedOld++; continue;
        }
        const dedupHash = await sha256Hex(normalizeForHash(item.link, item.title));
        if (await repo.dedupExists(dedupHash)) { summary.skippedDuplicate++; continue; }

        try {
          // Fetch halaman artikel sekali: teks isi (konteks AI lebih kaya) + og:image.
          let content = item.contentText;
          if (item.link) {
            const art = await fetchArticleData(item.link);
            if (!item.thumbnailUrl && art.ogImage) item.thumbnailUrl = art.ogImage;
            if (art.text && art.text.length > content.length) content = art.text;
          }
          const draft = await generateDraft(env, item, content);
          if (!draft || !draft.summary) { summary.failed++; continue; }
          // Gerbang kualitas: item tak layak TIDAK disimpan (auto-hapus efektif).
          if (!draft.is_worthy) {
            console.log(`[ai-pulse] skip low-value: ${item.title} — ${draft.worthiness_reason}`);
            summary.skippedLowValue++; continue;
          }
          const row = await buildDraftRow(repo, source, item, draft, dedupHash, model, new Date().toISOString());
          await repo.insertDraft(row);
          summary.inserted++;
        } catch (err) {
          console.error('[ai-pulse] draft error:', item.link, err);
          summary.failed++;
        }
      }
      await repo.markSourceFetched(source.id, now);
    } catch (err) {
      console.error('[ai-pulse] source fetch error:', source.url, err);
      summary.failed++;
    }
  }

  console.log(`[ai-pulse] ingestion: ${JSON.stringify(summary)}`);
  return summary;
}

/** Regenerate learning package untuk satu item (admin). Pakai data tersimpan sebagai konteks. */
export async function regenerateDraft(env: Env, itemId: string): Promise<boolean> {
  const repo = new AiPulseRepository(env.DB);
  const row = await repo.getById(itemId);
  if (!row) return false;

  const item: RawFeedItem = {
    title: row.original_title ?? row.title,
    link: row.source_url ?? '',
    publishedAt: row.published_at,
    thumbnailUrl: row.thumbnail_url,
    contentText: row.summary ?? '',
  };
  // Refetch artikel untuk konteks lebih kaya (backfill kualitas), best-effort.
  let content = item.contentText;
  if (item.link) {
    const art = await fetchArticleData(item.link);
    if (!item.thumbnailUrl && art.ogImage) item.thumbnailUrl = art.ogImage;
    if (art.text && art.text.length > content.length) content = art.text;
  }
  const draft = await generateDraft(env, item, content);
  if (!draft || !draft.summary) return false;

  await repo.updateItem(
    itemId,
    {
      // backfill judul Bahasa Indonesia; simpan judul asli bila belum ada
      title: draft.title_id || row.title,
      original_title: row.original_title ?? row.title,
      thumbnail_url: item.thumbnailUrl,
      summary: draft.summary,
      deep_dive: draft.deep_dive || null,
      key_points_json: JSON.stringify(draft.key_points),
      why_it_matters: draft.why_it_matters,
      who_should_use: draft.who_should_use,
      use_cases_json: JSON.stringify(draft.use_cases),
      how_to_start_json: JSON.stringify(draft.how_to_start),
      prompt_example: draft.prompt_example || null,
      faq_json: JSON.stringify(draft.faq),
      business_insight: draft.business_insight,
      tags_json: JSON.stringify(draft.tags),
      impact_level: draft.impact_level,
      primary_category_id: draft.suggested_category_id ?? row.primary_category_id,
      ai_model: env.SUMOPOD_MODEL || 'gemini/gemini-2.5-flash-lite',
    },
    new Date().toISOString()
  );
  return true;
}
