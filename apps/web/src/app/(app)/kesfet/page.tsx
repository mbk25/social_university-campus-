"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { CommunityRow } from "@/components/CommunityRow";
import { Feed } from "@/components/Feed";
import type { Community } from "@/lib/types";
import { CalendarIcon, FireIcon, GraduationIcon } from "@/components/icons";
import { Avatar, Skeleton, cx, formatCount } from "@/components/ui";

interface Trending {
  trending: { tag: string; postCount: number }[];
  suggestedCommunities: Community[];
}

interface LeaderboardUniversity {
  id: string;
  name: string;
  shortName: string;
  city: string;
  studentCount: number;
  communityCount: number;
}

export default function ExplorePage() {
  const { user } = useAuth();
  const [trending, setTrending] = useState<Trending | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [universities, setUniversities] = useState<LeaderboardUniversity[]>([]);
  const [events, setEvents] = useState<
    { id: string; title: string; startsAt: string; attendeeCount: number; coverUrl: string | null }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Trending>("/feed/trending").catch(() => null),
      api.get<{ items: Community[] }>("/communities?filter=SUGGESTED&limit=5").catch(() => null),
      api.get<{ items: LeaderboardUniversity[] }>("/meta/leaderboard").catch(() => null),
      api.get<{ items: typeof events }>("/events?when=UPCOMING&limit=4").catch(() => null),
    ]).then(([t, c, u, e]) => {
      if (t) setTrending(t);
      if (c) setCommunities(c.items);
      if (u) setUniversities(u.items.slice(0, 8));
      if (e) setEvents(e.items);
      setLoading(false);
    });
  }, []);

  return (
    <div className="mx-auto w-full max-w-[680px] space-y-5">
      <header>
        <h1 className="text-[26px] font-black tracking-tight">Keşfet</h1>
        <p className="mt-1 text-[14px] text-muted">
          Türkiye&apos;deki kampüslerde bugün neler konuşuluyor?
        </p>
      </header>

      {/* ------------------------------------------------------------ Gündem */}
      {loading ? (
        <Skeleton className="h-28 rounded-[var(--radius-card)]" />
      ) : trending && trending.trending.length > 0 ? (
        <section className="surface rounded-[var(--radius-card)] p-4">
          <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold">
            <FireIcon width={17} height={17} className="text-orange-500" />
            Gündemdeki etiketler
          </h2>
          <div className="flex flex-wrap gap-2">
            {trending.trending.map((t, i) => (
              <Link
                key={t.tag}
                href={`/etiket/${encodeURIComponent(t.tag)}`}
                className={cx(
                  "rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors",
                  i === 0
                    ? "bg-[var(--brand)] text-white"
                    : "surface-subtle text-muted hover:text-[var(--text)]",
                )}
              >
                #{t.tag}
                <span className="ml-1.5 opacity-70">{t.postCount}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* -------------------------------------------------------- Etkinlikler */}
      {events.length > 0 && (
        <section>
          <div className="mb-2.5 flex items-center justify-between px-1">
            <h2 className="flex items-center gap-2 text-[15px] font-bold">
              <CalendarIcon width={17} height={17} className="brand-text" />
              Yaklaşan etkinlikler
            </h2>
            <Link href="/etkinlikler" className="text-[13px] font-semibold brand-text hover:underline">
              Tümü →
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/etkinlik/${event.id}`}
                className="surface w-56 shrink-0 overflow-hidden rounded-[var(--radius-card)]"
              >
                <div
                  className="h-20 bg-gradient-to-br from-[#6b46ef] to-[#38e0c4]"
                  style={
                    event.coverUrl
                      ? { backgroundImage: `url(${event.coverUrl})`, backgroundSize: "cover" }
                      : undefined
                  }
                />
                <div className="p-3">
                  <p className="line-clamp-2 text-[14px] font-bold leading-snug">{event.title}</p>
                  <p className="mt-1 text-[12px] text-faint">
                    {new Date(event.startsAt).toLocaleDateString("tr-TR", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · "}
                    {event.attendeeCount} katılımcı
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* -------------------------------------------------------- Topluluklar */}
      {communities.length > 0 && (
        <section>
          <div className="mb-2.5 flex items-center justify-between px-1">
            <h2 className="text-[15px] font-bold">Sana uygun topluluklar</h2>
            <Link href="/topluluklar" className="text-[13px] font-semibold brand-text hover:underline">
              Tümü →
            </Link>
          </div>
          <div className="space-y-3">
            {communities.map((c) => (
              <CommunityRow key={c.id} community={c} />
            ))}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------- Üniversiteler */}
      {universities.length > 0 && (
        <section className="surface rounded-[var(--radius-card)] p-4">
          <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold">
            <GraduationIcon width={17} height={17} className="brand-text" />
            En aktif kampüsler
          </h2>
          <ol className="space-y-1">
            {universities.map((uni, i) => (
              <li
                key={uni.id}
                className={cx(
                  "flex items-center gap-3 rounded-lg px-2 py-2",
                  uni.id === user?.university?.id && "brand-soft-bg",
                )}
              >
                <span className="w-5 text-[13px] font-bold text-faint">{i + 1}</span>
                <Avatar name={uni.shortName} size="sm" className="rounded-lg" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{uni.name}</span>
                  <span className="block text-[12px] text-faint">{uni.city}</span>
                </span>
                <span className="shrink-0 text-[13px] font-semibold text-muted">
                  {formatCount(uni.studentCount)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ----------------------------------------------------- Popüler akış */}
      <section>
        <h2 className="mb-2.5 px-1 text-[15px] font-bold">Popüler gönderiler</h2>
        <Feed query="tab=EXPLORE" emptyTitle="Henüz popüler gönderi yok" />
      </section>
    </div>
  );
}
