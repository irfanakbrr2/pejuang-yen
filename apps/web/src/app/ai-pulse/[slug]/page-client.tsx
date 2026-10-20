"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import NextImage from "next/image";
import {
  ArrowLeft, BookOpen, Bookmark, BookmarkCheck, Bot, Check, CheckCircle2, Copy, ExternalLink, GraduationCap, Gift,
  HelpCircle, Layers, Lightbulb, Link2, ListChecks, MessageCircle, Radar, Rocket, Share2, Sparkles, Target, Terminal, TrendingUp, Users,
} from "lucide-react";
import { aiPulseApi } from "@/lib/api-client";
import { PulseCard } from "../_components/PulseCard";
import { CATEGORY_LABELS, IMPACT_CONFIG, categoryGradient, relativeTime, type PulseDetail } from "../_lib/pulse";

export default function AiPulseDetailClient() {
  const pathname = usePathname();
  const router = useRouter();
  const slug = pathname.split("/").filter(Boolean)[1] ?? "_";

  const [item, setItem] = useState<PulseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!slug || slug === "_") return;
    setLoading(true);
    aiPulseApi.detail(slug).then((res) => {
      if (res.success && res.data) {
        const d = res.data as PulseDetail;
        setItem(d);
        setBookmarked(d.bookmarked);
      } else {
        setNotFound(true);
      }
      setLoading(false);
    });
  }, [slug]);

  const toggleBookmark = async () => {
    if (!item || saving) return;
    setSaving(true);
    const res = await aiPulseApi.toggleBookmark(item.id);
    if (res.success) {
      setBookmarked((res.data as { bookmarked: boolean }).bookmarked);
    } else if (res.error?.toLowerCase().includes("unauth") || res.error?.toLowerCase().includes("login") || res.error?.toLowerCase().includes("session")) {
      router.push("/login?redirect=" + encodeURIComponent(`/ai-pulse/${slug}`));
    }
    setSaving(false);
  };

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/ai-pulse");
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#F7F7F8]">
        <div className="text-sm text-[#A1A1AA]">Memuat intel...</div>
      </div>
    );
  }

  if (notFound || !item) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#F7F7F8] px-4 text-center">
        <Radar className="h-10 w-10 text-gray-300" />
        <p className="text-sm font-medium text-[#71717A]">Intel tidak ditemukan.</p>
        <Link href="/ai-pulse" className="text-sm font-semibold text-[#8B1414] hover:underline">
          Kembali ke AI Pulse
        </Link>
      </div>
    );
  }

  const impact = IMPACT_CONFIG[item.impact_level];
  const category = item.primary_category_id ? CATEGORY_LABELS[item.primary_category_id] : null;
  const hasRelated =
    item.related.courses.length > 0 || item.related.bonuses.length > 0 || item.related.automations.length > 0;

  return (
    <div className="min-h-dvh bg-[#F7F7F8]">
      <header className="sticky top-0 z-20 border-b border-[rgba(0,0,0,0.06)] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-1 px-4 py-3">
          <button onClick={goBack} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-[#3F3F46] hover:bg-black/[0.04]">
            <ArrowLeft className="h-4 w-4" /> Kembali
          </button>
          <button
            onClick={toggleBookmark}
            disabled={saving}
            aria-label={bookmarked ? "Hapus bookmark" : "Simpan bookmark"}
            className={`ml-auto flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
              bookmarked
                ? "border-[#8B1414] bg-[#8B1414] text-white"
                : "border-[rgba(0,0,0,0.1)] bg-white text-[#3F3F46] hover:bg-gray-50"
            }`}
          >
            {bookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
            {bookmarked ? "Tersimpan" : "Simpan"}
          </button>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-6">
        {/* Meta */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${impact.chip}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${impact.dot}`} aria-hidden /> {impact.label}
          </span>
          {category ? (
            <span className="rounded-full bg-[#F7E8E8] px-2 py-0.5 text-[10px] font-medium text-[#8B1414]">{category}</span>
          ) : null}
          <span className="text-[11px] tabular-nums text-[#A1A1AA]">{relativeTime(item.published_at)}</span>
          {item.source_name ? <span className="text-[11px] text-[#A1A1AA]">via {item.source_name}</span> : null}
        </div>

        <h1 className="mt-3 text-2xl font-black leading-tight tracking-[-0.02em] text-[#09090B] sm:text-3xl">{item.title}</h1>

        <div className="relative mt-4 h-52 w-full overflow-hidden rounded-xl sm:h-64">
          {item.thumbnail_url ? (
            <NextImage src={item.thumbnail_url} alt={item.title} fill className="object-cover" sizes="(max-width:768px) 100vw, 768px" />
          ) : (
            <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${categoryGradient(item.primary_category_id)}`}>
              <Sparkles className="h-10 w-10 text-[#8B1414]/40" />
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          {item.source_url ? (
            <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-[#8B1414] hover:underline">
              Sumber resmi <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
          <ShareRow title={item.title} />
        </div>

        {/* Learning package */}
        <div className="mt-6 space-y-5">
          {item.key_points.length > 0 ? (
            <div className="glass-card border-l-4 border-l-[#8B1414] p-4">
              <div className="mb-2 flex items-center gap-2 text-[12px] font-bold text-[#8B1414]">
                <ListChecks className="h-4 w-4" /> Poin Penting
              </div>
              <ul className="space-y-1.5">
                {item.key_points.map((p, i) => (
                  <li key={i} className="flex gap-2 text-sm text-[#3F3F46]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#8B1414]" /> {p}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {item.summary ? <Section icon={Sparkles} title="Ringkasan">{item.summary}</Section> : null}
          {item.deep_dive ? (
            <SectionWrap icon={Layers} title="Penjelasan mendalam">
              <div className="space-y-3 text-sm leading-relaxed text-[#3F3F46]">
                {item.deep_dive.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
              </div>
            </SectionWrap>
          ) : null}
          {item.why_it_matters ? <Section icon={TrendingUp} title="Kenapa ini penting">{item.why_it_matters}</Section> : null}
          {item.who_should_use ? <Section icon={Users} title="Siapa yang cocok">{item.who_should_use}</Section> : null}

          {item.use_cases.length > 0 ? (
            <SectionWrap icon={Target} title="Contoh use case">
              <ul className="space-y-2">
                {item.use_cases.map((u, i) => (
                  <li key={i} className="flex gap-2 text-sm text-[#3F3F46]">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#8B1414]" aria-hidden />
                    {u}
                  </li>
                ))}
              </ul>
            </SectionWrap>
          ) : null}

          {item.how_to_start.length > 0 ? (
            <SectionWrap icon={Rocket} title="Cara mulai">
              <ol className="space-y-2">
                {item.how_to_start.map((s, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-[#3F3F46]">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F7E8E8] text-[11px] font-bold text-[#8B1414]">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </SectionWrap>
          ) : null}

          {item.prompt_example ? (
            <SectionWrap icon={Terminal} title="Contoh prompt siap pakai">
              <PromptBlock text={item.prompt_example} />
            </SectionWrap>
          ) : null}

          {item.business_insight ? (
            <div className="glass-card border-l-4 border-l-[#8B1414] p-4">
              <div className="mb-1.5 flex items-center gap-2 text-[12px] font-bold text-[#8B1414]">
                <Lightbulb className="h-4 w-4" /> Insight Bisnis
              </div>
              <p className="text-sm leading-relaxed text-[#3F3F46]">{item.business_insight}</p>
            </div>
          ) : null}

          {item.faq.length > 0 ? (
            <SectionWrap icon={HelpCircle} title="FAQ">
              <div className="space-y-3">
                {item.faq.map((f, i) => (
                  <div key={i}>
                    <p className="text-sm font-semibold text-[#09090B]">{f.q}</p>
                    <p className="mt-0.5 text-sm text-[#71717A]">{f.a}</p>
                  </div>
                ))}
              </div>
            </SectionWrap>
          ) : null}
        </div>

        {/* CTA terkait — mesin konversi */}
        {hasRelated ? (
          <div className="glass-card mt-8 p-5">
            <div className="mb-3 flex items-center gap-2 text-[12px] font-bold text-[#8B1414]">
              <BookOpen className="h-4 w-4" /> Langsung praktik
            </div>
            <div className="space-y-2">
              {item.related.courses.map((c) => (
                <CtaRow key={c.id} href={`/learn/${c.slug}/start`} icon={BookOpen} title={c.title} sub="Kelas" />
              ))}
              {item.related.bonuses.map((b) => (
                <CtaRow key={b.id} href={`/bonuses/${b.slug}`} icon={Gift} title={b.title} sub="Bonus / Prompt Pack" />
              ))}
              {item.related.automations.map((a) => (
                <CtaRow key={a.key} href="/tools/automation" icon={Bot} title={a.name} sub="Workflow Automation" />
              ))}
            </div>
          </div>
        ) : null}

        {/* CTA Belajar — selalu tampil. Non-login otomatis diarahkan ke /login oleh app. */}
        <Link
          href="/kelas"
          className="mt-6 flex items-center gap-3 rounded-2xl bg-[#8B1414] p-5 text-white transition-colors hover:bg-[#6E0F0F]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-bold">Mulai belajar di PejuangYen</div>
            <div className="text-[13px] text-white/80">Pelajari topik ini lebih dalam lewat kelas terstruktur.</div>
          </div>
          <ArrowLeft className="h-5 w-5 rotate-180 opacity-80" />
        </Link>

        {/* Baca juga */}
        {item.related_posts.length > 0 ? (
          <div className="mt-10">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[#09090B]">
              <Layers className="h-4 w-4 text-[#8B1414]" /> Baca juga
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {item.related_posts.map((p, i) => <PulseCard key={p.id} item={p} index={i} />)}
            </div>
          </div>
        ) : null}
      </article>
    </div>
  );
}

function ShareRow({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? window.location.href : "";
  const text = `${title} — AI Pulse PejuangYen`;

  const nativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try { await navigator.share({ title, text, url }); } catch { /* dibatalkan */ }
    }
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* noop */ }
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-medium text-[#A1A1AA]">Bagikan</span>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`}
        target="_blank" rel="noopener noreferrer"
        aria-label="Bagikan ke WhatsApp"
        className="flex h-7 w-7 items-center justify-center rounded-full border border-[rgba(0,0,0,0.1)] bg-white text-[#3F3F46] hover:bg-[#F7E8E8] hover:text-[#8B1414]"
      >
        <MessageCircle className="h-3.5 w-3.5" />
      </a>
      <a
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`}
        target="_blank" rel="noopener noreferrer"
        aria-label="Bagikan ke X"
        className="flex h-7 w-7 items-center justify-center rounded-full border border-[rgba(0,0,0,0.1)] bg-white text-[#3F3F46] hover:bg-[#F7E8E8] hover:text-[#8B1414]"
      >
        <Share2 className="h-3.5 w-3.5" />
      </a>
      <button
        onClick={() => { copyLink(); nativeShare(); }}
        aria-label="Salin link"
        className="flex h-7 items-center gap-1 rounded-full border border-[rgba(0,0,0,0.1)] bg-white px-2 text-[11px] font-medium text-[#3F3F46] hover:bg-[#F7E8E8] hover:text-[#8B1414]"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
        {copied ? "Tersalin" : "Salin"}
      </button>
    </div>
  );
}

function PromptBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable */ }
  };
  return (
    <div className="relative rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#0B1220] p-4">
      <button
        onClick={copy}
        className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-white/20"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "Tersalin" : "Salin"}
      </button>
      <pre className="overflow-x-auto whitespace-pre-wrap break-words pr-16 font-mono text-[12.5px] leading-relaxed text-[#E2E8F0]">{text}</pre>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Sparkles; title: string; children: ReactNode }) {
  return (
    <SectionWrap icon={Icon} title={title}>
      <p className="text-sm leading-relaxed text-[#3F3F46]">{children}</p>
    </SectionWrap>
  );
}

function SectionWrap({ icon: Icon, title, children }: { icon: typeof Sparkles; title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-[#09090B]">
        <Icon className="h-4 w-4 text-[#8B1414]" /> {title}
      </h2>
      {children}
    </section>
  );
}

function CtaRow({ href, icon: Icon, title, sub }: { href: string; icon: typeof BookOpen; title: string; sub: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAFAFA] p-3 transition-colors hover:border-[#8B1414]/30 hover:bg-[#F7E8E8]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#8B1414] shadow-sm">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-[#09090B]">{title}</div>
        <div className="text-[10px] font-medium uppercase tracking-wide text-[#A1A1AA]">{sub}</div>
      </div>
      <ExternalLink className="h-4 w-4 shrink-0 text-gray-300 transition-colors group-hover:text-[#8B1414]" />
    </Link>
  );
}
