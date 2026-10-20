"use client";

import Link from "next/link";
import { Plus, Users, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Stats {
  pendingOrders: number;
  pendingCommissions: number;
}

export function QuickActions({ stats }: { stats: Stats }) {
  const alerts = [
    {
      label: "Pending orders",
      count: stats.pendingOrders,
      href: "/admin/orders",
      color: stats.pendingOrders > 0 ? "bg-amber-500/10 border-amber-500/20" : "bg-white/34 border-black/[0.06]",
      countColor: stats.pendingOrders > 0 ? "text-amber-700 bg-amber-500/14" : "text-gray-500 bg-white/54",
    },
    {
      label: "Pending commissions",
      count: stats.pendingCommissions,
      href: "/admin/commissions",
      color: stats.pendingCommissions > 0 ? "bg-[#8B1414]/10 border-[#8B1414]/20" : "bg-white/34 border-black/[0.06]",
      countColor: stats.pendingCommissions > 0 ? "text-[#8B1414] bg-[#8B1414]/12" : "text-gray-500 bg-white/54",
    },
  ];

  const shortcuts = [
    { label: "Tambah kelas baru", href: "/admin/courses/new",  icon: Plus },
    { label: "Lihat semua users", href: "/admin/users",        icon: Users },
    { label: "Audit logs",        href: "/admin/audit-logs",   icon: ClipboardList },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Perlu Tindakan</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2.5">
          {alerts.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center justify-between p-3.5 rounded-xl border ${item.color} hover:scale-[1.01] transition-all duration-150`}
            >
              <span className="text-sm text-gray-700 font-medium">{item.label}</span>
              <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${item.countColor}`}>{item.count}</span>
            </Link>
          ))}

          <div className="mt-1 pt-4 border-t border-black/[0.06]">
            <p className="label-uppercase mb-3">Shortcut</p>
            <div className="flex flex-col gap-1">
              {shortcuts.map(({ label, href, icon: Icon }) => (
                <Link
                  key={label}
                  href={href}
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#8B1414] transition-colors py-1.5 px-2 rounded-xl hover:bg-white/46"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
