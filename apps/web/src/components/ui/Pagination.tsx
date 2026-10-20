"use client";

import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  className?: string;
  onPageChange?: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, className, onPageChange }: PaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  if (totalPages <= 1) return null;

  const createPageUrl = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());
    return `${pathname}?${params.toString()}`;
  };

  const handlePageChange = (page: number) => {
    if (onPageChange) {
      onPageChange(page);
    } else {
      router.push(createPageUrl(page));
    }
  };

  // Helper to generate page numbers
  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div className={cn("flex items-center justify-center gap-1.5 mt-6", className)}>
      <button
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-[rgba(12,12,10,0.12)] text-[rgba(12,12,10,0.5)] hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronLeft size={16} />
      </button>

      {getPageNumbers().map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className="w-8 h-8 flex items-center justify-center text-[rgba(12,12,10,0.5)]">
            ...
          </span>
        ) : (
          <button
            key={`page-${p}`}
            onClick={() => handlePageChange(p as number)}
            className={cn(
              "w-8 h-8 flex items-center justify-center rounded-lg text-sm font-semibold transition-colors",
              currentPage === p
                ? "bg-[#8B1414] text-white border border-[#8B1414] shadow-sm"
                : "border border-[rgba(12,12,10,0.12)] text-[rgba(12,12,10,0.6)] hover:bg-white bg-white/50"
            )}
          >
            {p}
          </button>
        )
      )}

      <button
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-[rgba(12,12,10,0.12)] text-[rgba(12,12,10,0.5)] hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
