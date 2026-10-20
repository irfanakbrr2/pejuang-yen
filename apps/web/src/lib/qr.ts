import QRCode from "qrcode";

export type QrLevel = "L" | "M" | "Q" | "H";

export interface QrOptions {
  fg: string;
  bg: string;
  size: number;
  level: QrLevel;
  margin: boolean;
  logo?: boolean;
}

const LOGO_SRC = "/icon-192.png";
// Logo footprint relative to the QR side. ~22% is safe with level "H" (30% recovery).
const LOGO_RATIO = 0.22;
const PAD_RATIO = 0.12; // white backing around the logo, relative to logo size

function effectiveLevel(opts: QrOptions): QrLevel {
  // Force high error correction when a logo covers the centre.
  return opts.logo ? "H" : opts.level;
}

function baseOptions(opts: QrOptions, size: number) {
  return {
    width: size,
    margin: opts.margin ? 2 : 0,
    errorCorrectionLevel: effectiveLevel(opts),
    color: { dark: opts.fg, light: opts.bg },
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function loadImageAsDataUrl(src: string): Promise<string> {
  const blob = await (await fetch(src)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function drawLogoOnCanvas(canvas: HTMLCanvasElement, bg: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const img = await loadImage(LOGO_SRC);
  const s = canvas.width;
  const logoSize = Math.round(s * LOGO_RATIO);
  const pad = Math.round(logoSize * PAD_RATIO);
  const x = Math.round((s - logoSize) / 2);
  const y = Math.round((s - logoSize) / 2);
  ctx.fillStyle = bg || "#FFFFFF";
  roundRect(ctx, x - pad, y - pad, logoSize + pad * 2, logoSize + pad * 2, Math.round(logoSize * 0.18));
  ctx.fill();
  ctx.drawImage(img, x, y, logoSize, logoSize);
}

/** Render a QR (with optional centred logo) onto an existing canvas — used for live preview. */
export async function drawQr(canvas: HTMLCanvasElement, text: string, opts: QrOptions) {
  await QRCode.toCanvas(canvas, text, baseOptions(opts, opts.size));
  if (opts.logo) await drawLogoOnCanvas(canvas, opts.bg);
}

/** Produce a PNG data URL at the requested size, with optional centred logo. */
export async function qrToPngDataUrl(text: string, opts: QrOptions): Promise<string> {
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, text, baseOptions(opts, opts.size));
  if (opts.logo) await drawLogoOnCanvas(canvas, opts.bg);
  return canvas.toDataURL("image/png");
}

/** Produce an SVG string. When a logo is requested it is embedded as a base64 <image>. */
export async function qrToSvgString(text: string, opts: QrOptions): Promise<string> {
  let svg = await QRCode.toString(text, { type: "svg", ...baseOptions(opts, opts.size) });
  if (opts.logo) {
    const dataUrl = await loadImageAsDataUrl(LOGO_SRC);
    const vb = svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) /);
    const n = vb ? Number(vb[1]) : 25;
    const logoSize = n * LOGO_RATIO;
    const pad = logoSize * PAD_RATIO;
    const x = (n - logoSize) / 2;
    const y = (n - logoSize) / 2;
    const overlay =
      `<rect x="${x - pad}" y="${y - pad}" width="${logoSize + pad * 2}" height="${logoSize + pad * 2}" ` +
      `rx="${logoSize * 0.18}" fill="${opts.bg || "#FFFFFF"}"/>` +
      `<image href="${dataUrl}" x="${x}" y="${y}" width="${logoSize}" height="${logoSize}"/>`;
    svg = svg.replace("</svg>", `${overlay}</svg>`);
  }
  return svg;
}

export function qrFileSlug(text: string): string {
  const cleaned = text
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 40);
  return cleaned || "qr-code";
}

export function triggerDownload(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
}
