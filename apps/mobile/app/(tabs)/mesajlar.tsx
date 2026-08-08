import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from "react-native";
import { api } from "../../src/lib/api";
import { getSocket } from "../../src/lib/socket";
import { palette, spacing, timeAgo } from "../../src/lib/theme";
import type { Conversation } from "../../src/lib/types";
import { Avatar, Divider, Empty, Loading } from "../../src/components/ui";

export default function MessagesScreen() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ items: Conversation[] }>("/chat/conversations?limit=50");
      setItems(data.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const socket = getSocket();
    socket?.on("conversation:updated", load);
    socket?.on("message:new", load);
    return () => {
      socket?.off("conversation:updated", load);
      socket?.off("message:new", load);
    };
  }, [load]);

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: palette.bg }}
      data={items.filter((item) => `${item.title ?? ""} ${item.lastMessage?.content ?? ""}`.toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr")))}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
      ListHeaderComponent={
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
            <View>
              <Text style={{ color: palette.text, fontSize: 24, fontWeight: "800", letterSpacing: -0.4 }}>Mesajlar</Text>
              <Text style={{ color: palette.textMuted, fontSize: 12.5, marginTop: 2 }}>Özel konuşmaların ve toplulukların</Text>
            </View>
            <Pressable onPress={() => router.push("/ara")} hitSlop={10} style={{ width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19, backgroundColor: palette.bgElevated }}>
              <Ionicons name="create-outline" size={21} color={palette.text} />
            </Pressable>
          </View>
          <View style={{ height: 40, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, backgroundColor: palette.bgElevated, paddingHorizontal: 12 }}>
            <Ionicons name="search-outline" size={18} color={palette.textFaint} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Mesajlarda ara" placeholderTextColor={palette.textFaint} style={{ flex: 1, color: palette.text, fontSize: 14 }} />
          </View>
        </View>
      }
      ItemSeparatorComponent={Divider}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={palette.brand}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
        />
      }
      ListEmptyComponent={
        loading ? (
          <Loading />
        ) : (
          <Empty
            icon="chatbubbles-outline"
            title="Henüz mesajın yok"
            description="Bir profile git ve mesaj gönder, ya da bir topluluğun sohbetine katıl."
          />
        )
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/sohbet/${item.id}`)}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: 13,
            backgroundColor: pressed || item.unreadCount > 0 ? palette.brandSoft : "transparent",
          })}
        >
          <Avatar
            uri={item.avatarUrl}
            name={item.title ?? "Sohbet"}
            size="lg"
            square={item.type !== "DIRECT"}
          />

          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <Text
                style={{ color: palette.text, fontSize: 15, fontWeight: "700", flex: 1 }}
                numberOfLines={1}
              >
                {item.title ?? "Sohbet"}
              </Text>
              <Text style={{ color: palette.textFaint, fontSize: 11.5 }}>
                {item.lastMessage ? timeAgo(item.lastMessage.createdAt) : ""}
              </Text>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
              <Text
                style={{
                  color: item.unreadCount > 0 ? palette.text : palette.textMuted,
                  fontSize: 13.5,
                  fontWeight: item.unreadCount > 0 ? "600" : "400",
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {item.type !== "DIRECT" && item.lastMessage
                  ? `${item.lastMessage.sender.displayName}: `
                  : ""}
                {item.lastMessage?.isDeleted
                  ? "Mesaj silindi"
                  : item.lastMessage?.sharedPost
                    ? "Bir gönderi paylaştı"
                  : item.lastMessage?.content ||
                    (item.lastMessage?.attachments.length ? "📎 Dosya" : "Henüz mesaj yok")}
              </Text>

              {item.unreadCount > 0 && (
                <View
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 5,
                    backgroundColor: palette.brandStrong,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                </View>
              )}
            </View>
          </View>
        </Pressable>
      )}
    />
  );
}
