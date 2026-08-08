"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, uploadImage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { getSocket } from "@/lib/socket";
import type { Conversation, MediaAsset, Message } from "@/lib/types";
import { ArrowLeftIcon, CloseIcon, ImageIcon, SendIcon } from "@/components/icons";
import { Avatar, Button, Spinner, cx, timeAgo, useToast } from "@/components/ui";

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { user, setCounts } = useAuth();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<MediaAsset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useCallback((smooth = false) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  const syncUnreadMessages = useCallback(() => {
    void api
      .get<{ messages: number }>("/notifications/unread-count")
      .then((counts) => setCounts({ messages: counts.messages }))
      .catch(() => undefined);
  }, [setCounts]);

  const markConversationRead = useCallback(() => {
    void api
      .post(`/chat/conversations/${id}/read`, {})
      .then(syncUnreadMessages)
      .catch(() => undefined);
  }, [id, syncUnreadMessages]);

  // ---- İlk yükleme
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<{ conversation: Conversation }>(`/chat/conversations/${id}`),
      api.get<{ items: Message[]; nextCursor: string | null }>(
        `/chat/conversations/${id}/messages?limit=40`,
      ),
    ])
      .then(([c, m]) => {
        if (cancelled) return;
        setConversation(c.conversation);
        setMessages(m.items);
        setCursor(m.nextCursor);
      })
      .catch((err) => {
        toast.show(err instanceof ApiError ? err.message : "Sohbet yüklenemedi", "error");
        router.push("/mesajlar");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!loading) requestAnimationFrame(() => scrollToBottom());
  }, [loading, scrollToBottom]);

  // ---- Socket olayları
  useEffect(() => {
    const socket = getSocket();
    markConversationRead();
    if (!socket) return;

    socket.emit("conversation:join", id);

    const onMessage = (message: Message) => {
      if (message.conversationId !== id) return;
      setMessages((current) => {
        // İyimser eklenen mesajı gerçeğiyle değiştir
        const withoutPending = current.filter(
          (m) => !(m.pending && m.content === message.content && m.sender.id === message.sender.id),
        );
        if (withoutPending.some((m) => m.id === message.id)) return withoutPending;
        return [...withoutPending, { ...message, isMine: message.sender.id === user?.id }];
      });
      markConversationRead();
      requestAnimationFrame(() => scrollToBottom(true));
    };

    const onDeleted = ({ messageId }: { messageId: string }) => {
      setMessages((current) =>
        current.map((m) => (m.id === messageId ? { ...m, isDeleted: true, content: "" } : m)),
      );
    };

    const onTyping = (data: {
      conversationId: string;
      userId: string;
      displayName: string;
      isTyping: boolean;
    }) => {
      if (data.conversationId !== id || data.userId === user?.id) return;
      setTypingUsers((current) => {
        const next = { ...current };
        if (data.isTyping) next[data.userId] = data.displayName;
        else delete next[data.userId];
        return next;
      });
      if (data.isTyping) {
        setTimeout(() => {
          setTypingUsers((current) => {
            const next = { ...current };
            delete next[data.userId];
            return next;
          });
        }, 4000);
      }
    };

    socket.on("message:new", onMessage);
    socket.on("message:deleted", onDeleted);
    socket.on("typing:update", onTyping);

    return () => {
      socket.emit("conversation:leave", id);
      socket.off("message:new", onMessage);
      socket.off("message:deleted", onDeleted);
      socket.off("typing:update", onTyping);
    };
  }, [id, user?.id, scrollToBottom, markConversationRead]);

  // ---- Yukarı kaydırınca eski mesajlar
  async function loadOlder() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    const container = scrollRef.current;
    const previousHeight = container?.scrollHeight ?? 0;
    try {
      const data = await api.get<{ items: Message[]; nextCursor: string | null }>(
        `/chat/conversations/${id}/messages?limit=40&cursor=${cursor}`,
      );
      setMessages((current) => [...data.items, ...current]);
      setCursor(data.nextCursor);
      requestAnimationFrame(() => {
        if (container) container.scrollTop = container.scrollHeight - previousHeight;
      });
    } finally {
      setLoadingMore(false);
    }
  }

  function emitTyping() {
    const socket = getSocket();
    socket?.emit("typing", { conversationId: id, isTyping: true });
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socket?.emit("typing", { conversationId: id, isTyping: false });
    }, 2500);
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploads = await Promise.all(
        Array.from(files).slice(0, 4).map((f) => uploadImage(f, "message")),
      );
      setAttachments((a) => [...a, ...uploads].slice(0, 4));
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Dosya yüklenemedi", "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function send() {
    const content = draft.trim();
    if ((!content && attachments.length === 0) || sending) return;

    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: Message = {
      id: `pending-${nonce}`,
      conversationId: id,
      sender: {
        id: user!.id,
        username: user!.username,
        displayName: user!.displayName,
        avatarUrl: user!.avatarUrl,
      },
      content,
      attachments,
      replyTo: replyTo
        ? { id: replyTo.id, content: replyTo.content, senderName: replyTo.sender.displayName }
        : null,
      createdAt: new Date().toISOString(),
      isDeleted: false,
      isMine: true,
      pending: true,
    };

    setMessages((current) => [...current, optimistic]);
    setDraft("");
    setAttachments([]);
    setReplyTo(null);
    setSending(true);
    requestAnimationFrame(() => scrollToBottom(true));

    const payload = {
      conversationId: id,
      content,
      attachments: optimistic.attachments,
      replyToId: optimistic.replyTo?.id ?? null,
      clientNonce: nonce,
    };

    const socket = getSocket();
    if (socket?.connected) {
      socket.emit("message:send", payload, (response: { ok: boolean; message?: Message }) => {
        setSending(false);
        if (response?.ok && response.message) {
          setMessages((current) =>
            current.map((m) => (m.id === optimistic.id ? { ...response.message!, isMine: true } : m)),
          );
        } else {
          setMessages((current) => current.filter((m) => m.id !== optimistic.id));
          toast.show("Mesaj gönderilemedi", "error");
        }
      });
      return;
    }

    // Soket yoksa REST üzerinden gönder
    try {
      const result = await api.post<{ message: Message }>(
        `/chat/conversations/${id}/messages`,
        payload,
      );
      setMessages((current) =>
        current.map((m) => (m.id === optimistic.id ? { ...result.message, isMine: true } : m)),
      );
    } catch (err) {
      setMessages((current) => current.filter((m) => m.id !== optimistic.id));
      toast.show(err instanceof ApiError ? err.message : "Mesaj gönderilemedi", "error");
    } finally {
      setSending(false);
    }
  }

  async function deleteMessage(messageId: string) {
    if (!confirm("Mesaj silinsin mi?")) return;
    try {
      await api.delete(`/chat/messages/${messageId}`);
      setMessages((current) =>
        current.map((m) => (m.id === messageId ? { ...m, isDeleted: true, content: "" } : m)),
      );
    } catch {
      toast.show("Mesaj silinemedi", "error");
    }
  }

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Spinner size={26} className="text-muted" />
      </div>
    );
  }

  const typingNames = Object.values(typingUsers);

  return (
    <div className="mx-auto flex h-[calc(100vh-140px)] w-full max-w-[720px] flex-col lg:h-[calc(100vh-64px)]">
      {/* ------------------------------------------------------------ Başlık */}
      <header className="surface flex items-center gap-3 rounded-t-[var(--radius-card)] px-4 py-3">
        <button
          onClick={() => router.push("/mesajlar")}
          className="rounded-lg p-1.5 text-muted hover:bg-[var(--bg-subtle)] lg:hidden"
          aria-label="Geri"
        >
          <ArrowLeftIcon width={20} height={20} />
        </button>

        {conversation?.type === "DIRECT" && conversation.peerUsername ? (
          <Link href={`/u/${conversation.peerUsername}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar src={conversation.avatarUrl} name={conversation.title ?? "?"} size="md" />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold">{conversation.title}</span>
              <span className="block truncate text-[12.5px] text-faint">
                @{conversation.peerUsername}
              </span>
            </span>
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar
              src={conversation?.avatarUrl}
              name={conversation?.title ?? "Sohbet"}
              size="md"
              className="rounded-xl"
            />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold">{conversation?.title}</span>
              <span className="block text-[12.5px] text-faint">
                {conversation?.type === "COMMUNITY"
                  ? "Topluluk sohbeti"
                  : `${conversation?.members.length ?? 0} kişi`}
              </span>
            </span>
          </div>
        )}
      </header>

      {/* ----------------------------------------------------------- Mesajlar */}
      <div
        ref={scrollRef}
        onScroll={(e) => {
          if (e.currentTarget.scrollTop < 80) void loadOlder();
        }}
        className="surface flex-1 space-y-1 overflow-y-auto border-y-0 px-3 py-3"
      >
        {loadingMore && (
          <div className="flex justify-center py-2">
            <Spinner size={18} className="text-muted" />
          </div>
        )}
        {!cursor && messages.length > 0 && (
          <p className="py-3 text-center text-[12.5px] text-faint">Sohbetin başlangıcı</p>
        )}

        {messages.map((message, i) => {
          const previous = messages[i - 1];
          const sameSender = previous?.sender.id === message.sender.id;
          const showAvatar = !sameSender || conversation?.type === "DIRECT";
          const mine = message.isMine ?? message.sender.id === user?.id;

          return (
            <div
              key={message.id}
              className={cx("group flex gap-2", mine ? "justify-end" : "justify-start")}
            >
              {!mine && conversation?.type !== "DIRECT" && (
                <div className="w-8 shrink-0 self-end">
                  {showAvatar && (
                    <Avatar src={message.sender.avatarUrl} name={message.sender.displayName} size="xs" />
                  )}
                </div>
              )}

              <div className={cx("max-w-[78%] sm:max-w-[68%]", mine && "items-end")}>
                {!mine && !sameSender && conversation?.type !== "DIRECT" && (
                  <p className="mb-0.5 pl-1 text-[12px] font-semibold text-muted">
                    {message.sender.displayName}
                  </p>
                )}

                <div
                  className={cx(
                    "relative rounded-2xl px-3.5 py-2 text-[14.5px] leading-relaxed",
                    mine
                      ? "rounded-br-md bg-[var(--brand)] text-white"
                      : "rounded-bl-md surface-subtle",
                    message.pending && "opacity-60",
                  )}
                >
                  {message.replyTo && (
                    <div
                      className={cx(
                        "mb-1.5 rounded-lg border-l-2 px-2 py-1 text-[12.5px]",
                        mine ? "border-white/50 bg-white/15" : "border-[var(--brand)] bg-[var(--bg)]",
                      )}
                    >
                      <span className="block font-semibold opacity-90">
                        {message.replyTo.senderName}
                      </span>
                      <span className="line-clamp-1 opacity-75">{message.replyTo.content}</span>
                    </div>
                  )}

                  {message.isDeleted ? (
                    <span className="italic opacity-60">Bu mesaj silindi</span>
                  ) : (
                    <>
                      {message.attachments.length > 0 && (
                        <div className="mb-1.5 grid gap-1.5">
                          {message.attachments.map((a) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={a.url}
                              src={a.url}
                              alt=""
                              className="max-h-64 rounded-lg object-cover"
                            />
                          ))}
                        </div>
                      )}
                      {message.content && (
                        <span className="whitespace-pre-wrap break-words">{message.content}</span>
                      )}
                    </>
                  )}
                </div>

                <div
                  className={cx(
                    "mt-0.5 flex items-center gap-2 px-1 text-[11px] text-faint",
                    mine && "justify-end",
                  )}
                >
                  <span>{timeAgo(message.createdAt)}</span>
                  {!message.isDeleted && (
                    <>
                      <button
                        onClick={() => setReplyTo(message)}
                        className="opacity-0 transition-opacity hover:underline group-hover:opacity-100"
                      >
                        yanıtla
                      </button>
                      {mine && !message.pending && (
                        <button
                          onClick={() => deleteMessage(message.id)}
                          className="opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100"
                        >
                          sil
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {typingNames.length > 0 && (
          <p className="px-2 py-1 text-[12.5px] italic text-faint">
            {typingNames.join(", ")} yazıyor…
          </p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ------------------------------------------------------------ Yazma */}
      <div className="surface rounded-b-[var(--radius-card)] px-3 py-2.5">
        {replyTo && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-lg surface-subtle px-3 py-1.5 text-[12.5px]">
            <span className="min-w-0 truncate">
              <strong>{replyTo.sender.displayName}</strong>: {replyTo.content.slice(0, 60)}
            </span>
            <button onClick={() => setReplyTo(null)} aria-label="İptal">
              <CloseIcon width={15} height={15} />
            </button>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="mb-2 flex gap-2">
            {attachments.map((a) => (
              <div key={a.url} className="relative h-16 w-16 overflow-hidden rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt="" className="h-full w-full object-cover" />
                <button
                  onClick={() => setAttachments((list) => list.filter((x) => x.url !== a.url))}
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/70 p-0.5 text-white"
                  aria-label="Kaldır"
                >
                  <CloseIcon width={12} height={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-[var(--bg-subtle)] hover:brand-text"
            aria-label="Görsel ekle"
          >
            {uploading ? <Spinner size={19} /> : <ImageIcon width={20} height={20} />}
          </button>

          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              emitTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Mesaj yaz..."
            rows={1}
            maxLength={4000}
            className="max-h-32 flex-1 resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] px-3.5 py-2.5 text-[15px] outline-none focus-ring"
          />

          <Button
            onClick={send}
            disabled={(!draft.trim() && attachments.length === 0) || sending}
            className="h-10 w-10 !p-0"
            aria-label="Gönder"
          >
            <SendIcon width={18} height={18} />
          </Button>
        </div>
      </div>
    </div>
  );
}
