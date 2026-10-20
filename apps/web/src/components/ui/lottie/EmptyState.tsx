"use client";

import { LottiePlayer } from "./LottiePlayer";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
}

interface EmptyStateProps {
  /** Path to .lottie or .json file in /public/lottie/, or a remote URL */
  animationSrc?: string;
  title: string;
  description?: string;
  action?: EmptyStateAction;
  className?: string;
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: "w-20 h-20",
  md: "w-28 h-28",
  lg: "w-36 h-36",
};

export function EmptyState({
  animationSrc,
  title,
  description,
  action,
  className = "",
  size = "md",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}
    >
      {animationSrc && (
        <div className={`${SIZES[size]} mb-4`}>
          <LottiePlayer
            src={animationSrc}
            loop
            autoplay
            className="w-full h-full"
          />
        </div>
      )}
      {!animationSrc && (
        <div className={`${SIZES[size]} mb-4 flex items-center justify-center`}>
          <svg
            viewBox="0 0 80 80"
            fill="none"
            className="w-full h-full opacity-20"
          >
            <rect
              x="12"
              y="20"
              width="56"
              height="44"
              rx="6"
              stroke="#0D0D0D"
              strokeWidth="2"
            />
            <path
              d="M12 32h56"
              stroke="#0D0D0D"
              strokeWidth="2"
            />
            <circle cx="40" cy="52" r="6" stroke="#0D0D0D" strokeWidth="2" />
          </svg>
        </div>
      )}
      <p className="text-[15px] font-semibold text-[#0D0D0D] heading-tight mb-1">
        {title}
      </p>
      {description && (
        <p className="text-sm text-[#6B7280] max-w-[260px] leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 px-5 py-2.5 text-sm font-medium rounded-lg bg-[#8B1414] text-white transition-all duration-150 hover:bg-[#6E0F0F] active:scale-[0.97]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
