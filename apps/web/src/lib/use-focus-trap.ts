"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Focus trap untuk modal/dialog buatan sendiri:
 * - memindahkan fokus ke dalam container saat mount
 * - mengunci Tab/Shift+Tab agar berputar di dalam container
 * - mengembalikan fokus ke elemen pemicu saat unmount
 */
export function useFocusTrap<T extends HTMLElement>(active: boolean = true): RefObject<T | null> {
  const containerRef = useRef<T>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    // Fokus ke elemen pertama yang bisa difokus (atau container-nya)
    const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE);
    (focusables[0] || container).focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      // Baca ulang dari ref — panel modal bisa di-remount (mis. step sukses)
      const trapEl = containerRef.current;
      if (!trapEl) return;
      const items = Array.from(trapEl.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (current === first || !trapEl.contains(current)) {
          e.preventDefault();
          last.focus();
        }
      } else if (current === last || !trapEl.contains(current)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [active]);

  return containerRef;
}
