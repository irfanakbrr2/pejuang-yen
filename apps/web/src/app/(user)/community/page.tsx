"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  ImagePlus,
  Search,
  Send,
  Tag,
  X,
  ShieldCheck,
  Crown,
  MessageCircle,
  Heart,
  CalendarDays,
  Pin,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
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
  is_pinned?: number | boolean;
};

type CommunityUser = {
  name: string;
  avatar_url?: string | null;
  role?: string | null;
};

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const inputClass =
  "w-full rounded-xl border border-black/[0.08] dark:border-white/[0.08] px-3.5 py-2.5 text-sm text-[#0D0D0D] dark:text-white placeholder:text-[#9CA3AF] dark:placeholder:text-slate-500 outline-none focus:border-[#8B1414]/40 dark:focus:border-[#C0392B]/40 focus:ring-2 focus:ring-[#8B1414]/10 dark:focus:ring-[#C0392B]/10";

const toolbar = [
  { command: "bold", icon: Bold, label: "Bold" },
  { command: "italic", icon: Italic, label: "Italic" },
  { command: "underline", icon: Underline, label: "Underline" },
  { command: "strikeThrough", icon: Strikethrough, label: "Strike" },
  { command: "insertUnorderedList", icon: List, label: "Bullet list" },
  { command: "insertOrderedList", icon: ListOrdered, label: "Numbered list" },
  { command: "formatBlock", value: "blockquote", icon: Quote, label: "Quote" },
];

const CATEGORIES = [
  { value: "pengumuman", label: "Pengumuman" },
  { value: "pertanyaan", label: "Pertanyaan" },
  { value: "wins", label: "Wins" },
  { value: "perkenalan", label: "Perkenalan" },
  { value: "share-build", label: "Share build" },
  { value: "tools-ai", label: "Tools AI" },
] as const;

const topicFilters = [
  { id: "all", label: "Semua", category: "", icon: Sparkles },
  { id: "pengumuman", label: "Pengumuman", category: "pengumuman", icon: ShieldCheck },
  { id: "pertanyaan", label: "Pertanyaan", category: "pertanyaan", icon: MessageCircle },
  { id: "wins", label: "Wins", category: "wins", icon: Crown },
  { id: "perkenalan", label: "Perkenalan", category: "perkenalan", icon: Heart },
  { id: "share-build", label: "Share build", category: "share-build", icon: Send },
  { id: "tools-ai", label: "Tools AI", category: "tools-ai", icon: SlidersHorizontal },
] as const;

function formatDate(date?: string | null) {
  if (!date) return "";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "GW";
}

export default function CommunityPage() {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listTopRef = useRef<HTMLDivElement>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [canPost, setCanPost] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<CommunityUser | null>(null);
  const [query, setQuery] = useState("");
  const [activeTopic, setActiveTopic] = useState<(typeof topicFilters)[number]["id"]>("all");
  const [activeCategory, setActiveCategory] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [postCategory, setPostCategory] = useState<typeof CATEGORIES[number]["value"]>("perkenalan");
  const [bodyLength, setBodyLength] = useState(0);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [likingId, setLikingId] = useState<string | null>(null);

  const loadPosts = async (q = query, cat = activeCategory, page = 1, append = false) => {
    if (!append) setLoading(true);
    setAccessError(null);
    const params = new URLSearchParams({ page: String(page), limit: "10" });
    if (q.trim()) params.set("q", q.trim());
    if (cat) params.set("category", cat);
    const res = await communityApi.list(params.toString());
    if (res.success) {
      const data = res as any;
      const nextPosts = Array.isArray(data.data) ? data.data : [];
      setPosts((prev) => append ? [...prev, ...nextPosts] : nextPosts);
      setPagination({
        page: Math.max(1, Number(data.pagination?.page || page)),
        limit: Math.max(1, Number(data.pagination?.limit || 10)),
        total: Math.max(0, Number(data.pagination?.total || 0)),
        totalPages: Math.max(1, Number(data.pagination?.totalPages || 1)),
      });
    } else {
      if (!append) setPosts([]);
      setAccessError(res.error || "Gagal memuat komunitas");
    }
    setLoading(false);
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > pagination.totalPages || page === pagination.page) return;
    loadPosts(query, activeCategory, page, false);
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    authApi.me().then((res) => {
      if (res.success) {
        const data = res.data as any;
        const user = data?.user;
        const membership = data?.membership;
        const isAdmin = user?.role === "admin" || user?.role === "super_admin";
        const premium = membership ? !membership.expires_at || new Date(membership.expires_at) > new Date() : false;
        setCurrentUser({
          name: user?.name || "Member",
          avatar_url: user?.avatar_url || null,
          role: user?.role || null,
        });
        setCanPost(Boolean(isAdmin || premium));
      }
      setAuthLoading(false);
    });
    loadPosts("", "", 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const runCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    setBodyLength((editorRef.current?.innerText || "").trim().length);
  };

  const onImageChange = (file?: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    if (!file) {
      setImage(null);
      setPreview(null);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
      toast.error("Format gambar harus JPEG, PNG, WebP, atau GIF");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Ukuran gambar maksimal 2MB");
      return;
    }
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const bodyHtml = editorRef.current?.innerHTML || "";
    const bodyText = (editorRef.current?.innerText || "").trim();

    if (!title.trim()) return toast.error("Judul wajib diisi");
    if (!bodyText) return toast.error("Isi postingan wajib diisi");
    if (title.trim().length > 120) return toast.error("Judul maksimal 120 karakter");
    if (bodyText.length > 8000) return toast.error("Isi postingan maksimal 8.000 karakter");

    const formData = new FormData();
    formData.set("title", title.trim());
    formData.set("body_html", bodyHtml);
    formData.set("category", postCategory);
    if (image) formData.set("image", image);

    setSubmitting(true);
    const res = await communityApi.create(formData);
    setSubmitting(false);

    if (!res.success) {
      toast.error(res.error || "Gagal membuat postingan");
      return;
    }

    toast.success(res.data?.message || "Postingan terkirim");
    setTitle("");
    setPostCategory("perkenalan");
    if (editorRef.current) editorRef.current.innerHTML = "";
    setBodyLength(0);
    onImageChange(null);
    setComposerOpen(false);
    if (res.data?.status === "published") await loadPosts(query, activeCategory, 1);
  };

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    setActiveTopic("all");
    setActiveCategory("");
    loadPosts(query, "", 1);
  };

  const applyTopic = (topic: (typeof topicFilters)[number]) => {
    setActiveTopic(topic.id);
    setActiveCategory(topic.category);
    setQuery("");
    loadPosts("", topic.category, 1);
  };

  const toggleLike = async (post: CommunityPost) => {
    if (likingId) return;
    setLikingId(post.id);
    const res = await communityApi.toggleLike(post.id);
    setLikingId(null);
    if (!res.success) {
      toast.error(res.error || "Gagal memperbarui like");
      return;
    }
    setPosts((prev) => prev.map((item) => (
      item.id === post.id
        ? { ...item, liked_by_me: Boolean((res.data as any)?.liked), like_count: Number((res.data as any)?.like_count || 0) }
        : item
    )));
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-col gap-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#8B1414] dark:text-[#C0392B]">Komunitas PejuangYen</p>
        <h1 className="text-2xl font-bold leading-tight text-[#0D0D0D] dark:text-white md:text-3xl">Diskusi, update, dan pertanyaan AI</h1>
      </div>

      {accessError ? (
        <div className="glass-card p-8 text-center">
          <Crown className="mx-auto mb-3 h-8 w-8 text-amber-500" />
          <h2 className="text-lg font-bold text-[#0D0D0D] dark:text-white">Komunitas belum bisa dibuka</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-600 dark:text-slate-400">{accessError}</p>
        </div>
      ) : (
        <>
          {authLoading ? (
            <div className="glass-card p-4">
              <div className="skeleton h-12 rounded-xl" />
            </div>
          ) : canPost ? (
            <div className="glass-card overflow-hidden p-3">
              {!composerOpen ? (
                <button
                  type="button"
                  onClick={() => setComposerOpen(true)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-white/60 dark:hover:bg-white/[0.04]"
                >
                  {currentUser?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentUser.avatar_url} alt={currentUser.name} className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-black/[0.06]" />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#8B1414]/10 text-sm font-bold text-[#8B1414] dark:bg-[#C0392B]/10 dark:text-[#C0392B]">
                      {initials(currentUser?.name || "Member")}
                    </div>
                  )}
                  <span className="text-lg font-semibold text-gray-500 dark:text-slate-400">Tulis sesuatu</span>
                </button>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4 p-2">
                  <div className="flex items-start gap-3">
                    {currentUser?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={currentUser.avatar_url} alt={currentUser.name} className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-black/[0.06]" />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#8B1414]/10 text-sm font-bold text-[#8B1414] dark:bg-[#C0392B]/10 dark:text-[#C0392B]">
                        {initials(currentUser?.name || "Member")}
                      </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-3">
                      <input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        maxLength={120}
                        className={inputClass}
                        placeholder="Judul postingan atau pertanyaan"
                      />
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 shrink-0 text-gray-400 dark:text-slate-500" />
                        <select
                          value={postCategory}
                          onChange={(e) => setPostCategory(e.target.value as typeof CATEGORIES[number]["value"])}
                          className="flex-1 rounded-xl border border-black/[0.08] bg-white/70 px-3 py-2 text-sm text-[#0D0D0D] outline-none focus:border-[#8B1414]/40 focus:ring-2 focus:ring-[#8B1414]/10 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-white"
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="overflow-hidden rounded-xl border border-black/[0.08] bg-white/70 dark:border-white/[0.08] dark:bg-white/[0.03]">
                        <div className="flex flex-wrap gap-1 border-b border-black/[0.06] p-2 dark:border-white/[0.06]">
                          {toolbar.map((item) => {
                            const Icon = item.icon;
                            return (
                              <button
                                key={`${item.command}-${item.value || ""}`}
                                type="button"
                                title={item.label}
                                onClick={() => runCommand(item.command, item.value)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-[#8B1414]/10 hover:text-[#8B1414] dark:text-slate-300 dark:hover:bg-[#C0392B]/10 dark:hover:text-[#C0392B]"
                              >
                                <Icon className="h-4 w-4" />
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            title="Tambah gambar"
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-[#8B1414]/10 hover:text-[#8B1414] dark:text-slate-300 dark:hover:bg-[#C0392B]/10 dark:hover:text-[#C0392B]"
                          >
                            <ImagePlus className="h-4 w-4" />
                          </button>
                        </div>
                        <div
                          ref={editorRef}
                          contentEditable
                          suppressContentEditableWarning
                          onInput={() => setBodyLength((editorRef.current?.innerText || "").trim().length)}
                          className="lesson-content min-h-32 px-3.5 py-3 text-sm leading-6 text-[#0D0D0D] outline-none empty:before:text-[#9CA3AF] dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(event) => onImageChange(event.target.files?.[0])}
                  />
                  {preview && (
                    <div className="relative overflow-hidden rounded-xl border border-black/[0.08] bg-black/[0.03] dark:border-white/[0.08] dark:bg-white/[0.03]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview} alt="Preview" className="max-h-72 w-full object-contain" />
                      <button
                        type="button"
                        onClick={() => onImageChange(null)}
                        className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <div className="flex flex-col gap-3 text-xs text-gray-500 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                    <p>
                      {bodyLength}/8000 karakter. Kompres gambar bila perlu:{" "}
                      <a href="https://www.iloveimg.com/compress-image" target="_blank" rel="noopener noreferrer" className="font-semibold text-[#8B1414] dark:text-[#C0392B]">
                        iLoveIMG
                      </a>
                    </p>
                    <div className="flex gap-2">
                      <Button type="button" variant="ghost" onClick={() => setComposerOpen(false)}>Batal</Button>
                      <Button type="submit" loading={submitting}>
                        <Send className="h-4 w-4" />
                        Posting
                      </Button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => window.open("https://app.pejuangyen.com/premium/", "_blank", "noopener,noreferrer")}
              className="glass-card flex w-full items-center gap-3 p-4 text-left transition-transform hover:-translate-y-0.5"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
                <Crown className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-semibold text-gray-500 dark:text-slate-400">Tulis sesuatu</p>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-500">Semua user bisa membaca. Upgrade premium untuk membuat post.</p>
              </div>
            </button>
          )}

          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-gray-700 dark:text-slate-300">
            <CalendarDays className="h-4 w-4 text-[#8B1414] dark:text-[#C0392B]" />
            Komunitas PejuangYen aktif hari ini
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {topicFilters.map((topic) => {
              const Icon = topic.icon;
              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => applyTopic(topic)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ring-1 transition-colors",
                    activeTopic === topic.id
                      ? "bg-[#8B1414] text-white ring-[#8B1414]"
                      : "bg-white/70 text-gray-600 ring-black/[0.06] hover:bg-white hover:text-[#0D0D0D] dark:bg-white/[0.05] dark:text-slate-300 dark:ring-white/[0.06]"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {topic.label}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value.slice(0, 80))}
                className={cn(inputClass, "pl-9")}
                placeholder="Cari postingan atau pertanyaan"
              />
            </div>
            <Button type="submit" variant="secondary">Cari</Button>
          </form>

          <button
            type="button"
            onClick={() => loadPosts(query, activeCategory, 1)}
            className="flex w-full items-center justify-between rounded-xl bg-amber-200 px-4 py-3 text-sm font-bold text-[#0D0D0D] shadow-sm ring-1 ring-amber-300/70 transition-colors hover:bg-amber-300"
          >
            <span>Muat postingan terbaru</span>
            <RefreshCw className="h-4 w-4" />
          </button>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((item) => (
                <div key={item} className="glass-card p-5">
                  <div className="skeleton mb-4 h-5 w-1/2 rounded" />
                  <div className="skeleton mb-2 h-4 w-full rounded" />
                  <div className="skeleton h-4 w-2/3 rounded" />
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <EmptyState title="Belum ada postingan" description="Postingan yang sudah disetujui admin akan muncul di sini." className="py-14" />
          ) : (
            <div ref={listTopRef} className="space-y-4 scroll-mt-4">
              {posts.map((post) => {
                const isAdminPost = post.author_role === "admin" || post.author_role === "super_admin";
                const pinned = Boolean(post.is_pinned);
                return (
                  <article
                    key={post.id}
                    className={cn(
                      "glass-card overflow-hidden p-4 transition-transform hover:-translate-y-0.5 md:p-5",
                      (isAdminPost || pinned) && "border-amber-400/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_18px_44px_rgba(245,158,11,0.13)]"
                    )}
                  >
                    {pinned && (
                      <div className="mb-3 flex justify-end">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                          <Pin className="h-3.5 w-3.5" />
                          Pinned
                        </span>
                      </div>
                    )}
                    <div className="flex gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-3 flex items-center gap-2">
                          {post.author_avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={post.author_avatar_url} alt={post.author_name} className="h-10 w-10 rounded-full object-cover ring-1 ring-black/[0.06]" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#8B1414]/10 text-sm font-bold text-[#8B1414] dark:bg-[#C0392B]/10 dark:text-[#C0392B]">
                              {initials(post.author_name)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-[#0D0D0D] dark:text-white">{post.author_name}</p>
                              {isAdminPost && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                                  <ShieldCheck className="h-3 w-3" />
                                  Pengumuman
                                </span>
                              )}
                            </div>
                            <p className="text-xs font-medium text-gray-500 dark:text-slate-400">{formatDate(post.published_at || post.created_at)}</p>
                          </div>
                        </div>

                        <Link href={`/community/${post.slug || post.id}`} className="group block">
                          <h2 className="text-lg font-bold leading-snug text-[#0D0D0D] transition-colors group-hover:text-[#8B1414] dark:text-white dark:group-hover:text-[#C0392B] md:text-xl">
                            {post.title}
                          </h2>
                          <div className="lesson-content mt-2 line-clamp-3 text-sm leading-6 text-gray-700 dark:text-slate-300" dangerouslySetInnerHTML={{ __html: post.body_html }} />
                        </Link>

                        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-semibold text-gray-500 dark:text-slate-400">
                          <button
                            type="button"
                            disabled={likingId === post.id}
                            onClick={() => toggleLike(post)}
                            className={cn(
                              "inline-flex items-center gap-1.5 transition-colors hover:text-rose-600",
                              post.liked_by_me && "text-rose-600 dark:text-rose-400"
                            )}
                          >
                            <Heart className={cn("h-4 w-4", post.liked_by_me && "fill-current")} />
                            {Number(post.like_count || 0)}
                          </button>
                          <Link href={`/community/${post.slug || post.id}`} className="inline-flex items-center gap-1.5 transition-colors hover:text-[#8B1414] dark:hover:text-[#C0392B]">
                            <MessageCircle className="h-4 w-4" />
                            {Number(post.comment_count || 0)}
                          </Link>
                        </div>
                      </div>

                      {post.image_url && (
                        <Link href={`/community/${post.slug || post.id}`} className="hidden shrink-0 sm:block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={post.image_url} alt="" className="h-24 w-28 rounded-xl bg-black/[0.03] object-cover ring-1 ring-black/[0.06] dark:bg-white/[0.03] md:h-28 md:w-32" />
                        </Link>
                      )}
                    </div>
                  </article>
                );
              })}

              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2 sm:gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={loading || pagination.page <= 1}
                    onClick={() => goToPage(pagination.page - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Sebelumnya</span>
                  </Button>
                  <span className="px-2 text-sm font-medium text-[#374151] dark:text-slate-300">
                    Halaman {pagination.page} dari {pagination.totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={loading || pagination.page >= pagination.totalPages}
                    onClick={() => goToPage(pagination.page + 1)}
                  >
                    <span className="hidden sm:inline">Berikutnya</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
