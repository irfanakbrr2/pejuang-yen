"use client";

import Link from "next/link";
import { ComingSoonHero, type FloatingCardItem } from "@/components/coming-soon/ComingSoonHero";
import { FeatureCardsGrid } from "@/components/coming-soon/FeatureCardsGrid";
import { DashboardSection } from "@/components/ui/dashboard-chrome";
import { Button } from "@/components/ui/Button";
import {
  TrendingUp, Flame, Sparkles, Briefcase, MessageCircle, Award, ArrowRight, BadgeCheck,
} from "lucide-react";

// Kartu melayang — posisi/ukuran/rotasi mengikuti demo LandingHero,
// foto diganti kartu gradient + ikon (tanpa foto orang).
const FLOATING_CARDS: FloatingCardItem[] = [
  {
    icon: TrendingUp, label: "Progress 92%",
    gradient: "from-[#C0392B] to-[#8B1414]",
    className: "top-[15%] left-[2%] md:top-[25%] md:left-[5%]",
    size: "w-16 h-12 sm:w-24 sm:h-16 md:w-28 md:h-20 lg:w-32 lg:h-24",
    rotate: "-rotate-[3deg]", depth: 0.5, delay: 0.5,
  },
  {
    icon: Flame, label: "Streak 14 hari",
    gradient: "from-amber-400 to-orange-600",
    className: "top-[0%] left-[8%] md:top-[6%] md:left-[11%]",
    size: "w-32 h-24 sm:w-40 sm:h-32 md:w-48 md:h-36 lg:w-52 lg:h-40",
    rotate: "-rotate-12", depth: 1, delay: 0.7,
  },
  {
    icon: Award, label: "3 Sertifikat",
    gradient: "from-[#0015ff] to-indigo-500",
    className: "top-[88%] left-[6%] md:top-[78%] md:left-[8%]",
    size: "w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 lg:w-52 lg:h-52",
    rotate: "-rotate-[4deg]", depth: 4, delay: 0.9,
  },
  {
    icon: Briefcase, label: "Portofolio Siap",
    gradient: "from-violet-500 to-purple-700",
    className: "top-[0%] left-[80%] md:top-[2%] md:left-[81%]",
    size: "w-32 h-28 sm:w-40 sm:h-36 md:w-48 md:h-44 lg:w-52 lg:h-48",
    rotate: "rotate-[6deg]", depth: 2, delay: 1.1,
  },
  {
    icon: BadgeCheck, label: "Siap Ditemukan",
    gradient: "from-[#C0392B] to-[#7A1414]",
    className: "top-[78%] left-[78%] md:top-[68%] md:left-[80%]",
    size: "w-36 h-36 sm:w-48 sm:h-48 md:w-56 md:h-56 lg:w-64 lg:h-64",
    rotate: "rotate-[19deg]", depth: 1, delay: 1.3,
  },
];

const ASSESSMENT_ITEMS = [
  {
    icon: TrendingUp,
    title: "Progress Belajar",
    description: "Persentase penyelesaian kelas dan lesson jadi sinyal utama kesiapanmu.",
  },
  {
    icon: Flame,
    title: "Konsistensi",
    description: "Seberapa rutin kamu belajar — hari aktif dan streak belajarmu dihitung.",
  },
  {
    icon: Sparkles,
    title: "Skill Praktis",
    description: "Skill tags dari kelas dan tools AI yang sudah kamu kuasai.",
  },
  {
    icon: Briefcase,
    title: "Portofolio",
    description: "Project dan hasil karya yang bisa dilihat langsung oleh perusahaan.",
  },
  {
    icon: MessageCircle,
    title: "Kontribusi Komunitas",
    description: "Keaktifanmu membantu member lain di komunitas PejuangYen.",
  },
];

export default function TalentBoardPage() {
  return (
    <div className="flex flex-col max-w-6xl mx-auto py-6 md:py-10 space-y-10">
      <ComingSoonHero
        titleTop="Belajar Lebih Konsisten."
        rotatePrefix="Biar Kamu Ditemukan"
        rotateWords={["oleh perusahaan", "oleh partner", "oleh recruiter", "oleh project owner", "oleh peluang baru"]}
        subtitle="PejuangYen sedang menyiapkan Talent Board — tempat member terbaik bisa terlihat berdasarkan progress belajar, konsistensi, skill, dan kontribusi. Untuk sekarang, fokus dulu selesaikan kelas, ikut webinar, dan bangun portofolio."
        primaryCta={{ label: "Lanjutkan Belajar", href: "/my-classes" }}
        secondaryCta={{ label: "Lihat Progress Saya", href: "/dashboard" }}
        cards={FLOATING_CARDS}
      />

      <DashboardSection title="Apa yang akan dinilai di Talent Board">
        <FeatureCardsGrid items={ASSESSMENT_ITEMS} />
      </DashboardSection>

      <div className="rounded-2xl bg-[#0015ff]/[0.04] border border-[#0015ff]/10 p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">Mulai sekarang, biar profilmu siap saat Talent Board rilis</h3>
          <p className="text-sm text-gray-500">
            Semua progress belajarmu hari ini akan dihitung. Tidak ada yang sia-sia.
          </p>
        </div>
        <Link href="/my-classes" className="shrink-0">
          <Button className="rounded-full inline-flex items-center gap-1.5">
            Lanjutkan Kelas <ArrowRight size={14} />
          </Button>
        </Link>
      </div>
    </div>
  );
}
