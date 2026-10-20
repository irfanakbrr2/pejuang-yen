"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { EmptyState } from "@/components/ui/lottie/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-gray-900 text-white text-xs rounded-xl px-3 py-2.5 shadow-xl">
      <p className="text-white/50 mb-1 text-[11px]">{label}</p>
      <p className="font-semibold">{payload[0].value}</p>
    </div>
  );
}

const PIE_COLORS: Record<string, string> = {
  paid:      "#8B1414",
  pending:   "#F59E0B",
  failed:    "#EF4444",
  cancelled: "#9CA3AF",
  expired:   "#6B7280",
};

export function UserGrowthChart({ userChart, loading }: { userChart: any[]; loading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>User Baru (7 Hari)</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="skeleton h-44 rounded-xl" />
        ) : userChart.length === 0 || userChart.every(d => d.count === 0) ? (
          <EmptyState title="Belum ada registrasi" description="Data akan muncul setelah ada user baru." size="sm" className="py-6" />
        ) : (
          <ResponsiveContainer width="100%" height={176}>
            <BarChart data={userChart} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9CA3AF" }} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" fill="#8B1414" radius={[6, 6, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

export function OrderStatusChart({ ordersByStatus, loading }: { ordersByStatus: any[]; loading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Status Orders</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="skeleton h-44 rounded-xl" />
        ) : ordersByStatus.length === 0 ? (
          <EmptyState title="Belum ada orders" description="Data order akan tampil di sini." size="sm" className="py-6" />
        ) : (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={176}>
              <PieChart>
                <Pie data={ordersByStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={50} outerRadius={74} paddingAngle={3}>
                  {ordersByStatus.map((entry: any) => (
                    <Cell key={entry.status} fill={PIE_COLORS[entry.status] || "#E5E7EB"} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [value, name]} contentStyle={{ fontSize: 12, borderRadius: 12, border: "none", boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2.5 flex-1">
              {ordersByStatus.map((entry: any) => (
                <div key={entry.status} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[entry.status] || "#E5E7EB" }} />
                    <span className="text-xs text-gray-600 capitalize">{entry.status}</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-900">{entry.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
