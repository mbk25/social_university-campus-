"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Community, Post, User } from "@/lib/types";
import { CommunityRow } from "@/components/CommunityRow";
import { PostCard } from "@/components/PostCard";
import { SearchIcon } from "@/components/icons";
import { Avatar, EmptyState, Skeleton, cx } from "@/components/ui";

interface SearchResults {
  users: User[];
  communities: Community[];
  posts: Post[];
  events: {
    id: string;
    title: string;
    startsAt: string;
    attendeeCount: number;
    community: { name: string } | null;
  }[];
  notes: {
    id: string;
    title: string;
    courseCode: string | null;
    courseName: string;
    ratingAvg: number;
    downloadCount: number;
  }[];
}

const TABS = [
  { key: "ALL", label: "Tümü" },
  { key: "USERS", label: "Kişiler" },
  { key: "COMMUNITIES", label: "Topluluklar" },
  { key: "POSTS", label: "Gönderiler" },
  { key: "EVENTS", label: "Etkinlikler" },
  { key: "NOTES", label: "Notlar" },
] as const;

function SearchContent() {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("ALL");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q.trim()) return;
    setLoading(true);
    api
      .get<SearchResults>(`/search?q=${encodeURIComponent(q)}&type=${tab}&limit=20`)
      .then(setResults)
      .catch(() => setResults(null))
      .finally(() => setLoading(false));
  }, [q, tab]);

  if (!q.trim()) {
    return (
      <EmptyState
        icon={<SearchIcon width={26} height={26} />}
        title="Ne aramak istersin?"
        description="Kişi, topluluk, gönderi, etkinlik ya da ders notu arayabilirsin."
      />
    );
  }

  const total =
    (results?.users.length ?? 0) +
    (results?.communities.length ?? 0) +
    (results?.posts.length ?? 0) +
    (results?.events.length ?? 0) +
    (results?.notes.length ?? 0);

  return (
    <div className="mx-auto w-full max-w-[680px] space-y-4">
      <header>
        <h1 className="text-[22px] font-black tracking-tight">
          &ldquo;{q}&rdquo; için sonuçlar
        </h1>
      </header>

      <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cx(
              "shrink-0 rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors",
              tab === t.key ? "bg-[var(--brand)] text-white" : "surface-subtle text-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : total === 0 ? (
        <EmptyState title="Sonuç bulunamadı" description="Farklı bir kelimeyle aramayı dene." />
      ) : (
        <div className="space-y-6">
          {results!.users.length > 0 && (
            <section>
              <h2 className="mb-2.5 px-1 text-[15px] font-bold">Kişiler</h2>
              <div className="surface divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius-card)]">
                {results!.users.map((u) => (
                  <Link
                    key={u.id}
                    href={`/u/${u.username}`}
                    className="flex items-center gap-3 p-3.5 transition-colors hover:bg-[var(--bg-subtle)]"
                  >
                    <Avatar src={u.avatarUrl} name={u.displayName} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{u.displayName}</span>
                      <span className="block truncate text-[12.5px] text-faint">
                        @{u.username}
                        {u.department ? ` · ${u.department}` : ""}
                        {u.university ? ` · ${u.university.shortName}` : ""}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results!.communities.length > 0 && (
            <section>
              <h2 className="mb-2.5 px-1 text-[15px] font-bold">Topluluklar</h2>
              <div className="space-y-3">
                {results!.communities.map((c) => (
                  <CommunityRow key={c.id} community={c} />
                ))}
              </div>
            </section>
          )}

          {results!.events.length > 0 && (
            <section>
              <h2 className="mb-2.5 px-1 text-[15px] font-bold">Etkinlikler</h2>
              <div className="surface divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius-card)]">
                {results!.events.map((e) => (
                  <Link key={e.id} href="/etkinlikler" className="block p-3.5 hover:bg-[var(--bg-subtle)]">
                    <span className="block text-[15px] font-semibold">{e.title}</span>
                    <span className="block text-[12.5px] text-faint">
                      {new Date(e.startsAt).toLocaleDateString("tr-TR", {
                        day: "numeric",
                        month: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {" · "}
                      {e.attendeeCount} katılımcı
                      {e.community ? ` · ${e.community.name}` : ""}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results!.notes.length > 0 && (
            <section>
              <h2 className="mb-2.5 px-1 text-[15px] font-bold">Ders notları</h2>
              <div className="surface divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius-card)]">
                {results!.notes.map((n) => (
                  <Link key={n.id} href="/notlar" className="block p-3.5 hover:bg-[var(--bg-subtle)]">
                    <span className="block text-[15px] font-semibold">
                      {n.courseCode ? `${n.courseCode} · ` : ""}
                      {n.title}
                    </span>
                    <span className="block text-[12.5px] text-faint">
                      {n.courseName} · ⭐ {n.ratingAvg} · {n.downloadCount} indirme
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {results!.posts.length > 0 && (
            <section>
              <h2 className="mb-2.5 px-1 text-[15px] font-bold">Gönderiler</h2>
              <div className="space-y-3">
                {results!.posts.map((p) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<Skeleton className="h-40 rounded-[var(--radius-card)]" />}>
      <SearchContent />
    </Suspense>
  );
}
