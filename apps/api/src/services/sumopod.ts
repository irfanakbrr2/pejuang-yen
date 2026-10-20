/**
 * Sumopod chat completion — wrapper reusable untuk pemanggilan LLM
 * (Gemini fast / DeepSeek deep). Diekstrak dari domains/tools/tools.routes.ts
 * supaya bisa dipakai juga oleh engine automation (aiGenerate step).
 */
import type { Env } from '../env';

const SUMOPOD_DEFAULT_BASE_URL = 'https://ai.sumopod.com';
const SUMOPOD_DEFAULT_MODEL = 'gemini/gemini-2.5-flash-lite';
const SUMOPOD_DEEP_DEFAULT_MODEL = 'deepseek-v4-flash';
const DEFAULT_MAX_COMPLETION_TOKENS = 16000;
const AI_REQUEST_TIMEOUT_MS = 120000;

export type SumopodMode = 'fast' | 'deep';

export interface SumopodChatParams {
  system: string;
  user: string;
  mode?: SumopodMode;
  maxCompletionTokens?: number;
  temperature?: number;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveModel(env: Env, mode: SumopodMode): string {
  if (mode === 'deep') {
    return env.SUMOPOD_DEEP_MODEL || env.SUMOPOD_FALLBACK_MODEL || SUMOPOD_DEEP_DEFAULT_MODEL;
  }
  return env.SUMOPOD_MODEL || SUMOPOD_DEFAULT_MODEL;
}

function extractProviderMessage(raw: string): string {
  if (!raw.trim()) return '';
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string }; message?: string; detail?: string };
    return parsed.error?.message || parsed.message || parsed.detail || raw;
  } catch {
    return raw;
  }
}

/**
 * Panggil Sumopod chat completions. Throw Error (dengan pesan ringkas) bila gagal.
 * Return: konten teks dari model.
 */
export async function callSumopodChat(env: Env, params: SumopodChatParams): Promise<string> {
  if (!env.SUMOPOD_API_KEY) throw new Error('SUMOPOD_API_KEY belum dikonfigurasi');

  const mode = params.mode || 'fast';
  const model = resolveModel(env, mode);
  const baseUrl = (env.SUMOPOD_BASE_URL || SUMOPOD_DEFAULT_BASE_URL).replace(/\/+$/, '');
  const url = baseUrl.endsWith('/v1') ? `${baseUrl}/chat/completions` : `${baseUrl}/v1/chat/completions`;

  const maxTokens = params.maxCompletionTokens
    || parsePositiveInt(
      mode === 'deep' ? env.SUMOPOD_DEEP_MAX_COMPLETION_TOKENS : env.SUMOPOD_MAX_COMPLETION_TOKENS,
      DEFAULT_MAX_COMPLETION_TOKENS
    );

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.SUMOPOD_API_KEY}`,
      'Content-Type': 'application/json',
    },
    signal: controller.signal,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.user },
      ],
      max_completion_tokens: maxTokens,
      temperature: params.temperature ?? 0.7,
    }),
  }).finally(() => clearTimeout(timeout));

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Sumopod error ${res.status}: ${extractProviderMessage(text).slice(0, 300)}`);
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string }; text?: string }>;
  };
  const content = (data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '').trim();
  if (!content) throw new Error('Sumopod mengembalikan konten kosong');
  return content;
}
