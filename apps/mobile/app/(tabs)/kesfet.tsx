import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { api } from "../../src/lib/api";
import { formatCount, palette, radius, spacing, typography } from "../../src/lib/theme";
import type { Community, KampusEvent } from "../../src/lib/types";
import { Avatar, Card, Loading } from "../../src/components/ui";

interface Trending {
  trending: { tag: string; postCount: number }[];
  suggestedCommunities: Community[];
}

interface QuickResults {
  users: { id: string; username: string; displayName: string; avatarUrl: string | null; department: string | null }[];
  communities: { id: string; slug: string; name: string; avatarUrl: string | null; memberCount: number }[];
}

export default function ExploreScreen() {
  const [query, setQuery] = useState("");
  const [quick, setQuick] = useState<QuickResults | null>(null);
  const [trending, setTrending] = useState<Trending | null>(null);
  const [events, setEvents] = useState<KampusEvent[]>([]);
  const [universities, setUniversities] = useState<
    { id: string; name: string; shortName: string; city: string; studentCount: number }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Trending>("/feed/trending").catch(() => null),
      api.get<{ items: KampusEvent[] }>("/events?when=UPCOMING&limit=5").catch(() => null),
      api.get<{ items: typeof universities }>("/meta/leaderboard").catch(() => null),
    ]).then(([t, e, u]) => {
      if (t) setTrending(t);
      if (e) setEvents(e.items);
      if (u) setUniversities(u.items.slice(0, 6));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setQuick(null);
      return;
    }
    const t = setTimeout(() => {
      api
        .get<QuickResults>(`/search/quick?q=${encodeURIComponent(query.trim())}`)
        .then(setQuick)
        .catch(() => setQuick(null));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100, gap: spacing.xl }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Arama */}
      <View style={{ position: "relative" }}>
        <Ionicons
          name="search"
          size={18}
          color={palette.textFaint}
          style={{ position: "absolute", left: 14, top: 14, zIndex: 1 }}
        />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Kişi, topluluk ara..."
          placeholderTextColor={palette.textFaint}
          autoCapitalize="none"
          style={{
            backgroundColor: palette.bgElevated,
            borderWidth: 1,
            borderColor: palette.border,
            borderRadius: radius.full,
            paddingLeft: 42,
            paddingRight: 16,
            paddingVertical: 12,
            color: palette.text,
            fontSize: 15,
          }}
        />
      </View>

      {quick && (quick.users.length > 0 || quick.communities.length > 0) && (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {quick.users.map((u) => (
            <Pressable
              key={u.id}
              onPress={() => router.push(`/profil/${u.username}`)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 11,
                padding: spacing.md,
              }}
            >
              <Avatar uri={u.avatarUrl} name={u.displayName} size="sm" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontSize: 14.5, fontWeight: "600" }}>
                  {u.displayName}
                </Text>
                <Text style={{ color: palette.textFaint, fontSize: 12 }}>
                  @{u.username}
                  {u.department ? ` · ${u.department}` : ""}
                </Text>
              </View>
            </Pressable>
          ))}
          {quick.communities.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => router.push(`/topluluk/${c.slug}`)}
              style={{ flexDirection: "row", alignItems: "center", gap: 11, padding: spacing.md }}
            >
              <Avatar uri={c.avatarUrl} name={c.name} size="sm" square />
              <View style={{ flex: 1 }}>
                <Text style={{ color: palette.text, fontSize: 14.5, fontWeight: "600" }}>
                  {c.name}
                </Text>
                <Text style={{ color: palette.textFaint, fontSize: 12 }}>{c.memberCount} üye</Text>
              </View>
            </Pressable>
          ))}
        </Card>
      )}

      {/* Kısayollar */}
      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <ShortcutCard
          icon="glasses-outline"
          label="İtiraflar"
          description="Anonim"
          onPress={() => router.push("/itiraflar")}
        />
        <ShortcutCard
          icon="calendar-outline"
          label="Etkinlikler"
          description={`${events.length} yaklaşan`}
          onPress={() => router.push("/etkinlikler")}
        />
      </View>

      {loading && <Loading />}

      {/* Gündem */}
      {trending && trending.trending.length > 0 && (
        <View>
          <Text style={[typography.h3, { color: palette.text, marginBottom: spacing.md }]}>
            🔥 Gündemdeki etiketler
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {trending.trending.map((t, i) => (
              <View
                key={t.tag}
                style={{
                  paddingHorizontal: 13,
                  paddingVertical: 7,
                  borderRadius: radius.full,
                  backgroundColor: i === 0 ? palette.brandStrong : palette.bgElevated,
                  borderWidth: 1,
                  borderColor: i === 0 ? palette.brandStrong : palette.border,
                }}
              >
                <Text
                  style={{
                    color: i === 0 ? palette.white : palette.textMuted,
                    fontSize: 13,
                    fontWeight: "600",
                  }}
                >
                  #{t.tag} · {t.postCount}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Etkinlikler */}
      {events.length > 0 && (
        <View>
          <Text style={[typography.h3, { color: palette.text, marginBottom: spacing.md }]}>
            Yaklaşan etkinlikler
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
            {events.map((event) => (
              <Card key={event.id} style={{ width: 210 }} onPress={() => router.push("/etkinlikler")}>
                <Text style={{ color: palette.brand, fontSize: 12, fontWeight: "700" }}>
                  {new Date(event.startsAt).toLocaleDateString("tr-TR", {
                    day: "numeric",
                    month: "long",
                  })}
                </Text>
                <Text
                  style={{ color: palette.text, fontSize: 15, fontWeight: "700", marginTop: 4 }}
                  numberOfLines={2}
                >
                  {event.title}
                </Text>
                <Text style={{ color: palette.textFaint, fontSize: 12, marginTop: 6 }}>
                  {event.attendeeCount} katılımcı
                </Text>
              </Card>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Topluluk önerileri */}
      {trending && trending.suggestedCommunities.length > 0 && (
        <View>
          <Text style={[typography.h3, { color: palette.text, marginBottom: spacing.md }]}>
            Sana uygun topluluklar
          </Text>
          <View style={{ gap: spacing.md }}>
            {trending.suggestedCommunities.map((c) => (
              <Card
                key={c.id}
                onPress={() => router.push(`/topluluk/${c.slug}`)}
                style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}
              >
                <Avatar uri={c.avatarUrl} name={c.name} size="md" square />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.text, fontSize: 15, fontWeight: "700" }}>
                    {c.name}
                  </Text>
                  <Text style={{ color: palette.textFaint, fontSize: 12.5 }}>
                    {formatCount(c.memberCount)} üye
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={palette.textFaint} />
              </Card>
            ))}
          </View>
        </View>
      )}

      {/* Kampüs sıralaması */}
      {universities.length > 0 && (
        <View>
          <Text style={[typography.h3, { color: palette.text, marginBottom: spacing.md }]}>
            🎓 En aktif kampüsler
          </Text>
          <Card style={{ gap: spacing.md }}>
            {universities.map((uni, i) => (
              <View key={uni.id} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <Text
                  style={{ color: palette.textFaint, fontSize: 13, fontWeight: "800", width: 18 }}
                >
                  {i + 1}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: palette.text, fontSize: 14, fontWeight: "600" }} numberOfLines={1}>
                    {uni.name}
                  </Text>
                  <Text style={{ color: palette.textFaint, fontSize: 12 }}>{uni.city}</Text>
                </View>
                <Text style={{ color: palette.textMuted, fontSize: 13, fontWeight: "700" }}>
                  {formatCount(uni.studentCount)}
                </Text>
              </View>
            ))}
          </Card>
        </View>
      )}
    </ScrollView>
  );
}

function ShortcutCard({
  icon,
  label,
  description,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: palette.bgElevated,
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: radius.lg,
        padding: spacing.lg,
        gap: 8,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: radius.md,
          backgroundColor: palette.brandSoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={20} color={palette.brand} />
      </View>
      <Text style={{ color: palette.text, fontSize: 15, fontWeight: "700" }}>{label}</Text>
      <Text style={{ color: palette.textFaint, fontSize: 12.5 }}>{description}</Text>
    </Pressable>
  );
}
