"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Copy, Download, QrCode } from "lucide-react";
import { drawQr, qrToPngDataUrl, qrToSvgString, qrFileSlug, triggerDownload, type QrLevel, type QrOptions } from "@/lib/qr";

const FG_PRESETS = [
  { label: "Hitam", value: "#0C0C0A" },
  { label: "Merah PejuangYen", value: "#8B1414" },
  { label: "Violet", value: "#7C3AED" },
  { label: "Biru", value: "#1D4ED8" },
];

const BG_PRESETS = ["#FFFFFF", "#F5F4EF", "#0C0C0A"];

const LEVELS: Array<{ value: QrLevel; label: string; hint: string }> = [
  { value: "L", label: "L", hint: "7%" },
  { value: "M", label: "M", hint: "15%" },
  { value: "Q", label: "Q", hint: "25%" },
  { value: "H", label: "H", hint: "30%" },
];

export function QrGenerator() {
  const searchParams = useSearchParams();
  const [text, setText] = useState("https://pejuangyen.com");
  const [fg, setFg] = useState("#0C0C0A");
  const [bg, setBg] = useState("#FFFFFF");
  const [size, setSize] = useState(512);
  const [level, setLevel] = useState<QrLevel>("M");
  const [margin, setMargin] = useState(true);
  const [logo, setLogo] = useState(false);
  const [copied, setCopied] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trimmed = text.trim();

  // Prefill from ?url= (e.g. opened from a shortlink "Kustomisasi" link).
  // Read client-side so it works with static export.
  useEffect(() => {
    const u = searchParams.get("url");
    if (u) setText(u);
  }, [searchParams]);

  const buildOptions = useCallback(
    (renderSize: number): QrOptions => ({ fg, bg, size: renderSize, level, margin, logo }),
    [fg, bg, level, margin, logo]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!trimmed) {
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    drawQr(canvas, trimmed, buildOptions(320)).catch(() => {});
  }, [trimmed, buildOptions]);

  const downloadPng = useCallback(async () => {
    if (!trimmed) return;
    triggerDownload(await qrToPngDataUrl(trimmed, buildOptions(size)), `${qrFileSlug(trimmed)}-qr.png`);
  }, [trimmed, buildOptions, size]);

  const downloadSvg = useCallback(async () => {
    if (!trimmed) return;
    const svg = await qrToSvgString(trimmed, buildOptions(size));
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    triggerDownload(url, `${qrFileSlug(trimmed)}-qr.svg`);
    URL.revokeObjectURL(url);
  }, [trimmed, buildOptions, size]);

  const copyPng = useCallback(async () => {
    if (!trimmed || typeof ClipboardItem === "undefined") return;
    try {
      const blob = await (await fetch(await qrToPngDataUrl(trimmed, buildOptions(size)))).blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }, [trimmed, buildOptions, size]);

  const canCopy = typeof window !== "undefined" && typeof ClipboardItem !== "undefined";

  const swatch = (active: boolean) =>
    `h-8 w-8 rounded-full border-2 transition ${
      active ? "border-gray-900 dark:border-white scale-110" : "border-gray-200 dark:border-white/15"
    }`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* Controls */}
      <div className="min-w-0 space-y-6">
        <div>
          <label htmlFor="qr-text" className="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">
            Link atau teks
          </label>
          <textarea
            id="qr-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            placeholder="https://pejuangyen.com atau teks apa saja"
            className="w-full resize-y rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <span className="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">Warna QR</span>
            <div className="flex flex-wrap items-center gap-2">
              {FG_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setFg(p.value)}
                  aria-label={p.label}
                  className={swatch(fg.toUpperCase() === p.value)}
                  style={{ backgroundColor: p.value }}
                />
              ))}
              <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-gray-300 dark:border-white/20">
                <input
                  type="color"
                  value={fg}
                  onChange={(e) => setFg(e.target.value)}
                  className="absolute inset-[-4px] h-12 w-12 cursor-pointer"
                  aria-label="Warna kustom"
                />
              </label>
            </div>
          </div>

          <div>
            <span className="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">Latar</span>
            <div className="flex flex-wrap items-center gap-2">
              {BG_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setBg(c)}
                  aria-label={`Latar ${c}`}
                  className={swatch(bg.toUpperCase() === c)}
                  style={{ backgroundColor: c }}
                />
              ))}
              <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-gray-300 dark:border-white/20">
                <input
                  type="color"
                  value={bg}
                  onChange={(e) => setBg(e.target.value)}
                  className="absolute inset-[-4px] h-12 w-12 cursor-pointer"
                  aria-label="Latar kustom"
                />
              </label>
            </div>
          </div>
        </div>

        <div>
          <label htmlFor="qr-size" className="mb-2 flex items-center justify-between text-sm font-semibold text-gray-900 dark:text-white">
            <span>Ukuran unduhan</span>
            <span className="font-mono text-xs text-gray-500 dark:text-slate-400">{size}px</span>
          </label>
          <input
            id="qr-size"
            type="range"
            min={256}
            max={1024}
            step={64}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="w-full accent-violet-600"
          />
        </div>

        <div>
          <span className="mb-2 block text-sm font-semibold text-gray-900 dark:text-white">
            Ketahanan{" "}
            <span className="font-normal text-gray-500 dark:text-slate-400">
              {logo ? "(dikunci ke H saat logo aktif)" : "(makin tinggi makin tahan rusak)"}
            </span>
          </span>
          <div className="flex gap-2">
            {LEVELS.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => setLevel(l.value)}
                disabled={logo}
                className={`flex-1 rounded-xl border px-2 py-2 text-center transition disabled:opacity-40 ${
                  (logo ? l.value === "H" : level === l.value)
                    ? "border-violet-400 bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300"
                    : "border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-600 dark:text-slate-300 hover:border-gray-300"
                }`}
              >
                <span className="block text-sm font-semibold">{l.label}</span>
                <span className="block text-[10px] text-gray-400 dark:text-slate-500">{l.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2.5 text-sm font-medium text-gray-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={logo}
              onChange={(e) => setLogo(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 accent-violet-600"
            />
            Sisipkan logo PejuangYen di tengah
          </label>
          <label className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={margin}
              onChange={(e) => setMargin(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 accent-violet-600"
            />
            Beri ruang kosong di pinggir (disarankan)
          </label>
        </div>
      </div>

      {/* Preview + actions */}
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-5">
        <div
          className="flex aspect-square w-full max-w-[300px] items-center justify-center rounded-xl p-3"
          style={{ backgroundColor: bg }}
        >
          {trimmed ? (
            <canvas ref={canvasRef} className="h-full w-full" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <QrCode className="h-10 w-10" />
              <span className="text-xs">Masukkan link dulu</span>
            </div>
          )}
        </div>

        <div className="grid w-full max-w-[300px] grid-cols-2 gap-2">
          <button
            type="button"
            onClick={downloadPng}
            disabled={!trimmed}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> PNG
          </button>
          <button
            type="button"
            onClick={downloadSvg}
            disabled={!trimmed}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm font-semibold text-gray-800 dark:text-white transition hover:border-gray-300 disabled:opacity-40"
          >
            <Download className="h-4 w-4" /> SVG
          </button>
          {canCopy && (
            <button
              type="button"
              onClick={copyPng}
              disabled={!trimmed}
              className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2.5 text-sm font-semibold text-gray-800 dark:text-white transition hover:border-gray-300 disabled:opacity-40"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-500" /> Tersalin
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" /> Salin gambar
                </>
              )}
            </button>
          )}
        </div>
        <p className="text-center text-xs leading-relaxed text-gray-400 dark:text-slate-500">
          Gratis tanpa kredit. Diproses di browser kamu.
        </p>
      </div>
    </div>
  );
}
