"use client";
/* eslint-disable @typescript-eslint/no-unused-vars */

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { api, invalidateCache } from "@/lib/api-client";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import {
  Wand2, Zap, Copy, Check, RefreshCw, ChevronLeft, ChevronRight,
  AlertCircle, Download, Eye, FileText,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────

const PROJECT_TYPES = [
  "Landing Page", "Web App", "SaaS", "Dashboard",
  "Mobile App", "E-commerce", "Internal Tool",
];
const TONES = ["Professional", "Casual", "Bold", "Friendly", "Premium", "Technical"];
const PLATFORMS = ["Website", "Web App", "Mobile", "Internal Tool"];
const TECH_STACKS = [
  "React + Tailwind", "Next.js + Tailwind", "HTML CSS JS", "Vue.js", "Lainnya",
];
const OUTPUT_DETAILS = ["Ringkas", "Standar", "Sangat Detail"];
const LANGUAGES = ["Indonesia", "English"];
const AI_MODES = [
  {
    value: "fast",
    label: "Smart / Cepat",
    description: "Gemini Flash-Lite, cocok untuk PRD cepat dengan input panjang.",
  },
  {
    value: "deep",
    label: "Deep / Detail",
    description: "DeepSeek V4 Flash, cocok untuk SaaS, dashboard, dan logic produk kompleks.",
  },
] as const;
const OUTPUT_FORMATS = [
  "AI Builder Prompt + PRD",
  "Technical Blueprint",
  "UX Product Spec",
  "Landing Page Brief",
];
const OUTPUT_PRIORITIES = [
  "Balanced",
  "Conversion",
  "UX",
  "Technical Architecture",
  "MVP Speed",
  "Premium Design",
];
const REQUIRED_SECTIONS_OPTIONS = [
  "Hero", "Problem", "Benefit", "Pricing", "FAQ",
  "CTA", "Social Proof", "Speaker", "Testimonial", "Schedule",
];

const TOTAL_STEPS = 5;
const TEXT_LIMITS = {
  main_goal: 120_000,
  target_user: 80_000,
  problem: 120_000,
  solution: 120_000,
  references: 80_000,
  constraints: 80_000,
  future_features: 80_000,
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface GenerateResult {
  prompt: string;
  markdown?: string;
  preview?: string;
  filename?: string;
  model?: string;
  mode?: "fast" | "deep";
  fallback_used?: boolean;
  credits_used: number;
  credits_remaining: number;
}

type OutputMode = "preview" | "markdown";

interface FormState {
  // Step 1
  project_name: string;
  project_type: string;
  main_goal: string;
  target_user: string;
  // Step 2
  problem: string;
  solution: string;
  primary_cta: string;
  // Step 3
  visual_style: string;
  tone: string;
  brand_colors: string;
  references: string;
  // Step 4
  platform: string;
  tech_stack: string;
  output_detail: string;
  language: string;
  ai_mode: "fast" | "deep";
  output_format: string;
  output_priority: string;
  // Step 5
  required_sections: string[];
  constraints: string;
  future_features: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WebPromptGeneratorPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>({
    project_name: "",
    project_type: "Landing Page",
    main_goal: "",
    target_user: "",
    problem: "",
    solution: "",
    primary_cta: "",
    visual_style: "",
    tone: "Professional",
    brand_colors: "",
    references: "",
    platform: "Website",
    tech_stack: "React + Tailwind",
    output_detail: "Standar",
    language: "Indonesia",
    ai_mode: "fast",
    output_format: "AI Builder Prompt + PRD",
    output_priority: "Balanced",
    required_sections: [],
    constraints: "",
    future_features: "",
  });
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [outputMode, setOutputMode] = useState<OutputMode>("preview");

  const set = (field: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const toggleSection = (section: string) =>
    setForm((f) => ({
      ...f,
      required_sections: f.required_sections.includes(section)
        ? f.required_sections.filter((s) => s !== section)
        : [...f.required_sections, section],
    }));

  // Validation: required fields per step
  const canAdvance = () => {
    if (step === 1) return form.project_name.trim() && form.main_goal.trim() && form.target_user.trim();
    if (step === 2) return form.problem.trim() && form.solution.trim();
    return true;
  };

  const handleNext = () => { if (canAdvance()) setStep((s) => Math.min(s + 1, TOTAL_STEPS)); };
  const handleBack = () => setStep((s) => Math.max(s - 1, 1));

  const handleGenerate = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await api<GenerateResult>("/api/tools/web-prompt-generator", {
        method: "POST",
        body: form,
        cacheTtl: 0,
      });

      if (!res.success) {
        if (res.error?.includes("Kredit tidak cukup")) {
          setError("Kredit kamu habis. Beli kredit untuk melanjutkan.");
        } else {
          setError(res.error || "Gagal generate PRD. Silakan coba lagi.");
        }
        return;
      }

      setResult(res.data!);
      setOutputMode("preview");
      invalidateCache("/api/tools/credits");
    } catch {
      setError("Gagal terhubung ke AI service. Periksa koneksi dan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    const markdown = result?.markdown || result?.prompt;
    if (!markdown) return;
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const markdown = result?.markdown || result?.prompt;
    if (!markdown) return;
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result?.filename || "ai-builder-prd.md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="mb-6 flex items-center gap-2">
        <Link
          href="/tools"
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-slate-400 transition-colors hover:bg-gray-100 dark:hover:bg-white/10"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          AI Tools
        </Link>
      </div>

      <PageHeader
        title="PRD Generator"
        description="Buat AI Builder Prompt + PRD lengkap siap tempel ke Cursor, Lovable, v0, Bolt, atau Replit."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Multi-step Form */}
        <div className="flex flex-col gap-4">
          {/* Step Indicator */}
          <StepIndicator current={step} total={TOTAL_STEPS} />

          <div className="rounded-2xl border dark:border-white/10 bg-white dark:bg-[#0D0D1F] p-5">
            <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-white">
              {step === 1 && "Step 1 — Basic Project"}
              {step === 2 && "Step 2 — Problem & Offer"}
              {step === 3 && "Step 3 — Design Direction"}
              {step === 4 && "Step 4 — Technical Output"}
              {step === 5 && (
                <span>
                  Step 5 — Advanced{" "}
                  <span className="ml-1 text-xs font-normal text-gray-400 dark:text-slate-500">opsional</span>
                </span>
              )}
            </h2>

            <div className="flex flex-col gap-4">
              {step === 1 && (
                <>
                  <Field label="Nama Project" required>
                    <input
                      type="text"
                      placeholder="Contoh: PejuangYen Landing Page"
                      value={form.project_name}
                      onChange={(e) => set("project_name", e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Jenis Project" required>
                    <select value={form.project_type} onChange={(e) => set("project_type", e.target.value)} className={inputCls}>
                      {PROJECT_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                    </Field>
                    <Field label="Tujuan Utama" required>
                      <textarea
                        rows={3}
                        placeholder="Contoh: Mengumpulkan pendaftar webinar persiapan kerja ke Jepang"
                        value={form.main_goal}
                        maxLength={TEXT_LIMITS.main_goal}
                        onChange={(e) => set("main_goal", e.target.value)}
                        className={`${inputCls} resize-none`}
                      />
                      <CharacterCounter value={form.main_goal} max={TEXT_LIMITS.main_goal} />
                    </Field>
                    <Field label="Target User" required>
                      <textarea
                        rows={3}
                        placeholder="Contoh: Anak muda yang ingin kerja & belajar bahasa Jepang"
                        value={form.target_user}
                        maxLength={TEXT_LIMITS.target_user}
                        onChange={(e) => set("target_user", e.target.value)}
                        className={`${inputCls} resize-none`}
                      />
                      <CharacterCounter value={form.target_user} max={TEXT_LIMITS.target_user} />
                    </Field>
                </>
              )}

              {step === 2 && (
                  <>
                    <Field label="Masalah yang Diselesaikan" required>
                      <textarea
                        rows={4}
                        placeholder="Contoh: Banyak orang ingin kerja ke Jepang tapi bingung harus mulai dari mana"
                        value={form.problem}
                        maxLength={TEXT_LIMITS.problem}
                        onChange={(e) => set("problem", e.target.value)}
                        className={`${inputCls} resize-none`}
                      />
                      <CharacterCounter value={form.problem} max={TEXT_LIMITS.problem} />
                    </Field>
                    <Field label="Solusi yang Ditawarkan" required>
                      <textarea
                        rows={4}
                        placeholder="Contoh: Webinar gratis + kelas premium persiapan kerja ke Jepang"
                        value={form.solution}
                        maxLength={TEXT_LIMITS.solution}
                        onChange={(e) => set("solution", e.target.value)}
                        className={`${inputCls} resize-none`}
                      />
                      <CharacterCounter value={form.solution} max={TEXT_LIMITS.solution} />
                    </Field>
                  <Field label="CTA Utama">
                    <input
                      type="text"
                      placeholder="Contoh: Daftar Sekarang"
                      value={form.primary_cta}
                      onChange={(e) => set("primary_cta", e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                </>
              )}

              {step === 3 && (
                <>
                  <Field label="Style Visual">
                    <input
                      type="text"
                      placeholder="Contoh: Clean, premium, modern SaaS, smooth motion"
                      value={form.visual_style}
                      onChange={(e) => set("visual_style", e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Tone Copywriting">
                    <select value={form.tone} onChange={(e) => set("tone", e.target.value)} className={inputCls}>
                      {TONES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </Field>
                  <Field label="Warna Brand">
                    <input
                      type="text"
                      placeholder="Contoh: #0F172A, #FFFFFF, #22C55E"
                      value={form.brand_colors}
                      onChange={(e) => set("brand_colors", e.target.value)}
                      className={inputCls}
                    />
                    </Field>
                    <Field label="Referensi / Skill Source">
                      <textarea
                        rows={3}
                        placeholder="URL referensi, design guideline, atau dokumentasi (pisahkan dengan enter)"
                        value={form.references}
                        maxLength={TEXT_LIMITS.references}
                        onChange={(e) => set("references", e.target.value)}
                        className={`${inputCls} resize-none`}
                      />
                      <CharacterCounter value={form.references} max={TEXT_LIMITS.references} />
                    </Field>
                </>
              )}

              {step === 4 && (
                <>
                  <Field label="Mode AI">
                    <div className="grid gap-2 sm:grid-cols-2">
                      {AI_MODES.map((mode) => (
                        <button
                          key={mode.value}
                          type="button"
                          onClick={() => set("ai_mode", mode.value)}
                          className={`rounded-xl border p-3 text-left transition-colors ${
                            form.ai_mode === mode.value
                              ? "border-violet-300 dark:border-violet-500/50 bg-violet-50 dark:bg-violet-500/10 text-violet-900 dark:text-violet-300"
                              : "border-gray-200 dark:border-white/10 bg-white dark:bg-transparent text-gray-700 dark:text-slate-300 hover:border-violet-200 dark:hover:border-violet-500/30 hover:bg-violet-50/60 dark:hover:bg-violet-500/5"
                          }`}
                        >
                          <span className="block text-sm font-semibold">{mode.label}</span>
                          <span className="mt-1 block text-xs leading-5 text-gray-500 dark:text-slate-400">{mode.description}</span>
                        </button>
                      ))}
                    </div>
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Platform Output">
                      <select value={form.platform} onChange={(e) => set("platform", e.target.value)} className={inputCls}>
                        {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
                      </select>
                    </Field>
                    <Field label="Tech Stack">
                      <select value={form.tech_stack} onChange={(e) => set("tech_stack", e.target.value)} className={inputCls}>
                        {TECH_STACKS.map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Format Output">
                      <select value={form.output_format} onChange={(e) => set("output_format", e.target.value)} className={inputCls}>
                        {OUTPUT_FORMATS.map((format) => <option key={format}>{format}</option>)}
                      </select>
                    </Field>
                    <Field label="Prioritas Output">
                      <select value={form.output_priority} onChange={(e) => set("output_priority", e.target.value)} className={inputCls}>
                        {OUTPUT_PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}
                      </select>
                    </Field>
                  </div>
                  <Field label="Level Detail Output">
                    <select value={form.output_detail} onChange={(e) => set("output_detail", e.target.value)} className={inputCls}>
                      {OUTPUT_DETAILS.map((d) => <option key={d}>{d}</option>)}
                    </select>
                  </Field>
                  <Field label="Bahasa Output">
                    <div className="flex gap-2">
                      {LANGUAGES.map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => set("language", lang)}
                          className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                            form.language === lang
                              ? "bg-violet-600 dark:bg-violet-500 text-white"
                              : "border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent text-gray-600 dark:text-slate-300 hover:border-violet-200 dark:hover:border-violet-500/30 hover:bg-violet-50 dark:hover:bg-violet-500/10"
                          }`}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                  </Field>
                </>
              )}

              {step === 5 && (
                <>
                  <Field label="Section yang Wajib Ada">
                    <div className="flex flex-wrap gap-2">
                      {REQUIRED_SECTIONS_OPTIONS.map((section) => (
                        <button
                          key={section}
                          type="button"
                          onClick={() => toggleSection(section)}
                          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                            form.required_sections.includes(section)
                              ? "bg-violet-600 dark:bg-violet-500 text-white"
                              : "border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent text-gray-600 dark:text-slate-300 hover:border-violet-200 dark:hover:border-violet-500/30 hover:bg-violet-50 dark:hover:bg-violet-500/10"
                          }`}
                        >
                          {section}
                        </button>
                      ))}
                    </div>
                    </Field>
                    <Field label="Batasan">
                      <textarea
                        rows={3}
                        placeholder="Contoh: Jangan pakai fake testimonial, jangan gradient ramai, harus responsive"
                        value={form.constraints}
                        maxLength={TEXT_LIMITS.constraints}
                        onChange={(e) => set("constraints", e.target.value)}
                        className={`${inputCls} resize-none`}
                      />
                      <CharacterCounter value={form.constraints} max={TEXT_LIMITS.constraints} />
                    </Field>
                    <Field label="Future Features">
                      <textarea
                        rows={3}
                        placeholder="Contoh: Payment gateway, dashboard peserta, referral program"
                        value={form.future_features}
                        maxLength={TEXT_LIMITS.future_features}
                        onChange={(e) => set("future_features", e.target.value)}
                        className={`${inputCls} resize-none`}
                      />
                      <CharacterCounter value={form.future_features} max={TEXT_LIMITS.future_features} />
                    </Field>
                </>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
              <div>
                <p className="text-sm text-orange-700">{error}</p>
                {error.includes("kredit") && (
                  <Link href="/tools/credits" className="mt-1 text-xs font-medium text-orange-600 underline">
                    Beli kredit sekarang
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-white/10 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-slate-300 transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
              >
                <ChevronLeft className="h-4 w-4" />
                Kembali
              </button>
            )}

            {step < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canAdvance() || loading}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
              >
                Lanjut
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : !result ? (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-50"
              >
                {loading ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Generating...</>
                ) : (
                  <><Wand2 className="h-4 w-4" /> Generate PRD (1 kredit)</>
                )}
              </button>
            ) : null}
          </div>

          {/* Quick generate from step 4 — only shown before first result */}
          {step === 4 && !result && (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-xl border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 px-5 py-2.5 text-sm font-medium text-violet-700 dark:text-violet-300 transition-colors hover:bg-violet-100 dark:hover:bg-violet-500/20 disabled:opacity-50"
            >
              {loading ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Generating...</>
              ) : (
                <><Wand2 className="h-4 w-4" /> Generate Sekarang (skip step 5)</>
              )}
            </button>
          )}

          {result && (
            <div className="text-center text-xs text-gray-400">
              <p>
                Kredit tersisa: <span className="font-semibold text-violet-600">{result.credits_remaining}</span>
              </p>
              {result.model && (
                <p className="mt-1">
                  Model: <span className="font-medium text-gray-500">{result.model}</span>
                  {result.fallback_used ? <span className="text-orange-500"> (fallback)</span> : null}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right: Output */}
        <div className="flex flex-col gap-4">
          <div className="flex h-full min-h-[400px] flex-col rounded-2xl border dark:border-white/10 bg-white dark:bg-[#0D0D1F]">
            <div className="flex items-center justify-between border-b dark:border-white/10 px-5 py-3">
              <div className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-violet-500" />
                <span className="text-sm font-semibold text-gray-800 dark:text-white">Output</span>
              </div>
              {result?.prompt && (
                <div className="flex items-center gap-2">
                  <div className="flex rounded-full bg-gray-100 dark:bg-white/5 p-0.5">
                    {[
                      { mode: "preview" as const, label: "Preview", icon: Eye },
                      { mode: "markdown" as const, label: "MD", icon: FileText },
                    ].map((item) => (
                      <button
                        key={item.mode}
                        onClick={() => setOutputMode(item.mode)}
                        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                          outputMode === item.mode ? "bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white"
                        }`}
                      >
                        <item.icon className="h-3 w-3" />
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 rounded-full border dark:border-white/10 px-3 py-1 text-xs font-medium text-gray-600 dark:text-slate-300 transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
                  >
                    <Download className="h-3 w-3" />
                    .md
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 rounded-full border dark:border-white/10 px-3 py-1 text-xs font-medium text-gray-600 dark:text-slate-300 transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
                  >
                    {copied ? (
                      <><Check className="h-3 w-3 text-green-500" /> Tersalin!</>
                    ) : (
                      <><Copy className="h-3 w-3" /> Salin</>
                    )}
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-auto p-5">
              {loading && (
                <div className="flex h-full items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="h-8 w-8 animate-spin text-violet-300" />
                    <p className="text-sm text-gray-400">Sedang generate PRD...</p>
                  </div>
                </div>
              )}
              {!loading && !result && (
                <div className="flex h-full items-center justify-center">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50">
                      <Wand2 className="h-6 w-6 text-violet-400" />
                    </div>
                    <p className="text-sm text-gray-400">
                      Isi form di kiri sampai step 4 atau 5,<br />
                      lalu klik <span className="font-medium text-violet-500">Generate PRD</span>
                    </p>
                  </div>
                </div>
              )}
              {!loading && result?.prompt && outputMode === "markdown" && (
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-gray-700 dark:text-slate-300">
                  {result.markdown || result.prompt}
                </pre>
              )}
              {!loading && result?.prompt && outputMode === "preview" && (
                <MarkdownPreview markdown={result.preview || result.markdown || result.prompt} />
              )}
            </div>
          </div>

          {result?.prompt && (
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-xl border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 px-5 py-2.5 text-sm font-medium text-violet-700 dark:text-violet-300 transition-colors hover:bg-violet-100 dark:hover:bg-violet-500/20 disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" />
              Generate Ulang (1 kredit lagi)
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Helper components ────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-xl border border-gray-200 dark:border-white/10 dark:bg-white/[0.02] px-3 py-2.5 text-sm text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:border-violet-400 dark:focus:border-violet-500/50 focus:outline-none focus:ring-2 focus:ring-violet-100 dark:focus:ring-violet-500/20";

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-gray-700 dark:text-slate-300">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function CharacterCounter({ value, max }: { value: string; max: number }) {
  const isNearLimit = value.length >= max * 0.9;

  return (
    <p className={`mt-1 text-right text-[11px] ${isNearLimit ? "text-orange-500" : "text-gray-400"}`}>
      {value.length.toLocaleString("id-ID")} / {max.toLocaleString("id-ID")}
    </p>
  );
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-0">
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={n} className="flex flex-1 items-center">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                done
                  ? "bg-violet-600 dark:bg-violet-500 text-white"
                  : active
                  ? "border-2 border-violet-600 dark:border-violet-500 text-violet-600 dark:text-violet-400"
                  : "border-2 border-gray-200 dark:border-white/10 text-gray-400 dark:text-slate-500"
              }`}
            >
              {done ? "✓" : n}
            </div>
            {n < total && (
              <div className={`h-0.5 flex-1 transition-colors ${n < current ? "bg-violet-600 dark:bg-violet-500" : "bg-gray-200 dark:bg-white/10"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderInline(text: string): ReactNode {
  // Split on bold (**...**), italic (*...*), and inline code (`...`)
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith("*") && part.endsWith("*"))
          return <em key={i}>{part.slice(1, -1)}</em>;
        if (part.startsWith("`") && part.endsWith("`"))
          return <code key={i} className="rounded bg-gray-100 px-1 font-mono text-xs">{part.slice(1, -1)}</code>;
        return part;
      })}
    </>
  );
}

function MarkdownPreview({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  const elements: ReactNode[] = [];
  let codeBlock: string[] = [];
  let inCode = false;

  lines.forEach((line, index) => {
    if (line.trim().startsWith("```")) {
      if (inCode) {
        elements.push(
          <pre key={`code-${index}`} className="my-3 overflow-auto rounded-xl bg-gray-950 p-4 text-xs leading-relaxed text-gray-100">
            {codeBlock.join("\n")}
          </pre>
        );
        codeBlock = [];
        inCode = false;
      } else {
        inCode = true;
      }
      return;
    }

    if (inCode) { codeBlock.push(line); return; }

    const trimmed = line.trim();
    if (!trimmed) {
      elements.push(<div key={index} className="h-3" />);
    } else if (trimmed.startsWith("# ")) {
      elements.push(<h1 key={index} className="mb-3 text-xl font-bold text-gray-950">{renderInline(trimmed.slice(2))}</h1>);
    } else if (trimmed.startsWith("## ")) {
      elements.push(<h2 key={index} className="mb-2 mt-5 text-base font-semibold text-gray-900">{renderInline(trimmed.slice(3))}</h2>);
    } else if (trimmed.startsWith("### ")) {
      elements.push(<h3 key={index} className="mb-2 mt-4 text-sm font-semibold text-gray-800">{renderInline(trimmed.slice(4))}</h3>);
    } else if (/^[-*]\s+/.test(trimmed)) {
      elements.push(
        <div key={index} className="ml-3 flex gap-2 text-sm leading-7 text-gray-700">
          <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
          <span>{renderInline(trimmed.replace(/^[-*]\s+/, ""))}</span>
        </div>
      );
    } else if (/^\d+\.\s+/.test(trimmed)) {
      elements.push(<p key={index} className="text-sm leading-7 text-gray-700">{renderInline(trimmed)}</p>);
    } else {
      elements.push(<p key={index} className="text-sm leading-7 text-gray-700">{renderInline(trimmed)}</p>);
    }
  });

  if (codeBlock.length) {
    elements.push(
      <pre key="code-tail" className="my-3 overflow-auto rounded-xl bg-gray-950 p-4 text-xs leading-relaxed text-gray-100">
        {codeBlock.join("\n")}
      </pre>
    );
  }

  return <div className="prose prose-sm max-w-none">{elements}</div>;
}
