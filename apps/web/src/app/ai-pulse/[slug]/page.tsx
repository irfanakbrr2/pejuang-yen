import { Suspense } from "react";
import AiPulseDetailClient from "./page-client";

export async function generateStaticParams() {
  try {
    const res = await fetch("https://api.pejuangyen.com/api/ai-pulse?limit=48");
    const data = await res.json();
    const items = Array.isArray(data?.data) ? data.data : [];
    return [{ slug: "_" }, ...items.map((it: { slug: string }) => ({ slug: it.slug }))];
  } catch {
    return [{ slug: "_" }];
  }
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-[#F8FAFC] dark:bg-slate-950">
          <div className="font-mono text-sm text-slate-400">Memuat intel...</div>
        </div>
      }
    >
      <AiPulseDetailClient />
    </Suspense>
  );
}
