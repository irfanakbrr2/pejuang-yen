"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { useMousePositionRef } from "@/hooks/use-mouse-position-ref";

// Parallax mengikuti mouse untuk elemen dekoratif hero. Nonaktif otomatis di
// perangkat touch dan saat prefers-reduced-motion — elemen tampil statis.

interface FloatingItem {
  element: HTMLDivElement;
  depth: number;
  currentX: number;
  currentY: number;
}

interface FloatingContextValue {
  registerElement: (id: string, element: HTMLDivElement, depth: number) => void;
  unregisterElement: (id: string) => void;
}

const FloatingContext = createContext<FloatingContextValue | null>(null);

export interface FloatingProps {
  children: ReactNode;
  className?: string;
  sensitivity?: number;
  easingFactor?: number;
}

export function Floating({ children, className, sensitivity = 1, easingFactor = 0.05 }: FloatingProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<Map<string, FloatingItem>>(new Map());
  const rafRef = useRef<number | null>(null);
  const mouseRef = useMousePositionRef(containerRef);

  const registerElement = useCallback((id: string, element: HTMLDivElement, depth: number) => {
    itemsRef.current.set(id, { element, depth, currentX: 0, currentY: 0 });
  }, []);

  const unregisterElement = useCallback((id: string) => {
    itemsRef.current.delete(id);
  }, []);

  useEffect(() => {
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (isTouch || reducedMotion) return; // dekorasi tetap statis

    const animate = () => {
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const offsetX = (mouseRef.current.x - centerX) * sensitivity * 0.1;
        const offsetY = (mouseRef.current.y - centerY) * sensitivity * 0.1;

        itemsRef.current.forEach((item) => {
          const targetX = offsetX * item.depth;
          const targetY = offsetY * item.depth;
          item.currentX += (targetX - item.currentX) * easingFactor;
          item.currentY += (targetY - item.currentY) * easingFactor;
          item.element.style.transform = `translate3d(${item.currentX.toFixed(2)}px, ${item.currentY.toFixed(2)}px, 0)`;
        });
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [sensitivity, easingFactor, mouseRef]);

  return (
    <FloatingContext.Provider value={{ registerElement, unregisterElement }}>
      <div ref={containerRef} className={cn("absolute inset-0", className)}>
        {children}
      </div>
    </FloatingContext.Provider>
  );
}

export interface FloatingElementProps {
  children: ReactNode;
  className?: string;
  depth?: number;
}

export function FloatingElement({ children, className, depth = 1 }: FloatingElementProps) {
  const id = useId();
  const elementRef = useRef<HTMLDivElement>(null);
  const context = useContext(FloatingContext);

  useEffect(() => {
    if (!elementRef.current || !context) return;
    context.registerElement(id, elementRef.current, depth);
    return () => context.unregisterElement(id);
  }, [id, depth, context]);

  return (
    <div ref={elementRef} className={cn("absolute will-change-transform", className)}>
      {children}
    </div>
  );
}

export default Floating;
