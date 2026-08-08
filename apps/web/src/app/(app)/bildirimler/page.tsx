"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getSocket } from "@/lib/socket";
import type { Notification } from "@/lib/types";
import { BellIcon } from "@/components/icons";
import { Avatar, Button, EmptyState, Skeleton, cx, timeAgo } from "@/components/ui";

const TYPE_ICON: Record<string, string> = {
  FOLLOW: "👤",
  POST_LIKE: "❤️",
  COMMENT: "💬",
  COMMENT_LIKE: "❤️",
  COMMENT_REPLY: "↩️",
  MENTION: "@",
  COMMUNITY_INVITE: "✉️",
  COMMUNITY_JOIN_REQUEST: "🙋",
  COMMUNITY_JOIN_APPROVED: "🎉",
  COMMUNITY_POST: "📌",
  EVENT_REMINDER: "⏰",
  EVENT_NEW: "📅",
  MESSAGE: "✉️",
  BADGE_EARNED: "🏅",
  SYSTEM: "🔔",
};

const FILTERS = [
  { key: "ALL", label: "Tümü" },
  { key: "UNREAD", label: "Okunmamış" },
  { key: "MENTIONS", label: "Bahsetmeler" },
] as const;

export default function NotificationsPage() {
  const { setCounts } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("ALL");

  const load = useCallback(
    async (next?: string | null) => {
      if (!next) setLoading(true);
      try {
        const params = new URLSearchParams({ filter, limit: "25" });
        if (next) params.set("cursor", next);
        const data = await api.get<{ items: Notification[]; nextCursor: string | null }>(
          `/notifications?${params}`,
        );
        setItems((current) => (next ? [...current, ...data.items] : data.items));
        setCursor(data.nextCursor);
      } finally {
        setLoading(false);
      }
    },
    [filter],
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  // Sayfa açıkken gelen bildirimleri anında ekle
  useEffect(() => {
    const socket = getSocket();
    const handler = (n: Notification) => {
      if (n.type !== "MESSAGE") setItems((current) => [n, ...current]);
    };
    socket?.on("notification:new", handler);
    return () => {
      socket?.off("notification:new", handler);
    };
  }, []);

  // Sayfa açılınca hepsini okundu işaretle
  useEffect(() => {
    api
      .post("/notifications/read")
      .then(() => setCounts({ notifications: 0 }))
      .catch(() => undefined);
  }, [setCounts]);

  return (
    <div className="mx-auto w-full max-w-[620px] space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-[26px] font-black tracking-tight">Bildirimler</h1>
        {items.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await api.delete("/notifications");
              void load(null);
            }}
          >
            Okunanları temizle
          </Button>
        )}
      </header>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cx(
              "rounded-full px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors",
              filter === f.key ? "bg-[var(--brand)] text-white" : "surface-subtle text-muted",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<BellIcon width={26} height={26} />}
          title="Bildirim yok"
          description="Biri seni takip ettiğinde, gönderini beğendiğinde ya da senden bahsettiğinde burada göreceksin."
        />
      ) : (
        <div className="surface divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius-card)]">
          {items.map((n) => {
            const className = cx(
              "flex items-start gap-3 p-3.5 transition-colors",
              n.link && "hover:bg-[var(--bg-subtle)]",
              !n.isRead && "brand-soft-bg",
            );
            const Wrapper = ({ children }: { children: React.ReactNode }) =>
              n.link ? (
                <Link href={n.link} className={className}>
                  {children}
                </Link>
              ) : (
                <div className={className}>{children}</div>
              );

            return (
              <Wrapper key={n.id}>
                {n.actor ? (
                  <Avatar src={n.actor.avatarUrl} name={n.actor.displayName} size="md" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full surface-subtle text-lg">
                    {TYPE_ICON[n.type] ?? "🔔"}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] leading-snug">
                    <span className="mr-1.5">{TYPE_ICON[n.type] ?? ""}</span>
                    {n.text}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-faint">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.isRead && (
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--brand)]" />
                )}
              </Wrapper>
            );
          })}
        </div>
      )}

      {cursor && (
        <button
          onClick={() => void load(cursor)}
          className="w-full rounded-xl py-2.5 text-[14px] font-semibold brand-text hover:bg-[var(--bg-subtle)]"
        >
          Daha fazla
        </button>
      )}
    </div>
  );
}
