"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

import { BlurFade } from "./blur-fade";

interface PageHeaderProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <BlurFade delay={0.1} inView>
            <p className="label-uppercase mb-1.5">{eyebrow}</p>
          </BlurFade>
        )}
        <BlurFade delay={0.15} inView>
          <h1 className="text-[1.875rem] font-black leading-none text-[#09090B] tracking-[-0.03em]">
            {title}
          </h1>
        </BlurFade>
        {description && (
          <BlurFade delay={0.25} inView>
            <p className="mt-2 text-[13px] leading-relaxed text-[#71717A]">
              {description}
            </p>
          </BlurFade>
        )}
      </div>
      {actions && (
        <BlurFade delay={0.3} inView>
          <div className="shrink-0">{actions}</div>
        </BlurFade>
      )}
    </div>
  );
}

interface DashboardSectionProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

export function DashboardSection({
  title,
  description,
  actions,
  className,
  children,
  ...props
}: DashboardSectionProps) {
  return (
    <section className={cn("space-y-4", className)} {...props}>
      {(title || description || actions) && (
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-bold text-[#09090B] tracking-[-0.015em]">{title}</h2>}
            {description && <p className="mt-1 text-[12px] leading-5 text-[#71717A]">{description}</p>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
