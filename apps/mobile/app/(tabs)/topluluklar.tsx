import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { ApiError, api } from "../../src/lib/api";
import { formatCount, palette, radius, spacing } from "../../src/lib/theme";
import type { Community } from "../../src/lib/types";
import { Avatar, Button, Chip, Empty, Loading } from "../../src/components/ui";

const FILTERS = [
  { key: "SUGGESTED", label: "Sana uygun" },
  { key: "MINE", label: "Üye olduklarım" },
  { key: "ALL", label: "Tümü" },
] as const;

const SCOPE_LABEL: Record<string, string> = {
  DEPARTMENT: "Bölüm",
  UNIVERSITY: "Üniversite",
  GLOBAL: "Genel",
};

export default function CommunitiesScreen() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("SUGGESTED");
  const [items, setItems] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ items: Community[] }>(
        `/communities?filter=${filter}&limit=40`,
      );
      setItems(data.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

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
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </ScrollView>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: 100,
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
              icon="people-outline"
              title={filter === "MINE" ? "Henüz topluluğa üye değilsin" : "Topluluk bulunamadı"}
              description="Sana uygun sekmesinden bölümüne ve üniversitene ait toplulukları keşfet."
            />
          )
        }
        renderItem={({ item }) => <CommunityRow community={item} onChange={load} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function CommunityRow({ community, onChange }: { community: Community; onChange: () => void }) {
  const [state, setState] = useState(community.viewer);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      if (state?.isMember) {
        await api.delete(`/communities/${community.id}/leave`);
        setState({ isMember: false, role: null, hasPendingRequest: false });
      } else {
        const result = await api.post<{ joined: boolean }>(`/communities/${community.id}/join`);
        setState(
          result.joined
            ? { isMember: true, role: "MEMBER", hasPendingRequest: false }
            : { isMember: false, role: null, hasPendingRequest: true },
        );
      }
      onChange();
    } catch (err) {
      if (err instanceof ApiError) console.warn(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable
      onPress={() => router.push(`/topluluk/${community.slug}`)}
      style={({ pressed }) => ({
        backgroundColor: palette.bgElevated,
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: radius.lg,
        padding: spacing.lg,
        flexDirection: "row",
        gap: spacing.md,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Avatar uri={community.avatarUrl} name={community.name} size="lg" square />

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Text style={{ color: palette.text, fontSize: 15.5, fontWeight: "700" }} numberOfLines={1}>
            {community.name}
          </Text>
          {community.visibility === "PRIVATE" && (
            <Ionicons name="lock-closed" size={12} color={palette.textFaint} />
          )}
          <View
            style={{
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 5,
              backgroundColor: palette.brandSoft,
            }}
          >
            <Text style={{ color: palette.brand, fontSize: 10.5, fontWeight: "800" }}>
              {SCOPE_LABEL[community.scope]}
            </Text>
          </View>
        </View>

        {!!community.description && (
          <Text
            style={{ color: palette.textMuted, fontSize: 13.5, lineHeight: 19, marginTop: 4 }}
            numberOfLines={2}
          >
            {community.description}
          </Text>
        )}

        <Text style={{ color: palette.textFaint, fontSize: 12, marginTop: 6 }}>
          {formatCount(community.memberCount)} üye · {formatCount(community.postCount)} gönderi
          {community.university ? ` · ${community.university.shortName}` : ""}
        </Text>
      </View>

      <View style={{ justifyContent: "center" }}>
        <Button
          title={state?.hasPendingRequest ? "Beklemede" : state?.isMember ? "Üyesin" : "Katıl"}
          size="sm"
          variant={state?.isMember ? "secondary" : "primary"}
          loading={busy}
          disabled={state?.hasPendingRequest}
          onPress={toggle}
        />
      </View>
    </Pressable>
  );
}
