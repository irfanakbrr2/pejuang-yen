"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Lock, PlayCircle } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { track } from "@/lib/tracking/client";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/Button";
import YouTubePlayer from "@/components/course/YouTubePlayer";

interface RecordingDetail {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  body_html: string;
  replay_body_html: string;
  thumbnail_url: string;
  starts_at: string;
  category: string;
  format: string;
  tags: string;
  recording_url: string;
  recording_embed_url: string;
  replay_status: string;
}

function getEmbedUrl(url: string): string {
  if (!url) return "";
  
  try {
    const urlStr = String(url);
    // YouTube
    if (urlStr.includes("youtube.com") || urlStr.includes("youtu.be")) {
      let videoId = "";
      if (urlStr.includes("youtu.be/")) {
        videoId = urlStr.split("youtu.be/")[1]?.split(/[?#]/)[0];
      } else if (urlStr.includes("embed/")) {
        return urlStr;
      } else if (urlStr.includes("watch?v=")) {
        const match = urlStr.match(/[?&]v=([^&#]+)/);
        if (match) videoId = match[1];
      } else if (urlStr.includes("shorts/")) {
        videoId = urlStr.split("shorts/")[1]?.split(/[?#]/)[0];
      }
      
      if (videoId) {
        // Keep search params
        const urlParts = urlStr.split("?");
        const queryStr = urlParts.length > 1 ? `?${urlParts[1]}` : "";
        let cleanQuery = "";
        if (queryStr) {
          const sp = new URLSearchParams(urlParts[1]);
          sp.delete("v");
          const spStr = sp.toString();
          cleanQuery = spStr ? `?${spStr}` : "";
        }
        return `https://www.youtube.com/embed/${videoId}${cleanQuery}`;
      }
    }
    
    // Vimeo
    if (urlStr.includes("vimeo.com")) {
      if (urlStr.includes("player.vimeo.com")) {
        return urlStr;
      }
      const match = urlStr.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
      if (match && match[1]) {
        return `https://player.vimeo.com/video/${match[1]}`;
      }
    }
  } catch (e) {
    console.error("Error parsing embed URL", e);
  }
  
  return url;
}

function isYouTubeUrl(url: string): boolean {
  if (!url) return false;
  const urlStr = String(url);
  return urlStr.includes("youtube.com") || urlStr.includes("youtu.be");
}

export default function RecordingDetailPage() {
  const params = useParams();
  const router = useRouter();
  
  const [actualSlug, setActualSlug] = useState<string>("");
  const [recording, setRecording] = useState<RecordingDetail | null>(null);
  const [hasMembership, setHasMembership] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const parts = window.location.pathname.split("/").filter(Boolean);
      const pathSlug = parts[parts.length - 1];
      if (pathSlug && pathSlug !== "_") {
        setActualSlug(pathSlug);
      } else if (params?.slug && params.slug !== "_") {
        setActualSlug(params.slug as string);
      }
    }
  }, [params?.slug]);

  useEffect(() => {
    if (!actualSlug) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api(`/api/user/webinars/recordings/directory/${actualSlug}`);
        if (res.success) {
          setRecording(res.data.recording);
          setHasMembership(res.data.has_active_membership);
          track("recording_viewed", { recording_id: res.data.recording?.id });
        } else {
          toast.error(res.error || "Gagal memuat rekaman");
          router.push("/rekaman-zoom");
        }
      } catch {
        toast.error("Terjadi kesalahan saat memuat rekaman");
        router.push("/rekaman-zoom");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [actualSlug, router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  if (!recording) return null;

  const isPremium = recording.replay_status === "membership_only";
  const canWatch = !isPremium || hasMembership;

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      <Link href="/rekaman-zoom" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-warm-black transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Kembali ke Direktori
      </Link>

      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {recording.category && (
            <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-md">{recording.category}</span>
          )}
          {recording.format && (
            <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2.5 py-1 rounded-md">{recording.format}</span>
          )}
          {isPremium && (
            <span className="text-xs font-bold text-white bg-amber-500 px-2.5 py-1 rounded-md flex items-center gap-1 shadow-sm">
              <Lock size={12} />
              Premium
            </span>
          )}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-warm-black leading-tight">
          {recording.title}
        </h1>
        {recording.subtitle && (
          <p className="text-xl text-gray-600">{recording.subtitle}</p>
        )}
      </div>

      {/* Video Player or Paywall */}
      {!canWatch ? (
        <div className="relative aspect-video bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-gray-900 to-black text-white">
            <Lock className="w-16 h-16 text-amber-500 mb-6" />
            <h2 className="text-2xl font-bold mb-3">Konten Premium</h2>
            <p className="text-gray-300 max-w-md mb-8">
              Rekaman ini khusus untuk member premium PejuangYen. Tingkatkan membership Anda untuk membuka akses ke semua rekaman premium.
            </p>
            <Link href="/premium">
              <Button size="lg" className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-lg rounded-xl px-8 shadow-[0_0_20px_rgba(245,158,11,0.4)]">
                Upgrade Membership
              </Button>
            </Link>
          </div>
        </div>
      ) : isYouTubeUrl(recording.recording_embed_url || recording.recording_url) ? (
        <YouTubePlayer
          videoUrl={recording.recording_embed_url || recording.recording_url || ""}
          title={recording.title}
        />
      ) : (
        <div className="relative aspect-video bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
          {recording.recording_embed_url ? (
            <iframe 
              src={getEmbedUrl(recording.recording_embed_url)} 
              className="absolute inset-0 w-full h-full"
              allowFullScreen 
              allow="autoplay; fullscreen"
            />
          ) : recording.recording_url ? (
            <video 
              src={recording.recording_url} 
              className="absolute inset-0 w-full h-full"
              controls 
              poster={recording.thumbnail_url || undefined}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-gray-800">
              <PlayCircle className="w-16 h-16 text-gray-500 mb-4" />
              <p className="text-gray-400">Video belum tersedia</p>
            </div>
          )}
        </div>
      )}

      {/* Content Body */}
      <div className="prose prose-lg max-w-none text-gray-700">
        {recording.replay_body_html ? (
          <div dangerouslySetInnerHTML={{ __html: recording.replay_body_html }} />
        ) : recording.body_html ? (
          <div dangerouslySetInnerHTML={{ __html: recording.body_html }} />
        ) : (
          <p>Tidak ada deskripsi tambahan.</p>
        )}
      </div>
    </div>
  );
}
