"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getSocket } from "@/lib/socket";
import type { Conversation } from "@/lib/types";
import { ChatIcon, PlusIcon, SearchIcon, SendIcon } from "@/components/icons";
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
    socket?.on("presence:update", handler);
    return () => {
      socket?.off("conversation:updated", handler);
      socket?.off("message:new", handler);
      socket?.off("presence:update", handler);
    };
  }, [load]);

  const visibleItems = useMemo(
    () =>
      items.filter((conversation) =>
        `${conversation.title ?? ""} ${conversation.lastMessage?.content ?? ""}`
          .toLocaleLowerCase("tr")
          .includes(query.toLocaleLowerCase("tr")),
      ),
    [items, query],
  );

  const quickItems = items
    .filter((item) => item.type === "DIRECT")
    .sort((a, b) => Number(!!b.isOnline) - Number(!!a.isOnline))
    .slice(0, 6);

  return (
    <div className="mx-auto h-[calc(100dvh-7.5rem)] min-h-[600px] w-full max-w-[1090px] overflow-hidden rounded-[28px] border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[0_24px_80px_-40px_rgba(0,0,0,.75)] sm:h-[calc(100dvh-2rem)]">
      <div className="grid h-full grid-cols-1 lg:grid-cols-[390px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col bg-[var(--bg-elevated)] lg:border-r lg:border-[var(--border)]">
          <header className="flex items-center justify-between px-6 pb-4 pt-6">
            <div className="min-w-0">
              <h1 className="truncate text-[21px] font-black tracking-tight">{user?.username ?? "Mesajlar"}</h1>
              <p className="mt-0.5 text-[12.5px] text-faint">Gelen kutun</p>
            </div>
            <Link
              href="/ara"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-subtle)] text-[var(--text)] transition-all hover:scale-105 hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]"
              aria-label="Yeni mesaj"
              title="Yeni mesaj"
            >
              <PlusIcon width={22} height={22} />
            </Link>
          </header>

          <div className="px-5">
            <label className="flex h-11 items-center gap-2.5 rounded-2xl bg-[var(--bg-subtle)] px-3.5 text-muted transition-shadow focus-within:ring-2 focus-within:ring-[var(--ring)]">
              <SearchIcon width={18} height={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Mesajlarda ara"
                className="min-w-0 flex-1 bg-transparent text-[14px] text-[var(--text)] outline-none placeholder:text-[var(--text-faint)]"
              />
            </label>
          </div>

          {quickItems.length > 0 && !query && (
            <div className="px-5 pb-4 pt-5">
              <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.08em] text-faint">Hızlı erişim</p>
              <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                {quickItems.map((conversation) => (
                  <Link key={conversation.id} href={`/mesajlar/${conversation.id}`} className="w-[58px] shrink-0 text-center">
                    <span className="relative inline-flex rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-amber-400 p-[2px]">
                      <Avatar src={conversation.avatarUrl} name={conversation.title ?? "Sohbet"} size="md" className="ring-2 ring-[var(--bg-elevated)]" />
                      {conversation.isOnline && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[var(--bg-elevated)] bg-emerald-500" aria-label="Çevrimiçi" />}
                    </span>
                    <span className="mt-1.5 block truncate text-[11px] font-medium text-muted">{conversation.title ?? "Sohbet"}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between px-6 pb-2 pt-2">
            <h2 className="text-[16px] font-bold">Mesajlar</h2>
            <Link href="/ara" className="text-[12.5px] font-bold brand-text hover:underline">Oluştur</Link>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
            {loading ? (
              <div className="space-y-1 px-2 pt-1">
                {[0, 1, 2, 3, 4, 5].map((item) => <Skeleton key={item} className="h-[76px] rounded-2xl" />)}
              </div>
            ) : visibleItems.length > 0 ? (
              visibleItems.map((conversation) => (
                <Link
                  key={conversation.id}
                  href={`/mesajlar/${conversation.id}`}
                  className={cx(
                    "group mx-1 flex items-center gap-3 rounded-2xl px-3 py-3 transition-all hover:bg-[var(--bg-subtle)]",
                    conversation.unreadCount > 0 && "bg-[var(--brand-soft)]/45",
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
                  {conversation.unreadCount > 0 && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--brand)] shadow-[0_0_0_4px_var(--brand-soft)]" aria-label={`${conversation.unreadCount} okunmamış mesaj`} />}
                </Link>
              ))
            ) : (
              <div className="px-8 py-14 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl brand-soft-bg brand-text"><ChatIcon width={24} height={24} /></span>
                <p className="mt-3 text-sm font-bold">{query ? "Sonuç bulunamadı" : "Henüz mesajın yok"}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{query ? "Farklı bir arama deneyebilirsin." : "Bir öğrencinin profilinden yeni bir sohbet başlatabilirsin."}</p>
              </div>
            )}
          </div>
        </aside>

        <section className="relative hidden overflow-hidden lg:flex lg:flex-col lg:items-center lg:justify-center lg:px-10 lg:text-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,104,255,.12),transparent_43%)]" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--brand)] shadow-[0_20px_45px_-25px_var(--brand)]">
            <SendIcon width={43} height={43} />
          </div>
          <h2 className="relative mt-6 text-[26px] font-black tracking-tight">Mesajların</h2>
          <p className="relative mt-2 max-w-sm text-[14.5px] leading-relaxed text-muted">Arkadaşlarınla ve topluluklarınla bağlantıda kal. Bir mesaj göndererek yeni bir sohbet başlat.</p>
          <Link href="/ara" className="relative mt-6"><Button size="md" icon={<PlusIcon width={17} height={17} />}>Yeni mesaj</Button></Link>
        </section>
      </div>
    </div>
  );
}
