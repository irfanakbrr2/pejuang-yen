"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LottiePlayer } from "@/components/ui/lottie/LottiePlayer";

export interface SidebarNavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: string | number;
  /** Optional Lottie animation src (path in /public/lottie/ or URL). Plays on hover/active. */
  lottieSrc?: string;
}

export interface SidebarNavSection {
  label?: string;
  items: SidebarNavItem[];
}

export interface ModernSidebarProps {
  brand: {
    name: string;
    subtitle?: string;
    badgeLabel?: string;
    badgeColor?: string;
  };
  sections: SidebarNavSection[];
  user?: {
    name: string;
    initials: string;
    role?: string;
    roleColor?: string;
    avatarUrl?: string | null;
    avatarSeed?: string;
  };
  onLogout?: () => void;
  className?: string;
  /** Opt-in: label section jadi tombol lipat (dipakai admin; layout user tidak berubah) */
  collapsibleSections?: boolean;
  /** Section yang terbuka default saat belum ada preferensi tersimpan (label persis) */
  defaultOpenSections?: string[];
}

export function ModernSidebar({
  brand,
  sections,
  user,
  onLogout,
  className,
  collapsibleSections = false,
  defaultOpenSections,
}: ModernSidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const sectionsStorageKey = `sidebar-sections-${(brand.subtitle || brand.name).toLowerCase().replace(/\s+/g, "-")}`;
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const s of sections) {
      if (s.label) initial[s.label] = defaultOpenSections ? defaultOpenSections.includes(s.label) : true;
    }
    return initial;
  });

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") {
      const frame = requestAnimationFrame(() => setIsCollapsed(true));
      return () => cancelAnimationFrame(frame);
    }
  }, []);

  // Restore preferensi lipatan section (hanya saat collapsibleSections aktif)
  useEffect(() => {
    if (!collapsibleSections) return;
    try {
      const stored = localStorage.getItem(sectionsStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, boolean>;
        const frame = requestAnimationFrame(() =>
          setOpenSections((prev) => ({ ...prev, ...parsed }))
        );
        return () => cancelAnimationFrame(frame);
      }
    } catch { /* preferensi korup → pakai default */ }
  }, [collapsibleSections, sectionsStorageKey]);

  const toggleSection = useCallback((label: string) => {
    setOpenSections((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      try { localStorage.setItem(sectionsStorageKey, JSON.stringify(next)); } catch { /* storage penuh */ }
      return next;
    });
  }, [sectionsStorageKey]);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }, []);

  const filteredSections = useMemo(() => {
    if (!search.trim()) return sections;
    const q = search.toLowerCase();
    return sections
      .map((s) => ({ ...s, items: s.items.filter((i) => i.label.toLowerCase().includes(q)) }))
      .filter((s) => s.items.length > 0);
  }, [search, sections]);

  const activeHref = useMemo(() => {
    const matches = sections
      .flatMap((section) => section.items)
      .filter((item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`)))
      .sort((a, b) => b.href.length - a.href.length);

    return matches[0]?.href ?? "";
  }, [pathname, sections]);

  const avatarUrl = user?.avatarUrl || (user ? `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.avatarSeed || user.name || user.initials)}` : "");

  return (
    <>
      <MobileBottomNav sections={sections} activeHref={activeHref} brandName={brand.name} onLogout={onLogout} />

      {/* Sidebar panel */}
      <aside
        className={cn(
          "bg-white hidden h-full flex-col transition-all duration-300 ease-in-out md:flex",
          "border-r border-[rgba(0,0,0,0.07)] shadow-[var(--shadow-sidebar)]",
          isCollapsed ? "w-[72px]" : "w-[260px]",
          "relative z-auto",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[rgba(0,0,0,0.06)] min-h-[60px]">
          {!isCollapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <Image
                src="/logo.png"
                alt="PejuangYen"
                width={28}
                height={28}
                className="rounded-lg shrink-0 object-contain"
                priority
              />
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-[13px] text-[#09090B] leading-tight truncate tracking-[-0.01em]">
                  {brand.name}
                </span>
                {brand.subtitle && (
                  <span className="text-[11px] text-[#A1A1AA] leading-tight truncate">
                    {brand.subtitle}
                  </span>
                )}
              </div>
              {brand.badgeLabel && (
                <span
                  className={cn(
                    "shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border",
                    brand.badgeColor ?? "bg-[#ECFDF5] text-[#8B1414] border-[#8B1414]/15"
                  )}
                >
                  {brand.badgeLabel}
                </span>
              )}
            </div>
          )}

          {isCollapsed && (
            <Image
              src="/logo.png"
              alt="PejuangYen"
              width={32}
              height={32}
              className="rounded-xl mx-auto object-contain shadow-sm"
              priority
            />
          )}

          <button
            onClick={toggleCollapse}
            className="hidden md:flex shrink-0 p-1.5 rounded-lg hover:bg-black/[0.04] transition-colors duration-150 ml-auto"
            aria-label={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5 text-gray-400" />
            )}
          </button>
        </div>

        {/* Search */}
        {!isCollapsed && (
          <div className="px-3 pt-3 pb-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#A1A1AA] pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari menu..."
                className="w-full pl-8 pr-3 py-1.5 rounded-[var(--radius-md,8px)] text-[12px] bg-[#F4F4F5] border border-transparent text-[#09090B] placeholder:text-[#A1A1AA] outline-none focus:bg-white focus:border-[rgba(0,0,0,0.10)] focus:shadow-[0_0_0_3px_rgba(139,20,20,0.06)] transition-all duration-150"
              />
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
          {filteredSections.map((section, si) => {
            // Saat search aktif: paksa terbuka. Mode collapsed (72px): semua item tampil.
            const isSearching = search.trim().length > 0;
            const canToggle = collapsibleSections && !isCollapsed && !!section.label && !isSearching;
            const isOpen = !canToggle || openSections[section.label!] !== false;
            // Section berisi halaman aktif tetap terlihat meski terlipat
            const containsActive = section.items.some((i) => i.href === activeHref);

            return (
            <div key={si}>
              {section.label && !isCollapsed && (
                canToggle ? (
                  <button
                    onClick={() => toggleSection(section.label!)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 min-h-[36px] rounded-[var(--radius-md,8px)] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#A1A1AA] hover:text-[#71717A] hover:bg-black/[0.02] transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#8B1414]/40"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      {section.label}
                      {!isOpen && containsActive && (
                        <span className="h-1.5 w-1.5 rounded-full bg-[#8B1414]" aria-hidden />
                      )}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 shrink-0 transition-transform duration-200",
                        isOpen ? "rotate-0" : "-rotate-90"
                      )}
                    />
                  </button>
                ) : (
                  <p className="px-3 mb-1 mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#A1A1AA]">
                    {section.label}
                  </p>
                )
              )}
              {(isOpen || isCollapsed) && (
              <ul className="space-y-px">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.href === activeHref;

                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        title={isCollapsed ? item.label : undefined}
                        className={cn(
                          "relative flex items-center rounded-[var(--radius-md,8px)] text-[13px] font-medium transition-all duration-150 group",
                          isCollapsed
                            ? "justify-center p-2.5"
                            : "gap-2.5 px-3 py-2",
                          isActive
                            ? "bg-[#8B1414]/[0.06] text-[#8B1414]"
                            : "text-[#3F3F46] hover:bg-black/[0.03] hover:text-[#09090B]"
                        )}
                      >
                        {/* Active left indicator bar */}
                        {isActive && !isCollapsed && (
                          <span className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] rounded-full bg-[#8B1414]" />
                        )}

                        {/* Icon: Lottie if provided, else Lucide */}
                        {item.lottieSrc ? (
                          <div className="h-[15px] w-[15px] shrink-0">
                            <LottiePlayer
                              src={item.lottieSrc}
                              loop={isActive}
                              autoplay={isActive}
                              hoverPlay={!isActive}
                              className="w-full h-full"
                            />
                          </div>
                        ) : (
                          <Icon
                            className={cn(
                              "h-[15px] w-[15px] shrink-0 transition-colors duration-150",
                              isActive ? "text-[#8B1414]" : "text-[#A1A1AA] group-hover:text-[#71717A]"
                            )}
                          />
                        )}

                        {!isCollapsed && (
                          <>
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.badge !== undefined && (
                              <span
                                className={cn(
                                  "text-[10px] font-semibold px-1.5 py-0.5 rounded-md",
                                  isActive
                                    ? "bg-[#8B1414]/10 text-[#8B1414]"
                                    : "bg-[#F4F4F5] text-[#71717A]"
                                )}
                              >
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}

                        {/* Collapsed tooltip */}
                        {isCollapsed && (
                          <div className="absolute left-full ml-2.5 px-2.5 py-1.5 bg-[#0D0D0D] text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap z-50 pointer-events-none shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_4px_12px_rgba(0,0,0,0.15)]">
                            {item.label}
                            {item.badge !== undefined && (
                              <span className="ml-1.5 px-1 py-0.5 bg-white/20 rounded-full text-[10px]">
                                {item.badge}
                              </span>
                            )}
                            <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#0D0D0D]" />
                          </div>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              )}
            </div>
            );
          })}
        </nav>

        {/* Bottom: Profile + Logout */}
        <div className="border-t border-[rgba(0,0,0,0.07)] mt-auto">
          {user && (
            <div className={cn("p-3", isCollapsed ? "flex justify-center" : "")}>
              {!isCollapsed ? (
                <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-gray-50 transition-colors duration-150">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarUrl}
                    alt={user.name}
                    className="w-8 h-8 rounded-full bg-white/62 object-cover ring-1 ring-black/[0.06] shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate leading-tight">{user.name}</p>
                    {user.role && (
                      <p className={`text-xs truncate leading-tight ${user.roleColor ?? "text-gray-400"}`}>{user.role}</p>
                    )}
                  </div>
                  <div className="w-2 h-2 bg-green-500 rounded-full shrink-0" />
                </div>
              ) : (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarUrl}
                    alt={user.name}
                    className="w-9 h-9 rounded-full bg-white/62 object-cover ring-1 ring-black/[0.06]"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
                </div>
              )}
            </div>
          )}

          <div className={cn("px-3 pb-3", isCollapsed ? "flex justify-center" : "")}>
            <button
              onClick={onLogout}
              title={isCollapsed ? "Keluar" : undefined}
              className={cn(
                "flex items-center rounded-lg text-sm font-medium transition-all duration-150 group",
                "text-red-500 hover:bg-red-50 hover:text-red-600",
                isCollapsed ? "p-2.5 justify-center relative" : "w-full gap-2.5 px-3 py-2.5"
              )}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {!isCollapsed && <span>Keluar</span>}

              {isCollapsed && (
                <div className="absolute left-full ml-2.5 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap z-50 pointer-events-none">
                  Keluar
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
                </div>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function MobileBottomNav({
  sections,
  activeHref,
  brandName,
  onLogout,
}: {
  sections: SidebarNavSection[];
  activeHref: string;
  brandName: string;
  onLogout?: () => void;
}) {
  const items = useMemo(() => sections.flatMap((section) => section.items), [sections]);
  const activeItemRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [activeHref]);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 bg-white px-2 pt-2 pb-[calc(0.7rem+env(safe-area-inset-bottom))] shadow-[0_-1px_0_rgba(0,0,0,0.07)] md:hidden"
      aria-label={`${brandName} mobile navigation`}
    >
      <div className="flex items-center gap-1">
        <div className="flex flex-1 snap-x gap-1.5 overflow-x-auto px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === activeHref;

            return (
              <Link
                key={item.id}
                ref={isActive ? activeItemRef : undefined}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group relative flex min-w-[72px] snap-center flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-semibold leading-tight transition-all duration-200",
                  isActive
                    ? "bg-[#8B1414]/8 text-[#8B1414]"
                    : "text-gray-500 hover:bg-black/[0.04] hover:text-gray-900"
                )}
              >
                {item.lottieSrc ? (
                  <span className="h-5 w-5 shrink-0">
                    <LottiePlayer
                      src={item.lottieSrc}
                      loop={isActive}
                      autoplay={isActive}
                      hoverPlay={!isActive}
                      className="h-full w-full"
                    />
                  </span>
                ) : (
                  <Icon
                    className={cn(
                      "h-5 w-5 shrink-0 transition-colors duration-150",
                      isActive ? "text-[#8B1414]" : "text-gray-400 group-hover:text-gray-700"
                    )}
                  />
                )}
                <span className="max-w-[64px] truncate">{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={cn(
                      "absolute -mt-8 ml-8 rounded-full px-1.5 py-0.5 text-[9px] font-bold",
                      isActive ? "bg-[#8B1414] text-white" : "bg-[#8B1414] text-white"
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {onLogout && (
          <button
            onClick={onLogout}
            aria-label="Keluar"
            className="flex shrink-0 min-w-[56px] flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] font-semibold text-red-400 transition-all duration-200 hover:bg-red-50 hover:text-red-600"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span>Keluar</span>
          </button>
        )}
      </div>
    </nav>
  );
}
