"use client";
/* eslint-disable react-hooks/refs, react-hooks/set-state-in-effect */

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

interface PupilProps {
  size?: number;
  maxDistance?: number;
  pupilColor?: string;
  forceLookX?: number;
  forceLookY?: number;
}

function Pupil({
  size = 12,
  maxDistance = 5,
  pupilColor = "#2D2D2D",
  forceLookX,
  forceLookY,
}: PupilProps) {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const pupilRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const getPosition = () => {
    if (!pupilRef.current) return { x: 0, y: 0 };
    if (forceLookX !== undefined && forceLookY !== undefined) {
      return { x: forceLookX, y: forceLookY };
    }
    const rect = pupilRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = mouseX - cx;
    const dy = mouseY - cy;
    const dist = Math.min(Math.sqrt(dx ** 2 + dy ** 2), maxDistance);
    const angle = Math.atan2(dy, dx);
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
  };

  const pos = getPosition();

  return (
    <div
      ref={pupilRef}
      className="rounded-full"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: pupilColor,
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        transition: "transform 0.1s ease-out",
      }}
    />
  );
}

interface EyeBallProps {
  size?: number;
  pupilSize?: number;
  maxDistance?: number;
  eyeColor?: string;
  pupilColor?: string;
  isBlinking?: boolean;
  forceLookX?: number;
  forceLookY?: number;
}

function EyeBall({
  size = 48,
  pupilSize = 16,
  maxDistance = 10,
  eyeColor = "white",
  pupilColor = "#2D2D2D",
  isBlinking = false,
  forceLookX,
  forceLookY,
}: EyeBallProps) {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const eyeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const getPosition = () => {
    if (!eyeRef.current) return { x: 0, y: 0 };
    if (forceLookX !== undefined && forceLookY !== undefined) {
      return { x: forceLookX, y: forceLookY };
    }
    const rect = eyeRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = mouseX - cx;
    const dy = mouseY - cy;
    const dist = Math.min(Math.sqrt(dx ** 2 + dy ** 2), maxDistance);
    const angle = Math.atan2(dy, dx);
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
  };

  const pos = getPosition();

  return (
    <div
      ref={eyeRef}
      className="rounded-full flex items-center justify-center transition-all duration-150"
      style={{
        width: `${size}px`,
        height: isBlinking ? "2px" : `${size}px`,
        backgroundColor: eyeColor,
        overflow: "hidden",
      }}
    >
      {!isBlinking && (
        <div
          className="rounded-full"
          style={{
            width: `${pupilSize}px`,
            height: `${pupilSize}px`,
            backgroundColor: pupilColor,
            transform: `translate(${pos.x}px, ${pos.y}px)`,
            transition: "transform 0.1s ease-out",
          }}
        />
      )}
    </div>
  );
}

export interface AnimatedCharactersPanelProps {
  isTyping?: boolean;
  password?: string;
  showPassword?: boolean;
}

export function AnimatedCharactersPanel({
  isTyping = false,
  password = "",
  showPassword = false,
}: AnimatedCharactersPanelProps) {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const [isPurpleBlinking, setIsPurpleBlinking] = useState(false);
  const [isBlackBlinking, setIsBlackBlinking] = useState(false);
  const [isLookingAtEachOther, setIsLookingAtEachOther] = useState(false);
  const [isPurplePeeking, setIsPurplePeeking] = useState(false);

  const purpleRef = useRef<HTMLDivElement>(null);
  const blackRef = useRef<HTMLDivElement>(null);
  const yellowRef = useRef<HTMLDivElement>(null);
  const orangeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Purple blinking
  useEffect(() => {
    const schedule = () => {
      const t = setTimeout(() => {
        setIsPurpleBlinking(true);
        setTimeout(() => {
          setIsPurpleBlinking(false);
          schedule();
        }, 150);
      }, Math.random() * 4000 + 3000);
      return t;
    };
    const t = schedule();
    return () => clearTimeout(t);
  }, []);

  // Black blinking
  useEffect(() => {
    const schedule = () => {
      const t = setTimeout(() => {
        setIsBlackBlinking(true);
        setTimeout(() => {
          setIsBlackBlinking(false);
          schedule();
        }, 150);
      }, Math.random() * 4000 + 3000);
      return t;
    };
    const t = schedule();
    return () => clearTimeout(t);
  }, []);

  // Look at each other when typing
  useEffect(() => {
    if (isTyping) {
      setIsLookingAtEachOther(true);
      const t = setTimeout(() => setIsLookingAtEachOther(false), 800);
      return () => clearTimeout(t);
    } else {
      setIsLookingAtEachOther(false);
    }
  }, [isTyping]);

  // Purple sneaky peeking when password is visible
  useEffect(() => {
    if (password.length > 0 && showPassword) {
      const t = setTimeout(() => {
        setIsPurplePeeking(true);
        setTimeout(() => setIsPurplePeeking(false), 800);
      }, Math.random() * 3000 + 2000);
      return () => clearTimeout(t);
    } else {
      setIsPurplePeeking(false);
    }
  }, [password, showPassword, isPurplePeeking]);

  const calculatePos = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return { faceX: 0, faceY: 0, bodySkew: 0 };
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 3;
    const dx = mouseX - cx;
    const dy = mouseY - cy;
    return {
      faceX: Math.max(-15, Math.min(15, dx / 20)),
      faceY: Math.max(-10, Math.min(10, dy / 30)),
      bodySkew: Math.max(-6, Math.min(6, -dx / 120)),
    };
  };

  const purplePos = calculatePos(purpleRef);
  const blackPos = calculatePos(blackRef);
  const yellowPos = calculatePos(yellowRef);
  const orangePos = calculatePos(orangeRef);

  const isCovering = password.length > 0 && !showPassword;
  const isPeeking = password.length > 0 && showPassword;

  return (
    <div className="relative hidden lg:flex flex-col justify-between bg-[#0C4A38] p-12 text-white overflow-hidden">
      {/* Header */}
      <div className="relative z-20">
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-3 py-2 inline-flex">
          <Image src="/logo.png" alt="PejuangYen" width={140} height={36} priority className="h-8 w-auto" />
        </div>
      </div>

      {/* Characters */}
      <div className="relative z-20 flex items-end justify-center h-[500px]">
        <div className="relative" style={{ width: "550px", height: "400px" }}>
          {/* Purple tall — back layer */}
          <div
            ref={purpleRef}
            className="absolute bottom-0 transition-all duration-700 ease-in-out"
            style={{
              left: "70px",
              width: "180px",
              height: isCovering ? "440px" : "400px",
              backgroundColor: "#6C3FF5",
              borderRadius: "10px 10px 0 0",
              zIndex: 1,
              transform: isPeeking
                ? "skewX(0deg)"
                : isCovering
                ? `skewX(${(purplePos.bodySkew || 0) - 12}deg) translateX(40px)`
                : `skewX(${purplePos.bodySkew || 0}deg)`,
              transformOrigin: "bottom center",
            }}
          >
            <div
              className="absolute flex gap-8 transition-all duration-700 ease-in-out"
              style={{
                left: isPeeking ? "20px" : isLookingAtEachOther ? "55px" : `${45 + purplePos.faceX}px`,
                top: isPeeking ? "35px" : isLookingAtEachOther ? "65px" : `${40 + purplePos.faceY}px`,
              }}
            >
              <EyeBall
                size={18} pupilSize={7} maxDistance={5}
                eyeColor="white" pupilColor="#2D2D2D"
                isBlinking={isPurpleBlinking}
                forceLookX={isPeeking ? (isPurplePeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined}
                forceLookY={isPeeking ? (isPurplePeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined}
              />
              <EyeBall
                size={18} pupilSize={7} maxDistance={5}
                eyeColor="white" pupilColor="#2D2D2D"
                isBlinking={isPurpleBlinking}
                forceLookX={isPeeking ? (isPurplePeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined}
                forceLookY={isPeeking ? (isPurplePeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined}
              />
            </div>
          </div>

          {/* Black tall — middle layer */}
          <div
            ref={blackRef}
            className="absolute bottom-0 transition-all duration-700 ease-in-out"
            style={{
              left: "240px",
              width: "120px",
              height: "310px",
              backgroundColor: "#2D2D2D",
              borderRadius: "8px 8px 0 0",
              zIndex: 2,
              transform: isPeeking
                ? "skewX(0deg)"
                : isLookingAtEachOther
                ? `skewX(${(blackPos.bodySkew || 0) * 1.5 + 10}deg) translateX(20px)`
                : isCovering
                ? `skewX(${(blackPos.bodySkew || 0) * 1.5}deg)`
                : `skewX(${blackPos.bodySkew || 0}deg)`,
              transformOrigin: "bottom center",
            }}
          >
            <div
              className="absolute flex gap-6 transition-all duration-700 ease-in-out"
              style={{
                left: isPeeking ? "10px" : isLookingAtEachOther ? "32px" : `${26 + blackPos.faceX}px`,
                top: isPeeking ? "28px" : isLookingAtEachOther ? "12px" : `${32 + blackPos.faceY}px`,
              }}
            >
              <EyeBall
                size={16} pupilSize={6} maxDistance={4}
                eyeColor="white" pupilColor="#2D2D2D"
                isBlinking={isBlackBlinking}
                forceLookX={isPeeking ? -4 : isLookingAtEachOther ? 0 : undefined}
                forceLookY={isPeeking ? -4 : isLookingAtEachOther ? -4 : undefined}
              />
              <EyeBall
                size={16} pupilSize={6} maxDistance={4}
                eyeColor="white" pupilColor="#2D2D2D"
                isBlinking={isBlackBlinking}
                forceLookX={isPeeking ? -4 : isLookingAtEachOther ? 0 : undefined}
                forceLookY={isPeeking ? -4 : isLookingAtEachOther ? -4 : undefined}
              />
            </div>
          </div>

          {/* Orange semi-circle — front left */}
          <div
            ref={orangeRef}
            className="absolute bottom-0 transition-all duration-700 ease-in-out"
            style={{
              left: "0px",
              width: "240px",
              height: "200px",
              zIndex: 3,
              backgroundColor: "#FF9B6B",
              borderRadius: "120px 120px 0 0",
              transform: isPeeking ? "skewX(0deg)" : `skewX(${orangePos.bodySkew || 0}deg)`,
              transformOrigin: "bottom center",
            }}
          >
            <div
              className="absolute flex gap-8 transition-all duration-200 ease-out"
              style={{
                left: isPeeking ? "50px" : `${82 + (orangePos.faceX || 0)}px`,
                top: isPeeking ? "85px" : `${90 + (orangePos.faceY || 0)}px`,
              }}
            >
              <Pupil size={12} maxDistance={5} forceLookX={isPeeking ? -5 : undefined} forceLookY={isPeeking ? -4 : undefined} />
              <Pupil size={12} maxDistance={5} forceLookX={isPeeking ? -5 : undefined} forceLookY={isPeeking ? -4 : undefined} />
            </div>
          </div>

          {/* Yellow capsule — front right */}
          <div
            ref={yellowRef}
            className="absolute bottom-0 transition-all duration-700 ease-in-out"
            style={{
              left: "310px",
              width: "140px",
              height: "230px",
              backgroundColor: "#E8D754",
              borderRadius: "70px 70px 0 0",
              zIndex: 4,
              transform: isPeeking ? "skewX(0deg)" : `skewX(${yellowPos.bodySkew || 0}deg)`,
              transformOrigin: "bottom center",
            }}
          >
            <div
              className="absolute flex gap-6 transition-all duration-200 ease-out"
              style={{
                left: isPeeking ? "20px" : `${52 + (yellowPos.faceX || 0)}px`,
                top: isPeeking ? "35px" : `${40 + (yellowPos.faceY || 0)}px`,
              }}
            >
              <Pupil size={12} maxDistance={5} forceLookX={isPeeking ? -5 : undefined} forceLookY={isPeeking ? -4 : undefined} />
              <Pupil size={12} maxDistance={5} forceLookX={isPeeking ? -5 : undefined} forceLookY={isPeeking ? -4 : undefined} />
            </div>
            <div
              className="absolute w-20 h-[4px] bg-[#2D2D2D] rounded-full transition-all duration-200 ease-out"
              style={{
                left: isPeeking ? "10px" : `${40 + (yellowPos.faceX || 0)}px`,
                top: isPeeking ? "88px" : `${88 + (yellowPos.faceY || 0)}px`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-20 flex items-center gap-8 text-sm text-white/60">
        <Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link>
        <Link href="#" className="hover:text-white transition-colors">Terms of Service</Link>
        <Link href="#" className="hover:text-white transition-colors">Contact</Link>
      </div>

      {/* Decorative blobs */}
      <div className="absolute top-1/4 right-1/4 size-64 bg-white/6 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 size-96 bg-white/4 rounded-full blur-3xl pointer-events-none" />
    </div>
  );
}
