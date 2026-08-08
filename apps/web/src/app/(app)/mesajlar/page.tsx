"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { Conversation } from "@/lib/types";
import { ChatIcon, PlusIcon, SearchIcon, UsersIcon } from "@/components/icons";
import { Avatar, Button, EmptyState, Skeleton, cx, timeAgo } from "@/components/ui";

export default function MessagesPage() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ items: Conversation[] }>("/chat/conversations?limit=50");
      setItems(data.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const socket = getSocket();
    const handler = () => void load();
    socket?.on("conversation:updated", handler);
    socket?.on("message:new", handler);
    return () => {
      socket?.off("conversation:updated", handler);
      socket?.off("message:new", handler);
    };
  }, [load]);

  const visibleItems = items.filter((conversation) =>
    `${conversation.title ?? ""} ${conversation.lastMessage?.content ?? ""}`
      .toLocaleLowerCase("tr")
      .includes(query.toLocaleLowerCase("tr")),
  );

  return (
    <div className="mx-auto w-full max-w-[680px]">
      <section className="surface overflow-hidden rounded-[var(--radius-card)]">
        <header className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h1 className="text-[20px] font-black tracking-tight">Mesajlar</h1>
            <p className="mt-0.5 text-[12.5px] text-muted">Özel konuşmaların ve topluluk sohbetlerin</p>
          </div>
          <Link href="/ara" className="rounded-full p-2 text-[var(--text)] transition-colors hover:bg-[var(--bg-subtle)]" aria-label="Yeni mesaj">
            <PlusIcon width={22} height={22} />
          </Link>
        </header>

        <div className="px-4 pt-4">
          <label className="flex h-10 items-center gap-2 rounded-xl bg-[var(--bg-subtle)] px-3 text-muted focus-within:ring-2 focus-within:ring-[var(--ring)]">
            <SearchIcon width={18} height={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Mesajlarda ara" className="min-w-0 flex-1 bg-transparent text-[14px] text-[var(--text)] outline-none placeholder:text-[var(--text-faint)]" />
          </label>
        </div>

      {loading ? (
        <div className="space-y-2 p-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[72px] rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : visibleItems.length === 0 ? (
        <EmptyState
          icon={<ChatIcon width={26} height={26} />}
          title="Henüz mesajın yok"
          description="Bir profile git ve 'Mesaj' butonuna bas, ya da bir topluluğun sohbetine katıl."
          action={
            <Link href="/topluluklar">
              <Button icon={<UsersIcon width={17} height={17} />}>Topluluklara göz at</Button>
            </Link>
          }
        />
      ) : (
        <div className="mt-3 divide-y divide-[var(--border)]">
          {visibleItems.map((conversation) => (
            <Link
              key={conversation.id}
              href={`/mesajlar/${conversation.id}`}
              className={cx("flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--bg-subtle)]", conversation.unreadCount > 0 && "bg-[var(--brand-soft)]/30")}
            >
              <Avatar
                src={conversation.avatarUrl}
                name={conversation.title ?? "Sohbet"}
                size="lg"
                className={conversation.type !== "DIRECT" ? "rounded-2xl" : undefined}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[15px] font-bold">
                    {conversation.title ?? "Sohbet"}
                  </span>
                  <span className="shrink-0 text-[12px] text-faint">
                    {conversation.lastMessage ? timeAgo(conversation.lastMessage.createdAt) : ""}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cx(
                      "truncate text-[13.5px]",
                      conversation.unreadCount > 0 ? "font-semibold text-[var(--text)]" : "text-muted",
                    )}
                  >
                    {conversation.type !== "DIRECT" && conversation.lastMessage
                      ? `${conversation.lastMessage.sender.displayName}: `
                      : ""}
                    {conversation.lastMessage?.isDeleted
                      ? "Mesaj silindi"
                      : conversation.lastMessage?.sharedPost
                        ? "Bir gönderi paylaştı"
                      : conversation.lastMessage?.content ||
                        (conversation.lastMessage?.attachments.length
                          ? "📎 Dosya"
                          : "Henüz mesaj yok")}
                  </span>
                  {conversation.unreadCount > 0 && (
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--brand)]" aria-label={`${conversation.unreadCount} okunmamış mesaj`} />
                  )}
                </div>
                {conversation.type === "COMMUNITY" && (
                  <span className="mt-0.5 block text-[11.5px] text-faint">Topluluk sohbeti</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
      </section>
    </div>
  );
}
