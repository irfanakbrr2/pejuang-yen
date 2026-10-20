import { Hono, type Context } from 'hono';
import { sanitizeLessonHtml } from '@growwithai/shared';
import type { Env } from '../../env';
import { authMiddleware, requireRole } from '../../middleware/auth';
import { success, error } from '../../lib/response';

const SUMOPOD_DEFAULT_BASE_URL = 'https://ai.sumopod.com';
const SUMOPOD_DEFAULT_MODEL = 'gemini/gemini-2.5-flash-lite';
const AI_REQUEST_TIMEOUT_MS = 60000;
const MAX_COMPLETION_TOKENS = 4096;

type EntityType = 'course' | 'lesson' | 'webinar' | 'email_campaign';
type OutputFormat = 'plain' | 'html';
type AiFillMode = 'field' | 'bundle';

type FieldConfig = {
  label: string;
  format: OutputFormat;
  maxLength?: number;
};

type AiFillBody = {
  mode?: AiFillMode;
  entity_type?: EntityType;
  field?: string;
  fields?: string[];
  context?: unknown;
  prompt?: string;
  output_format?: OutputFormat;
};

const FIELD_CONFIG: Record<EntityType, Record<string, FieldConfig>> = {
  course: {
    subtitle: { label: 'Course subtitle', format: 'plain', maxLength: 300 },
    short_description: { label: 'Course short description', format: 'plain', maxLength: 500 },
    description: { label: 'Course description', format: 'plain' },
  },
  lesson: {
    description: { label: 'Lesson short description', format: 'plain' },
    content_html: { label: 'Lesson HTML content', format: 'html' },
  },
  webinar: {
    subtitle: { label: 'Webinar subtitle', format: 'plain', maxLength: 300 },
    body_html: { label: 'Webinar body HTML', format: 'html' },
    replay_body_html: { label: 'Webinar replay body HTML', format: 'html' },
    seo_title: { label: 'SEO title', format: 'plain', maxLength: 70 },
    seo_description: { label: 'SEO description', format: 'plain', maxLength: 170 },
  },
  email_campaign: {
    subject: { label: 'Email subject', format: 'plain' },
    content: { label: 'Email HTML content', format: 'html' },
  },
};

const SYSTEM_PROMPT = `Kamu adalah asisten penulisan konten untuk admin platform online learning Indonesia PejuangYen.

Rules wajib:
1. Jangan gunakan em dash. Gunakan koma, titik, atau hyphen biasa.
2. Jangan gunakan asterisk untuk apapun.
3. Tulis dalam bahasa yang sama dengan instruksi admin.
4. Output hanya konten field, tanpa pembuka, penjelasan, atau wrapper yang tidak diminta.
5. Untuk plain text, jangan gunakan tag HTML.
6. Untuk HTML, jangan gunakan script, style, iframe, form, atau event handler HTML.
7. Untuk lesson dan webinar HTML, gunakan tag sederhana seperti p, ul, ol, li, strong, em, br, h2, h3, a.
8. Untuk email campaign, hanya gunakan variable ini jika perlu: {{first_name}}, {{role}}, {{dashboard_url}}, {{support_url}}, {{community_whatsapp_url}}, {{unsubscribe_url}}. Jangan buat variable lain.
9. Untuk email campaign content, sertakan link unsubscribe dengan {{unsubscribe_url}}.
10. Jangan tampilkan chain of thought.`;

function getFieldConfig(entityType: EntityType, field: string): FieldConfig | null {
  return FIELD_CONFIG[entityType]?.[field] || null;
}

function getRequestedFields(body: AiFillBody): string[] {
  const raw = body.mode === 'bundle' ? body.fields : body.field ? [body.field] : [];
  return [...new Set((raw || []).filter((field): field is string => typeof field === 'string' && field.trim().length > 0))]
    .map((field) => field.trim());
}

function stripCodeFence(value: string): string {
  return value
    .replace(/^```(?:json|html|markdown|md|text)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function stripDangerousHtml(value: string): string {
  return value
    .replace(/<\s*(script|style|iframe|form)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s+(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, '');
}

function truncateText(value: string, maxLength?: number): string {
  if (!maxLength || value.length <= maxLength) return value;
  return value.slice(0, maxLength).replace(/\s+\S*$/, '').trim() || value.slice(0, maxLength).trim();
}

function sanitizeAiOutput(value: unknown, config: FieldConfig, entityType: EntityType): string {
  let next = typeof value === 'string' ? value : '';
  next = stripCodeFence(next)
    .replace(/[—–]/g, '-')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .trim();

  if (config.format === 'plain') {
    next = next.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  } else {
    next = stripDangerousHtml(next);
    if (entityType === 'lesson' || entityType === 'webinar') {
      next = sanitizeLessonHtml(next);
    }
  }

  return truncateText(next, config.maxLength);
}

function extractProviderMessage(raw: string): string {
  if (!raw.trim()) return '';
  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string };
      message?: string;
      detail?: string;
    };
    return parsed.error?.message || parsed.message || parsed.detail || raw;
  } catch {
    return raw;
  }
}

function buildUserMessage(body: AiFillBody, fields: string[], configs: FieldConfig[]): string {
  const mode = body.mode === 'bundle' ? 'bundle' : 'field';
  const context = typeof body.context === 'string' ? body.context : JSON.stringify(body.context || {}, null, 2);
  const fieldInstructions = fields.map((field, index) => {
    const config = configs[index];
    const limit = config.maxLength ? ` Maksimal ${config.maxLength} karakter.` : '';
    return `- ${field}: ${config.label}. Format ${config.format}.${limit}`;
  }).join('\n');

  if (mode === 'bundle') {
    return `Generate copy untuk beberapa field.

Entity: ${body.entity_type}
Fields:
${fieldInstructions}

Context:
${context || '-'}

Instruksi admin:
${body.prompt}

Return JSON object valid saja, tanpa markdown fence, dengan key persis seperti nama field yang diminta.`;
  }

  return `Generate copy untuk satu field.

Entity: ${body.entity_type}
Field:
${fieldInstructions}

Context:
${context || '-'}

Instruksi admin:
${body.prompt}

Return isi field saja.`;
}

function parseBundleJson(raw: string): Record<string, unknown> | null {
  const stripped = stripCodeFence(raw);
  try {
    const parsed = JSON.parse(stripped);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[0]);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }
}

async function callAi(c: Context<{ Bindings: Env }>, userMessage: string): Promise<string> {
  const baseUrl = (c.env.SUMOPOD_BASE_URL || SUMOPOD_DEFAULT_BASE_URL).replace(/\/+$/, '');
  const chatCompletionsUrl = baseUrl.endsWith('/v1')
    ? `${baseUrl}/chat/completions`
    : `${baseUrl}/v1/chat/completions`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
  const aiResponse = await fetch(chatCompletionsUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${c.env.SUMOPOD_API_KEY}`,
      'Content-Type': 'application/json',
    },
    signal: controller.signal,
    body: JSON.stringify({
      model: c.env.SUMOPOD_MODEL || SUMOPOD_DEFAULT_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.4,
      max_completion_tokens: MAX_COMPLETION_TOKENS,
    }),
  }).finally(() => clearTimeout(timeout));

  if (!aiResponse.ok) {
    const responseText = await aiResponse.text().catch(() => '');
    const providerMessage = extractProviderMessage(responseText).slice(0, 300);
    throw new Error(`AI provider error ${aiResponse.status}${providerMessage ? `: ${providerMessage}` : ''}`);
  }

  const aiData = await aiResponse.json() as {
    choices?: Array<{ message?: { content?: string }; text?: string }>;
  };
  return (aiData.choices?.[0]?.message?.content || aiData.choices?.[0]?.text || '').trim();
}

const aiFillRoutes = new Hono<{ Bindings: Env }>();
aiFillRoutes.use('*', authMiddleware());
aiFillRoutes.use('*', requireRole('admin', 'super_admin'));

aiFillRoutes.post('/', async (c) => {
  if (!c.env.SUMOPOD_API_KEY) return error(c, 'AI service belum dikonfigurasi', 503);

  const body = await c.req.json().catch(() => null) as AiFillBody | null;
  if (!body || typeof body !== 'object') return error(c, 'Invalid JSON', 400);
  if (!body.prompt || typeof body.prompt !== 'string' || !body.prompt.trim()) {
    return error(c, 'Prompt wajib diisi', 400);
  }
  if (!body.entity_type || !FIELD_CONFIG[body.entity_type]) {
    return error(c, 'entity_type tidak valid', 400);
  }

  const mode: AiFillMode = body.mode === 'bundle' ? 'bundle' : 'field';
  const fields = getRequestedFields({ ...body, mode });
  if (mode === 'field' && fields.length !== 1) return error(c, 'Field tidak valid', 400);
  if (mode === 'bundle' && fields.length === 0) return error(c, 'Fields tidak valid', 400);

  const invalidField = fields.find((field) => !getFieldConfig(body.entity_type!, field));
  if (invalidField) return error(c, `Field ${invalidField} tidak valid untuk ${body.entity_type}`, 400);

  const configs = fields.map((field) => getFieldConfig(body.entity_type!, field)!);
  const userMessage = buildUserMessage({ ...body, mode }, fields, configs);

  try {
    const rawOutput = await callAi(c, userMessage);
    if (!rawOutput) return error(c, 'AI response kosong', 503);

    if (mode === 'bundle') {
      const parsed = parseBundleJson(rawOutput);
      if (!parsed) return error(c, 'AI response bundle tidak valid', 503);
      const values = fields.reduce<Record<string, string>>((acc, field, index) => {
        acc[field] = sanitizeAiOutput(parsed[field], configs[index], body.entity_type!);
        return acc;
      }, {});
      return success(c, { fields: values });
    }

    return success(c, {
      field: fields[0],
      content: sanitizeAiOutput(rawOutput, configs[0], body.entity_type),
    });
  } catch (err) {
    console.error('[admin:ai-fill] AI error', err);
    const message = err instanceof DOMException && err.name === 'AbortError'
      ? 'AI provider timeout. Silakan coba lagi.'
      : err instanceof Error ? err.message : 'AI provider sedang gagal. Silakan coba lagi.';
    return error(c, message, 503);
  }
});

export default aiFillRoutes;
