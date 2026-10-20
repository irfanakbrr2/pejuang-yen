"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  ExternalLink,
  Heart,
  MessageCircle,
  Search,
  Trash2,
} from "lucide-react";
import { AdminTable, StatusBadge, Td, Tr } from "@/components/ui/AdminTable";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { PageHeader } from "@/components/ui/dashboard-chrome";
import { EmptyState } from "@/components/ui/lottie/EmptyState";
import { toast } from "@/components/ui/toast";

type CommunityPost = {
  id: string;
  slug?: string | null;
  title: string;
  body_html: string;
  body_text: string;
  image_url?: string | null;
  status: "pending" | "published";
  source_role: string;
  author_name: string;
  author_email: string;
  author_role: string;
  approved_by_name?: string | null;
  like_count?: number;
  comment_count?: number;
  created_at: string;
  published_at?: string | null;
};

type CommunityComment = {
  id: string;
  post_id: string;
  post_title: string;
  post_slug?: string | null;
  author_name: string;
  author_email: string;
  body_text: string;
  moderation_status?: "approved" | "blocked";
  moderation_reason?: string | null;
  created_at: string;
};

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const inputClass =
  "rounded-xl border border-black/[0.08] px-3.5 py-2.5 text-sm text-[#0D0D0D] placeholder:text-[#9CA3AF] outline-none focus:border-[#8B1414]/40 focus:ring-2 focus:ring-[#8B1414]/10";

async function adminFetch<T>(input: string, init?: RequestInit): Promise<{ success: boolean; data?: T; error?: string; pagination?: PaginationMeta }> {
  const res = await fetch(input, { credentials: "include", ...init });
  const data = await res.json().catch(() => ({ success: false, error: `Request gagal (${res.status}).` }));
  return data;
}

function normalizePagination(pagination?: PaginationMeta): PaginationMeta {
  return {
    page: Math.max(1, Number(pagination?.page || 1)),
    limit: Math.max(1, Number(pagination?.limit || 10)),
    total: Math.max(0, Number(pagination?.total || 0)),
    totalPages: Math.max(1, Number(pagination?.totalPages || 1)),
  };
}

function formatDate(date?: string | null) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export default function AdminCommunityPage() {
  const [activeView, setActiveView] = useState<"posts" | "comments">("posts");
  const [status, setStatus] = useState<"pending" | "published">("pending");
  const [commentStatus, setCommentStatus] = useState<"blocked" | "approved">("blocked");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [postPage, setPostPage] = useState(1);
  const [postPagination, setPostPagination] = useState<PaginationMeta>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [commentPage, setCommentPage] = useState(1);
  const [commentPagination, setCommentPagination] = useState<PaginationMeta>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);

  const load = async (nextStatus = status, q = appliedQuery, page = postPage) => {
    setLoading(true);
    const params = new URLSearchParams({ status: nextStatus, page: String(page), limit: "10" });
    if (q.trim()) params.set("q", q.trim());
    const res = await adminFetch<CommunityPost[]>(`/api/admin/community/posts?${params}`);
    if (res.success) {
      const nextPagination = normalizePagination(res.pagination);
      if (page > nextPagination.totalPages) {
        setPostPage(nextPagination.totalPages);
        setLoading(false);
        return;
      }
      setPosts(Array.isArray(res.data) ? res.data : []);
      setPostPagination(nextPagination);
    } else {
      toast.error(res.error || "Gagal memuat postingan komunitas");
      setPosts([]);
      setPostPagination({ page: 1, limit: 10, total: 0, totalPages: 1 });
    }
    setLoading(false);
  };

  const loadComments = async (nextStatus = commentStatus, q = appliedQuery, page = commentPage) => {
    setLoading(true);
    const params = new URLSearchParams({ status: nextStatus, page: String(page), limit: "10" });
    if (q.trim()) params.set("q", q.trim());
    const res = await adminFetch<CommunityComment[]>(`/api/admin/community/comments?${params}`);
    if (res.success) {
      const nextPagination = normalizePagination(res.pagination);
      if (page > nextPagination.totalPages) {
        setCommentPage(nextPagination.totalPages);
        setLoading(false);
        return;
      }
      setComments(Array.isArray(res.data) ? res.data : []);
      setCommentPagination(nextPagination);
    } else {
      toast.error(res.error || "Gagal memuat komentar komunitas");
      setComments([]);
      setCommentPagination({ page: 1, limit: 10, total: 0, totalPages: 1 });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (activeView === "posts") load(status, appliedQuery, postPage);
    else loadComments(commentStatus, appliedQuery, commentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, status, commentStatus, postPage, commentPage, appliedQuery]);

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    const nextQuery = query.trim();
    setAppliedQuery(nextQuery);
    if (activeView === "posts") {
      setPostPage(1);
      load(status, nextQuery, 1);
    } else {
      setCommentPage(1);
      loadComments(commentStatus, nextQuery, 1);
    }
  };

  const approvePost = async (post: CommunityPost) => {
    setActingId(post.id);
    const res = await adminFetch(`/api/admin/community/posts/${post.id}/approve`, { method: "POST" });
    setActingId(null);
    if (res.success) {
      toast.success("Postingan disetujui");
      await load();
    } else {
      toast.error(res.error || "Gagal menyetujui postingan");
    }
  };

  const deletePost = async (post: CommunityPost) => {
    const ok = window.confirm(post.status === "pending" ? "Tolak dan hapus postingan ini?" : "Hapus postingan ini?");
    if (!ok) return;

    setActingId(post.id);
    const res = await adminFetch(`/api/admin/community/posts/${post.id}`, { method: "DELETE" });
    setActingId(null);
    if (res.success) {
      toast.success(post.status === "pending" ? "Postingan ditolak dan dihapus" : "Postingan dihapus");
      await load();
    } else {
      toast.error(res.error || "Gagal menghapus postingan");
    }
  };

  const approveComment = async (comment: CommunityComment) => {
    setActingId(comment.id);
    const res = await adminFetch(`/api/admin/community/comments/${comment.id}/approve`, { method: "POST" });
    setActingId(null);
    if (res.success) {
      toast.success("Komentar disetujui");
      await loadComments();
    } else {
      toast.error(res.error || "Gagal menyetujui komentar");
    }
  };

  const deleteComment = async (comment: CommunityComment) => {
    const ok = window.confirm("Hapus komentar ini?");
    if (!ok) return;

    setActingId(comment.id);
    const res = await adminFetch(`/api/admin/community/comments/${comment.id}`, { method: "DELETE" });
    setActingId(null);
    if (res.success) {
      toast.success("Komentar dihapus");
      await loadComments();
    } else {
      toast.error(res.error || "Gagal menghapus komentar");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Moderasi"
        title="Moderasi Komunitas"
        description="Tinjau postingan pending, published, dan komentar sensitif yang masuk filter otomatis."
      />

      <div className="glass-card flex w-fit items-center gap-1 p-1">
        {([
          ["posts", "Postingan"],
          ["comments", "Komentar"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveView(id)}
            className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
              activeView === id
                ? "bg-[#8B1414] text-white"
                : "text-gray-500 hover:bg-white/70 hover:text-gray-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="glass-card flex w-fit items-center gap-1 p-1">
          {activeView === "posts" ? (
            (["pending", "published"] as const).map((item) => (
              <button
                key={item}
                onClick={() => {
                  setStatus(item);
                  setPostPage(1);
                }}
                className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
                  status === item ? "bg-[#8B1414] text-white" : "text-gray-500 hover:bg-white/70 hover:text-gray-900"
                }`}
              >
                {item === "pending" ? "Pending" : "Published"}
              </button>
            ))
          ) : (
            (["blocked", "approved"] as const).map((item) => (
              <button
                key={item}
                onClick={() => {
                  setCommentStatus(item);
                  setCommentPage(1);
                }}
                className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
                  commentStatus === item ? "bg-[#8B1414] text-white" : "text-gray-500 hover:bg-white/70 hover:text-gray-900"
                }`}
              >
                {item === "blocked" ? "Diblokir" : "Disetujui"}
              </button>
            ))
          )}
        </div>

        <form onSubmit={handleSearch} className="flex min-w-0 flex-1 gap-2 lg:max-w-md">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value.slice(0, 80))}
              className={`${inputClass} w-full pl-9`}
              placeholder={activeView === "posts" ? "Cari judul, isi, atau author" : "Cari komentar, post, atau author"}
            />
          </div>
          <Button type="submit" variant="secondary">Cari</Button>
        </form>
      </div>

      {activeView === "posts" ? (
        <>
        <div className="text-sm text-gray-500">
          {postPagination.total} postingan {status === "pending" ? "pending" : "published"}
          {appliedQuery && <span> untuk pencarian &quot;{appliedQuery}&quot;</span>}
        </div>
        <AdminTable
        loading={loading}
        columns={[
          { key: "post", label: "Postingan" },
          { key: "author", label: "Author" },
          { key: "status", label: "Status" },
          { key: "date", label: "Tanggal" },
          { key: "actions", label: "Aksi", className: "text-right" },
        ]}
        empty={<EmptyState title="Tidak ada postingan" description="Tidak ada postingan untuk filter ini." className="py-10" />}
        >
        {posts.map((post) => (
          <Tr key={post.id}>
            <Td className="min-w-[360px] max-w-xl">
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  {post.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={post.image_url} alt="" className="h-16 w-24 shrink-0 rounded-lg bg-black/[0.03] object-cover" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold leading-snug text-[#0D0D0D]">{post.title}</p>
                    <div
                      className={`lesson-content mt-1 text-xs leading-5 text-gray-600 ${expandedPostId === post.id ? "" : "line-clamp-3"}`}
                      dangerouslySetInnerHTML={{ __html: post.body_html }}
                    />
                    <button
                      type="button"
                      onClick={() => setExpandedPostId(expandedPostId === post.id ? null : post.id)}
                      className="mt-1 text-xs font-semibold text-[#8B1414] hover:underline"
                    >
                      {expandedPostId === post.id ? "Tutup" : "Baca selengkapnya"}
                    </button>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <Heart className="h-3.5 w-3.5" />
                        {Number(post.like_count || 0)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MessageCircle className="h-3.5 w-3.5" />
                        {Number(post.comment_count || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Td>
            <Td>
              <div>
                <p className="font-medium text-[#0D0D0D]">{post.author_name}</p>
                <p className="text-xs text-gray-500">{post.author_email}</p>
              </div>
            </Td>
            <Td>
              <StatusBadge status={post.status} />
            </Td>
            <Td>
              <div className="text-sm text-gray-600">
                <p>{formatDate(post.status === "published" ? post.published_at : post.created_at)}</p>
                {post.approved_by_name && <p className="mt-1 text-xs text-gray-400">oleh {post.approved_by_name}</p>}
              </div>
            </Td>
            <Td className="text-right">
              <div className="flex flex-wrap justify-end gap-2">
                {post.status === "published" && (
                  <Link
                    href={`/community/${post.slug || post.id}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-black/[0.08] transition-colors hover:bg-gray-50"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Lihat
                  </Link>
                )}
                {post.status === "pending" && (
                  <Button size="sm" onClick={() => approvePost(post)} loading={actingId === post.id}>
                    <Check className="h-3.5 w-3.5" />
                    Setujui
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => deletePost(post)}
                  loading={actingId === post.id}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {post.status === "pending" ? "Tolak" : "Hapus"}
                </Button>
              </div>
            </Td>
          </Tr>
        ))}
        </AdminTable>
        <Pagination currentPage={postPagination.page} totalPages={postPagination.totalPages} onPageChange={setPostPage} />
        </>
      ) : (
        <>
        <div className="text-sm text-gray-500">
          {commentPagination.total} komentar {commentStatus === "blocked" ? "diblokir" : "disetujui"}
          {appliedQuery && <span> untuk pencarian &quot;{appliedQuery}&quot;</span>}
        </div>
        <AdminTable
          loading={loading}
          columns={[
            { key: "comment", label: "Komentar" },
            { key: "post", label: "Postingan" },
            { key: "author", label: "Author" },
            { key: "date", label: "Tanggal" },
            { key: "actions", label: "Aksi", className: "text-right" },
          ]}
          empty={<EmptyState title="Tidak ada komentar" description="Tidak ada komentar untuk filter ini." className="py-10" />}
        >
          {comments.map((comment) => (
            <Tr key={comment.id}>
              <Td className="min-w-[360px] max-w-xl">
                <p className="whitespace-pre-wrap text-sm leading-6 text-[#0D0D0D]">{comment.body_text}</p>
                {comment.moderation_reason && (
                  <p className="mt-2 text-xs font-semibold text-red-600">Reason: {comment.moderation_reason}</p>
                )}
              </Td>
              <Td>
                <Link href={`/community/${comment.post_slug || comment.post_id}`} className="font-semibold text-[#8B1414] hover:underline">
                  {comment.post_title}
                </Link>
              </Td>
              <Td>
                <div>
                  <p className="font-medium text-[#0D0D0D]">{comment.author_name}</p>
                  <p className="text-xs text-gray-500">{comment.author_email}</p>
                </div>
              </Td>
              <Td>
                <p className="text-sm text-gray-600">{formatDate(comment.created_at)}</p>
              </Td>
              <Td className="text-right">
                <div className="flex flex-wrap justify-end gap-2">
                  {comment.moderation_status !== "approved" && (
                    <Button size="sm" onClick={() => approveComment(comment)} loading={actingId === comment.id}>
                      <Check className="h-3.5 w-3.5" />
                      Setujui
                    </Button>
                  )}
                  <Button size="sm" variant="danger" onClick={() => deleteComment(comment)} loading={actingId === comment.id}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus
                  </Button>
                </div>
              </Td>
            </Tr>
          ))}
        </AdminTable>
        <Pagination currentPage={commentPagination.page} totalPages={commentPagination.totalPages} onPageChange={setCommentPage} />
        </>
      )}
    </div>
  );
}
