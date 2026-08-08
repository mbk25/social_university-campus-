import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { ApiError, api } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { getSocket } from "../../src/lib/socket";
import { palette, radius, spacing, timeAgo } from "../../src/lib/theme";
import type { Conversation, Message } from "../../src/lib/types";
import { Avatar, Loading } from "../../src/components/ui";

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, setCounts } = useAuth();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [draft, setDraft] = useState("");
  const [typingNames, setTypingNames] = useState<string[]>([]);
  const listRef = useRef<FlatList<Message>>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get<{ conversation: Conversation }>(`/chat/conversations/${id}`),
      api.get<{ items: Message[]; nextCursor: string | null }>(
        `/chat/conversations/${id}/messages?limit=40`,
      ),
    ])
      .then(([c, m]) => {
        setConversation(c.conversation);
        // FlatList `inverted` kullandığı için en yeni mesaj başta olmalı.
        setMessages([...m.items].reverse());
        setCursor(m.nextCursor);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const socket = getSocket();
    if (!id) return;
    markConversationRead();
    if (!socket) return;

    socket.emit("conversation:join", id);

    const onMessage = (message: Message) => {
      if (message.conversationId !== id) return;
      setMessages((current) => {
        const withoutPending = current.filter(
          (m) => !(m.pending && m.content === message.content && m.sender.id === message.sender.id),
        );
        if (withoutPending.some((m) => m.id === message.id)) return withoutPending;
        return [{ ...message, isMine: message.sender.id === user?.id }, ...withoutPending];
      });
      markConversationRead();
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
      setTypingNames((current) =>
        data.isTyping
          ? Array.from(new Set([...current, data.displayName]))
          : current.filter((n) => n !== data.displayName),
      );
      if (data.isTyping) {
        setTimeout(
          () => setTypingNames((current) => current.filter((n) => n !== data.displayName)),
          4000,
        );
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
  }, [id, user?.id, markConversationRead]);

  const loadOlder = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await api.get<{ items: Message[]; nextCursor: string | null }>(
        `/chat/conversations/${id}/messages?limit=40&cursor=${cursor}`,
      );
      setMessages((current) => [...current, ...[...data.items].reverse()]);
      setCursor(data.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, id, loadingMore]);

  function emitTyping() {
    const socket = getSocket();
    socket?.emit("typing", { conversationId: id, isTyping: true });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket?.emit("typing", { conversationId: id, isTyping: false });
    }, 2500);
  }

  async function send() {
    const content = draft.trim();
    if (!content || !user) return;

    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: Message = {
      id: `pending-${nonce}`,
      conversationId: id!,
      sender: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
      content,
      attachments: [],
      replyTo: null,
      createdAt: new Date().toISOString(),
      isDeleted: false,
      isMine: true,
      pending: true,
    };

    setMessages((current) => [optimistic, ...current]);
    setDraft("");

    const payload = { conversationId: id, content, clientNonce: nonce };
    const socket = getSocket();

    if (socket?.connected) {
      socket.emit("message:send", payload, (response: { ok: boolean; message?: Message }) => {
        if (response?.ok && response.message) {
          setMessages((current) =>
            current.map((m) => (m.id === optimistic.id ? { ...response.message!, isMine: true } : m)),
          );
        } else {
          setMessages((current) => current.filter((m) => m.id !== optimistic.id));
        }
      });
      return;
    }

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
      if (err instanceof ApiError) console.warn(err.message);
    }
  }

  if (loading) return <Loading label="Sohbet yükleniyor…" />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <Stack.Screen options={{ title: conversation?.title ?? "Sohbet", headerTitleStyle: { fontWeight: "700" } }} />

      <FlatList
        ref={listRef}
        data={messages}
        inverted
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: spacing.lg, gap: 4 }}
        onEndReachedThreshold={0.4}
        onEndReached={loadOlder}
        ListHeaderComponent={
          typingNames.length > 0 ? (
            <Text
              style={{
                color: palette.textFaint,
                fontSize: 12.5,
                fontStyle: "italic",
                paddingHorizontal: spacing.sm,
                paddingVertical: 6,
              }}
            >
              {typingNames.join(", ")} yazıyor…
            </Text>
          ) : null
        }
        ListFooterComponent={loadingMore ? <Loading /> : null}
        renderItem={({ item, index }) => {
          const mine = item.isMine ?? item.sender.id === user?.id;
          // inverted listede "önceki mesaj" bir sonraki indekstir
          const previous = messages[index + 1];
          const sameSender = previous?.sender.id === item.sender.id;

          return (
            <View
              style={{
                flexDirection: "row",
                justifyContent: mine ? "flex-end" : "flex-start",
                gap: 8,
                marginTop: sameSender ? 2 : 8,
              }}
            >
              {!mine && conversation?.type !== "DIRECT" && (
                <View style={{ width: 28 }}>
                  {!sameSender && (
                    <Avatar uri={item.sender.avatarUrl} name={item.sender.displayName} size="xs" />
                  )}
                </View>
              )}

              <View style={{ maxWidth: "78%" }}>
                {!mine && !sameSender && conversation?.type !== "DIRECT" && (
                  <Text
                    style={{
                      color: palette.textMuted,
                      fontSize: 11.5,
                      fontWeight: "600",
                      marginBottom: 2,
                      marginLeft: 4,
                    }}
                  >
                    {item.sender.displayName}
                  </Text>
                )}

                <View
                  style={{
                    backgroundColor: mine ? palette.brandStrong : palette.bgElevated,
                    borderWidth: mine ? 0 : 1,
                    borderColor: palette.border,
                    borderRadius: 20,
                    borderBottomRightRadius: mine ? 4 : radius.lg,
                    borderBottomLeftRadius: mine ? radius.lg : 4,
                    paddingHorizontal: 13,
                    paddingVertical: 10,
                    opacity: item.pending ? 0.6 : 1,
                  }}
                >
                  <Text
                    style={{
                      color: mine ? palette.white : palette.text,
                      fontSize: 14.5,
                      lineHeight: 21,
                      fontStyle: item.isDeleted ? "italic" : "normal",
                      opacity: item.isDeleted ? 0.6 : 1,
                    }}
                  >
                    {item.isDeleted ? "Bu mesaj silindi" : item.content}
                  </Text>
                </View>

                <Text
                  style={{
                    color: palette.textFaint,
                    fontSize: 10.5,
                    marginTop: 3,
                    textAlign: mine ? "right" : "left",
                    marginHorizontal: 4,
                  }}
                >
                  {timeAgo(item.createdAt)}
                </Text>
              </View>
            </View>
          );
        }}
      />

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 6,
          marginHorizontal: spacing.md,
          marginBottom: spacing.sm,
          paddingHorizontal: 7,
          paddingVertical: 6,
          borderTopWidth: 1,
          borderTopColor: palette.border,
          borderRadius: 24,
          backgroundColor: palette.bgSubtle,
        }}
      >
        <TextInput
          value={draft}
          onChangeText={(v) => {
            setDraft(v);
            emitTyping();
          }}
          placeholder="Mesaj yaz..."
          placeholderTextColor={palette.textFaint}
          multiline
          maxLength={4000}
          style={{
            flex: 1,
            maxHeight: 110,
            backgroundColor: "transparent",
            borderRadius: 20,
            paddingHorizontal: 10,
            paddingVertical: 8,
            color: palette.text,
            fontSize: 15,
          }}
        />
        <Pressable
          onPress={send}
          disabled={!draft.trim()}
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: palette.brandStrong,
            alignItems: "center",
            justifyContent: "center",
            opacity: draft.trim() ? 1 : 0.45,
          }}
        >
          <Ionicons name="send" size={18} color={palette.white} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
