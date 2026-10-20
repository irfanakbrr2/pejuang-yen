"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { StatusBadge } from "@/components/ui/AdminTable";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/card";
import { formatRupiah } from "@/lib/utils";
import { PageHeader } from "@/components/ui/dashboard-chrome";

interface Order {
  id: string; user_id: string; order_number: string; order_type: string; product_id: string;
  product_name: string; amount: number; currency: string; status: string;
  affiliate_code?: string; metadata_json?: string; created_at: string; paid_at?: string;
}

interface OrderAddon {
  type: string;
  label: string;
  amount: number;
  status?: string;
}

function parseOrderAddons(metadataJson?: string): OrderAddon[] {
  if (!metadataJson) return [];
  try {
    const parsed = JSON.parse(metadataJson);
    return Array.isArray(parsed?.addons) ? parsed.addons : [];
  } catch {
    return [];
  }
}

export default function AdminOrderDetailClient() {
  const pathname = usePathname();
  const id = pathname.split('/').filter(Boolean)[2];
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  

  useEffect(() => {
    fetch(`/api/admin/orders/${id}`, { credentials: "include" })
      .then(r => r.json())
      .then(data => { if (data.success) setOrder(data.data); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="max-w-xl">
      <div className="skeleton h-4 w-20 mb-5 rounded" />
      <div className="skeleton h-6 w-36 mb-5 rounded" />
      <Card>
        <CardContent className="p-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex justify-between items-center px-5 py-3.5 border-b border-[rgba(12,12,10,0.05)] last:border-b-0">
              <div className="skeleton h-4 w-24 rounded" />
              <div className="skeleton h-4 w-32 rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );

  if (!order) return (
    <div className="flex items-center justify-center py-20 text-sm text-red-600">Order tidak ditemukan.</div>
  );

  const rows: [string, React.ReactNode][] = [
    ["Order Number", <span key="on" className="font-mono font-semibold">{order.order_number}</span>],
    ["Tipe", order.order_type],
    ["Produk", order.product_name],
    ["Jumlah", <span key="jml" className="font-semibold text-warm-black">{formatRupiah(order.amount)}</span>],
    ["Affiliate", order.affiliate_code || "—"],
    ["Status", <StatusBadge key="st" status={order.status} />],
    ["Dibuat", new Date(order.created_at).toLocaleString("id-ID")],
    ["Dibayar", order.paid_at ? new Date(order.paid_at).toLocaleString("id-ID") : "—"],
  ];
  const addons = parseOrderAddons(order.metadata_json);

  return (
    <div className="max-w-xl">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.back()}
        className="mb-5"
      >
        <ArrowLeft size={14} />
        Kembali
      </Button>

      <PageHeader title="Detail Order" />

      <Card>
        <CardContent className="p-0">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between px-5 py-3.5 border-b border-[rgba(12,12,10,0.05)] last:border-b-0">
              <span className="text-sm text-[rgba(12,12,10,0.55)]">{label}</span>
              <span className="text-sm font-medium text-warm-black text-right">{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {addons.length > 0 && (
        <Card className="mt-5">
          <CardContent className="p-0">
            <div className="px-5 py-3.5 border-b border-[rgba(12,12,10,0.05)]">
              <p className="text-sm font-semibold text-warm-black">Add-on Order</p>
            </div>
            {addons.map((addon) => (
              <div key={addon.type} className="px-5 py-3.5 border-b border-[rgba(12,12,10,0.05)] last:border-b-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-warm-black">{addon.label}</p>
                    <p className="mt-0.5 text-xs text-[rgba(12,12,10,0.5)]">{addon.status || "pending_followup"}</p>
                  </div>
                  <span className="text-sm font-semibold text-warm-black">{formatRupiah(addon.amount)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
