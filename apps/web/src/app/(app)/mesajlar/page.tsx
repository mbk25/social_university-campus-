"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getSocket } from "@/lib/socket";
import type { Conversation } from "@/lib/types";
import { ChatIcon, PlusIcon, SearchIcon, SendIcon, UsersIcon } from "@/components/icons";
import { Avatar, Button, Skeleton, cx, timeAgo } from "@/components/ui";

function preview(conversation: Conversation) {
  const message = conversation.lastMessage;
  if (!message) return "Henüz mesaj yok";
  if (message.isDeleted) return "Mesaj silindi";
  if (message.sharedPost) return "Bir gönderi paylaştı";
  if (message.content) return message.content;
  return message.attachments.length ? "📎 Dosya gönderdi" : "Henüz mesaj yok";
}

export default function MessagesPage() {
  const { user } = useAuth();
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
    <div className="mx-auto h-[calc(100dvh-7.5rem)] min-h-[560px] w-full max-w-[1000px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg)] sm:h-[calc(100dvh-3.5rem)]">
      <div className="grid h-full grid-cols-1 md:grid-cols-[370px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r border-[var(--border)] bg-[var(--bg-elevated)]">
          <header className="flex items-center justify-between px-5 pb-3 pt-5">
            <div className="min-w-0">
              <h1 className="truncate text-[18px] font-black tracking-tight">{user?.username ?? "Mesajlar"}</h1>
              <p className="mt-0.5 text-[12px] text-faint">Özel konuşmaların</p>
            </div>
            <Link
              href="/ara"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--text)] transition-colors hover:bg-[var(--bg-subtle)]"
              aria-label="Yeni mesaj"
              title="Yeni mesaj"
            >
              <PlusIcon width={22} height={22} />
            </Link>
          </header>

          <div className="px-4 pb-4">
            <label className="flex h-10 items-center gap-2 rounded-xl bg-[var(--bg-subtle)] px-3 text-muted focus-within:ring-2 focus-within:ring-[var(--ring)]">
              <SearchIcon width={18} height={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ara"
                className="min-w-0 flex-1 bg-transparent text-[14px] text-[var(--text)] outline-none placeholder:text-[var(--text-faint)]"
              />
            </label>
          </div>

          <div className="flex items-center justify-between px-5 pb-2">
            <h2 className="text-[16px] font-bold">Mesajlar</h2>
            <Link href="/ara" className="text-[12.5px] font-semibold brand-text hover:underline">Yeni mesaj</Link>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pb-4">
            {loading ? (
              <div className="space-y-1 px-3">
                {[0, 1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-[76px] rounded-xl" />)}
              </div>
            ) : visibleItems.length > 0 ? (
              visibleItems.map((conversation) => (
                <Link
                  key={conversation.id}
                  href={`/mesajlar/${conversation.id}`}
                  className={cx(
                    "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-subtle)]",
                    conversation.unreadCount > 0 && "bg-[var(--brand-soft)]/30",
                  )}
                >
                  <Avatar
                    src={conversation.avatarUrl}
                    name={conversation.title ?? "Sohbet"}
                    size="lg"
                    className={conversation.type !== "DIRECT" ? "rounded-2xl" : undefined}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-1.5">
                      <span className={cx("truncate text-[14.5px]", conversation.unreadCount > 0 ? "font-bold" : "font-semibold")}>{conversation.title ?? "Sohbet"}</span>
                      {conversation.lastMessage && <span className="shrink-0 text-[11.5px] text-faint">· {timeAgo(conversation.lastMessage.createdAt)}</span>}
                    </span>
                    <span className={cx("mt-0.5 block truncate text-[13px]", conversation.unreadCount > 0 ? "font-semibold text-[var(--text)]" : "text-muted")}>
                      {conversation.type !== "DIRECT" && conversation.lastMessage ? `${conversation.lastMessage.sender.displayName}: ` : ""}
                      {preview(conversation)}
                    </span>
                  </span>
                  {conversation.unreadCount > 0 && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--brand)]" aria-label={`${conversation.unreadCount} okunmamış mesaj`} />}
                </Link>
              ))
            ) : (
              <div className="px-7 py-12 text-center">
                <ChatIcon width={28} height={28} className="mx-auto text-faint" />
                <p className="mt-3 text-sm font-semibold">{query ? "Sonuç bulunamadı" : "Henüz mesajın yok"}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{query ? "Farklı bir arama deneyebilirsin." : "Bir öğrencinin profilinden sohbet başlatabilirsin."}</p>
              </div>
            )}
          </div>
        </aside>

        <section className="hidden flex-col items-center justify-center px-6 text-center md:flex">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-[var(--text)]/80 text-[var(--text)]">
            <SendIcon width={39} height={39} />
          </div>
          <h2 className="mt-5 text-[22px] font-normal">Mesajların</h2>
          <p className="mt-1 max-w-sm text-[14px] text-muted">Bir arkadaşına veya topluluğuna özel mesajlar, görseller ve gönderiler gönder.</p>
          <Link href="/ara" className="mt-5"><Button size="sm" icon={<UsersIcon width={16} height={16} />}>Mesaj gönder</Button></Link>
        </section>
      </div>
    </div>
  );
}
