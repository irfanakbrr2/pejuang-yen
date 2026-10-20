import { Hono, type Context } from 'hono';
import type { Env } from '../../env';
import { authMiddleware } from '../../middleware/auth';
import { success, error } from '../../lib/response';

export const TOOLS_CATALOG = [
  {
    id: 'web_prompt_generator',
    name: 'PRD Generator',
    description: 'Buat AI Builder Prompt + PRD lengkap dengan mode Gemini cepat dan DeepSeek deep.',
    credits_per_use: 1,
    category: 'productivity',
    status: 'active',
  },
];

const SUMOPOD_DEFAULT_BASE_URL = 'https://ai.sumopod.com';
const SUMOPOD_DEFAULT_MODEL = 'gemini/gemini-2.5-flash-lite';
const SUMOPOD_DEEP_DEFAULT_MODEL = 'deepseek-v4-flash';
const DEFAULT_CONTEXT_TOKENS = 1048576;
const DEFAULT_MAX_COMPLETION_TOKENS = 65536;
const DEEP_CONTEXT_TOKENS = 1000000;
const DEEP_MAX_COMPLETION_TOKENS = 32768;
const INPUT_TOKEN_BUFFER = 12000;
const ESTIMATED_CHARS_PER_TOKEN = 3;
const AI_REQUEST_TIMEOUT_MS = 120000;
const AI_MODEL_FAMILY = {
  default: 'Gemini 2.5 Flash-Lite',
  deep: 'DeepSeek V4 Flash',
};

type GenerationMode = 'fast' | 'deep';

type AiModelConfig = {
  label: string;
  model: string;
  contextTokens: number;
  maxCompletionTokens: number;
  isFallback?: boolean;
};

type WebPromptGeneratorBody = {
  // Legacy field (backward compat)
  purpose?: string;
  // Step 1 — Basic Project
  project_name?: string;
  project_type?: string;
  main_goal?: string;
  target_user?: string;
  // Step 2 — Problem & Offer
  problem?: string;
  solution?: string;
  primary_cta?: string;
  // Step 3 — Design Direction
  visual_style?: string;
  tone?: string;
  brand_colors?: string;
  references?: string;
  // Step 4 — Technical Output
  platform?: string;
  tech_stack?: string;
  output_detail?: string;
  language?: string;
  ai_mode?: string;
  output_format?: string;
  output_priority?: string;
  // Step 5 — Optional Advanced
  required_sections?: unknown;
  constraints?: string;
  future_features?: string;
};

type AiErrorKind = 'provider_rejection' | 'provider_unavailable';

class AiProviderError extends Error {
  kind: AiErrorKind;
  upstreamStatus?: number;
  upstreamBody?: string;

  constructor(message: string, kind: AiErrorKind, upstreamStatus?: number, upstreamBody?: string) {
    super(message);
    this.name = 'AiProviderError';
    this.kind = kind;
    this.upstreamStatus = upstreamStatus;
    this.upstreamBody = upstreamBody;
  }
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseGenerationMode(value: string | undefined): GenerationMode {
  return value === 'deep' ? 'deep' : 'fast';
}

function getAiBudgets(contextTokens: number, requestedCompletionTokens: number) {
  const maxCompletionTokens = Math.min(requestedCompletionTokens, Math.max(1024, contextTokens - INPUT_TOKEN_BUFFER));
  const maxInputTokens = Math.max(1024, contextTokens - maxCompletionTokens - INPUT_TOKEN_BUFFER);
  const maxInputChars = maxInputTokens * ESTIMATED_CHARS_PER_TOKEN;

  return { maxCompletionTokens, maxInputChars };
}

function getPrimaryModelConfig(env: Env, mode: GenerationMode): AiModelConfig {
  if (mode === 'deep') {
    return {
      label: AI_MODEL_FAMILY.deep,
      model: env.SUMOPOD_DEEP_MODEL || env.SUMOPOD_FALLBACK_MODEL || SUMOPOD_DEEP_DEFAULT_MODEL,
      contextTokens: parsePositiveInt(env.SUMOPOD_DEEP_CONTEXT_LENGTH || env.SUMOPOD_FALLBACK_CONTEXT_LENGTH, DEEP_CONTEXT_TOKENS),
      maxCompletionTokens: parsePositiveInt(env.SUMOPOD_DEEP_MAX_COMPLETION_TOKENS || env.SUMOPOD_FALLBACK_MAX_COMPLETION_TOKENS, DEEP_MAX_COMPLETION_TOKENS),
    };
  }

  return {
    label: AI_MODEL_FAMILY.default,
    model: env.SUMOPOD_MODEL || SUMOPOD_DEFAULT_MODEL,
    contextTokens: parsePositiveInt(env.SUMOPOD_CONTEXT_LENGTH, DEFAULT_CONTEXT_TOKENS),
    maxCompletionTokens: parsePositiveInt(env.SUMOPOD_MAX_COMPLETION_TOKENS, DEFAULT_MAX_COMPLETION_TOKENS),
  };
}

function getFallbackModelConfig(env: Env): AiModelConfig {
  return {
    label: `${AI_MODEL_FAMILY.deep} fallback`,
    model: env.SUMOPOD_FALLBACK_MODEL || env.SUMOPOD_DEEP_MODEL || SUMOPOD_DEEP_DEFAULT_MODEL,
    contextTokens: parsePositiveInt(env.SUMOPOD_FALLBACK_CONTEXT_LENGTH || env.SUMOPOD_DEEP_CONTEXT_LENGTH, DEEP_CONTEXT_TOKENS),
    maxCompletionTokens: parsePositiveInt(env.SUMOPOD_FALLBACK_MAX_COMPLETION_TOKENS || env.SUMOPOD_DEEP_MAX_COMPLETION_TOKENS, DEEP_MAX_COMPLETION_TOKENS),
    isFallback: true,
  };
}

function getModelAttempts(env: Env, mode: GenerationMode, estimatedInputChars: number): AiModelConfig[] {
  const primary = getPrimaryModelConfig(env, mode);
  const attempts = [primary];

  if (mode === 'fast') {
    const fallback = getFallbackModelConfig(env);
    const isSameModel = fallback.model === primary.model;
    const fallbackBudget = getAiBudgets(fallback.contextTokens, fallback.maxCompletionTokens);
    if (!isSameModel && estimatedInputChars <= fallbackBudget.maxInputChars) {
      attempts.push(fallback);
    }
  }

  return attempts;
}

function extractProviderMessage(raw: string): string {
  if (!raw.trim()) return '';

  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string; type?: string; code?: string };
      message?: string;
      detail?: string;
    };
    return parsed.error?.message || parsed.message || parsed.detail || raw;
  } catch {
    return raw;
  }
}

function normalizeAiError(err: unknown): AiProviderError {
  if (err instanceof AiProviderError) return err;
  if (err instanceof DOMException && err.name === 'AbortError') {
    return new AiProviderError('AI service timeout', 'provider_unavailable');
  }
  if (err instanceof Error) {
    return new AiProviderError(err.message, 'provider_unavailable');
  }
  return new AiProviderError('Unknown AI service error', 'provider_unavailable');
}

async function logAiFailure(c: Context<{ Bindings: Env }>, userId: string, usageId: string, aiErr: AiProviderError) {
  await c.env.DB.prepare(
    `INSERT INTO error_logs (id, source, message, stack, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(),
    'POST /api/tools/web-prompt-generator',
    aiErr.message.slice(0, 1000),
    aiErr.stack || null,
    JSON.stringify({
      user_id: userId,
      usage_id: usageId,
      kind: aiErr.kind,
      upstream_status: aiErr.upstreamStatus || null,
      upstream_body: aiErr.upstreamBody?.slice(0, 1000) || null,
    }),
    new Date().toISOString()
  ).run();
}

const PRD_SYSTEM_PROMPT = `You are an expert Product Requirements Document generator for websites, landing pages, SaaS products, web applications, dashboards, mobile apps, and AI-powered products.

Your job is to transform user input into a clear, structured, realistic, and implementation-ready AI Builder Prompt that embeds a full PRD.

You are not a generic writing assistant. You are a product strategist, UX planner, conversion strategist, and technical product analyst.

Your output must help a developer, designer, product manager, or AI coding agent (Cursor, Lovable, v0, Bolt, Replit) understand exactly what needs to be built and start building immediately.

## Core Behavior

Always produce output that is:
- Clear, structured, realistic, and implementation-ready
- Specific to the project type
- Free from fake claims, fake data, testimonials, fake statistics, and unrealistic assumptions
- Useful for AI builders and human developers

Do not blindly agree with vague input. If the user input is weak, incomplete, or generic, improve it using reasonable assumptions and clearly label those assumptions.

If the user provides references, skill documents, design guidelines, or URLs, include them as mandatory references and instruct the builder to review them before building.

## Deep Product Thinking Protocol

Before writing the final PRD, think through the project as a senior product strategist, UX architect, technical lead, and conversion planner. Do this reasoning internally; do not expose chain-of-thought or scratch notes.

Your internal analysis must cover:
- What the product is really trying to accomplish
- The most likely primary user intent and anxieties
- The shortest useful MVP that still feels complete
- The interaction model and information architecture
- The core data objects, states, permissions, and lifecycle
- The riskiest assumptions and how the builder should validate them
- Which parts need precise acceptance criteria to prevent vague implementation
- Which design, copy, and motion choices serve the business goal

Then output only the polished Markdown document.

## Output Control Inputs

The user may provide:
- generation_mode: "fast" or "deep"
- output_format: target artifact shape
- output_priority: dominant optimization goal
- output_detail: Ringkas, Standar, or Sangat Detail

Honor these fields:
- Fast mode: concise but still complete; prioritize clarity, speed, and implementation readiness.
- Deep mode: produce a more rigorous PRD with stronger assumptions, edge cases, architecture notes, risks, QA plan, and implementation sequencing.
- If output_format says "AI Builder Prompt + PRD", frame the document as a direct prompt for Cursor/Lovable/v0/Bolt/Replit.
- If output_format says "Technical Blueprint", add stronger architecture, data model, integration, state, API, and security requirements.
- If output_format says "UX Product Spec", add stronger user journey, IA, screen states, interaction, accessibility, and content requirements.
- If output_format says "Landing Page Brief", add stronger section strategy, copy hierarchy, CTA, SEO, performance, and conversion requirements.
- Let output_priority shape tradeoffs: Conversion, UX, Technical Architecture, MVP Speed, Premium Design, or Balanced.

## Project Type Adaptation

### If the project is a Landing Page
Focus on: conversion objective, target audience, value proposition, page sections, CTA strategy, copy hierarchy, visual direction, motion and interaction, SEO, performance, responsive behavior, accessibility, trust elements, offer structure, acceptance criteria.

Landing page PRD must include:
1. Project Overview & Conversion Objective
2. Target Audience
3. Problem Statement & Value Proposition
4. Offer / CTA
5. Page Structure (section-by-section)
6. Copywriting Requirements
7. Visual Design Requirements
8. Motion & Interaction Requirements
9. Responsive Requirements
10. SEO & Performance Requirements
11. Accessibility Requirements
12. Out of Scope
13. Acceptance Criteria

### If the project is a Web App / SaaS / Dashboard
Focus on: user roles, core features, user flow, business rules, data model, permissions, system logic, validations, edge cases, API needs, technical constraints.

Web app PRD must include:
1. Project Overview & Goals
2. Target Users & User Roles
3. Problem Statement
4. Core Features
5. User Stories & User Flows
6. Business Rules
7. Data Requirements & Entity Suggestions
8. Validation Rules & Edge Cases
9. Permissions
10. Technical Requirements
11. Security Requirements
12. Non-Functional Requirements
13. Out of Scope
14. Acceptance Criteria

### If the project is a Mobile App
Focus on: mobile-first user journey, screens, navigation, device constraints, offline behavior, notification behavior, gestures, performance, permissions.

### If the project is an E-commerce Page
Focus on: product presentation, offer structure, checkout flow, trust, pricing, urgency, objection handling, conversion tracking.

## PRD Quality Rules

1. **Assumptions**: State clearly if input is incomplete. Example: "Assumption: because no tech stack was provided, this PRD assumes React + Tailwind."
2. **Goals and Non-Goals**: Separate what the project must achieve and what it should not include.
3. **Scope**: Define MVP scope, out of scope, and future enhancements.
4. **Acceptance Criteria**: Must be specific and testable. Bad: "The website should look good." Good: "The CTA button must be visible in the hero section on desktop and mobile without excessive scrolling."
5. **Edge Cases**: Include edge cases relevant to the project type.
6. **No Fake Data**: Do not invent testimonials, user numbers, revenue, conversion rates, partner logos, guarantees, deadlines, or scarcity claims. Use clearly marked placeholders if needed.
7. **Builder-Ready**: Include clear requirements, section breakdown, interaction notes, design constraints, technical constraints, acceptance criteria, and implementation instructions.
8. **Prioritized**: Mark what is P0, P1, and P2 when the requested scope is broad.
9. **Stateful**: For apps, include empty, loading, success, error, partial, unauthorized, and edge states when relevant.
10. **Testable**: Include a QA checklist and measurable acceptance criteria.

## Required Content Depth

Unless the user explicitly asks for a short output, include:
1. Executive Summary
2. Assumptions & Clarifying Notes
3. Goals, Non-Goals, and Success Metrics
4. Target Users, Jobs-To-Be-Done, and User Concerns
5. Scope: MVP, P1, P2, and Out of Scope
6. Feature Requirements
7. User Flows and Screen / Section Requirements
8. Data, State, and Permission Requirements
9. UX, Visual Design, Copy, Motion, Accessibility, and Responsive Requirements
10. Technical Requirements and Suggested Architecture
11. Integrations, Analytics, SEO, and Performance Requirements when relevant
12. Edge Cases, Error States, and Security Notes
13. Implementation Plan
14. QA Checklist
15. Acceptance Criteria
16. AI Builder Instructions

## Mandatory Reference / Skill Check

Every PRD you generate MUST include the following section verbatim, regardless of what the user provides:

---
### 🔍 Mandatory Skill Check Before Building

Before writing any code, the AI/developer must read and apply these two reference skills:

1. **Motion Design Skill** — https://www.skills.sh/lottiefiles/motion-design-skill/motion-design
   - Apply to: animation hierarchy, button feedback, section reveal, scroll animation, transition timing, reduced motion support
   - Verify: final output must include a "Reference Application Review" explaining how motion principles from this skill influenced implementation decisions

2. **Emil Design Engineering Skill** — https://github.com/emilkowalski/skill/blob/main/skills/emil-design-eng/SKILL.md
   - Apply to: component architecture, interaction patterns, accessibility, design system thinking, CSS/JS animation approach
   - Verify: final output must explain how the design engineering principles from this skill were applied to component structure and interactions

These are non-negotiable. Do not skip them. Do not summarize them from memory — instruct the builder to open and read the actual URLs before building.
---

If the user also provides additional skill sources, design references, documentation links, or URLs, include them in the same section as additional mandatory references with the same structure (what to apply, how to verify).

## Output Format

Output a single Markdown document structured as an AI Builder Prompt that embeds the full PRD. The document should be ready to paste directly into Cursor, Lovable, v0, Bolt, or Replit.

Structure:
# AI Builder Prompt — [Project Name]

## Executive Summary
[Short product, audience, goal, and build strategy]

## Operating Assumptions
[Clearly labeled assumptions and constraints]

## 📋 PRD (Product Requirements Document)
[Full PRD adapted to project type]

## 🧭 UX / IA / Flow Requirements
[Screens, sections, navigation, states, and key interactions]

## 🧱 Technical Blueprint
[Stack assumptions, components, data model, integrations, APIs, permissions, performance, security]

## 🤖 AI Builder Instructions
[Direct, actionable instructions for the AI coder — what to build first, key constraints, must-haves, must-nots]

## 🧪 QA Checklist
[Manual checks, edge states, responsive checks, accessibility checks]

## ✅ Acceptance Criteria
[Specific testable criteria the final output must meet]

Output rules:
- Be specific. Avoid generic phrases.
- Use clean Markdown.
- Do not include fake claims.
- Do not overcomplicate MVP.
- Make every requirement actionable.
- Prefer concrete UI states, implementation details, and validation rules over abstract advice.
- Do not expose hidden reasoning or chain-of-thought.
- Output only Markdown, no wrapper code fence.`;

const toolsRoutes = new Hono<{ Bindings: Env }>();
toolsRoutes.use('*', authMiddleware());

async function generatePrdWithModel(
  c: Context<{ Bindings: Env }>,
  modelConfig: AiModelConfig,
  userMessage: string
): Promise<string> {
  const baseUrl = (c.env.SUMOPOD_BASE_URL || SUMOPOD_DEFAULT_BASE_URL).replace(/\/+$/, '');
  const chatCompletionsUrl = baseUrl.endsWith('/v1')
    ? `${baseUrl}/chat/completions`
    : `${baseUrl}/v1/chat/completions`;
  const budgets = getAiBudgets(modelConfig.contextTokens, modelConfig.maxCompletionTokens);

  const isKimiK26 = /(?:^|[/:-])kimi-k2\.(5|6)(?:$|[-_])/i.test(modelConfig.model);
  const requestBody: Record<string, unknown> = {
    model: modelConfig.model,
    messages: [
      { role: 'system', content: PRD_SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    max_completion_tokens: budgets.maxCompletionTokens,
  };

  if (isKimiK26) {
    requestBody.thinking = { type: 'disabled' };
  } else {
    requestBody.temperature = 0.35;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
  const aiResponse = await fetch(chatCompletionsUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${c.env.SUMOPOD_API_KEY}`,
      'Content-Type': 'application/json',
    },
    signal: controller.signal,
    body: JSON.stringify(requestBody),
  }).finally(() => clearTimeout(timeout));

  if (!aiResponse.ok) {
    const responseText = await aiResponse.text().catch(() => '');
    const providerMessage = extractProviderMessage(responseText).slice(0, 300);
    const kind: AiErrorKind = aiResponse.status >= 500 ? 'provider_unavailable' : 'provider_rejection';
    throw new AiProviderError(
      `${modelConfig.label} error ${aiResponse.status}${providerMessage ? `: ${providerMessage}` : ''}`,
      kind,
      aiResponse.status,
      responseText
    );
  }

  const aiData = await aiResponse.json() as {
    choices?: Array<{ message?: { content?: string }; text?: string }>;
  };
  const generatedMarkdown = (aiData.choices?.[0]?.message?.content || aiData.choices?.[0]?.text || '')
    .replace(/^```(?:markdown|md)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!generatedMarkdown || generatedMarkdown.length < 80) {
    throw new AiProviderError(`${modelConfig.label} response kosong atau terlalu pendek`, 'provider_unavailable');
  }

  return generatedMarkdown;
}

toolsRoutes.get('/', async (c) => {
  return success(c, TOOLS_CATALOG);
});

toolsRoutes.post('/web-prompt-generator', async (c) => {
  const user = c.get('user');

  if (!c.env.SUMOPOD_API_KEY) return error(c, 'AI service belum dikonfigurasi', 503);

  let body: WebPromptGeneratorBody;
  try { body = await c.req.json(); } catch { return error(c, 'Invalid JSON', 400); }

  // Support both new multi-step fields and legacy `purpose` field
  const mainGoal = body.main_goal?.trim() || body.purpose?.trim() || '';
  if (!mainGoal) return error(c, 'Tujuan/goal aplikasi wajib diisi', 400);

  const generationMode = parseGenerationMode(body.ai_mode);
  const primaryModel = getPrimaryModelConfig(c.env, generationMode);
  const primaryBudgets = getAiBudgets(primaryModel.contextTokens, primaryModel.maxCompletionTokens);
  const estimatedInputChars = PRD_SYSTEM_PROMPT.length + JSON.stringify(body).length;
  if (estimatedInputChars > primaryBudgets.maxInputChars) {
    return error(
      c,
      `Input terlalu panjang untuk mode ${generationMode === 'deep' ? 'Deep' : 'Fast'}. Maksimal sekitar ${primaryBudgets.maxInputChars.toLocaleString('id-ID')} karakter total.`,
      400
    );
  }

  // C1: Atomic credit deduction
  const now = new Date().toISOString();
  const deductResult = await c.env.DB.prepare(
    `UPDATE user_tool_credits SET balance = balance - 1, total_used = total_used + 1, updated_at = ?
     WHERE user_id = ? AND balance >= 1`
  ).bind(now, user.id).run();

  if (!deductResult.meta.changes || deductResult.meta.changes === 0) {
    return error(c, 'Kredit tidak cukup. Beli kredit untuk melanjutkan.', 402);
  }

  const creditRow = await c.env.DB.prepare(
    'SELECT balance FROM user_tool_credits WHERE user_id = ?'
  ).bind(user.id).first();
  const newBalance = (creditRow?.balance as number) ?? 0;

  await c.env.DB.prepare(
    `INSERT INTO tool_credit_transactions (id, user_id, type, amount, balance_after, tool_name, description, created_at)
     VALUES (?, ?, 'usage', -1, ?, 'web_prompt_generator', 'PRD Generator', ?)`
  ).bind(crypto.randomUUID(), user.id, newBalance, now).run();

  const usageId = crypto.randomUUID();
  const inputSummary = (body.project_name || mainGoal).slice(0, 200);
  await c.env.DB.prepare(
    `INSERT INTO tool_usage_logs (id, user_id, tool_name, credits_used, input_summary, status, created_at)
     VALUES (?, ?, 'web_prompt_generator', 1, ?, 'success', ?)`
  ).bind(usageId, user.id, inputSummary, now).run();

  // Build structured input for AI
  const inputData = {
    project_name: body.project_name || 'Unnamed Project',
    project_type: body.project_type || 'Web App',
    main_goal: mainGoal,
    target_user: body.target_user || '',
    problem: body.problem || '',
    solution: body.solution || '',
    primary_cta: body.primary_cta || '',
    tone: body.tone || 'Professional',
    visual_style: body.visual_style || '',
    brand_colors: body.brand_colors || '',
    references: body.references || '',
    platform: body.platform || 'Website',
    tech_stack: body.tech_stack || 'React + Tailwind',
    output_detail: body.output_detail || 'Standar',
    language: body.language || 'Indonesia',
    ai_mode: generationMode,
    output_format: body.output_format || 'AI Builder Prompt + PRD',
    output_priority: body.output_priority || 'Balanced',
    required_sections: Array.isArray(body.required_sections) ? body.required_sections : [],
    constraints: body.constraints || '',
    future_features: body.future_features || '',
  };

  const userMessage = `Buat AI Builder Prompt yang berisi PRD lengkap untuk project berikut:

${JSON.stringify(inputData, null, 2)}

Gunakan bahasa ${inputData.language === 'Indonesia' ? 'Indonesia' : 'English'} untuk seluruh output.
Mode generate: ${generationMode === 'deep' ? 'Deep / Detail menggunakan analisis produk yang lebih ketat' : 'Fast / Smart menggunakan output yang tetap lengkap tapi efisien'}.
Format output: ${inputData.output_format}.
Prioritas output: ${inputData.output_priority}.
Level detail: ${inputData.output_detail}.

Instruksi tambahan:
- Jika mode Deep, buat PRD lebih tajam, eksplisit, dan siap dieksekusi oleh coding agent.
- Jika prioritas output bukan Balanced, sesuaikan tradeoff PRD ke prioritas tersebut.
- Jangan tampilkan chain-of-thought. Tampilkan hanya dokumen final yang rapi.`;

  let generatedMarkdown = '';
  let modelUsed = primaryModel.model;
  let fallbackUsed = false;
  try {
    const attempts = getModelAttempts(c.env, generationMode, estimatedInputChars);
    let lastError: unknown = null;

    for (const attempt of attempts) {
      try {
        generatedMarkdown = await generatePrdWithModel(c, attempt, userMessage);
        modelUsed = attempt.model;
        fallbackUsed = !!attempt.isFallback;
        lastError = null;
        break;
      } catch (err) {
        lastError = err;
        if (!attempt.isFallback) {
          console.warn('[tools:web-prompt-generator] primary AI model failed, trying fallback if available', normalizeAiError(err));
        }
      }
    }

    if (lastError || !generatedMarkdown) {
      throw lastError || new AiProviderError('AI response kosong atau terlalu pendek', 'provider_unavailable');
    }
  } catch (aiErr) {
    const normalizedError = normalizeAiError(aiErr);
    console.error('[tools:web-prompt-generator] AI error', normalizedError);

    // M1: Atomic refund
    await c.env.DB.prepare(
      `UPDATE user_tool_credits
       SET balance = balance + 1,
           total_used = CASE WHEN total_used > 0 THEN total_used - 1 ELSE 0 END,
           updated_at = ?
       WHERE user_id = ?`
    ).bind(new Date().toISOString(), user.id).run();

    await c.env.DB.prepare(
      `INSERT INTO tool_credit_transactions (id, user_id, type, amount, balance_after, tool_name, description, created_at)
       VALUES (?, ?, 'refund', 1, ?, 'web_prompt_generator', 'Refund: AI gagal', ?)`
    ).bind(crypto.randomUUID(), user.id, newBalance + 1, new Date().toISOString()).run();

    await c.env.DB.prepare(
      `UPDATE tool_usage_logs SET status = 'failed' WHERE id = ?`
    ).bind(usageId).run();

    await logAiFailure(c, user.id, usageId, normalizedError).catch(console.error);

    const status = normalizedError.kind === 'provider_rejection' ? 502 : 503;
    const message = normalizedError.kind === 'provider_rejection'
      ? `AI provider menolak request: ${normalizedError.message}. Kredit sudah dikembalikan.`
      : 'AI provider sedang gagal atau timeout. Kredit sudah dikembalikan. Silakan coba lagi.';
    return error(c, message, status);
  }

  const slug = inputData.project_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);
  const filename = `ai-builder-prd-${slug}-${new Date().toISOString().slice(0, 10)}.md`;

  return success(c, {
    prompt: generatedMarkdown,
    markdown: generatedMarkdown,
    preview: generatedMarkdown,
    filename,
    model: modelUsed,
    mode: generationMode,
    fallback_used: fallbackUsed,
    credits_used: 1,
    credits_remaining: newBalance,
  });
});

export default toolsRoutes;
