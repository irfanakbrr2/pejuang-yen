"use client";

import { cn } from "@/lib/utils";
import { type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-gray-900">
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          "w-full px-3.5 py-2.5 text-[13px] rounded-[var(--radius-md,8px)] border bg-white",
          "text-[#111827] placeholder:text-[#9CA3AF]",
          "outline-none transition-[border-color,box-shadow] duration-150",
          error
            ? "border-red-400 focus:border-red-400 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.08)]"
            : "border-[rgba(0,0,0,0.10)] focus:border-[#8B1414]/40 focus:shadow-[0_0_0_3px_rgba(139,20,20,0.08)]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
