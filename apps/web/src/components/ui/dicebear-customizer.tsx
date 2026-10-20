import React, { useState } from "react";
import Image from "next/image";
import { Button } from "./Button";
import { RefreshCw, Check } from "lucide-react";

export const DICEBEAR_STYLES = [
  "adventurer",
  "avataaars",
  "bottts",
  "fun-emoji",
  "lorelei",
  "notionists",
  "pixel-art",
];

interface DicebearCustomizerProps {
  initialUrl?: string | null;
  defaultSeed: string;
  onSelect: (url: string) => void;
}

export function DicebearCustomizer({ initialUrl, defaultSeed, onSelect }: DicebearCustomizerProps) {
  const [style, setStyle] = useState<string>(DICEBEAR_STYLES[1]);
  const [seed, setSeed] = useState<string>(defaultSeed || "pejuangyen");
  
  const currentUrl = `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
  const displayUrl = initialUrl && !initialUrl.includes(style) && seed === defaultSeed ? initialUrl : currentUrl;

  const handleRandomize = () => {
    const randomSeed = Math.random().toString(36).substring(7);
    setSeed(randomSeed);
    onSelect(`https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(randomSeed)}`);
  };

  const handleStyleChange = (newStyle: string) => {
    setStyle(newStyle);
    onSelect(`https://api.dicebear.com/7.x/${newStyle}/svg?seed=${encodeURIComponent(seed)}`);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-6 items-start">
      <div className="flex flex-col items-center gap-3">
        <div className="w-24 h-24 rounded-full ring-4 ring-gray-100 dark:ring-white/10 overflow-hidden relative bg-white dark:bg-white/5">
          <Image
            src={displayUrl}
            alt="Custom Avatar"
            fill
            className="object-cover"
            unoptimized
          />
        </div>
        <Button 
          type="button" 
          variant="secondary" 
          size="sm" 
          onClick={handleRandomize}
          className="flex items-center gap-2 text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Randomize
        </Button>
      </div>

      <div className="flex-1 w-full space-y-4">
        <div>
          <label className="text-xs font-semibold text-[#6B7280] dark:text-slate-400 uppercase tracking-[0.06em] mb-2 block">
            Pilih Style Karakter
          </label>
          <div className="flex flex-wrap gap-2">
            {DICEBEAR_STYLES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleStyleChange(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                  style === s 
                    ? "bg-[#8B1414]/10 dark:bg-[#C0392B]/20 border-[#8B1414] dark:border-[#C0392B] text-[#8B1414] dark:text-[#34D399]" 
                    : "bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-300 hover:border-gray-300 dark:hover:border-white/20"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-[#6B7280] dark:text-slate-400 uppercase tracking-[0.06em] mb-1.5 block">
            Custom Seed (Teks Bebas)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={seed}
              onChange={(e) => {
                setSeed(e.target.value);
                onSelect(`https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(e.target.value)}`);
              }}
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-black/[0.08] dark:border-white/10 dark:bg-white/5 dark:text-white outline-none focus:border-[#8B1414]/40 dark:focus:border-[#C0392B]/40 focus:ring-1 focus:ring-[#8B1414]/10 dark:focus:ring-[#C0392B]/10"
              placeholder="Ketik teks acak..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
