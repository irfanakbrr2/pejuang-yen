"use client";

import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-[#8B1414] text-white shadow-[0_1px_2px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.14)] hover:bg-[#6E0F0F] active:bg-[#085240] disabled:opacity-50",
  secondary:
    "bg-white border border-[rgba(0,0,0,0.10)] text-[#374151] shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-gray-50 hover:border-[rgba(0,0,0,0.14)] disabled:opacity-50",
  outline:
    "bg-transparent border border-[#8B1414] text-[#8B1414] hover:bg-[#8B1414]/5 disabled:opacity-50",
  ghost:
    "bg-transparent text-[#6B7280] hover:bg-black/[0.04] hover:text-[#111827] disabled:opacity-50",
  danger:
    "bg-red-500 text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:bg-red-600 disabled:opacity-50",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-[12px]",
  md: "h-8 px-3.5 text-[13px]",
  lg: "h-9 px-5 text-[14px]",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold rounded-[var(--radius-md,8px)]",
        "transition-all duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer",
        "active:scale-[0.98]",
        "disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1414]/40 focus-visible:ring-offset-2",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
