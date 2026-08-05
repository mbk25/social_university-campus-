import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, ScrollView, Text, View } from "react-native";
import { ApiError, api } from "../src/lib/api";
import { palette, radius, spacing } from "../src/lib/theme";
import type { KampusEvent } from "../src/lib/types";
import { Avatar, Button, Chip, Empty, Loading } from "../src/components/ui";

const SCOPES = [
  { key: "ALL", label: "Tümü" },
  { key: "UNIVERSITY", label: "Üniversitem" },
  { key: "ATTENDING", label: "Katılacaklarım" },
] as const;

export default function EventsScreen() {
  const [scope, setScope] = useState<(typeof SCOPES)[number]["key"]>("ALL");
  const [items, setItems] = useState<KampusEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ items: KampusEvent[] }>(
        `/events?scope=${scope}&when=UPCOMING&limit=30`,
      );
      setItems(data.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [scope]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, gap: 8 }}
        style={{ flexGrow: 0 }}
      >
        {SCOPES.map((s) => (
          <Chip key={s.key} label={s.label} active={scope === s.key} onPress={() => setScope(s.key)} />
        ))}
      </ScrollView>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: 40,
          gap: spacing.md,
          flexGrow: 1,
        }}
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
              icon="calendar-outline"
              title="Yaklaşan etkinlik yok"
              description="Kampüsündeki ilk etkinliği web sitesinden oluşturabilirsin."
            />
          )
        }
        renderItem={({ item }) => <EventCard event={item} onChange={load} />}
      />
    </View>
  );
}

function EventCard({ event, onChange }: { event: KampusEvent; onChange: () => void }) {
  const [attending, setAttending] = useState(!!event.viewer?.isAttending);
  const [count, setCount] = useState(event.attendeeCount);
  const [busy, setBusy] = useState(false);

  const start = new Date(event.startsAt);
  const isFull = !!event.capacity && count >= event.capacity && !attending;

  async function toggle() {
    setBusy(true);
    try {
      const result = await (attending
        ? api.delete<{ attendeeCount: number }>(`/events/${event.id}/attend`)
        : api.post<{ attendeeCount: number }>(`/events/${event.id}/attend`));
      setAttending(!attending);
      setCount(result.attendeeCount);
      onChange();
    } catch (err) {
      if (err instanceof ApiError) console.warn(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View
      style={{
        backgroundColor: palette.bgElevated,
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: radius.lg,
        padding: spacing.lg,
        flexDirection: "row",
        gap: spacing.lg,
      }}
    >
      <View
        style={{
          width: 54,
          borderRadius: radius.md,
          backgroundColor: palette.brandSoft,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 10,
        }}
      >
        <Text style={{ color: palette.brand, fontSize: 11, fontWeight: "800", textTransform: "uppercase" }}>
          {start.toLocaleDateString("tr-TR", { month: "short" })}
        </Text>
        <Text style={{ color: palette.text, fontSize: 22, fontWeight: "900" }}>
          {start.getDate()}
        </Text>
        <Text style={{ color: palette.textMuted, fontSize: 10.5 }}>
          {start.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ color: palette.text, fontSize: 15.5, fontWeight: "700", lineHeight: 21 }}>
          {event.title}
        </Text>

        {!!event.description && (
          <Text
            style={{ color: palette.textMuted, fontSize: 13.5, lineHeight: 19, marginTop: 4 }}
            numberOfLines={2}
          >
            {event.description}
          </Text>
        )}

        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="location-outline" size={13} color={palette.textFaint} />
            <Text style={{ color: palette.textFaint, fontSize: 12 }} numberOfLines={1}>
              {event.isOnline ? "Online" : event.location ?? "Konum yok"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="people-outline" size={13} color={palette.textFaint} />
            <Text style={{ color: palette.textFaint, fontSize: 12 }}>
              {count}
              {event.capacity ? `/${event.capacity}` : ""}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
          <Avatar uri={event.creator.avatarUrl} name={event.creator.displayName} size="xs" />
          <Text style={{ color: palette.textMuted, fontSize: 12, flex: 1 }} numberOfLines={1}>
            {event.creator.displayName}
          </Text>
          <Button
            title={isFull ? "Dolu" : attending ? "Katılıyorsun" : "Katıl"}
            size="sm"
            variant={attending ? "secondary" : "primary"}
            loading={busy}
            disabled={isFull || event.isCancelled}
            onPress={toggle}
          />
        </View>
      </View>
    </View>
  );
}
