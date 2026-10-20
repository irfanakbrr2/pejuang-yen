"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Bell, X, Check, BookOpen, Award, DollarSign, CreditCard, CheckCircle, MessageSquare, MessageCircle, BellRing } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { enablePush, pushSupported } from "@/lib/push-client";
import { toast } from "sonner";

export type NotifType =
  | "enrollment"
  | "completion"
  | "certificate"
  | "commission"
  | "payment"
  | "system"
  | "community_post"
  | "community_comment";

export interface Notification {
  id: string;
  type: NotifType;
  title: string;
  body?: string;
  timestamp: Date | string;
  read: boolean;
  href?: string;
}

interface NotificationCenterProps {
  notifications: Notification[];
  onMarkAllRead?: () => void;
  onMarkRead?: (id: string) => void;
  className?: string;
}

type IconComponent = React.ComponentType<{ className?: string; size?: number }>;

const NOTIF_ICON: Record<NotifType, IconComponent> = {
  enrollment:  BookOpen,
  completion:  CheckCircle,
  certificate: Award,
  commission:  DollarSign,
  payment:     CreditCard,
  system:      Bell,
  community_post: MessageSquare,
  community_comment: MessageCircle,
};

const NOTIF_DOT: Record<NotifType, string> = {
  enrollment:  "bg-[#8B1414]",
  completion:  "bg-[#22C55E]",
  certificate: "bg-[#8B5CF6]",
  commission:  "bg-[#8B1414]",
  payment:     "bg-[#F97316]",
  system:      "bg-[#6B7280]",
  community_post: "bg-[#C0392B]",
  community_comment: "bg-[#C0392B]",
};

// Fallback aman: tipe notifikasi tak terduga dari backend tidak boleh membuat render crash.
const FALLBACK_ICON: IconComponent = Bell;
const FALLBACK_DOT = "bg-[#6B7280]";

function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins}m lalu`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}j lalu`;
  return `${Math.floor(hrs / 24)}h lalu`;
}

export function NotificationCenter({
  notifications,
  onMarkAllRead,
  onMarkRead,
  className,
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [canPush, setCanPush] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Tampilkan ajakan aktifkan push hanya bila didukung & belum diizinkan.
  useEffect(() => {
    setCanPush(pushSupported() && typeof Notification !== "undefined" && Notification.permission !== "granted");
  }, []);

  const handleEnablePush = async () => {
    const ok = await enablePush();
    if (ok) {
      setCanPush(false);
      toast.success("Notifikasi push aktif! 🔔");
    } else {
      toast.error("Notifikasi tidak diaktifkan.");
    }
  };

  // Posisikan panel relatif ke tombol bel; panel dirender via portal ke <body>
  // (position: fixed) agar selalu tampil di atas semua elemen, tidak tertutup kartu lain.
  // Posisi horizontal adaptif: default tepi kanan panel sejajar tombol (buka ke kiri),
  // tapi jika tombol ada di kiri (mobile) panel dibuka ke kanan agar tidak keluar layar.
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const b = buttonRef.current?.getBoundingClientRect();
      if (!b) return;
      const margin = 12;
      const width = Math.min(340, window.innerWidth - margin * 2);
      let left = b.right - width; // buka ke kiri (tepi kanan sejajar tombol)
      if (left < margin) left = b.left; // tombol di kiri → buka ke kanan dari tombol
      left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
      setPos({ top: b.bottom + 8, left, width });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className={cn("relative", className)}>
      {/* Bell trigger */}
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "relative p-2 rounded-xl transition-all duration-150",
          open
            ? "bg-white/64 dark:bg-[#8B1414]/20 text-[#8B1414] dark:text-[#C0392B] shadow-[inset_0_1px_0_rgba(255,255,255,0.76),0_8px_22px_rgba(139,20,20,0.10)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_8px_22px_rgba(192,57,43,0.15)]"
            : "text-[#6B7280] dark:text-slate-400 hover:bg-white/54 dark:hover:bg-white/10 hover:text-[#0D0D0D] dark:hover:text-white"
        )}
        aria-label="Notifikasi"
      >
        <Bell size={18} strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span className="animate-badge-pop absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#8B1414] rounded-full flex items-center justify-center">
            <span className="text-[9px] font-bold text-white leading-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Panel — portal ke <body> + position fixed agar di atas semua elemen */}
      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={panelRef}
          style={{
            position: "fixed",
            top: pos?.top ?? 64,
            left: pos?.left ?? 12,
            width: pos?.width ?? 340,
            zIndex: 9999,
          }}
          className="animate-scale-in-panel glass-panel dark:bg-[#0D0D1F]/95 max-h-[480px] flex flex-col overflow-hidden border dark:border-white/10"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/[0.06] dark:border-white/[0.06] shrink-0">
            <span className="text-sm font-semibold text-[#0D0D0D] dark:text-white heading-tight">
              Notifikasi
            </span>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && onMarkAllRead && (
                <button
                  onClick={() => { onMarkAllRead(); }}
                  className="flex items-center gap-1 text-[11px] font-medium text-[#8B1414] dark:text-[#C0392B] hover:text-[#6E0F0F] dark:hover:text-[#34D399] px-2 py-1 rounded-lg hover:bg-[#8B1414]/[0.06] dark:hover:bg-[#C0392B]/10 transition-all duration-150"
                >
                  <Check size={11} />
                  Tandai dibaca
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg text-[#9CA3AF] dark:text-slate-400 hover:text-[#0D0D0D] dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-white/10 transition-colors duration-150"
                aria-label="Tutup"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-12 h-12 rounded-full bg-[#F2F2F7] dark:bg-white/5 flex items-center justify-center mb-3">
                  <Bell size={20} className="text-[#D1D5DB] dark:text-slate-600" />
                </div>
                <p className="text-sm font-medium text-[#0D0D0D] dark:text-white">Tidak ada notifikasi</p>
                <p className="text-xs text-[#9CA3AF] dark:text-slate-400 mt-0.5">Semua aktivitasmu akan muncul di sini</p>
              </div>
            ) : (
              <ul>
                {notifications.map((notif, i) => {
                  const Icon = NOTIF_ICON[notif.type] ?? FALLBACK_ICON;
                  const dot = NOTIF_DOT[notif.type] ?? FALLBACK_DOT;

                      const itemClassName = cn(
                        "w-full flex items-start gap-3 px-4 py-3 text-left border-b border-black/[0.04] dark:border-white/[0.05] last:border-0 transition-colors duration-150 block",
                        !notif.read
                          ? "bg-[#8B1414]/[0.03] dark:bg-[#C0392B]/10 hover:bg-[#8B1414]/[0.06] dark:hover:bg-[#C0392B]/20"
                          : "hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                      );
                      const handleClick = () => {
                        if (!notif.read && onMarkRead) onMarkRead(notif.id);
                        if (notif.href) setOpen(false);
                      };

                      const innerContent = (
                        <>
                          <div
                            className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                              !notif.read ? "bg-[#8B1414]/10 dark:bg-[#C0392B]/20" : "bg-[#F2F2F7] dark:bg-white/5"
                            )}
                          >
                            <Icon
                              size={14}
                              className={!notif.read ? "text-[#8B1414] dark:text-[#C0392B]" : "text-[#9CA3AF] dark:text-slate-500"}
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p
                                className={cn(
                                  "text-sm leading-snug line-clamp-1",
                                  !notif.read
                                    ? "font-semibold text-[#0D0D0D] dark:text-white"
                                    : "font-medium text-[#374151] dark:text-slate-400"
                                )}
                              >
                                {notif.title}
                              </p>
                              {!notif.read && (
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${dot}`} />
                              )}
                            </div>
                            {notif.body && (
                              <p className="text-xs text-[#9CA3AF] dark:text-slate-500 mt-0.5 line-clamp-1">
                                {notif.body}
                              </p>
                            )}
                            <p className="label-uppercase mt-1 text-[#9CA3AF] dark:text-slate-500" style={{ fontSize: "10px" }}>
                              {relativeTime(notif.timestamp)}
                            </p>
                          </div>
                        </>
                      );

                      return (
                        <li
                          key={notif.id}
                          className="animate-fade-in"
                          style={{ animationDelay: `${i * 40}ms` }}
                        >
                          {notif.href ? (
                            <Link href={notif.href} onClick={handleClick} className={itemClassName}>
                              {innerContent}
                            </Link>
                          ) : (
                            <button onClick={handleClick} className={itemClassName}>
                              {innerContent}
                            </button>
                          )}
                        </li>
                      );
                })}
              </ul>
            )}
          </div>

          {/* Footer: ajakan aktifkan notifikasi push */}
          {canPush && (
            <button
              onClick={handleEnablePush}
              className="flex items-center justify-center gap-1.5 px-4 py-3 border-t border-black/[0.06] dark:border-white/[0.06] shrink-0 text-[12px] font-semibold text-[#8B1414] dark:text-[#C0392B] hover:bg-[#8B1414]/[0.06] dark:hover:bg-[#C0392B]/10 transition-colors duration-150"
            >
              <BellRing size={14} />
              Aktifkan notifikasi push
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
