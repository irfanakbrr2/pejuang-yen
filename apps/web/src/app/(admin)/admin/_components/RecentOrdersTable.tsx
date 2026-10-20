"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { EmptyState } from "@/components/ui/lottie/EmptyState";
import { Card, CardHeader, CardTitle, CardToolbar } from "@/components/ui/card";

const statusBadge: Record<string, string> = {
  paid:      "bg-green-100 text-green-700",
  pending:   "bg-amber-100 text-amber-700",
  failed:    "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-600",
};

const typeBadge: Record<string, string> = {
  membership: "bg-[#F7E8E8] text-[#8B1414]",
  course:     "bg-purple-50 text-purple-700",
};

export function RecentOrdersTable({ recentOrders, loading }: { recentOrders: any[]; loading: boolean }) {
  return (
    <Card className="lg:col-span-2 overflow-hidden">
      <CardHeader>
        <CardTitle>Recent Orders</CardTitle>
        <CardToolbar>
          <Link href="/admin/orders" className="inline-flex items-center gap-1 text-xs text-[#8B1414] font-medium hover:text-[#6E0F0F] transition-colors">
            Lihat semua <ArrowRight className="h-3 w-3" />
          </Link>
        </CardToolbar>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/30">
              {["Order", "User", "Tipe", "Produk", "Amount", "Status"].map((h) => (
                <th key={h} className="text-left px-5 py-3 label-uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04]">
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-400 text-sm">Memuat...</td>
              </tr>
            ) : recentOrders.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState title="Belum ada orders" description="Orders baru akan muncul di sini." size="sm" className="py-8" />
                </td>
              </tr>
            ) : (
              recentOrders.map((row: any) => (
              <tr key={row.orderId} className="hover:bg-white/46 transition-colors duration-100">
                  <td className="px-5 py-3 font-mono font-medium text-gray-900 text-xs">{row.orderId?.slice(0, 8)}</td>
                  <td className="px-5 py-3 text-gray-600 text-xs">{row.user}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold capitalize ${typeBadge[row.order_type] || "bg-gray-100 text-gray-600"}`}>
                      {row.order_type === "membership" ? "Member" : row.order_type || "—"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-700 text-xs max-w-[140px] truncate" title={row.product_name}>
                    {row.product_name || "—"}
                  </td>
                  <td className="px-5 py-3 font-semibold text-gray-900 text-xs">{formatRupiah(row.amount)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold capitalize ${statusBadge[row.status] || "bg-gray-100 text-gray-600"}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
