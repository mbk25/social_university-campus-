import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useAuth } from "../../src/lib/auth";
import { palette, radius, spacing } from "../../src/lib/theme";
import { FeedList } from "../../src/components/FeedList";
import { Chip } from "../../src/components/ui";

const TABS = [
  { key: "HOME", label: "Sana Özel" },
  { key: "UNIVERSITY", label: "Üniversitem" },
  { key: "DEPARTMENT", label: "Bölümüm" },
  { key: "EXPLORE", label: "Popüler" },
] as const;

export default function HomeScreen() {
  const { user, unreadNotifications } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("HOME");

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      {/* Üst çubuk */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.lg,
          paddingTop: 52,
          paddingBottom: spacing.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              backgroundColor: palette.brandStrong,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ color: palette.white, fontSize: 17, fontWeight: "900" }}>K</Text>
          </View>
          <Text style={{ color: palette.text, fontSize: 20, fontWeight: "900" }}>Kampus</Text>
        </View>

        <View style={{ flexDirection: "row", gap: 4 }}>
          <IconButton icon="search-outline" onPress={() => router.push("/(tabs)/kesfet")} />
          <IconButton
            icon="notifications-outline"
            badge={unreadNotifications}
            onPress={() => router.push("/bildirimler")}
          />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: 8, paddingBottom: spacing.sm }}
        style={{ flexGrow: 0 }}
      >
        {TABS.map((t) => (
          <Chip key={t.key} label={t.label} active={tab === t.key} onPress={() => setTab(t.key)} />
        ))}
      </ScrollView>

      <FeedList
        query={`tab=${tab}`}
        emptyTitle={
          tab === "HOME"
            ? "Akışın henüz boş"
            : tab === "DEPARTMENT"
              ? "Bölümünden henüz paylaşım yok"
              : "Henüz paylaşım yok"
        }
        emptyDescription={
          tab === "HOME"
            ? "Topluluklara katıl ve insanları takip et — akışın dolmaya başlasın."
            : `${user?.university?.shortName ?? "Kampüsünde"} ilk paylaşımı sen yap.`
        }
      />

      {/* Paylaş butonu */}
      <Pressable
        onPress={() => router.push("/paylas")}
        style={({ pressed }) => ({
          position: "absolute",
          right: spacing.lg,
          bottom: spacing.xl,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: palette.brandStrong,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: palette.brandStrong,
          shadowOpacity: 0.45,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Ionicons name="add" size={28} color={palette.white} />
      </Pressable>
    </View>
  );
}

function IconButton({
  icon,
  onPress,
  badge = 0,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  badge?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        borderRadius: radius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? palette.bgElevated : "transparent",
      })}
    >
      <Ionicons name={icon} size={22} color={palette.textMuted} />
      {badge > 0 && (
        <View
          style={{
            position: "absolute",
            top: 7,
            right: 8,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: palette.danger,
          }}
        />
      )}
    </Pressable>
  );
}
