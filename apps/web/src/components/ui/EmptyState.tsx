import { cn } from "@/lib/utils";
import Link from "next/link";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4 text-center", className)}>
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-warm-cream flex items-center justify-center mb-4 text-[rgba(12,12,10,0.35)]">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-warm-black mb-1">{title}</h3>
      {description && <p className="text-sm text-[rgba(12,12,10,0.55)] max-w-xs">{description}</p>}
      {action && (
        <Link
          href={action.href}
          className="mt-4 inline-flex items-center px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-hover transition-colors"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
