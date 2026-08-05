"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { Conversation } from "@/lib/types";
import { ChatIcon, UsersIcon } from "@/components/icons";
import { Avatar, Button, EmptyState, Skeleton, cx, timeAgo } from "@/components/ui";

export default function MessagesPage() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="mx-auto w-full max-w-[620px] space-y-4">
      <h1 className="text-[26px] font-black tracking-tight">Mesajlar</h1>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[72px] rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : items.length === 0 ? (
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
        <div className="surface divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius-card)]">
          {items.map((conversation) => (
            <Link
              key={conversation.id}
              href={`/mesajlar/${conversation.id}`}
              className="flex items-center gap-3 p-3.5 transition-colors hover:bg-[var(--bg-subtle)]"
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
                      : conversation.lastMessage?.content ||
                        (conversation.lastMessage?.attachments.length
                          ? "📎 Dosya"
                          : "Henüz mesaj yok")}
                  </span>
                  {conversation.unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] px-1.5 text-[11px] font-bold text-white">
                      {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                    </span>
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
    </div>
  );
}
