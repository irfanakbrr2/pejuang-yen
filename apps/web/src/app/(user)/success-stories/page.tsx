"use client";

import Link from "next/link";
import { ComingSoonHero, type FloatingCardItem } from "@/components/coming-soon/ComingSoonHero";
import { FeatureCardsGrid } from "@/components/coming-soon/FeatureCardsGrid";
import { DashboardSection } from "@/components/ui/dashboard-chrome";
import { Button } from "@/components/ui/Button";
import {
  MessageSquareQuote, ArrowLeftRight, Presentation, Workflow, Rocket,
  Quote, DollarSign, ArrowRight, Trophy,
} from "lucide-react";

// Kartu melayang — posisi/ukuran/rotasi mengikuti demo LandingHero,
// foto diganti kartu gradient + ikon (tanpa foto orang).
const FLOATING_CARDS: FloatingCardItem[] = [
  {
    icon: Quote, label: "“Dari nol jadi bisa”",
    gradient: "from-rose-400 to-pink-600",
    className: "top-[15%] left-[2%] md:top-[25%] md:left-[5%]",
    size: "w-16 h-12 sm:w-24 sm:h-16 md:w-28 md:h-20 lg:w-32 lg:h-24",
    rotate: "-rotate-[3deg]", depth: 0.5, delay: 0.5,
  },
  {
    icon: Rocket, label: "Naik Level Karier",
    gradient: "from-[#0015ff] to-indigo-500",
    className: "top-[0%] left-[8%] md:top-[6%] md:left-[11%]",
    size: "w-32 h-24 sm:w-40 sm:h-32 md:w-48 md:h-36 lg:w-52 lg:h-40",
    rotate: "-rotate-12", depth: 1, delay: 0.7,
  },
  {
    icon: DollarSign, label: "Project Pertama",
    gradient: "from-[#C0392B] to-[#8B1414]",
    className: "top-[88%] left-[6%] md:top-[78%] md:left-[8%]",
    size: "w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 lg:w-52 lg:h-52",
    rotate: "-rotate-[4deg]", depth: 4, delay: 0.9,
  },
  {
    icon: Workflow, label: "Workflow 10x Cepat",
    gradient: "from-amber-400 to-orange-600",
    className: "top-[0%] left-[80%] md:top-[2%] md:left-[81%]",
    size: "w-32 h-28 sm:w-40 sm:h-36 md:w-48 md:h-44 lg:w-52 lg:h-48",
    rotate: "rotate-[6deg]", depth: 2, delay: 1.1,
  },
  {
    icon: Trophy, label: "Cerita Suksesmu",
    gradient: "from-violet-500 to-purple-700",
    className: "top-[78%] left-[78%] md:top-[68%] md:left-[80%]",
    size: "w-36 h-36 sm:w-48 sm:h-48 md:w-56 md:h-56 lg:w-64 lg:h-64",
    rotate: "rotate-[19deg]", depth: 1, delay: 1.3,
  },
];

const STORY_TYPES = [
  {
    icon: MessageSquareQuote,
    title: "Cerita Member",
    description: "Pengalaman nyata member: dari mulai belajar sampai hasil yang dirasakan.",
  },
  {
    icon: ArrowLeftRight,
    title: "Before After",
    description: "Kondisi sebelum vs sesudah konsisten belajar dan praktik AI.",
  },
  {
    icon: Presentation,
    title: "Project Showcase",
    description: "Project dan karya yang berhasil dibuat member dengan bantuan AI.",
  },
  {
    icon: DollarSign,
    title: "Income / Opportunity",
    description: "Peluang baru: project, klien, pekerjaan, atau penghasilan tambahan.",
  },
  {
    icon: Workflow,
    title: "Workflow AI",
    description: "Workflow kerja yang jadi lebih cepat dan produktif berkat AI.",
  },
  {
    icon: Rocket,
    title: "Career Growth",
    description: "Perjalanan karier yang naik level setelah menguasai skill AI.",
  },
];

export default function SuccessStoriesPage() {
  return (
    <div className="flex flex-col max-w-6xl mx-auto py-6 md:py-10 space-y-10">
      <ComingSoonHero
        titleTop="Kisah Sukses Sahabat PejuangYen."
        rotatePrefix="Mereka"
        rotateWords={["naik skill", "dapat project", "bangun workflow", "lebih produktif", "menghasilkan dari AI", "membangun karier"]}
        subtitle="Halaman ini akan menjadi tempat cerita nyata dari member PejuangYen: progress belajar, project yang berhasil dibuat, workflow yang terbantu AI, hingga pencapaian karier atau bisnis."
        primaryCta={{ label: "Mulai Bangun Ceritamu", href: "/my-classes" }}
        secondaryCta={{ label: "Lanjutkan Kelas", href: "/dashboard" }}
        cards={FLOATING_CARDS}
      />

      <DashboardSection title="Jenis cerita yang akan tampil">
        <FeatureCardsGrid items={STORY_TYPES} />
      </DashboardSection>

      <div className="rounded-2xl bg-[#0015ff]/[0.04] border border-[#0015ff]/10 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">Ceritamu bisa jadi yang pertama tampil di sini</h3>
          <p className="text-sm text-gray-500">
            Selesaikan kelas, bangun project, dan kami akan mengundangmu berbagi cerita.
          </p>
        </div>
        <Link href="/my-classes" className="shrink-0">
          <Button className="rounded-full inline-flex items-center gap-1.5">
            Mulai Belajar <ArrowRight size={14} />
          </Button>
        </Link>
      </div>
    </div>
  );
}
