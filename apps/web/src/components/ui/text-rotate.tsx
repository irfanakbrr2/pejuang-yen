"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
  type TargetAndTransition,
} from "framer-motion";
import { cn } from "@/lib/utils";

export interface TextRotateRef {
  next: () => void;
  previous: () => void;
  jumpTo: (index: number) => void;
  reset: () => void;
}

export interface TextRotateProps {
  texts: string[];
  rotationInterval?: number;
  initial?: TargetAndTransition;
  animate?: TargetAndTransition;
  exit?: TargetAndTransition;
  staggerDuration?: number;
  staggerFrom?: "first" | "last" | "center" | "random" | number;
  transition?: Transition;
  splitBy?: "characters" | "words";
  loop?: boolean;
  auto?: boolean;
  mainClassName?: string;
  splitLevelClassName?: string;
  elementLevelClassName?: string;
  onNext?: (index: number) => void;
}

function splitCharacters(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("id", { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), (segment) => segment.segment);
  }
  return Array.from(text);
}

export const TextRotate = forwardRef<TextRotateRef, TextRotateProps>(function TextRotate(
  {
    texts,
    rotationInterval = 2500,
    initial = { y: "100%", opacity: 0 },
    animate = { y: 0, opacity: 1 },
    exit = { y: "-120%", opacity: 0 },
    staggerDuration = 0.025,
    staggerFrom = "first",
    transition = { type: "spring", damping: 30, stiffness: 400 },
    splitBy = "characters",
    loop = true,
    auto = true,
    mainClassName,
    splitLevelClassName,
    elementLevelClassName,
    onNext,
  },
  ref
) {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const reducedMotion = useReducedMotion();

  const currentText = texts[currentTextIndex] ?? "";

  // Pecah per kata supaya word-wrap tetap utuh, lalu per karakter di dalamnya
  const elements = useMemo(() => {
    if (splitBy === "words") {
      return currentText.split(" ").map((word) => ({ characters: [word], needsSpace: true }));
    }
    const words = currentText.split(" ");
    return words.map((word, i) => ({
      characters: splitCharacters(word),
      needsSpace: i !== words.length - 1,
    }));
  }, [currentText, splitBy]);

  const totalChars = useMemo(
    () => elements.reduce((sum, word) => sum + word.characters.length, 0),
    [elements]
  );

  const getStaggerDelay = useCallback(
    (index: number): number => {
      if (staggerFrom === "first") return index * staggerDuration;
      if (staggerFrom === "last") return (totalChars - 1 - index) * staggerDuration;
      if (staggerFrom === "center") {
        const center = Math.floor(totalChars / 2);
        return Math.abs(center - index) * staggerDuration;
      }
      if (staggerFrom === "random") {
        // Deterministik per index agar stabil antar render
        return ((index * 7919) % totalChars) * staggerDuration * 0.5;
      }
      return Math.abs((staggerFrom as number) - index) * staggerDuration;
    },
    [staggerFrom, staggerDuration, totalChars]
  );

  const handleIndexChange = useCallback(
    (newIndex: number) => {
      setCurrentTextIndex(newIndex);
      onNext?.(newIndex);
    },
    [onNext]
  );

  const next = useCallback(() => {
    const isLast = currentTextIndex === texts.length - 1;
    const nextIndex = isLast ? (loop ? 0 : currentTextIndex) : currentTextIndex + 1;
    if (nextIndex !== currentTextIndex) handleIndexChange(nextIndex);
  }, [currentTextIndex, texts.length, loop, handleIndexChange]);

  const previous = useCallback(() => {
    const isFirst = currentTextIndex === 0;
    const prevIndex = isFirst ? (loop ? texts.length - 1 : 0) : currentTextIndex - 1;
    if (prevIndex !== currentTextIndex) handleIndexChange(prevIndex);
  }, [currentTextIndex, texts.length, loop, handleIndexChange]);

  useImperativeHandle(ref, () => ({
    next,
    previous,
    jumpTo: (index: number) => {
      const clamped = Math.max(0, Math.min(index, texts.length - 1));
      if (clamped !== currentTextIndex) handleIndexChange(clamped);
    },
    reset: () => {
      if (currentTextIndex !== 0) handleIndexChange(0);
    },
  }), [next, previous, currentTextIndex, texts.length, handleIndexChange]);

  useEffect(() => {
    if (!auto || texts.length <= 1) return;
    const interval = setInterval(next, rotationInterval);
    return () => clearInterval(interval);
  }, [auto, rotationInterval, next, texts.length]);

  // Reduced motion: tampilkan teks polos dengan crossfade ringan
  if (reducedMotion) {
    return (
      <span className={cn("inline-flex", mainClassName)}>
        <AnimatePresence mode="wait">
          <motion.span
            key={currentTextIndex}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {currentText}
          </motion.span>
        </AnimatePresence>
      </span>
    );
  }

  let charIndex = 0;

  return (
    <span className={cn("relative inline-flex", mainClassName)}>
      <span className="sr-only">{currentText}</span>
      <AnimatePresence mode="wait">
        <motion.span
          key={currentTextIndex}
          className="flex flex-wrap whitespace-pre-wrap relative"
          aria-hidden="true"
        >
          {elements.map((word, wordIndex) => (
            <span key={wordIndex} className={cn("inline-flex overflow-hidden", splitLevelClassName)}>
              {word.characters.map((char, i) => {
                const delay = getStaggerDelay(charIndex);
                charIndex += 1;
                return (
                  <motion.span
                    key={i}
                    initial={initial}
                    animate={animate}
                    exit={exit}
                    transition={{ ...transition, delay }}
                    className={cn("inline-block", elementLevelClassName)}
                  >
                    {char}
                  </motion.span>
                );
              })}
              {word.needsSpace && <span className="whitespace-pre"> </span>}
            </span>
          ))}
        </motion.span>
      </AnimatePresence>
    </span>
  );
});

export default TextRotate;
