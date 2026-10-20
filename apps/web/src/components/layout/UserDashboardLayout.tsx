"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Award,
  CreditCard,
  ShoppingBag,
  Share2,
  User,
} from "lucide-react";
import { ModernSidebar } from "@/components/ui/modern-side-bar";
import { GlobalSearch, GlobalSearchFab } from "@/components/search/GlobalSearch";
import { authApi, invalidateCache } from "@/lib/api-client";
import { useMenuVisit } from "@/hooks/use-menu-visit";
import { useScrollReset } from "@/hooks/use-scroll-reset";

// NOTE: PejuangYen hanya menampilkan 4 pilar — LMS, Membership, Affiliate, Dashboard.
// Fitur lain (AI Pulse, Komunitas, Webinar, Tools, Bonus, Toko Saya, dll) DISEMBUNYIKAN
// dari menu; kode/route-nya tetap ada di repo dan bisa diaktifkan lagi kapan saja.
const userSections = [
  {
    label: "Overview",
    items: [
      { id: "dashboard",    label: "Dashboard",   icon: LayoutDashboard, href: "/dashboard" },
    ],
  },
  {
    label: "Belajar",
    items: [
      { id: "my-classes",   label: "Kelas Saya", icon: BookOpen, href: "/my-classes" },
      { id: "certificates", label: "Sertifikat", icon: Award,    href: "/certificates" },
    ],
  },
  {
    label: "Affiliate",
    items: [
      { id: "affiliate",         label: "Affiliate",   icon: Share2, href: "/affiliate" },
    ],
  },
  {
    label: "Transaksi",
    items: [
      { id: "pembelian",    label: "Pembelian", icon: ShoppingBag, href: "/pembelian" },
      { id: "transactions", label: "Transaksi", icon: CreditCard,  href: "/transactions" },
    ],
  },
  {
    label: "Akun",
    items: [
      { id: "account",      label: "Akun Saya",   icon: User,            href: "/account" },
    ],
  },
];

function DashboardSkeleton() {
  return (
    <div className="dashboard-shell flex h-screen overflow-hidden">
      <aside className="hidden w-72 shrink-0 border-r border-[rgba(0,0,0,0.07)] bg-white p-5 md:block">
        <div className="h-9 w-36 animate-pulse rounded-lg bg-gray-200 dark:bg-white/10" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-white/5" />
          ))}
        </div>
      </aside>
      <main className="flex-1 p-4 pt-5 md:p-7 lg:p-9">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="h-9 w-56 animate-pulse rounded-lg bg-gray-200" />
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-lg bg-white/70 dark:bg-[#0D0D1F]/50 ring-1 ring-black/[0.04] dark:ring-white/[0.04]" />
            ))}
          </div>
          <div className="h-80 animate-pulse rounded-lg bg-white/70 dark:bg-[#0D0D1F]/50 ring-1 ring-black/[0.04] dark:ring-white/[0.04]" />
        </div>
      </main>
    </div>
  );
}

interface SidebarUser {
  name: string;
  initials: string;
  role: string;
  roleColor: string;
  avatarUrl?: string | null;
  avatarSeed?: string;
}

function isPaidMembership(membership: { expires_at?: string | null } | null | undefined): boolean {
  if (!membership) return false;
  if (!membership.expires_at) return true; // lifetime
  return new Date(membership.expires_at) > new Date();
}

export default function UserDashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  useMenuVisit();
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollReset(scrollRef);
  const redirectPathRef = useRef(pathname);
  const authStartedRef = useRef(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [sidebarUser, setSidebarUser] = useState<SidebarUser>({
    name: "Member",
    initials: "M",
    role: "Member Gratis",
    roleColor: "text-gray-400",
  });

  useEffect(() => {
    if (authStartedRef.current) return;
    authStartedRef.current = true;

    authApi.me().then((res: any) => {
      if (!res.success) {
        window.location.href = `/login?redirect=${encodeURIComponent(redirectPathRef.current)}`;
      } else {
        const user = res.data?.user;
        const membership = res.data?.membership;
        const paid = isPaidMembership(membership);
        const name = user?.name || "Member";
        const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

        setSidebarUser({
          name,
          initials,
          role: paid ? "Member Premium" : "Member Gratis",
          roleColor: paid ? "text-amber-500 font-semibold" : "text-gray-400",
          avatarUrl: user?.avatar_url || null,
          avatarSeed: user?.id || user?.email || name,
        });

        // City gate dinonaktifkan (fitur Peta Member GWA dimatikan untuk PejuangYen).
        setAuthChecked(true);
      }
    });
  }, []);

  const handleLogout = async () => {
    await authApi.logout();
    invalidateCache();
    window.location.href = "/login";
  };

  if (!authChecked) return <DashboardSkeleton />;

  return (
    <div className="dashboard-shell flex h-screen overflow-hidden">
      <ModernSidebar
        brand={{ name: "PejuangYen", subtitle: "Platform Belajar" }}
        sections={userSections}
        user={sidebarUser}
        onLogout={handleLogout}
      />

      <div ref={scrollRef} className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden">
        <main className="flex-1 p-4 pt-5 pb-28 md:p-7 lg:p-9">
          <div key={pathname} className="page-enter mx-auto max-w-7xl pb-6 md:pb-10">{children}</div>
        </main>
      </div>

      <GlobalSearch />
      <GlobalSearchFab />
    </div>
  );
}
