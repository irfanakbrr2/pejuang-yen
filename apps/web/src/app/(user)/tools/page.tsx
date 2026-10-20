"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { PageHeader, DashboardSection } from "@/components/ui/dashboard-chrome";
import { Wand2, Zap, ArrowRight, Sparkles, Lock, QrCode } from "lucide-react";

interface CreditsData {
  balance: number;
}

const TOOLS = [
  {
    id: "web_prompt_generator",
    name: "PRD Generator",
    description: "Buat AI Builder Prompt + PRD detail siap tempel ke Cursor, Lovable, v0, Bolt, atau Replit.",
    icon: Wand2,
    iconColor: "text-violet-500 dark:text-violet-400",
    iconBg: "bg-violet-50 dark:bg-violet-500/10",
    creditsPerUse: 1,
    href: "/tools/web-prompt-generator",
    status: "active" as const,
    thumbnail: "https://pub-d56d873c4b8d4204b35361d7bea0dca8.r2.dev/Kelas/Ai%20web%20Generator.webp",
  },
  {
    id: "qr_code_generator",
    name: "QR Code Generator",
    description: "Buat QR code untuk link, WhatsApp, atau teks. Atur warna, unduh PNG & SVG. Gratis tanpa kredit.",
    icon: QrCode,
    iconColor: "text-emerald-500 dark:text-emerald-400",
    iconBg: "bg-emerald-50 dark:bg-emerald-500/10",
    creditsPerUse: 0,
    href: "/tools/qr-code",
    status: "active" as const,
    thumbnail: undefined,
  },
  {
    id: "coming_soon_1",
    name: "Image Prompt Generator",
    description: "Generate prompt untuk Midjourney, DALL-E, atau Stable Diffusion dari deskripsi singkat.",
    icon: Sparkles,
    iconColor: "text-pink-500 dark:text-pink-400",
    iconBg: "bg-pink-50 dark:bg-pink-500/10",
    creditsPerUse: 1,
    href: "#",
    status: "coming_soon" as const,
    thumbnail: undefined,
  },
];

export default function ToolsPage() {
  const [credits, setCredits] = useState<CreditsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<CreditsData>("/api/tools/credits", { cacheTtl: 0 })
      .then((res) => { if (res.success && res.data) setCredits(res.data); })
      .catch(() => { /* balance stays null — shows 0 gracefully */ })
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        title="AI Tools"
        description="Koleksi tools AI generatif untuk produktivitas dan kreativitas kamu."
      />

      {/* Credit Balance Banner */}
      <div className="mb-6 flex items-center justify-between rounded-2xl border border-violet-100 dark:border-violet-500/20 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-500/10 dark:to-purple-500/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-500/20">
            <Zap className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800 dark:text-white">
              {loading ? "—" : `${credits?.balance ?? 0} kredit tersisa`}
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400">Setiap penggunaan tools membutuhkan 1 kredit</p>
          </div>
        </div>
        <Link
          href="/tools/credits"
          className="flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-700"
        >
          <Zap className="h-3.5 w-3.5" />
          Beli Kredit
        </Link>
      </div>

      <DashboardSection title="Tools Tersedia">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((tool) => (
            <ToolCard key={tool.id} tool={tool} balance={credits?.balance ?? 0} />
          ))}
        </div>
      </DashboardSection>
    </>
  );
}

function ToolCard({
  tool,
  balance,
}: {
  tool: (typeof TOOLS)[number];
  balance: number;
}) {
  const Icon = tool.icon;
  const isComingSoon = tool.status === "coming_soon";
  const hasCredits = balance >= tool.creditsPerUse;

  const inner = (
    <div
      className={`group relative flex flex-col rounded-2xl border dark:border-white/10 bg-white dark:bg-white/5 transition-all overflow-hidden ${
        isComingSoon
          ? "cursor-default opacity-60"
          : "hover:border-violet-200 dark:hover:border-violet-500/30 hover:shadow-md hover:shadow-violet-50 dark:hover:shadow-violet-500/10"
      }`}
    >
      {/* Thumbnail */}
      {tool.thumbnail ? (
        <div className="relative h-36 w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={tool.thumbnail}
            alt={tool.name}
            className="h-full w-full object-cover"
          />
          {isComingSoon && (
            <span className="absolute right-3 top-3 rounded-full bg-gray-800/70 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
              Segera
            </span>
          )}
        </div>
      ) : (
        isComingSoon && (
          <span className="absolute right-4 top-4 rounded-full bg-gray-100 dark:bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
            Segera
          </span>
        )
      )}

      <div className="flex flex-col gap-4 p-5">
        {!tool.thumbnail && (
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${tool.iconBg}`}>
            <Icon className={`h-5 w-5 ${tool.iconColor}`} />
          </div>
        )}
        <div className="flex-1">
          <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">{tool.name}</h3>
          <p className="text-xs leading-relaxed text-gray-500 dark:text-slate-400">{tool.description}</p>
        </div>
        <div className="flex items-center justify-between border-t border-gray-100 dark:border-white/10 pt-3">
          <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-slate-500">
            <Zap className="h-3 w-3" />
            {tool.creditsPerUse === 0 ? "Gratis" : `${tool.creditsPerUse} kredit / penggunaan`}
          </span>
          {!isComingSoon && (
            <span
              className={`flex items-center gap-1 text-xs font-medium ${
                hasCredits ? "text-violet-600 dark:text-violet-400 group-hover:underline" : "text-orange-500 dark:text-orange-400"
              }`}
            >
              {hasCredits ? (
                <>Gunakan <ArrowRight className="h-3 w-3" /></>
              ) : (
                <><Lock className="h-3 w-3" /> Beli kredit</>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (isComingSoon) return <div key={tool.id}>{inner}</div>;
  return (
    <Link href={tool.href} key={tool.id}>
      {inner}
    </Link>
  );
}
