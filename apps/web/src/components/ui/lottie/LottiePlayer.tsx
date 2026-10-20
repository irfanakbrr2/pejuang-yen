"use client";
/* eslint-disable react-hooks/immutability */

import dynamic from "next/dynamic";
import type { DotLottie } from "@lottiefiles/dotlottie-react";

const DotLottieReact = dynamic(
  () => import("@lottiefiles/dotlottie-react").then((m) => ({ default: m.DotLottieReact })),
  {
    ssr: false,
    loading: () => <div className="w-full h-full" />,
  }
);

interface LottiePlayerProps {
  src: string;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onComplete?: () => void;
  speed?: number;
  /** Play animation on hover, pause on leave */
  hoverPlay?: boolean;
}

export function LottiePlayer({
  src,
  loop = false,
  autoplay = true,
  className,
  style,
  onComplete,
  speed = 1,
  hoverPlay = false,
}: LottiePlayerProps) {
  let dotLottieInstance: DotLottie | null = null;

  const handleRef = (dotLottie: DotLottie | null) => {
    dotLottieInstance = dotLottie;
    if (!dotLottie) return;
    if (onComplete) {
      dotLottie.addEventListener("complete", onComplete);
    }
  };

  return (
    <DotLottieReact
      src={src}
      loop={loop}
      autoplay={autoplay && !hoverPlay}
      speed={speed}
      className={className}
      style={style}
      dotLottieRefCallback={handleRef}
      onMouseEnter={hoverPlay ? () => dotLottieInstance?.play() : undefined}
      onMouseLeave={hoverPlay ? () => dotLottieInstance?.stop() : undefined}
    />
  );
}
