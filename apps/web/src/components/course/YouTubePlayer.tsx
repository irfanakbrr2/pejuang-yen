"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/refs, @typescript-eslint/no-unused-expressions */

import { useReducer, useEffect, useRef, useCallback, useId } from "react";
import {
  Play, Pause, Volume2, VolumeX,
  Maximize, Minimize, RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export interface YouTubePlayerProps {
  videoUrl: string;
  title?: string;
  onEnded?: () => void;
  autoPlay?: boolean;
  /** Called from the existing 500ms progress poll while playing. */
  onProgress?: (currentTime: number, duration: number) => void;
}

// ─── State / Reducer ──────────────────────────────────────────────────────────

type PlayerState = {
  isReady: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  duration: number;
  currentTime: number;
  isBuffering: boolean;
  showControls: boolean;
  rate: number;
  isFullscreen: boolean;
  hasStarted: boolean;
  hasEnded: boolean;
  showRateMenu: boolean;
  isDragging: boolean;
  quality: string;
  availableQualities: string[];
  showQualityMenu: boolean;
};

type PlayerAction =
  | { type: "READY"; duration: number }
  | { type: "PLAY"; duration?: number }
  | { type: "PAUSE" }
  | { type: "END" }
  | { type: "BUFFER" }
  | { type: "TICK"; currentTime: number; duration?: number }
  | { type: "SEEK"; currentTime: number }
  | { type: "TOGGLE_MUTE" }
  | { type: "SET_RATE"; rate: number }
  | { type: "SET_FULLSCREEN"; isFullscreen: boolean }
  | { type: "SHOW_CONTROLS" }
  | { type: "HIDE_CONTROLS" }
  | { type: "TOGGLE_RATE_MENU" }
  | { type: "CLOSE_RATE_MENU" }
  | { type: "SET_QUALITIES"; availableQualities: string[]; quality?: string }
  | { type: "SET_QUALITY"; quality: string }
  | { type: "TOGGLE_QUALITY_MENU" }
  | { type: "CLOSE_QUALITY_MENU" }
  | { type: "SET_DRAGGING"; isDragging: boolean }
  | { type: "RESET" };

const initialState: PlayerState = {
  isReady: false,
  isPlaying: false,
  isMuted: false,
  duration: 0,
  currentTime: 0,
  isBuffering: false,
  showControls: true,
  rate: 1,
  isFullscreen: false,
  hasStarted: false,
  hasEnded: false,
  showRateMenu: false,
  isDragging: false,
  quality: "auto",
  availableQualities: [],
  showQualityMenu: false,
};

function playerReducer(state: PlayerState, action: PlayerAction): PlayerState {
  switch (action.type) {
    case "READY":
      return { ...state, isReady: true, duration: action.duration };
    case "PLAY":
      return {
        ...state, isPlaying: true, isBuffering: false, hasStarted: true, hasEnded: false, showControls: true,
        duration: action.duration ?? state.duration,
      };
    case "PAUSE":
      return { ...state, isPlaying: false, showControls: true };
    case "END":
      return { ...state, isPlaying: false, hasEnded: true, showControls: true };
    case "BUFFER":
      return { ...state, isBuffering: true };
    case "TICK":
      return {
        ...state,
        currentTime: action.currentTime,
        duration: action.duration ?? state.duration,
      };
    case "SEEK":
      return { ...state, currentTime: action.currentTime };
    case "TOGGLE_MUTE":
      return { ...state, isMuted: !state.isMuted };
    case "SET_RATE":
      return { ...state, rate: action.rate, showRateMenu: false };
    case "SET_FULLSCREEN":
      return { ...state, isFullscreen: action.isFullscreen };
    case "SHOW_CONTROLS":
      return { ...state, showControls: true };
    case "HIDE_CONTROLS":
      return { ...state, showControls: false };
    case "TOGGLE_RATE_MENU":
      return { ...state, showRateMenu: !state.showRateMenu, showQualityMenu: false };
    case "CLOSE_RATE_MENU":
      return { ...state, showRateMenu: false };
    case "SET_QUALITIES":
      return {
        ...state,
        availableQualities: action.availableQualities,
        quality: action.quality ?? state.quality,
      };
    case "SET_QUALITY":
      return { ...state, quality: action.quality, showQualityMenu: false };
    case "TOGGLE_QUALITY_MENU":
      return { ...state, showQualityMenu: !state.showQualityMenu, showRateMenu: false };
    case "CLOSE_QUALITY_MENU":
      return { ...state, showQualityMenu: false };
    case "SET_DRAGGING":
      return { ...state, isDragging: action.isDragging };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function formatTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Singleton: ensure the YT script is loaded only once
let ytApiLoaded = false;
let ytApiCallbacks: (() => void)[] = [];

function loadYTApi(cb: () => void) {
  if (typeof window === "undefined") return;
  if (window.YT?.Player) { cb(); return; }
  ytApiCallbacks.push(cb);
  if (ytApiLoaded) return;
  ytApiLoaded = true;
  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    prev?.();
    ytApiCallbacks.forEach(fn => fn());
    ytApiCallbacks = [];
  };
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);
}

// ─── Component ────────────────────────────────────────────────────────────────

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

// YouTube quality level → label manusiawi, urut dari tertinggi.
const QUALITY_LABELS: Record<string, string> = {
  hd2160: "4K",
  hd1440: "1440p",
  hd1080: "1080p",
  hd720: "720p",
  large: "480p",
  medium: "360p",
  small: "240p",
  tiny: "144p",
  auto: "Auto",
  default: "Auto",
};
const QUALITY_ORDER = ["hd2160", "hd1440", "hd1080", "hd720", "large", "medium", "small", "tiny"];

function qualityLabel(q: string): string {
  return QUALITY_LABELS[q] ?? "Auto";
}

// Urutkan level dari tertinggi ke terendah, lalu sisipkan "auto" di paling atas.
function sortQualities(levels: string[]): string[] {
  const known = levels
    .filter((l) => QUALITY_ORDER.includes(l))
    .sort((a, b) => QUALITY_ORDER.indexOf(a) - QUALITY_ORDER.indexOf(b));
  return ["auto", ...known];
}

export default function YouTubePlayer({ videoUrl, title, onEnded, autoPlay, onProgress }: YouTubePlayerProps) {
  const uid = useId().replace(/:/g, "");
  const iframeId = `yt-player-${uid}`;
  const videoId = extractVideoId(videoUrl);

  const [state, dispatch] = useReducer(playerReducer, initialState);
  // Stable ref to current state — avoids re-registering event listeners on state changes
  const stateRef = useRef(state);
  stateRef.current = state;

  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref so the stable poll callback always sees the latest onProgress
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  const progress = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

  // ── Progress polling ────────────────────────────────────────────────────────

  const startProgressPoll = useCallback(() => {
    if (progressIntervalRef.current) return;
    progressIntervalRef.current = setInterval(() => {
      if (!playerRef.current) return;
      try {
        const t = playerRef.current.getCurrentTime?.() ?? 0;
        const d = playerRef.current.getDuration?.() ?? 0;
        dispatch({ type: "TICK", currentTime: t, duration: d > 0 ? d : undefined });
        if (d > 0) onProgressRef.current?.(t, d);
      } catch { /* player not ready */ }
    }, 500);
  }, []);

  const stopProgressPoll = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  // ── Auto-hide controls ──────────────────────────────────────────────────────

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => dispatch({ type: "HIDE_CONTROLS" }), 3000);
  }, []);

  const revealControls = useCallback(() => {
    dispatch({ type: "SHOW_CONTROLS" });
    if (stateRef.current.isPlaying) scheduleHide();
  }, [scheduleHide]);

  // ── YT API init ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!videoId) return;
    dispatch({ type: "RESET" }); // new lesson video → re-show splash, clear ended/started
    loadYTApi(() => {
      if (playerRef.current) return;
      playerRef.current = new window.YT.Player(iframeId, {
        videoId,
        playerVars: { controls: 0, rel: 0, modestbranding: 1, showinfo: 0, enablejsapi: 1, playsinline: 1, color: "white", fs: 0, origin: window.location.origin },
        events: {
          onReady: (e: any) => {
            const d = e.target.getDuration?.() ?? 0;
            dispatch({ type: "READY", duration: d });
            if (autoPlay) e.target.playVideo();
          },
          onStateChange: (e: any) => {
            const s = e.data;
            if (s === 1) { // PLAYING
              const d = playerRef.current?.getDuration?.() ?? 0;
              dispatch({ type: "PLAY", duration: d > 0 ? d : undefined });
              startProgressPoll();
              scheduleHide();
            }
            if (s === 2) { dispatch({ type: "PAUSE" }); stopProgressPoll(); if (hideTimerRef.current) clearTimeout(hideTimerRef.current); }
            if (s === 0) { dispatch({ type: "END" }); stopProgressPoll(); if (hideTimerRef.current) clearTimeout(hideTimerRef.current); onEnded?.(); }
            if (s === 3) dispatch({ type: "BUFFER" });
            // Level kualitas baru tersedia setelah playback mulai (PLAYING/BUFFER).
            if (s === 1 || s === 3) {
              try {
                const levels = playerRef.current?.getAvailableQualityLevels?.() ?? [];
                if (Array.isArray(levels) && levels.length > 0) {
                  const current = playerRef.current?.getPlaybackQuality?.() ?? "auto";
                  dispatch({ type: "SET_QUALITIES", availableQualities: sortQualities(levels), quality: current });
                }
              } catch { /* player not ready */ }
            }
          },
          onPlaybackQualityChange: (e: any) => {
            if (typeof e?.data === "string") dispatch({ type: "SET_QUALITY", quality: e.data });
          },
          onError: () => dispatch({ type: "PAUSE" }),
        },
      });
    });
    return () => {
      stopProgressPoll();
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      try { playerRef.current?.destroy?.(); } catch { /* ignore */ }
      playerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // ── Fullscreen listener ─────────────────────────────────────────────────────

  useEffect(() => {
    const onFsChange = () => dispatch({ type: "SET_FULLSCREEN", isFullscreen: !!document.fullscreenElement });
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // ── Keyboard shortcuts — registered ONCE, reads state via ref ───────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["INPUT", "SELECT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;
      if (!containerRef.current?.contains(document.activeElement) && document.activeElement !== document.body) return;
      const { isReady, isPlaying, isMuted, currentTime, duration } = stateRef.current;
      if (e.code === "Space") {
        e.preventDefault();
        if (!isReady) return;
        isPlaying ? playerRef.current?.pauseVideo() : playerRef.current?.playVideo();
      }
      if (e.code === "ArrowRight" && duration > 0) {
        const t = Math.min(currentTime + 5, duration);
        playerRef.current?.seekTo(t, true);
        dispatch({ type: "SEEK", currentTime: t });
      }
      if (e.code === "ArrowLeft") {
        const t = Math.max(currentTime - 5, 0);
        playerRef.current?.seekTo(t, true);
        dispatch({ type: "SEEK", currentTime: t });
      }
      if (e.code === "KeyM") {
        if (!isReady) return;
        isMuted ? playerRef.current?.unMute() : playerRef.current?.mute();
        dispatch({ type: "TOGGLE_MUTE" });
      }
      if (e.code === "KeyF") {
        if (!containerRef.current) return;
        document.fullscreenElement ? document.exitFullscreen?.() : containerRef.current.requestFullscreen?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []); // empty deps — handler is stable via stateRef

  // ── Controls ────────────────────────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    if (!stateRef.current.isReady) return;
    stateRef.current.isPlaying ? playerRef.current?.pauseVideo() : playerRef.current?.playVideo();
  }, []);

  const toggleMute = useCallback(() => {
    if (!stateRef.current.isReady) return;
    stateRef.current.isMuted ? playerRef.current?.unMute() : playerRef.current?.mute();
    dispatch({ type: "TOGGLE_MUTE" });
    revealControls();
  }, [revealControls]);

  const seek = useCallback((pct: number) => {
    const { isReady, duration } = stateRef.current;
    if (!isReady || duration === 0) return;
    const t = Math.max(0, Math.min(1, pct)) * duration;
    playerRef.current?.seekTo(t, true);
    dispatch({ type: "SEEK", currentTime: t });
  }, []);

  const changeRate = useCallback((r: number) => {
    if (!stateRef.current.isReady) return;
    playerRef.current?.setPlaybackRate(r);
    dispatch({ type: "SET_RATE", rate: r });
    revealControls();
  }, [revealControls]);

  const changeQuality = useCallback((q: string) => {
    if (!stateRef.current.isReady) return;
    // Catatan: setPlaybackQuality bersifat saran — YouTube bisa menyesuaikan
    // ulang sesuai bandwidth. Kualitas aktual dikonfirmasi via onPlaybackQualityChange.
    try { playerRef.current?.setPlaybackQuality?.(q); } catch { /* ignore */ }
    dispatch({ type: "SET_QUALITY", quality: q });
    revealControls();
  }, [revealControls]);

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    document.fullscreenElement ? document.exitFullscreen?.() : containerRef.current.requestFullscreen?.();
  }, []);

  const restart = useCallback(() => {
    if (!stateRef.current.isReady) return;
    playerRef.current?.seekTo(0, true);
    playerRef.current?.playVideo();
    dispatch({ type: "SEEK", currentTime: 0 });
    revealControls();
  }, [revealControls]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!videoId) {
    return (
      <div className="w-full aspect-video bg-gray-900 rounded-2xl flex items-center justify-center">
        <p className="text-sm text-white/40">Video tidak tersedia</p>
      </div>
    );
  }

  const { isPlaying, isMuted, isReady, isBuffering, hasStarted, hasEnded, showControls, rate, isFullscreen, isDragging, showRateMenu, duration, currentTime, quality, availableQualities, showQualityMenu } = state;
  const controlsVisible = showControls || !isPlaying || isDragging;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative w-full bg-black rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.4)] group",
        "select-none outline-none",
        isFullscreen && "rounded-none"
      )}
      tabIndex={0}
      onMouseMove={revealControls}
      onMouseLeave={() => isPlaying && dispatch({ type: "HIDE_CONTROLS" })}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-controls]")) return;
        togglePlay();
      }}
    >
      {/* ── YouTube iframe ── */}
      <div className="aspect-video w-full">
        <div id={iframeId} className="w-full h-full" />
      </div>

      {/* ── Click/right-click shield over the cross-origin iframe ──
          Sits above the iframe (z-[1]) but below all controls. Catches
          pointer events so YouTube's native context menu / "Watch on
          YouTube" link never fire; left-clicks bubble to the container
          → togglePlay. */}
      <div className="absolute inset-0 z-[1]" aria-hidden="true" />

      {/* ── Thumbnail splash (before first play) ── */}
      {!hasStarted && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
            alt={title || "Video thumbnail"}
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`; }}
          />
          <div className="absolute inset-0 bg-black/30" />
          <button
            data-controls
            onClick={(e) => { e.stopPropagation(); playerRef.current?.playVideo(); }}
            className={cn(
              "relative z-10 w-20 h-20 rounded-full bg-[#8B1414] shadow-[0_8px_32px_rgba(139,20,20,0.5)]",
              "flex items-center justify-center hover:scale-110 hover:bg-[#6E0F0F]",
              "transition-all duration-200",
              !isReady && "opacity-50 cursor-wait"
            )}
          >
            <Play className="h-8 w-8 text-white ml-1" fill="white" />
          </button>
          {title && (
            <div className="absolute bottom-0 left-0 right-0 px-5 pb-5 bg-gradient-to-t from-black/70 to-transparent pointer-events-none">
              <p className="text-white/90 text-sm font-semibold">{title}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Buffering spinner ── */}
      {isBuffering && hasStarted && (
        <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
          <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* ── End-screen cover ──
          Hides YouTube's related-videos / channel end screen when the
          video finishes, replacing it with a clean replay card. */}
      {hasEnded && (
        <div
          data-controls
          className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
            alt={title || "Video selesai"}
            className="absolute inset-0 w-full h-full object-cover opacity-40"
            onError={(e) => { (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`; }}
          />
          <div className="absolute inset-0 bg-black/60" />
          <button
            data-controls
            onClick={(e) => { e.stopPropagation(); restart(); }}
            className={cn(
              "relative z-10 w-16 h-16 rounded-full bg-[#8B1414] shadow-[0_8px_32px_rgba(139,20,20,0.5)]",
              "flex items-center justify-center hover:scale-110 hover:bg-[#6E0F0F] transition-all duration-200"
            )}
            aria-label="Putar ulang"
          >
            <RotateCcw className="h-7 w-7 text-white" />
          </button>
          <span className="relative z-10 mt-3 text-white/80 text-xs font-semibold tracking-wide">Putar ulang</span>
        </div>
      )}

      {/* ── Branding ── */}
      <div className={cn("absolute top-3 left-3 z-10 pointer-events-none transition-opacity duration-300", controlsVisible ? "opacity-100" : "opacity-0")}>
        <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-lg px-2.5 py-1.5">
          <div className="w-5 h-5 bg-[#8B1414] rounded-[5px] flex items-center justify-center shrink-0">
            <span className="text-white font-extrabold text-[9px]">G</span>
          </div>
          <span className="text-white/70 text-[11px] font-semibold tracking-wide">PejuangYen</span>
        </div>
      </div>

      {/* ── Center play/pause button ── */}
      {hasStarted && (
        <div className={cn("absolute inset-0 z-10 flex items-center justify-center pointer-events-none transition-opacity duration-200", controlsVisible ? "opacity-100" : "opacity-0")}>
          <button
            data-controls
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className={cn(
              "pointer-events-auto w-14 h-14 rounded-full",
              "bg-white/15 backdrop-blur-sm border border-white/20",
              "flex items-center justify-center hover:bg-white/25 hover:scale-110",
              "transition-all duration-150"
            )}
          >
            {isPlaying
              ? <Pause className="h-6 w-6 text-white" fill="white" />
              : <Play className="h-6 w-6 text-white ml-0.5" fill="white" />
            }
          </button>
        </div>
      )}

      {/* ── Bottom controls bar ── */}
      {hasStarted && (
        <div
          data-controls
          className={cn(
            "absolute bottom-0 left-0 right-0 z-20",
            "bg-gradient-to-t from-black/90 via-black/50 to-transparent",
            "px-4 pb-3.5 pt-14 transition-opacity duration-300",
            controlsVisible ? "opacity-100" : "opacity-0"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Seekbar */}
          <div className="relative mb-3 group/seek">
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={progress}
              onChange={(e) => seek(Number(e.target.value) / 100)}
              onMouseDown={() => dispatch({ type: "SET_DRAGGING", isDragging: true })}
              onMouseUp={() => dispatch({ type: "SET_DRAGGING", isDragging: false })}
              onTouchStart={() => dispatch({ type: "SET_DRAGGING", isDragging: true })}
              onTouchEnd={() => dispatch({ type: "SET_DRAGGING", isDragging: false })}
              className={cn(
                "w-full h-1 rounded-full appearance-none cursor-pointer",
                "group-hover/seek:h-1.5 transition-all duration-150",
                "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5",
                "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-sm",
                "[&::-webkit-slider-thumb]:opacity-0 group-hover/seek:[&::-webkit-slider-thumb]:opacity-100",
                "[&::-webkit-slider-thumb]:transition-opacity [&::-webkit-slider-thumb]:duration-150",
                "[&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-none"
              )}
              style={{ background: `linear-gradient(to right, #8B1414 ${progress}%, rgba(255,255,255,0.25) ${progress}%)` }}
            />
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-2">
            <button onClick={togglePlay} className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors">
              {isPlaying ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4 ml-0.5" fill="currentColor" />}
            </button>
            <button onClick={restart} className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors">
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button onClick={toggleMute} className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors">
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <span className="text-white/70 text-[11px] font-mono tabular-nums ml-0.5">
              {formatTime(currentTime)}<span className="text-white/40 mx-1">/</span>{formatTime(duration)}
            </span>
            <div className="flex-1" />
            <div className="relative">
              <button
                onClick={() => dispatch({ type: "TOGGLE_RATE_MENU" })}
                className="px-2 py-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 text-[11px] font-semibold transition-colors min-w-[36px] text-center"
              >
                {rate}×
              </button>
              {showRateMenu && (
                <div className="absolute bottom-full right-0 mb-2 bg-gray-900/95 backdrop-blur-sm rounded-xl overflow-hidden shadow-xl border border-white/10 py-1 min-w-[72px]">
                  {RATES.map((r) => (
                    <button
                      key={r}
                      onClick={() => changeRate(r)}
                      className={cn(
                        "w-full px-4 py-1.5 text-[11px] text-left transition-colors",
                        r === rate ? "text-[#8B1414] bg-white/5 font-semibold" : "text-white/70 hover:text-white hover:bg-white/10"
                      )}
                    >
                      {r}×
                    </button>
                  ))}
                </div>
              )}
            </div>
            {availableQualities.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => dispatch({ type: "TOGGLE_QUALITY_MENU" })}
                  className="px-2 py-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 text-[11px] font-semibold transition-colors min-w-[44px] text-center"
                  aria-label="Kualitas video"
                >
                  {qualityLabel(quality)}
                </button>
                {showQualityMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-gray-900/95 backdrop-blur-sm rounded-xl overflow-hidden shadow-xl border border-white/10 py-1 min-w-[88px]">
                    {availableQualities.map((q) => (
                      <button
                        key={q}
                        onClick={() => changeQuality(q)}
                        className={cn(
                          "w-full px-4 py-1.5 text-[11px] text-left transition-colors",
                          q === quality ? "text-[#8B1414] bg-white/5 font-semibold" : "text-white/70 hover:text-white hover:bg-white/10"
                        )}
                      >
                        {qualityLabel(q)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <button onClick={toggleFullscreen} className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors">
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
