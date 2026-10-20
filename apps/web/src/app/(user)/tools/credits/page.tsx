"use client";
/* eslint-disable @typescript-eslint/no-unused-vars */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, checkoutApi, invalidateCache } from "@/lib/api-client";
import { PageHeader, DashboardSection } from "@/components/ui/dashboard-chrome";
import { AdminTable, Tr, Td, StatusBadge } from "@/components/ui/AdminTable";
import { EmptyState } from "@/components/ui/lottie/EmptyState";
import { formatDate, formatRupiah } from "@/lib/utils";
import { Zap, CheckCircle2, Sparkles, Star, AlertCircle } from "lucide-react";

interface Package {
  id: string;
  name: string;
  credits: number;
  price: number;
}

interface CreditsData {
  balance: number;
  total_purchased: number;
  total_used: number;
  transactions: Transaction[];
}

interface Transaction {
  id: string;
  type: "bonus" | "purchase" | "usage" | "refund" | "admin_adjust";
  amount: number;
  balance_after: number;
  tool_name: string | null;
  description: string | null;
  created_at: string;
}

const PACKAGE_BADGES: Record<string, { label: string; color: string }> = {
  pkg_growth: { label: "Populer", color: "bg-violet-100 text-violet-700" },
  pkg_pro: { label: "Terbaik", color: "bg-amber-100 text-amber-700" },
};

const TX_TYPE_LABELS: Record<string, string> = {
  bonus: "Bonus",
  purchase: "Pembelian",
  usage: "Digunakan",
  refund: "Refund",
  admin_adjust: "Penyesuaian Admin",
};

export default function ToolsCreditsPage() {
  const router = useRouter();
  const [creditsData, setCreditsData] = useState<CreditsData | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [showPhoneFor, setShowPhoneFor] = useState<string | null>(null);
  // phone from account — null = not loaded yet, "" = loaded but empty
  const [accountPhone, setAccountPhone] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<CreditsData>("/api/tools/credits", { cacheTtl: 0 }),
      api<Package[]>("/api/tools/credits/packages"),
      fetch("/api/auth/me", { credentials: "include" }).then((r) => r.json()).catch(() => null),
    ]).then(([creditsRes, pkgsRes, meRes]) => {
      if (creditsRes.success && creditsRes.data) setCreditsData(creditsRes.data);
      if (pkgsRes.success && pkgsRes.data) setPackages(pkgsRes.data);
      const phone: string = meRes?.data?.user?.phone || "";
      setAccountPhone(phone);
      if (phone) setPhoneInput(phone);
    }).catch(() => setError("Gagal memuat data. Silakan refresh halaman."))
    .finally(() => setLoading(false));
  }, []);

  const handlePurchase = async (packageId: string) => {
    // Only ask for phone if account has no phone on record
    if (!phoneInput.trim()) {
      setShowPhoneFor(packageId);
      return;
    }
    setPurchasing(packageId);
    setError(null);

    // Checkout embedded Pakasir — default QRIS, user bisa ganti metode di halaman checkout
    const res = await checkoutApi.createPayment({
      order_type: "tool_credits",
      product_id: packageId,
      payment_method: "qris",
      mobile: phoneInput,
    });

    setPurchasing(null);

    const orderData = res.data as { order_id?: string } | undefined;
    if (!res.success || !orderData?.order_id) {
      setError(res.error || "Gagal membuat pesanan. Silakan coba lagi.");
      return;
    }

    setShowPhoneFor(null);
    setPhoneInput("");
    invalidateCache("/api/tools/credits");
    router.push(`/checkout/${orderData.order_id}`);
  };

  return (
    <>
      <PageHeader
        title="Kredit Tools"
        description="Kelola dan beli kredit untuk menggunakan AI Tools PejuangYen."
      />

      {/* Balance Card */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Saldo Kredit", value: loading ? "—" : String(creditsData?.balance ?? 0), icon: Zap, color: "text-violet-600", bg: "bg-violet-50" },
          { label: "Total Dibeli", value: loading ? "—" : String(creditsData?.total_purchased ?? 0), icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50" },
          { label: "Total Digunakan", value: loading ? "—" : String(creditsData?.total_used ?? 0), icon: Sparkles, color: "text-orange-600", bg: "bg-orange-50" },
        ].map((stat) => (
          <div key={stat.label} className="flex items-center gap-3 rounded-2xl border dark:border-white/10 bg-white dark:bg-white/[0.02] px-5 py-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg} dark:bg-opacity-10`}>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Phone input (shared) */}
      {showPhoneFor && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-violet-100 dark:border-violet-500/20 bg-violet-50 dark:bg-violet-500/10 px-4 py-3">
          <Zap className="h-4 w-4 shrink-0 text-violet-500" />
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <p className="text-sm text-violet-800 dark:text-violet-300">Nomor WhatsApp belum ada di akun kamu. Masukkan untuk pembayaran:</p>
            <input
              type="tel"
              placeholder="08xx xxxx xxxx"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              className="flex-1 rounded-lg border border-violet-200 dark:border-violet-500/30 px-3 py-1.5 text-sm dark:bg-white/5 dark:text-white focus:border-violet-400 dark:focus:border-violet-500 focus:outline-none"
            />
            <button
              onClick={() => handlePurchase(showPhoneFor)}
              className="rounded-lg bg-violet-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
            >
              Lanjutkan
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-red-100 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Packages */}
      <DashboardSection title="Paket Kredit">
        <div className="grid gap-4 sm:grid-cols-3">
          {packages.map((pkg) => {
            const badge = PACKAGE_BADGES[pkg.id];
            const perCredit = Math.round(pkg.price / pkg.credits);
            const isBuying = purchasing === pkg.id;

            return (
              <div
                key={pkg.id}
                className={`relative flex flex-col gap-4 rounded-2xl border dark:border-white/10 bg-white dark:bg-white/[0.02] p-5 ${
                  pkg.id === "pkg_growth" ? "border-violet-300 dark:border-violet-500/50 ring-2 ring-violet-100 dark:ring-violet-500/20" : ""
                }`}
              >
                {badge && (
                  <span className={`absolute right-4 top-4 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${badge.color}`}>
                    {badge.label}
                  </span>
                )}
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <Star className={`h-4 w-4 ${pkg.id === "pkg_pro" ? "text-amber-400" : "text-violet-400"}`} />
                    <span className="text-sm font-semibold text-gray-800 dark:text-white">{pkg.name}</span>
                  </div>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">{pkg.credits}</p>
                  <p className="text-xs text-gray-500 dark:text-slate-400">kredit</p>
                </div>
                <div className="border-t border-gray-100 dark:border-white/10 pt-3">
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{formatRupiah(pkg.price)}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-400">{formatRupiah(perCredit)} per kredit</p>
                </div>
                <button
                  onClick={() => handlePurchase(pkg.id)}
                  disabled={!!purchasing}
                  className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
                    pkg.id === "pkg_growth"
                      ? "bg-violet-600 text-white hover:bg-violet-700"
                      : "border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-800 dark:text-white hover:bg-gray-50 dark:hover:bg-white/10"
                  }`}
                >
                  {isBuying ? "Memproses..." : "Beli Sekarang"}
                </button>
              </div>
            );
          })}
        </div>
      </DashboardSection>

      {/* Transaction History */}
      <DashboardSection title="Riwayat Kredit" className="mt-6">
        {!loading && (!creditsData?.transactions?.length) ? (
          <EmptyState title="Belum ada riwayat kredit" />
        ) : (
          <AdminTable columns={[
            { key: "type", label: "Tipe" },
            { key: "amount", label: "Jumlah" },
            { key: "balance", label: "Saldo Akhir" },
            { key: "desc", label: "Keterangan" },
            { key: "date", label: "Tanggal" },
          ]}>
            {(creditsData?.transactions || []).map((tx) => (
              <Tr key={tx.id}>
                <Td>
                  <span className="text-xs font-medium text-gray-700 dark:text-slate-300">
                    {TX_TYPE_LABELS[tx.type] || tx.type}
                  </span>
                </Td>
                <Td>
                  <span className={tx.amount > 0 ? "font-semibold text-green-600" : "font-semibold text-red-500"}>
                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                  </span>
                </Td>
                <Td>{tx.balance_after}</Td>
                <Td>{tx.description || (tx.tool_name ? `Tool: ${tx.tool_name}` : "—")}</Td>
                <Td>{formatDate(tx.created_at)}</Td>
              </Tr>
            ))}
          </AdminTable>
        )}
      </DashboardSection>
    </>
  );
}
