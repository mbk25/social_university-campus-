import { router } from "expo-router";
import { useCallback, useEffect } from "react";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { api } from "../src/lib/api";
import { useAuth } from "../src/lib/auth";
import { getSocket } from "../src/lib/socket";
import { palette, spacing, timeAgo } from "../src/lib/theme";
import type { Notification } from "../src/lib/types";
import { Avatar, Divider, Empty, Loading } from "../src/components/ui";

const TYPE_ICON: Record<string, string> = {
  FOLLOW: "👤",
  POST_LIKE: "❤️",
  COMMENT: "💬",
  COMMENT_LIKE: "❤️",
  COMMENT_REPLY: "↩️",
  MENTION: "@",
  COMMUNITY_JOIN_REQUEST: "🙋",
  COMMUNITY_JOIN_APPROVED: "🎉",
  EVENT_NEW: "📅",
  MESSAGE: "✉️",
  BADGE_EARNED: "🏅",
  SYSTEM: "🔔",
};

/** Web yollarını mobil rotalara çevirir. */
function toMobileRoute(link: string | null): string | null {
  if (!link) return null;
  if (link.startsWith("/gonderi/")) return link;
  if (link.startsWith("/u/")) return `/profil/${link.slice(3)}`;
  if (link.startsWith("/topluluk/")) return link;
  if (link.startsWith("/mesajlar/")) return `/sohbet/${link.slice(10)}`;
  return null;
}

export default function NotificationsScreen() {
  const { setCounts } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (next?: string | null) => {
    try {
      const params = new URLSearchParams({ limit: "25" });
      if (next) params.set("cursor", next);
      const data = await api.get<{ items: Notification[]; nextCursor: string | null }>(
        `/notifications?${params}`,
      );
      setItems((current) => (next ? [...current, ...data.items] : data.items));
      setCursor(data.nextCursor);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(null);
    api
      .post("/notifications/read")
      .then(() => setCounts({ notifications: 0 }))
      .catch(() => undefined);

    const socket = getSocket();
    const handler = (n: Notification) => setItems((current) => [n, ...current]);
    socket?.on("notification:new", handler);
    return () => {
      socket?.off("notification:new", handler);
    };
  }, [load, setCounts]);

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: palette.bg }}
      data={items}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
      ItemSeparatorComponent={Divider}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={palette.brand}
          onRefresh={() => {
            setRefreshing(true);
            void load(null);
          }}
        />
      }
      onEndReached={() => cursor && load(cursor)}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={
        loading ? (
          <Loading />
        ) : (
          <Empty
            icon="notifications-outline"
            title="Bildirim yok"
            description="Biri seni takip ettiğinde ya da gönderini beğendiğinde burada göreceksin."
          />
        )
      }
      renderItem={({ item }) => {
        const route = toMobileRoute(item.link);
        return (
          <Pressable
            onPress={() => route && router.push(route as never)}
            style={({ pressed }) => ({
              flexDirection: "row",
              gap: spacing.md,
              paddingHorizontal: spacing.lg,
              paddingVertical: 14,
              backgroundColor: pressed
                ? palette.bgElevated
                : item.isRead
                  ? "transparent"
                  : palette.brandSoft,
            })}
          >
            {item.actor ? (
              <Avatar uri={item.actor.avatarUrl} name={item.actor.displayName} size="md" />
            ) : (
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: palette.bgElevated,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 19 }}>{TYPE_ICON[item.type] ?? "🔔"}</Text>
              </View>
            )}

            <View style={{ flex: 1 }}>
              <Text style={{ color: palette.text, fontSize: 14.5, lineHeight: 20 }}>
                {TYPE_ICON[item.type] ?? ""} {item.text}
              </Text>
              <Text style={{ color: palette.textFaint, fontSize: 12, marginTop: 3 }}>
                {timeAgo(item.createdAt)}
              </Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}
