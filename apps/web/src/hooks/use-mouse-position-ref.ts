"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Posisi mouse/touch dalam ref (tanpa re-render). Jika containerRef diberikan,
 * posisi dihitung relatif terhadap bounding box container tersebut.
 */
export function useMousePositionRef(
  containerRef?: RefObject<HTMLElement | SVGElement | null>
): RefObject<{ x: number; y: number }> {
  const positionRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const updatePosition = (clientX: number, clientY: number) => {
      if (containerRef?.current) {
        const rect = containerRef.current.getBoundingClientRect();
        positionRef.current = { x: clientX - rect.left, y: clientY - rect.top };
      } else {
        positionRef.current = { x: clientX, y: clientY };
      }
    };

    const handleMouseMove = (e: MouseEvent) => updatePosition(e.clientX, e.clientY);
    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) updatePosition(touch.clientX, touch.clientY);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, [containerRef]);

  return positionRef;
}
