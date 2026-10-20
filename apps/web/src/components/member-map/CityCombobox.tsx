"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { INDONESIAN_CITIES } from "@growwithai/shared";
import { MapPin, X } from "lucide-react";

interface CityComboboxProps {
  value: string | null;
  onChange: (code: string | null) => void;
  inputClassName?: string;
}

export function CityCombobox({ value, onChange, inputClassName }: CityComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listboxId = useId();

  const selected = useMemo(
    () => INDONESIAN_CITIES.find((c) => c.code === value) || null,
    [value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return INDONESIAN_CITIES;
    return INDONESIAN_CITIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.province.toLowerCase().includes(q)
    );
  }, [query]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlighted] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlighted, open]);

  const pick = (code: string) => {
    onChange(code);
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlighted]) pick(filtered[highlighted].code);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF] dark:text-slate-500 pointer-events-none" />
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          value={open ? query : selected ? `${selected.name}, ${selected.province}` : ""}
          placeholder="Cari kota terdekat..."
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlighted(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className={`${inputClassName || ""} pl-9 ${selected ? "pr-9" : ""}`}
        />
        {selected && !open && (
          <button
            type="button"
            aria-label="Hapus kota"
            onClick={() => onChange(null)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-[#9CA3AF] hover:text-[#0D0D0D] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-1.5 w-full max-h-60 overflow-y-auto rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#16181D] shadow-lg py-1"
        >
          {filtered.length === 0 ? (
            <li className="px-3.5 py-2.5 text-sm text-[#6B7280] dark:text-slate-400">
              Kota tidak ditemukan — pilih kota besar terdekat dari lokasimu.
            </li>
          ) : (
            filtered.map((city, i) => (
              <li
                key={city.code}
                role="option"
                aria-selected={city.code === value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(city.code);
                }}
                onMouseEnter={() => setHighlighted(i)}
                className={`px-3.5 py-2 text-sm cursor-pointer flex items-baseline justify-between gap-2 ${
                  i === highlighted
                    ? "bg-[#8B1414]/[0.06] dark:bg-[#C0392B]/[0.08] text-[#0D0D0D] dark:text-white"
                    : "text-[#374151] dark:text-slate-300"
                }`}
              >
                <span className="font-medium">{city.name}</span>
                <span className="text-xs text-[#9CA3AF] dark:text-slate-500 shrink-0">{city.province}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
