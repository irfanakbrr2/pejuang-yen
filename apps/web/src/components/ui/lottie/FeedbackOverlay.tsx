"use client";

import { useEffect, useRef } from "react";
import { LottiePlayer } from "./LottiePlayer";
import { X } from "lucide-react";

interface FeedbackOverlayProps {
  type: "success" | "error";
  message: string;
  description?: string;
  onClose: () => void;
  /** Auto-close delay in ms. Set to 0 to disable auto-close. Default: 2500 for success, 0 for error */
  autoClose?: number;
}

const CONFIG = {
  success: {
    src: "/lottie/success.lottie",
    accentColor: "#8B1414",
    label: "Berhasil",
    bg: "bg-[#F7E8E8]",
    border: "border-[#8B1414]/20",
  },
  error: {
    src: "/lottie/error.lottie",
    accentColor: "#EF4444",
    label: "Terjadi kesalahan",
    bg: "bg-red-50",
    border: "border-red-200",
  },
};

export function FeedbackOverlay({
  type,
  message,
  description,
  onClose,
  autoClose,
}: FeedbackOverlayProps) {
  const delay = autoClose !== undefined ? autoClose : type === "success" ? 2500 : 0;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (delay > 0) {
      timerRef.current = setTimeout(onClose, delay);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [delay, onClose]);

  const cfg = CONFIG[type];

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className={`animate-scale-in-modal relative w-full max-w-sm rounded-2xl border p-8 text-center shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_16px_48px_rgba(0,0,0,0.12)] ${cfg.bg} ${cfg.border}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[#6B7280] hover:text-[#0D0D0D] hover:bg-black/5 transition-colors duration-150"
          aria-label="Tutup"
        >
          <X size={16} />
        </button>

        <div className="w-20 h-20 mx-auto mb-4">
          <LottiePlayer
            src={cfg.src}
            loop={false}
            autoplay
            className="w-full h-full"
          />
        </div>

        <p
          className="text-base font-semibold heading-tight mb-1"
          style={{ color: cfg.accentColor }}
        >
          {cfg.label}
        </p>
        <p className="text-[15px] font-medium text-[#0D0D0D] mb-1">{message}</p>
        {description && (
          <p className="text-sm text-[#6B7280] leading-relaxed">{description}</p>
        )}

        {type === "error" && (
          <button
            onClick={onClose}
            className="mt-5 w-full py-2.5 text-sm font-medium rounded-lg bg-[#0D0D0D] text-white transition-all duration-150 hover:bg-[#1a1a1a] active:scale-[0.98]"
          >
            Tutup
          </button>
        )}
      </div>
    </div>
  );
}
