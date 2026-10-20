"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LayoutGroup, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { TextRotate } from "@/components/ui/text-rotate";
import { Floating, FloatingElement } from "@/components/ui/parallax-floating";
import type { LucideIcon } from "lucide-react";

// Hero coming-soon bergaya fancy-components LandingHero: latar terang,
// headline serif besar di tengah, TextRotate aksen biru #0015ff, kartu
// gradient miring melayang dengan parallax (pengganti foto demo — tanpa
// foto orang sesuai aturan privasi).

export interface HeroCta {
  label: string;
  href: string;
}

export interface FloatingCardItem {
  icon: LucideIcon;
  label: string;
  gradient: string;   // tailwind gradient classes, mis. "from-emerald-400 to-teal-600"
  className: string;  // posisi absolut ala demo, mis. "top-[15%] left-[2%] md:top-[25%] md:left-[5%]"
  size: string;       // ukuran responsif ala demo
  rotate: string;     // "-rotate-[3deg]" dst.
  depth?: number;
  delay?: number;
}

export interface ComingSoonHeroProps {
  badgeText?: string;
  titleTop: ReactNode;            // baris pertama headline
  rotatePrefix?: string;          // teks sebelum TextRotate di baris kedua
  rotateWords: string[];
  rotateInterval?: number;
  subtitle: string;
  primaryCta: HeroCta;            // tombol hitam (bg-foreground ala demo)
  secondaryCta?: HeroCta;         // tombol biru #0015ff ala demo
  cards: FloatingCardItem[];
  className?: string;
}

const buttonMotion = {
  animate: { opacity: 1, y: 0 },
  initial: { opacity: 0, y: 20 },
  transition: { duration: 0.2, ease: "easeOut" as const, delay: 0.7 },
  whileHover: { scale: 1.05, transition: { type: "spring" as const, damping: 30, stiffness: 400 } },
};

export function ComingSoonHero({
  badgeText = "Coming Soon",
  titleTop,
  rotatePrefix,
  rotateWords,
  rotateInterval = 3000,
  subtitle,
  primaryCta,
  secondaryCta,
  cards,
  className,
}: ComingSoonHeroProps) {
  return (
    <section
      className={cn(
        "w-full min-h-[65vh] md:min-h-[72vh] overflow-hidden flex flex-col items-center justify-center relative rounded-3xl",
        "bg-gradient-to-b from-white via-white to-[#f7faf9]",
        className
      )}
    >
      {/* Kartu gradient melayang — posisi & rotasi mengikuti demo */}
      <Floating sensitivity={-0.5} className="h-full pointer-events-none">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <FloatingElement key={i} depth={card.depth ?? 1} className={card.className}>
              <motion.div
                className={cn(
                  "bg-gradient-to-br shadow-2xl rounded-xl flex flex-col items-start justify-end p-3",
                  card.gradient,
                  card.size,
                  card.rotate
                )}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: card.delay ?? 0.5 + i * 0.2 }}
              >
                <span className="rounded-lg bg-white/20 backdrop-blur-sm p-1.5 text-white mb-1.5">
                  <Icon size={14} />
                </span>
                <span className="text-[10px] sm:text-[11px] font-semibold text-white/90 leading-tight">
                  {card.label}
                </span>
              </motion.div>
            </FloatingElement>
          );
        })}
      </Floating>

      {/* Konten tengah */}
      <div className="flex flex-col justify-center items-center w-[260px] sm:w-[340px] md:w-[560px] lg:w-[760px] z-50 pointer-events-auto px-2 py-16 md:py-20">
        <motion.div
          className="bg-gray-900 text-white rounded-full px-4 py-1.5 text-[11px] font-semibold tracking-wide mb-6 md:mb-8 shadow-xl"
          animate={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2, ease: "easeOut", delay: 0.2 }}
        >
          🚀 {badgeText}
        </motion.div>

        <motion.h1
          className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl text-center w-full justify-center items-center flex-col flex leading-tight font-serif tracking-tight space-y-1 md:space-y-3 text-gray-900"
          animate={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2, ease: "easeOut", delay: 0.3 }}
        >
          <span>{titleTop}</span>
          <LayoutGroup>
            <motion.span layout className="flex flex-wrap justify-center items-center whitespace-pre">
              {rotatePrefix && (
                <motion.span
                  layout
                  className="flex whitespace-pre"
                  transition={{ type: "spring", damping: 30, stiffness: 400 }}
                >
                  {rotatePrefix}{" "}
                </motion.span>
              )}
              <TextRotate
                texts={rotateWords}
                mainClassName="overflow-hidden pr-3 text-[#0015ff] py-0 pb-2 md:pb-3 rounded-xl justify-center"
                staggerDuration={0.03}
                staggerFrom="last"
                rotationInterval={rotateInterval}
                transition={{ type: "spring", damping: 30, stiffness: 400 }}
              />
            </motion.span>
          </LayoutGroup>
        </motion.h1>

        <motion.p
          className="text-sm sm:text-base md:text-lg lg:text-xl text-center text-gray-500 pt-4 sm:pt-6 md:pt-8 max-w-2xl"
          animate={{ opacity: 1, y: 0 }}
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2, ease: "easeOut", delay: 0.5 }}
        >
          {subtitle}
        </motion.p>

        <div className="flex flex-row justify-center space-x-3 sm:space-x-4 items-center mt-8 sm:mt-12 md:mt-14 text-xs">
          <motion.span {...buttonMotion}>
            <Link
              href={primaryCta.href}
              className="inline-block sm:text-base md:text-lg font-semibold tracking-tight text-white bg-gray-900 hover:bg-gray-800 px-4 py-2 sm:px-5 sm:py-2.5 md:px-6 md:py-3 rounded-full z-20 shadow-2xl transition-colors"
            >
              {primaryCta.label} <span className="font-serif ml-1">→</span>
            </Link>
          </motion.span>
          {secondaryCta && (
            <motion.span {...buttonMotion}>
              <Link
                href={secondaryCta.href}
                className="inline-block sm:text-base md:text-lg font-semibold tracking-tight text-white bg-[#0015ff] hover:bg-[#0010cc] px-4 py-2 sm:px-5 sm:py-2.5 md:px-6 md:py-3 rounded-full z-20 shadow-2xl transition-colors"
              >
                {secondaryCta.label}
              </Link>
            </motion.span>
          )}
        </div>
      </div>
    </section>
  );
}

export default ComingSoonHero;
