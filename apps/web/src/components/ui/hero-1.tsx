"use client";

import * as React from "react";
import { Search } from "lucide-react";

interface Hero1Props {
  badgeText: string;
  badgeEmoji?: string;
  title: React.ReactNode;
  subtitle: string;
  searchValue: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder?: string;
  children?: React.ReactNode;
}

const Hero1 = ({
  badgeText,
  badgeEmoji = "🎉",
  title,
  subtitle,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  children,
}: Hero1Props) => {
  return (
    <div className="w-full bg-[#0c0414] text-white flex flex-col relative overflow-hidden rounded-3xl mb-8">
      {/* Gradient (No green color, using blue/white as requested) */}
      <div className="flex gap-[10rem] rotate-[-20deg] absolute top-[-20rem] right-[-10rem] z-[0] blur-[4rem] skew-[-40deg] opacity-40">
        <div className="w-[10rem] h-[20rem] bg-gradient-to-r from-white to-blue-300"></div>
        <div className="w-[10rem] h-[20rem] bg-gradient-to-r from-white to-blue-300"></div>
        <div className="w-[10rem] h-[20rem] bg-gradient-to-r from-white to-blue-300"></div>
      </div>
      
      <div className="flex gap-[10rem] rotate-[-20deg] absolute top-[-10rem] left-[-20rem] z-[0] blur-[4rem] skew-[-40deg] opacity-20">
        <div className="w-[10rem] h-[20rem] bg-gradient-to-r from-blue-300 to-indigo-400"></div>
        <div className="w-[10rem] h-[20rem] bg-gradient-to-r from-blue-300 to-indigo-400"></div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-20 md:py-24 text-center relative z-10 w-full">
        <div className="w-full max-w-4xl mx-auto space-y-6">
          <div className="flex-1 flex justify-center">
            <div className="bg-[#1c1528] rounded-full px-4 py-2 flex items-center gap-2 w-fit mx-4 border border-white/10 shadow-xl">
              <span className="text-xs flex items-center gap-2 font-medium">
                <span className="bg-black/50 p-1 rounded-full">{badgeEmoji}</span>
                {badgeText}
              </span>
            </div>
          </div>
          
          {/* Headline */}
          <h1 className="text-4xl md:text-5xl font-bold leading-tight tracking-tight">
            {title}
          </h1>

          {/* Subtitle */}
          <p className="text-base md:text-lg text-gray-300 max-w-2xl mx-auto">
            {subtitle}
          </p>

          {/* Search bar */}
          <div className="relative max-w-xl mx-auto w-full pt-8">
            <div className="bg-[#1c1528] border border-white/10 rounded-full p-2 flex items-center shadow-2xl">
              <button className="p-3 rounded-full hover:bg-[#2a1f3d] transition-all">
                <Search className="w-5 h-5 text-gray-400" />
              </button>
              <input
                type="text"
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="!bg-transparent flex-1 outline-none !text-white placeholder:!text-gray-400 pl-2 pr-4 text-base"
                style={{ backgroundColor: "transparent" }}
              />
            </div>
          </div>

          {children && (
            <div className="w-full pt-6 flex justify-center">
              {children}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export { Hero1 };
