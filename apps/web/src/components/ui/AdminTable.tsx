import React from "react";
import { cn } from "@/lib/utils";

interface Column {
  key: string;
  label: string;
  className?: string;
}

interface AdminTableProps {
  columns: Column[];
  children: React.ReactNode;
  loading?: boolean;
  empty?: React.ReactNode;
}

export function AdminTable({ columns, children, loading, empty }: AdminTableProps) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-lg,12px)] border border-[rgba(0,0,0,0.07)] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[rgba(0,0,0,0.07)] bg-[#F7F7F8]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]",
                    col.className
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="text-center py-10 text-[#9CA3AF]">
                  Loading...
                </td>
              </tr>
            ) : React.Children.count(children) === 0 ? (
              <tr>
                <td colSpan={columns.length}>{empty}</td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Tr({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <tr
      className={cn(
        "border-b border-[rgba(0,0,0,0.05)] last:border-0 even:bg-[#FAFAFA] hover:bg-[#F4F4F5] transition-colors duration-100",
        className
      )}
    >
      {children}
    </tr>
  );
}

export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={cn("px-4 py-2.5 text-[13px] text-[#3F3F46]", className)}>{children}</td>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid:            "border-green-200  bg-green-50  text-green-700",
    published:       "border-green-200  bg-green-50  text-green-700",
    active:          "border-green-200  bg-green-50  text-green-700",
    approved:        "border-green-200  bg-green-50  text-green-700",
    free:            "border-green-200  bg-green-50  text-green-700",
    pending:         "border-amber-200  bg-amber-50  text-amber-700",
    draft:           "border-amber-200  bg-amber-50  text-amber-700",
    sending:         "border-blue-200   bg-blue-50   text-blue-700",
    failed:          "border-red-200    bg-red-50    text-red-700",
    cancelled:       "border-red-200    bg-red-50    text-red-700",
    rejected:        "border-red-200    bg-red-50    text-red-700",
    archived:        "border-zinc-200   bg-zinc-50   text-zinc-500",
    inactive:        "border-zinc-200   bg-zinc-50   text-zinc-500",
    user:            "border-zinc-200   bg-zinc-50   text-zinc-500",
    admin:           "border-[#8B1414]/20 bg-[#ECFDF5] text-[#8B1414]",
    super_admin:     "border-[#8B1414]/20 bg-[#ECFDF5] text-[#8B1414]",
    membership_only: "border-purple-200 bg-purple-50 text-purple-700",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border capitalize",
        map[status] ?? "border-zinc-200 bg-zinc-50 text-zinc-500"
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
