"use client";

import { useState, useEffect, useRef, useId } from "react";

interface Props {
  html: string;
  className?: string;
  onQuizComplete?: (score: number, maxScore: number) => void;
}

const buildScript = (safeId: string) => `<script>
(function() {
  var FRAME_ID = ${safeId};
  // Height reporting
  window.addEventListener('load', function() {
    var h = document.documentElement.scrollHeight;
    window.parent.postMessage({ type: 'lesson-frame-height', id: FRAME_ID, height: h }, '*');
  });
  // Quiz score helper — call this from quiz HTML to report score
  window.submitQuizScore = function(score, maxScore) {
    window.parent.postMessage({ type: 'quiz-score', id: FRAME_ID, score: score, maxScore: maxScore }, '*');
  };
})();
</script>`;

const FRAGMENT_WRAPPER = (html: string, script: string) => `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${script}
<style>
*, *::before, *::after { box-sizing: border-box; }
html { margin: 0; padding: 0; color-scheme: light; }
body {
  margin: 0; padding: 1.5rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif;
  color: #1f2937; line-height: 1.75; font-size: 15px; background: transparent;
}
img { max-width: 100%; height: auto; }
a { color: #8B1414; }
code { background: #f3f4f6; padding: 0.2em 0.4em; border-radius: 4px; font-size: 0.9em; }
pre code { background: transparent; padding: 0; }
pre { background: #1f2937; color: #f8fafc; padding: 1rem; border-radius: 8px; overflow-x: auto; }
blockquote { border-left: 4px solid #e5e7eb; padding-left: 1rem; margin-left: 0; color: #4b5563; }
</style>
</head>
<body>${html}</body>
</html>`;

function buildSrcdoc(html: string, frameId: string): string {
  const safeId = JSON.stringify(frameId);
  const script = buildScript(safeId);
  const trimmed = html.trim();

  if (/<!doctype\s+html/i.test(trimmed) || /<html[\s>]/i.test(trimmed)) {
    const injected = trimmed.replace(/<\/body\s*>/i, `${script}</body>`);
    return injected !== trimmed ? injected : trimmed + script;
  }

  return FRAGMENT_WRAPPER(trimmed, script);
}

export function LessonContentFrame({ html, className, onQuizComplete }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(400);
  const frameId = useId();

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.id !== frameId) return;

      if (e.data?.type === "lesson-frame-height" && typeof e.data.height === "number" && e.data.height > 0) {
        setHeight(e.data.height);
      }

      if (e.data?.type === "quiz-score" && typeof e.data.score === "number" && typeof e.data.maxScore === "number") {
        onQuizComplete?.(e.data.score, e.data.maxScore);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [frameId, onQuizComplete]);

  return (
    <iframe
      ref={frameRef}
      srcDoc={buildSrcdoc(html, frameId)}
      style={{ height }}
      className={`w-full border-0 block ${className ?? ""}`}
      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
      title="Lesson content"
    />
  );
}
