"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api } from "@/lib/api";
import type { Post } from "@/lib/types";
import { PostCard } from "./PostCard";
import { EmptyState, PostSkeleton, Spinner } from "./ui";
import { CompassIcon } from "./icons";

export interface FeedHandle {
  prepend: (post: Post) => void;
}

export function Feed({
  query,
  emptyTitle = "Burada henüz bir şey yok",
  emptyDescription,
  emptyAction,
  onReady,
}: {
  /** `/feed?...` sonrası gelen sorgu dizesi (baştaki ? olmadan) */
  query: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  onReady?: (handle: FeedHandle) => void;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const queryRef = useRef(query);

  const load = useCallback(
    async (next?: string | null) => {
      const isFirst = !next;
      if (isFirst) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      try {
        const params = new URLSearchParams(query);
        if (next) params.set("cursor", next);
        const data = await api.get<{ items: Post[]; nextCursor: string | null }>(
          `/feed?${params.toString()}`,
        );
        setPosts((current) => (isFirst ? data.items : [...current, ...data.items]));
        setCursor(data.nextCursor);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Akış yüklenemedi");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [query],
  );

  useEffect(() => {
    queryRef.current = query;
    setPosts([]);
    setCursor(null);
    void load(null);
  }, [query, load]);

  useEffect(() => {
    onReady?.({
      prepend: (post: Post) => setPosts((current) => [post, ...current]),
    });
  }, [onReady]);

  // Sonsuz kaydırma
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !cursor || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMore) void load(cursor);
      },
      { rootMargin: "600px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, loading, loadingMore, load]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <PostSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Bir şeyler ters gitti"
        description={error}
        action={
          <button
            onClick={() => void load(null)}
            className="rounded-xl bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white"
          >
            Tekrar dene
          </button>
        }
      />
    );
  }

  if (posts.length === 0) {
    return (
      <EmptyState
        icon={<CompassIcon width={26} height={26} />}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onDeleted={(id) => setPosts((current) => current.filter((p) => p.id !== id))}
        />
      ))}

      <div ref={sentinel} className="flex justify-center py-6">
        {loadingMore ? (
          <Spinner size={22} className="text-muted" />
        ) : !cursor && posts.length > 4 ? (
          <p className="text-[13px] text-faint">Hepsi bu kadar 🎓</p>
        ) : null}
      </div>
    </div>
  );
}
