"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Heart, MessageCircle, Send, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/lottie/EmptyState";
import { toast } from "@/components/ui/toast";
import { authApi, communityApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type CommunityPost = {
  id: string;
  slug?: string | null;
  title: string;
  body_html: string;
  image_url?: string | null;
  published_at?: string | null;
  created_at: string;
  author_name: string;
  author_avatar_url?: string | null;
  author_role: string;
  like_count?: number;
  comment_count?: number;
  liked_by_me?: number | boolean;
};

type CommunityComment = {
  id: string;
  post_id: string;
  author_user_id: string;
  author_name: string;
  author_avatar_url?: string | null;
  author_role: string;
  body_text: string;
  created_at: string;
};

type CurrentUser = {
  id?: string;
  role?: string;
};

function formatDate(date?: string | null) {
  if (!date) return "";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "GW";
}

export default function CommunityDetailPage() {
  const pathname = usePathname();
  const slugOrId = pathname.split("/").filter(Boolean)[1] || "_";
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [liking, setLiking] = useState(false);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setCommentsLoading(true);
      const [meRes, postRes, commentsRes] = await Promise.all([
        authApi.me(),
        communityApi.detail(slugOrId),
        communityApi.comments(slugOrId),
      ]);

      if (meRes.success) {
        setCurrentUser((meRes.data as any)?.user || null);
      }

      const res = postRes;
      if (res.success) {
        setPost(res.data as CommunityPost);
        setError(null);
      } else {
        setError(res.error || "Postingan tidak ditemukan");
      }

      if (commentsRes.success) {
        const data = commentsRes as any;
        setComments(Array.isArray(data.data) ? data.data : []);
      } else {
        setComments([]);
      }

      setLoading(false);
      setCommentsLoading(false);
    }
    load();
  }, [slugOrId]);

  const toggleLike = async () => {
    if (!post || liking) return;
    setLiking(true);
    const res = await communityApi.toggleLike(post.id);
    setLiking(false);
    if (!res.success) {
      toast.error(res.error || "Gagal memperbarui like");
      return;
    }
    setPost({
      ...post,
      liked_by_me: Boolean((res.data as any)?.liked),
      like_count: Number((res.data as any)?.like_count || 0),
    });
  };

  const submitComment = async (event: FormEvent) => {
    event.preventDefault();
    const bodyText = commentText.trim();
    if (!post) return;
    if (!bodyText) return toast.error("Komentar wajib diisi");
    if (bodyText.length > 2000) return toast.error("Komentar maksimal 2.000 karakter");

    setSubmittingComment(true);
    const res = await communityApi.createComment(post.id, bodyText);
    setSubmittingComment(false);

    if (!res.success) {
      toast.error(res.error || "Gagal membuat komentar");
      return;
    }

    if ((res.data as any)?.moderation_status === "blocked") {
      toast.warning((res.data as any)?.message || "Komentar masuk moderasi dan tidak ditampilkan ke umum.");
      setCommentText("");
      return;
    }

    setComments((prev) => [...prev, res.data as CommunityComment]);
    setPost((prev) => prev ? { ...prev, comment_count: Number(prev.comment_count || 0) + 1 } : prev);
    setCommentText("");
  };

  const deleteComment = async (comment: CommunityComment) => {
    if (!post) return;
    const ok = window.confirm("Hapus komentar ini?");
    if (!ok) return;

    setDeletingCommentId(comment.id);
    const res = await communityApi.deleteComment(post.id, comment.id);
    setDeletingCommentId(null);

    if (!res.success) {
      toast.error(res.error || "Gagal menghapus komentar");
      return;
    }

    setComments((prev) => prev.filter((item) => item.id !== comment.id));
    setPost((prev) => prev ? { ...prev, comment_count: Math.max(0, Number(prev.comment_count || 0) - 1) } : prev);
  };

  const canDeleteComment = (comment: CommunityComment) => {
    return comment.author_user_id === currentUser?.id || currentUser?.role === "admin" || currentUser?.role === "super_admin";
  };

  return (
    <div className="space-y-5">
      <Link href="/community" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 transition-colors hover:text-[#8B1414] dark:text-slate-400 dark:hover:text-[#C0392B]">
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Komunitas
      </Link>

      {loading ? (
        <div className="glass-card p-6">
          <div className="skeleton mb-4 h-7 w-2/3 rounded" />
          <div className="skeleton mb-2 h-4 w-full rounded" />
          <div className="skeleton h-4 w-3/4 rounded" />
        </div>
      ) : error || !post ? (
        <EmptyState title="Postingan tidak tersedia" description={error || "Postingan tidak ditemukan."} className="py-14" />
      ) : (
        <article className="glass-card overflow-hidden p-5 md:p-7">
          <div className="mb-5 flex items-center gap-3">
            {post.author_avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.author_avatar_url} alt={post.author_name} className="h-11 w-11 rounded-xl object-cover" />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#8B1414]/10 text-sm font-bold text-[#8B1414] dark:bg-[#C0392B]/10 dark:text-[#C0392B]">
                {initials(post.author_name)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-[#0D0D0D] dark:text-white">{post.author_name}</p>
                {post.author_role === "admin" || post.author_role === "super_admin" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#8B1414]/10 px-2 py-0.5 text-[11px] font-semibold text-[#8B1414] dark:bg-[#C0392B]/10 dark:text-[#C0392B]">
                    <ShieldCheck className="h-3 w-3" />
                    Admin
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400">{formatDate(post.published_at || post.created_at)}</p>
            </div>
          </div>

          <h1 className="text-2xl font-bold leading-tight text-[#0D0D0D] dark:text-white md:text-3xl">{post.title}</h1>
          <div className="lesson-content prose prose-sm mt-4 max-w-none text-gray-700 dark:text-slate-300 md:prose-base" dangerouslySetInnerHTML={{ __html: post.body_html }} />
          {post.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.image_url} alt="" className="mt-5 max-h-[640px] w-full rounded-xl bg-black/[0.03] object-contain dark:bg-white/[0.03]" />
          )}
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-black/[0.06] pt-4 dark:border-white/[0.06]">
            <button
              type="button"
              disabled={liking}
              onClick={toggleLike}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                post.liked_by_me
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : "bg-white/70 text-gray-600 ring-1 ring-black/[0.06] hover:bg-rose-500/10 hover:text-rose-600 dark:bg-white/5 dark:text-slate-300 dark:ring-white/[0.06]"
              )}
            >
              <Heart className={cn("h-4 w-4", post.liked_by_me && "fill-current")} />
              {Number(post.like_count || 0)}
            </button>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/70 px-3 py-2 text-sm font-semibold text-gray-600 ring-1 ring-black/[0.06] dark:bg-white/5 dark:text-slate-300 dark:ring-white/[0.06]">
              <MessageCircle className="h-4 w-4" />
              {Number(post.comment_count || 0)}
            </span>
          </div>
        </article>
      )}

      {!loading && post && (
        <section className="glass-card space-y-5 p-5 md:p-6">
          <div>
            <h2 className="text-base font-bold text-[#0D0D0D] dark:text-white">Komentar</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">Diskusi singkat dengan member premium lain.</p>
          </div>

          <form onSubmit={submitComment} className="space-y-3">
            <textarea
              value={commentText}
              onChange={(event) => setCommentText(event.target.value.slice(0, 2000))}
              rows={3}
              className="w-full resize-none rounded-xl border border-black/[0.08] px-3.5 py-3 text-sm text-[#0D0D0D] outline-none placeholder:text-[#9CA3AF] focus:border-[#8B1414]/40 focus:ring-2 focus:ring-[#8B1414]/10 dark:border-white/[0.08] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#C0392B]/40 dark:focus:ring-[#C0392B]/10"
              placeholder="Tulis komentar..."
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500 dark:text-slate-400">{commentText.trim().length}/2000 karakter</p>
              <Button type="submit" loading={submittingComment}>
                <Send className="h-4 w-4" />
                Kirim
              </Button>
            </div>
          </form>

          {commentsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((item) => (
                <div key={item} className="rounded-xl bg-white/60 p-4 dark:bg-white/[0.04]">
                  <div className="skeleton mb-2 h-4 w-1/3 rounded" />
                  <div className="skeleton h-4 w-2/3 rounded" />
                </div>
              ))}
            </div>
          ) : comments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/[0.10] p-6 text-center text-sm text-gray-500 dark:border-white/[0.10] dark:text-slate-400">
              Belum ada komentar.
            </div>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-xl bg-white/64 p-4 ring-1 ring-black/[0.04] dark:bg-white/[0.04] dark:ring-white/[0.05]">
                  <div className="flex items-start gap-3">
                    {comment.author_avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={comment.author_avatar_url} alt={comment.author_name} className="h-9 w-9 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#8B1414]/10 text-xs font-bold text-[#8B1414] dark:bg-[#C0392B]/10 dark:text-[#C0392B]">
                        {initials(comment.author_name)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[#0D0D0D] dark:text-white">{comment.author_name}</p>
                        {(comment.author_role === "admin" || comment.author_role === "super_admin") && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#8B1414]/10 px-2 py-0.5 text-[11px] font-semibold text-[#8B1414] dark:bg-[#C0392B]/10 dark:text-[#C0392B]">
                            <ShieldCheck className="h-3 w-3" />
                            Admin
                          </span>
                        )}
                        <span className="text-xs text-gray-400">{formatDate(comment.created_at)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-gray-700 dark:text-slate-300">{comment.body_text}</p>
                    </div>
                    {canDeleteComment(comment) && (
                      <button
                        type="button"
                        disabled={deletingCommentId === comment.id}
                        onClick={() => deleteComment(comment)}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-500/10 hover:text-red-600"
                        title="Hapus komentar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
