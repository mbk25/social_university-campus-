"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Comment, Post } from "@/lib/types";
import { PostCard } from "@/components/PostCard";
import { RichText } from "@/components/RichText";
import { ArrowLeftIcon, HeartIcon, SendIcon } from "@/components/icons";
import {
  Avatar,
  Button,
  EmptyState,
  PostSkeleton,
  Spinner,
  cx,
  formatCount,
  timeAgo,
  useToast,
} from "@/components/ui";

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingComments, setLoadingComments] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<"NEW" | "TOP">("NEW");

  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api
      .get<{ post: Post }>(`/posts/${id}`)
      .then((d) => setPost(d.post))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Gönderi bulunamadı"))
      .finally(() => setLoading(false));
  }, [id]);

  const loadComments = useCallback(
    async (next?: string | null) => {
      setLoadingComments(true);
      try {
        const params = new URLSearchParams({ sort, limit: "20" });
        if (next) params.set("cursor", next);
        const data = await api.get<{ items: Comment[]; nextCursor: string | null }>(
          `/posts/${id}/comments?${params}`,
        );
        setComments((c) => (next ? [...c, ...data.items] : data.items));
        setCursor(data.nextCursor);
      } catch {
        if (!next) setComments([]);
      } finally {
        setLoadingComments(false);
      }
    },
    [id, sort],
  );

  useEffect(() => {
    void loadComments(null);
  }, [loadComments]);

  async function submitComment() {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const result = await api.post<{ comment: Comment }>(`/posts/${id}/comments`, {
        content,
        parentId: replyTo?.id ?? null,
      });

      if (replyTo) {
        setComments((current) =>
          current.map((c) =>
            c.id === replyTo.id
              ? { ...c, replyCount: c.replyCount + 1, replies: [...(c.replies ?? []), result.comment] }
              : c,
          ),
        );
      } else {
        setComments((current) => [result.comment, ...current]);
      }

      setPost((p) => (p ? { ...p, commentCount: p.commentCount + 1 } : p));
      setDraft("");
      setReplyTo(null);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Yorum gönderilemedi", "error");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[620px] space-y-3">
        <PostSkeleton />
      </div>
    );
  }

  if (error || !post) {
    return (
      <EmptyState
        title="Gönderi bulunamadı"
        description={error ?? "Bu gönderi silinmiş veya erişiminiz yok olabilir."}
        action={<Button onClick={() => router.push("/akis")}>Ana sayfaya dön</Button>}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[620px] space-y-3">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-[14px] font-medium text-muted transition-colors hover:text-[var(--text)]"
      >
        <ArrowLeftIcon width={18} height={18} /> Geri
      </button>

      <PostCard post={post} onDeleted={() => router.push("/akis")} />

      {/* -------------------------------------------------------- Yorum kutusu */}
      <div className="surface rounded-[var(--radius-card)] p-4">
        {replyTo && (
          <div className="mb-2.5 flex items-center justify-between gap-2 rounded-lg surface-subtle px-3 py-2 text-[13px]">
            <span className="min-w-0 truncate text-muted">
              <strong className="text-[var(--text)]">{replyTo.author.displayName}</strong> kişisine
              yanıt
            </span>
            <button
              onClick={() => setReplyTo(null)}
              className="shrink-0 font-medium brand-text hover:underline"
            >
              iptal
            </button>
          </div>
        )}
        <div className="flex gap-3">
          <Avatar src={user?.avatarUrl} name={user?.displayName ?? "?"} size="md" />
          <div className="flex-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void submitComment();
              }}
              placeholder="Yorumunu yaz..."
              rows={2}
              maxLength={1000}
              className="w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-[var(--text-faint)]"
            />
            <div className="mt-1.5 flex items-center justify-end gap-2">
              {draft.length > 800 && (
                <span className="text-[12px] text-faint">{1000 - draft.length}</span>
              )}
              <Button
                size="sm"
                loading={sending}
                disabled={!draft.trim()}
                onClick={submitComment}
                icon={<SendIcon width={15} height={15} />}
              >
                Gönder
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------ Yorumlar */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[15px] font-bold">
          {formatCount(post.commentCount)} yorum
        </h2>
        <div className="flex gap-1">
          {(["NEW", "TOP"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={cx(
                "rounded-lg px-2.5 py-1 text-[13px] font-medium transition-colors",
                sort === s ? "brand-soft-bg brand-text" : "text-muted hover:bg-[var(--bg-subtle)]",
              )}
            >
              {s === "NEW" ? "En yeni" : "En beğenilen"}
            </button>
          ))}
        </div>
      </div>

      {loadingComments && comments.length === 0 ? (
        <div className="flex justify-center py-8">
          <Spinner size={22} className="text-muted" />
        </div>
      ) : comments.length === 0 ? (
        <p className="py-8 text-center text-[14px] text-faint">
          İlk yorumu sen yaz 💬
        </p>
      ) : (
        <div className="space-y-2">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onReply={setReplyTo}
              onDeleted={(cid) => {
                setComments((c) => c.filter((x) => x.id !== cid));
                setPost((p) => (p ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p));
              }}
            />
          ))}
          {cursor && (
            <button
              onClick={() => void loadComments(cursor)}
              className="w-full rounded-xl py-2.5 text-[14px] font-semibold brand-text hover:bg-[var(--bg-subtle)]"
            >
              {loadingComments ? "Yükleniyor..." : "Daha fazla yorum"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CommentItem({
  comment: initial,
  onReply,
  onDeleted,
  nested = false,
}: {
  comment: Comment;
  onReply?: (comment: Comment) => void;
  onDeleted?: (id: string) => void;
  nested?: boolean;
}) {
  const toast = useToast();
  const [comment, setComment] = useState(initial);
  const [showReplies, setShowReplies] = useState(false);

  async function toggleLike() {
    const liked = comment.viewer.hasLiked;
    setComment((c) => ({
      ...c,
      viewer: { ...c.viewer, hasLiked: !liked },
      likeCount: c.likeCount + (liked ? -1 : 1),
    }));
    try {
      const result = await (liked
        ? api.delete<{ likeCount: number }>(`/comments/${comment.id}/like`)
        : api.post<{ likeCount: number }>(`/comments/${comment.id}/like`));
      setComment((c) => ({ ...c, likeCount: result.likeCount }));
    } catch {
      setComment((c) => ({
        ...c,
        viewer: { ...c.viewer, hasLiked: liked },
        likeCount: c.likeCount + (liked ? 1 : -1),
      }));
    }
  }

  async function remove() {
    if (!confirm("Yorum silinsin mi?")) return;
    try {
      await api.delete(`/comments/${comment.id}`);
      onDeleted?.(comment.id);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Silinemedi", "error");
    }
  }

  return (
    <article className={cx("surface rounded-[var(--radius-card)] p-3.5", nested && "ml-6 sm:ml-10")}>
      <div className="flex gap-3">
        <Link href={`/u/${comment.author.username}`} className="shrink-0">
          <Avatar src={comment.author.avatarUrl} name={comment.author.displayName} size="sm" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1.5 text-[14px]">
            <Link href={`/u/${comment.author.username}`} className="font-bold hover:underline">
              {comment.author.displayName}
            </Link>
            <span className="text-[12.5px] text-faint">
              @{comment.author.username} · {timeAgo(comment.createdAt)}
            </span>
          </div>

          <RichText
            text={comment.content}
            className="mt-1 whitespace-pre-wrap break-words text-[14.5px] leading-relaxed"
          />

          <div className="mt-1.5 flex items-center gap-3 text-[12.5px] font-medium">
            <button
              onClick={toggleLike}
              className={cx(
                "flex items-center gap-1 transition-colors",
                comment.viewer.hasLiked ? "text-rose-500" : "text-faint hover:text-[var(--text)]",
              )}
            >
              <HeartIcon width={15} height={15} filled={comment.viewer.hasLiked} />
              {comment.likeCount > 0 && formatCount(comment.likeCount)}
            </button>

            {onReply && (
              <button
                onClick={() => onReply(comment)}
                className="text-faint transition-colors hover:text-[var(--text)]"
              >
                Yanıtla
              </button>
            )}

            {comment.viewer.canDelete && (
              <button onClick={remove} className="text-faint transition-colors hover:text-rose-500">
                Sil
              </button>
            )}
          </div>

          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-2.5 space-y-2">
              {(showReplies ? comment.replies : comment.replies.slice(0, 2)).map((reply) => (
                <div key={reply.id} className="border-l-2 border-[var(--border)] pl-3">
                  <div className="flex items-center gap-1.5 text-[13.5px]">
                    <Link
                      href={`/u/${reply.author.username}`}
                      className="font-semibold hover:underline"
                    >
                      {reply.author.displayName}
                    </Link>
                    <span className="text-[12px] text-faint">{timeAgo(reply.createdAt)}</span>
                  </div>
                  <RichText
                    text={reply.content}
                    className="whitespace-pre-wrap break-words text-[14px] leading-relaxed"
                  />
                </div>
              ))}
              {comment.replies.length > 2 && !showReplies && (
                <button
                  onClick={() => setShowReplies(true)}
                  className="text-[13px] font-semibold brand-text hover:underline"
                >
                  {comment.replies.length - 2} yanıt daha göster
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
