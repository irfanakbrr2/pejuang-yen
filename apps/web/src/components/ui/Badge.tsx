"use client";

import { cn } from "@/lib/utils";

type BadgeVariant = "success" | "warning" | "error" | "info" | "primary" | "gray" | "purple";

const variantClasses: Record<BadgeVariant, string> = {
  success: "bg-green-50  border-green-200  text-green-700",
  warning: "bg-amber-50  border-amber-200  text-amber-700",
  error:   "bg-red-50    border-red-200    text-red-700",
  info:    "bg-blue-50   border-blue-200   text-blue-700",
  primary: "bg-[#ECFDF5] border-[#8B1414]/20 text-[#8B1414]",
  gray:    "bg-zinc-50   border-zinc-200   text-zinc-500",
  purple:  "bg-purple-50 border-purple-200 text-purple-700",
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = "gray", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
