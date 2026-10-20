"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Render HTML buatan user secara AMAN — stored-XSS mitigation.
 *
 * iframe sandbox TANPA `allow-same-origin` → konten berjalan di origin
 * terisolasi (origin null): tidak bisa membaca cookie/sesi PejuangYen,
 * tidak bisa fetch ber-credentials, tidak bisa menyentuh DOM parent.
 * `allow-scripts` tetap aman karena origin terisolasi — dibutuhkan untuk
 * embed YouTube/Vimeo/form pihak ketiga.
 *
 * Tinggi auto-resize via postMessage (script kecil di shell srcdoc),
 * clamp maksimum 1200px supaya konten jahat tidak bisa memenuhi layar.
 */
export function SandboxedHtml({ html, minHeight = 360, className }: {
  html: string;
  minHeight?: number;
  className?: string;
}) {
  const frameId = useId();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(minHeight);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // Origin srcdoc sandbox = "null"; cocokkan frame via id di payload
      const data = event.data as { __gwaEmbed?: string; height?: number } | null;
      if (!data || data.__gwaEmbed !== frameId) return;
      const next = Number(data.height);
      if (Number.isFinite(next) && next > 0) {
        setHeight(Math.min(1200, Math.max(minHeight, Math.ceil(next))));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [frameId, minHeight]);

  const srcDoc = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base target="_blank">
<style>
  html,body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#1f2937;line-height:1.6;}
  img,video,iframe{max-width:100%;}
  a{color:#8B1414;}
</style></head><body>${html}
<script>
  (function(){
    var send=function(){try{parent.postMessage({__gwaEmbed:${JSON.stringify(frameId)},height:document.body.scrollHeight},'*');}catch(e){}};
    window.addEventListener('load',send);
    setTimeout(send,300);setTimeout(send,1200);
    if(window.ResizeObserver){new ResizeObserver(send).observe(document.body);}
  })();
</script></body></html>`;

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcDoc}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-presentation"
      referrerPolicy="no-referrer"
      loading="lazy"
      title="Konten toko"
      className={className || "w-full rounded-xl border border-[rgba(12,12,10,0.08)] bg-white"}
      style={{ height, transition: "height 200ms ease-out" }}
    />
  );
}

/** Heuristik: string mengandung tag HTML → render sandboxed; else teks biasa. */
export function looksLikeHtml(value: string | null | undefined): boolean {
  return !!value && /<[a-z][\s\S]*>/i.test(value);
}
