"use client";

interface LevelRingProps {
  level: number;
  /** 0–100 progress menuju level berikutnya */
  progress: number;
  size?: number;
  stroke?: number;
  className?: string;
}

/**
 * Cincin progress level (gradient teal→emerald) dengan nomor level di tengah.
 * Hormati prefers-reduced-motion via transition transform/stroke yang ringan.
 */
export default function LevelRing({ level, progress, size = 56, stroke = 5, className = "" }: LevelRingProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, progress));
  const offset = circumference - (clamped / 100) * circumference;
  const gid = `lvlgrad-${size}`;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Level ${level}, ${clamped}% menuju level berikutnya`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8B1414" />
            <stop offset="100%" stopColor="#C0392B" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E2E8F0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset .6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] font-medium leading-none text-slate-400">LVL</span>
        <span className="text-base font-black leading-none tabular-nums text-[#8B1414]">{level}</span>
      </div>
    </div>
  );
}
