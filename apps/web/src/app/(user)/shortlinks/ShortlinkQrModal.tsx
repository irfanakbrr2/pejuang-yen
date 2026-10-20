"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, Copy, Download, SlidersHorizontal } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { drawQr, qrToPngDataUrl, qrToSvgString, qrFileSlug, triggerDownload, type QrOptions } from "@/lib/qr";

export interface QrTarget {
  url: string;
  label: string;
  filename: string;
}

const PREVIEW_SIZE = 320;
const DOWNLOAD_SIZE = 1024;

export function ShortlinkQrModal({ target, onClose }: { target: QrTarget | null; onClose: () => void }) {
  const [logo, setLogo] = useState(true);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const options = useCallback(
    (size: number): QrOptions => ({ fg: "#0C0C0A", bg: "#FFFFFF", size, level: "M", margin: true, logo }),
    [logo]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !target) return;
    drawQr(canvas, target.url, options(PREVIEW_SIZE)).catch(() => {});
  }, [target, options]);

  const downloadPng = useCallback(async () => {
    if (!target) return;
    triggerDownload(await qrToPngDataUrl(target.url, options(DOWNLOAD_SIZE)), `${target.filename}.png`);
  }, [target, options]);

  const downloadSvg = useCallback(async () => {
    if (!target) return;
    const svg = await qrToSvgString(target.url, options(DOWNLOAD_SIZE));
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    triggerDownload(url, `${target.filename}.svg`);
    URL.revokeObjectURL(url);
  }, [target, options]);

  const copyPng = useCallback(async () => {
    if (!target || typeof ClipboardItem === "undefined") return;
    try {
      const blob = await (await fetch(await qrToPngDataUrl(target.url, options(DOWNLOAD_SIZE)))).blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }, [target, options]);

  const canCopy = typeof window !== "undefined" && typeof ClipboardItem !== "undefined";

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>QR Code Shortlink</DialogTitle>
          <p className="truncate text-xs text-[#6B7280]">{target?.label}</p>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div className="flex aspect-square w-full max-w-[260px] items-center justify-center rounded-xl bg-[#FAFAF7] p-3">
            <canvas ref={canvasRef} className="h-full w-full" />
          </div>

          <label className="flex items-center gap-2.5 self-start text-sm font-medium text-[#374151]">
            <input
              type="checkbox"
              checked={logo}
              onChange={(e) => setLogo(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 accent-[#8B1414]"
            />
            Sisipkan logo PejuangYen
          </label>

          <div className="grid w-full grid-cols-2 gap-2">
            <button
              type="button"
              onClick={downloadPng}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#8B1414] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0c5a47]"
            >
              <Download className="h-4 w-4" /> PNG
            </button>
            <button
              type="button"
              onClick={downloadSvg}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-[#374151] transition hover:border-gray-300"
            >
              <Download className="h-4 w-4" /> SVG
            </button>
            {canCopy && (
              <button
                type="button"
                onClick={copyPng}
                className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-[#374151] transition hover:border-gray-300"
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

          {target && (
            <Link
              href={`/tools/qr-code?url=${encodeURIComponent(target.url)}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8B1414] hover:underline"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Kustomisasi warna & ukuran di tool
            </Link>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
