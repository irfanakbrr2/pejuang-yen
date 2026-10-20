"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { authApi, invalidateCache } from "@/lib/api-client";
import {
  LayoutDashboard,
  BookOpen,
  Gift,
  ShoppingCart,
  CreditCard,
  Star,
  Users,
  Share2,
  DollarSign,
  Award,
  Settings,
  ClipboardList,
  AlertTriangle,
  ExternalLink,
  Mail,
  KeyRound,
  TrendingUp,
  Wand2,
  Package,
  Coins,
  CalendarDays,
  MessageCircle,
  ShieldCheck,
  Ticket,
  FileText,
  PlayCircle,
  Route,
  Tags,
  BarChart3,
  BadgeCheck,
  Quote,
  GitBranch,
  Store,
  Megaphone,
  Radar,
} from "lucide-react";
import { ModernSidebar } from "@/components/ui/modern-side-bar";
import { useScrollReset } from "@/hooks/use-scroll-reset";

type AuthMeData = {
  user?: {
    id?: string;
    name?: string;
    email?: string;
    avatar_url?: string | null;
    role?: string;
  };
};

interface SidebarAdminUser {
  name: string;
  initials: string;
  role: string;
  avatarUrl?: string | null;
  avatarSeed?: string;
}

// PejuangYen — admin hanya 4 pilar: LMS, Membership, Affiliate, Dashboard.
// Menu fitur lain (invoice, digital products, funnels, creator store, learning paths,
// skills, bonus, AI Pulse, webinar, komunitas, tools/kredit, email marketing, push,
// API keys, error logs) DISEMBUNYIKAN — route/kode tetap ada & bisa diaktifkan lagi.
const adminSections = [
  {
    label: "Overview",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/admin" },
      { id: "revenue",   label: "Revenue",   icon: TrendingUp,      href: "/admin/revenue" },
      { id: "analytics", label: "Analytics", icon: BarChart3,       href: "/admin/analytics" },
    ],
  },
  {
    label: "Penjualan",
    items: [
      { id: "orders",      label: "Orders",        icon: ShoppingCart, href: "/admin/orders" },
      { id: "payments",    label: "Payments",      icon: CreditCard,   href: "/admin/payments" },
      { id: "memberships", label: "Membership",    icon: Star,         href: "/admin/memberships" },
      { id: "coupons",     label: "Kupon Diskon",  icon: Ticket,       href: "/admin/coupons" },
    ],
  },
  {
    label: "Konten",
    items: [
      { id: "courses",      label: "Kelas",      icon: BookOpen, href: "/admin/courses" },
      { id: "certificates", label: "Sertifikat", icon: Award,    href: "/admin/certificates" },
    ],
  },
  {
    label: "Users & Affiliate",
    items: [
      { id: "users",       label: "Data Users",  icon: Users,      href: "/admin/users" },
      { id: "affiliates",  label: "Affiliates",  icon: Share2,     href: "/admin/affiliates" },
      { id: "commissions", label: "Commissions", icon: DollarSign, href: "/admin/commissions" },
    ],
  },
  {
    label: "Sistem",
    items: [
      { id: "settings",   label: "Settings",   icon: Settings,      href: "/admin/settings" },
      { id: "audit-logs", label: "Audit Logs", icon: ClipboardList, href: "/admin/audit-logs" },
    ],
  },
];

function AdminDashboardSkeleton() {
  return (
    <div className="dashboard-shell flex h-screen overflow-hidden">
      <aside className="hidden w-72 shrink-0 border-r border-[rgba(0,0,0,0.07)] bg-white p-5 md:block">
        <div className="h-9 w-32 animate-pulse rounded-lg bg-gray-200" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      </aside>
      <main className="flex-1 p-4 pt-5 md:p-7 lg:p-9">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="h-9 w-48 animate-pulse rounded-lg bg-gray-200" />
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-lg bg-white/70 ring-1 ring-black/[0.04]" />
            ))}
          </div>
          <div className="h-80 animate-pulse rounded-lg bg-white/70 ring-1 ring-black/[0.04]" />
        </div>
      </main>
    </div>
  );
}

export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollReset(scrollRef);
  const redirectPathRef = useRef(pathname);
  const authStartedRef = useRef(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [sidebarUser, setSidebarUser] = useState<SidebarAdminUser>({
    name: "Administrator",
    initials: "AD",
    role: "Admin",
    avatarSeed: "Administrator",
  });

  useEffect(() => {
    if (authStartedRef.current) return;
    authStartedRef.current = true;

    authApi.me().then((res) => {
      if (!res.success) {
        window.location.href = `/login?redirect=${encodeURIComponent(redirectPathRef.current)}`;
        return;
      }
      const user = (res.data as AuthMeData | undefined)?.user;
      const role = user?.role;
      if (role !== "admin" && role !== "super_admin") {
        window.location.href = "/dashboard";
        return;
      }
      const name = user?.name || "Administrator";
      const initials = name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase() || "AD";
      setSidebarUser({
        name,
        initials,
        role: role === "super_admin" ? "Super Admin" : "Admin",
        avatarUrl: user?.avatar_url || null,
        avatarSeed: user?.id || user?.email || name,
      });
      setAuthChecked(true);
    });
  }, []);

  const handleLogout = async () => {
    await authApi.logout();
    invalidateCache();
    window.location.href = "/login";
  };

  if (!authChecked) return <AdminDashboardSkeleton />;

  return (
    <div className="dashboard-shell flex h-screen overflow-hidden">
      <ModernSidebar
        brand={{
          name: "PejuangYen",
          subtitle: "Admin Panel",
          badgeLabel: "Admin",
          badgeColor: "bg-orange-100 text-orange-700",
        }}
        sections={adminSections}
        user={sidebarUser}
        onLogout={handleLogout}
        collapsibleSections
        defaultOpenSections={["Overview", "Penjualan"]}
      />

      <div ref={scrollRef} className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden">
        <header className="glass-toolbar hidden md:flex sticky top-0 z-20 h-14 items-center px-6 gap-3">
          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-orange-500/12 text-orange-700 ring-1 ring-orange-500/16">
            Admin
          </span>
          <div className="flex-1" />
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-black/[0.04] hover:text-gray-800"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            User Dashboard
          </Link>
        </header>

        <main className="flex-1 p-4 pt-5 pb-28 md:p-7 lg:p-9">
          <div key={pathname} className="page-enter mx-auto max-w-7xl pb-6 md:pb-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
