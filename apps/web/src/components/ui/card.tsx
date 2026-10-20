"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

type CardVariant = "default" | "glass" | "solid" | "accent";
type CardContextType = { variant: CardVariant };
const CardContext = React.createContext<CardContextType>({ variant: "default" });
const useCardContext = () => React.useContext(CardContext);

const cardVariants = cva(
  "relative flex flex-col items-stretch overflow-hidden text-card-foreground rounded-[var(--radius-lg,12px)] transition-all duration-[220ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
  {
  variants: {
    variant: {
      default: "bg-white border border-[rgba(0,0,0,0.07)] shadow-[var(--shadow-card)]",
      glass: "glass-card",
      solid: "bg-white border border-[rgba(0,0,0,0.07)] shadow-[var(--shadow-card)]",
      accent: "bg-[#F7F7F8] border border-[rgba(0,0,0,0.07)]",
    },
  },
  defaultVariants: { variant: "default" },
});

const cardHeaderVariants = cva("flex items-center justify-between flex-wrap px-5 min-h-14 gap-2.5", {
  variants: {
    variant: {
      default: "border-b border-[rgba(0,0,0,0.07)]",
      glass: "border-b border-[rgba(0,0,0,0.07)]",
      solid: "border-b border-[rgba(0,0,0,0.07)]",
      accent: "",
    },
  },
  defaultVariants: { variant: "default" },
});

const cardContentVariants = cva("grow p-5", {
  variants: {
    variant: {
      default: "",
      glass: "",
      solid: "",
      accent: "bg-white rounded-t-[10px] [&:last-child]:rounded-b-[10px]",
    },
  },
  defaultVariants: { variant: "default" },
});

const cardFooterVariants = cva("flex items-center px-5 min-h-14", {
  variants: {
    variant: {
      default: "border-t border-[rgba(0,0,0,0.07)]",
      glass: "border-t border-[rgba(0,0,0,0.07)]",
      solid: "border-t border-[rgba(0,0,0,0.07)]",
      accent: "bg-white rounded-b-[10px] mt-[2px]",
    },
  },
  defaultVariants: { variant: "default" },
});

function Card({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>) {
  return (
    <CardContext.Provider value={{ variant: (variant || "default") as CardVariant }}>
      <div data-slot="card" className={cn(cardVariants({ variant }), className)} {...props} />
    </CardContext.Provider>
  );
}

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { variant } = useCardContext();
  return <div data-slot="card-header" className={cn(cardHeaderVariants({ variant }), className)} {...props} />;
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { variant } = useCardContext();
  return <div data-slot="card-content" className={cn(cardContentVariants({ variant }), className)} {...props} />;
}

function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { variant } = useCardContext();
  return <div data-slot="card-footer" className={cn(cardFooterVariants({ variant }), className)} {...props} />;
}

function CardHeading({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-heading" className={cn("space-y-1", className)} {...props} />;
}

function CardToolbar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-toolbar" className={cn("flex items-center gap-2.5", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      data-slot="card-title"
      className={cn("text-base font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

function CardTable({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-table" className={cn("grid grow", className)} {...props} />;
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardHeading, CardTable, CardTitle, CardToolbar };
