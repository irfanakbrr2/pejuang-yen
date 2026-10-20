"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  BookOpen,
  Gift,
  PlayCircle,
  Wand2,
  Loader2,
} from "lucide-react";
import { searchApi, skillsApi } from "@/lib/api-client";
import { useFocusTrap } from "@/lib/use-focus-trap";

export const OPEN_SEARCH_EVENT = "gwa:open-global-search";

/** Buka modal pencarian global dari mana saja */
export function openGlobalSearch() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_SEARCH_EVENT));
  }
}

interface SearchResult {
  content_type: string;
  ref_id: string;
  slug: string;
  title: string;
  description: string | null;
  format: string;
  access_type: string | null;
}

interface SkillChip {
  slug: string;
  name: string;
}

const TYPE_META: Record<string, { label: string; icon: typeof BookOpen; href: (r: SearchResult) => string }> = {
  course: { label: "Kelas", icon: BookOpen, href: (r) => `/learn/${r.slug}/start` },
  bonus: { label: "Bonus & Template", icon: Gift, href: () => `/bonuses` },
  recording: { label: "Rekaman", icon: PlayCircle, href: (r) => `/rekaman-zoom/${r.slug}` },
  tool: { label: "AI Tools", icon: Wand2, href: (r) => `/tools/${r.slug}` },
};

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [skill, setSkill] = useState("");
  const [skills, setSkills] = useState<SkillChip[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>(open);

  // cmd/ctrl+K atau custom event membuka modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, onOpenEvent);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      if (skills.length === 0) {
        skillsApi.list().then((res: { success: boolean; data?: SkillChip[] }) => {
          if (res.success && Array.isArray(res.data)) setSkills(res.data.slice(0, 8));
        });
      }
    } else {
      setQ("");
      setSkill("");
      setResults([]);
      setActiveIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const runSearch = useCallback((query: string, skillSlug: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const res = await searchApi.query({ q: query.trim(), skill: skillSlug || undefined } as { q: string; skill?: string });
      if (res.success) {
        setResults(((res.data as { results?: SearchResult[] })?.results) || []);
        setActiveIndex(0);
      }
      setLoading(false);
    }, 250);
  }, []);

  useEffect(() => {
    runSearch(q, skill);
  }, [q, skill, runSearch]);

  const goTo = (r: SearchResult) => {
    const meta = TYPE_META[r.content_type];
    setOpen(false);
    router.push(meta ? meta.href(r) : "/explore");
  };

  // Hasil diurutkan & dikelompokkan per tipe — kelas, rekaman, bonus, tools tidak dicampur
  const TYPE_ORDER = ["course", "recording", "bonus", "tool"];
  const ordered = TYPE_ORDER.flatMap((t) => results.filter((r) => r.content_type === t));

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, ordered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (ordered[activeIndex]) goTo(ordered[activeIndex]);
    }
  };

  if (!open) return null;

  const hasQuery = q.trim().length >= 2;
  const statusText = !hasQuery
    ? ""
    : loading
      ? "Mencari…"
      : `${results.length} hasil ditemukan`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-sm animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Pencarian global"
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 animate-scale-in-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-slate-800">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" aria-hidden="true" />
          ) : (
            <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
          )}
          <input
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Cari kelas, rekaman, template, tools…"
            aria-label="Kata kunci pencarian"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="global-search-results"
            aria-activedescendant={ordered[activeIndex] ? `gs-option-${activeIndex}` : undefined}
            autoComplete="off"
            className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400 dark:text-white [&::-webkit-search-cancel-button]:hidden"
          />
          <kbd className="hidden rounded-md border border-gray-200 px-1.5 py-0.5 text-[10px] text-gray-400 dark:border-slate-700 md:block">
            ESC
          </kbd>
        </div>

        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-gray-100 px-4 py-2.5 dark:border-slate-800" role="group" aria-label="Filter skill">
            {skills.map((s) => (
              <button
                key={s.slug}
                onClick={() => setSkill(skill === s.slug ? "" : s.slug)}
                aria-pressed={skill === s.slug}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1414] ${
                  skill === s.slug
                    ? "bg-[#8B1414] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}

        {/* Status untuk screen reader + visual */}
        <p aria-live="polite" className={statusText ? "px-4 pt-2 text-[11px] text-gray-400" : "sr-only"}>
          {statusText}
        </p>

        <div className="max-h-[50vh] overflow-y-auto">
          {!hasQuery ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400">
              Ketik minimal 2 huruf untuk mencari di semua konten.
            </p>
          ) : results.length === 0 && !loading ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400">
              Tidak ada hasil untuk “{q}”.
            </p>
          ) : (
            <ul id="global-search-results" role="listbox" aria-label="Hasil pencarian" className="py-2">
              {TYPE_ORDER.map((type) => {
                const group = ordered
                  .map((r, flatIdx) => ({ r, flatIdx }))
                  .filter(({ r }) => r.content_type === type);
                if (group.length === 0) return null;
                const meta = TYPE_META[type];
                const Icon = meta.icon;
                return (
                  <li key={type} role="presentation">
                    <p className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-gray-400" role="presentation">
                      {meta.label}
                    </p>
                    <ul role="group" aria-label={meta.label}>
                      {group.map(({ r, flatIdx }) => (
                        <li
                          key={`${r.content_type}:${r.ref_id}`}
                          id={`gs-option-${flatIdx}`}
                          role="option"
                          aria-selected={flatIdx === activeIndex}
                        >
                          <button
                            onClick={() => goTo(r)}
                            onMouseEnter={() => setActiveIndex(flatIdx)}
                            tabIndex={-1}
                            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                              flatIdx === activeIndex ? "bg-gray-50 dark:bg-slate-800/60" : ""
                            }`}
                          >
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#8B1414]/10 text-[#8B1414] dark:bg-[#C0392B]/10 dark:text-[#C0392B]" aria-hidden="true">
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">
                                {r.title}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// Tombol pembuka untuk dipasang di halaman (mis. /explore)
export function GlobalSearchTrigger({ className = "" }: { className?: string }) {
  return (
    <button
      onClick={openGlobalSearch}
      className={`flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm text-gray-400 shadow-sm transition-colors hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1414] dark:border-slate-700 dark:bg-slate-900 ${className}`}
    >
      <Search className="h-4 w-4" aria-hidden="true" />
      <span className="flex-1">Cari kelas, rekaman, template, tools…</span>
      <kbd className="hidden rounded-md border border-gray-200 px-1.5 py-0.5 text-[10px] dark:border-slate-700 md:block">
        ⌘K
      </kbd>
    </button>
  );
}

// FAB pencarian untuk mobile (cmd-K tidak tersedia di HP)
export function GlobalSearchFab() {
  return (
    <button
      onClick={openGlobalSearch}
      aria-label="Buka pencarian"
      className="fixed bottom-24 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#8B1414] text-white shadow-lg shadow-[#8B1414]/30 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#8B1414] md:hidden dark:bg-[#C0392B] dark:text-slate-900"
    >
      <Search className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
