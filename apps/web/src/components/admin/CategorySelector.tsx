"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HelpCircle } from "lucide-react";

// Pemilih kategori taxonomy (9 kategori utama).
// Aturan: 1 primary wajib (untuk publish), maksimal 2 secondary.
// Helper "?" menampilkan decision rule 9 langkah dari docs/content-taxonomy-plan.md.

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

const DECISION_RULES = [
  { q: "Tentang dasar AI / prompting?", cat: "AI Fundamentals & Prompting" },
  { q: "Outputnya website, landing page, web app, coding, deployment, debugging?", cat: "Vibecoding & Web Dev" },
  { q: "Outputnya visual: desain, poster, thumbnail, UI, brand kit, image asset?", cat: "Vibe Design & Visual Creation" },
  { q: "Outputnya traffic, leads, sales, funnel, closing, ads, email, conversion?", cat: "Vibe Marketing, Sales & Growth" },
  { q: "Outputnya workflow otomatis, API, webhook, n8n, Zapier, CRM?", cat: "AI Automation & Workflow" },
  { q: "Outputnya konten, personal branding, storytelling, script, audience?", cat: "Content Creation & Personal Branding" },
  { q: "Outputnya bisnis sendiri, digital product, offer, agency, monetisasi?", cat: "Business, Monetization & Solopreneurship" },
  { q: "Outputnya karier, freelance, portfolio, CV, LinkedIn, client, interview?", cat: "Career, Freelance & Portfolio" },
  { q: "Fokusnya cara belajar, produktivitas, riset, habit, sistem pribadi?", cat: "Productivity, Learning & Self-Development" },
];

let categoriesCache: Category[] | null = null;

export function useCategories(): Category[] {
  const [categories, setCategories] = useState<Category[]>(categoriesCache || []);
  useEffect(() => {
    if (categoriesCache) return;
    api("/api/categories").then((res) => {
      if (res.success) {
        categoriesCache = res.data;
        setCategories(res.data);
      }
    }).catch(console.error);
  }, []);
  return categories;
}

export function CategorySelector({
  primaryId,
  secondaryIds,
  onChange,
  required,
}: {
  primaryId: string | null;
  secondaryIds: string[];
  onChange: (primaryId: string | null, secondaryIds: string[]) => void;
  required?: boolean;
}) {
  const categories = useCategories();
  const [helpOpen, setHelpOpen] = useState(false);

  const toggleSecondary = (id: string) => {
    if (secondaryIds.includes(id)) {
      onChange(primaryId, secondaryIds.filter((s) => s !== id));
    } else if (secondaryIds.length < 2) {
      onChange(primaryId, [...secondaryIds, id]);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
          Kategori Utama {required && <span className="text-red-500">*</span>}
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="text-gray-400 hover:text-[#8B1414]"
            title="Panduan memilih kategori"
          >
            <HelpCircle size={14} />
          </button>
        </label>
        <select
          value={primaryId || ""}
          onChange={(e) => {
            const next = e.target.value || null;
            onChange(next, secondaryIds.filter((s) => s !== next));
          }}
          className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white text-gray-700"
        >
          <option value="">— Pilih kategori (skill utama yang diajarkan) —</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">
          Kategori Sekunder <span className="text-gray-400 font-normal">(opsional, maks 2)</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {categories.filter((cat) => cat.id !== primaryId).map((cat) => {
            const selected = secondaryIds.includes(cat.id);
            const disabled = !selected && secondaryIds.length >= 2;
            return (
              <button
                key={cat.id}
                type="button"
                disabled={disabled}
                onClick={() => toggleSecondary(cat.id)}
                className={`text-[11px] font-medium rounded-full px-2.5 py-1 border transition-colors ${
                  selected
                    ? "bg-[#8B1414] text-white border-[#8B1414]"
                    : disabled
                      ? "bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed"
                      : "bg-white text-gray-600 border-gray-200 hover:border-[#8B1414]/40"
                }`}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Panduan Memilih Kategori</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            <p className="text-xs text-gray-500 mb-3">
              Jawab berurutan dari atas. Berhenti di pertanyaan pertama yang jawabannya &ldquo;ya&rdquo; —
              itu kategori utamanya. Kategori menjawab <strong>topik</strong>, bukan bentuk konten.
            </p>
            {DECISION_RULES.map((rule, i) => (
              <div key={i} className="flex gap-2.5 text-[13px]">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[#8B1414]/10 text-[#8B1414] text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                <div>
                  <p className="text-gray-700">{rule.q}</p>
                  <p className="text-[#8B1414] font-semibold">→ {rule.cat}</p>
                </div>
              </div>
            ))}
            <p className="text-xs text-amber-600 pt-2 border-t border-gray-100">
              Kategori utama = skill utama yang diajarkan. Kalau konten menyentuh topik lain,
              pakai kategori sekunder (maks 2) — jangan ganti kategori utama.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CategorySelector;
