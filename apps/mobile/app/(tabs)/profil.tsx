import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { classYearLabel } from "@kampus/shared";
import { api, uploadImageAsset } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { formatCount, palette, radius, spacing, typography } from "../../src/lib/theme";
import type { User } from "../../src/lib/types";
import { Avatar, Button, Card, Divider } from "../../src/components/ui";

export default function ProfileScreen() {
  const { user, email, logout, setUser, refreshUser } = useAuth();
  const [uploading, setUploading] = useState(false);

  if (!user) return null;

  async function pickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("İzin gerekli", "Fotoğraf seçebilmek için galeri iznine ihtiyacımız var.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const upload = await uploadImageAsset(result.assets[0].uri, "avatar");
      const updated = await api.patch<{ user: User }>("/users/me", { avatarUrl: upload.url });
      setUser(updated.user);
    } catch {
      Alert.alert("Hata", "Fotoğraf yüklenemedi.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{ paddingBottom: 100 }}
    >
      {/* Kapak */}
      <View style={{ height: 110, backgroundColor: palette.brandStrong }} />

      <View style={{ paddingHorizontal: spacing.lg, marginTop: -42 }}>
        <Pressable onPress={pickAvatar}>
          <Avatar uri={user.avatarUrl} name={user.displayName} size="xl" style={{ borderWidth: 4, borderColor: palette.bg }} />
          <View
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: palette.brandStrong,
              borderWidth: 3,
              borderColor: palette.bg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name={uploading ? "hourglass-outline" : "camera"} size={13} color={palette.white} />
          </View>
        </Pressable>

        <View style={{ marginTop: spacing.md, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={[typography.h2, { color: palette.text }]}>{user.displayName}</Text>
          {user.isVerifiedStudent && (
            <Ionicons name="shield-checkmark" size={18} color={palette.brand} />
          )}
        </View>
        <Text style={{ color: palette.textFaint, fontSize: 14 }}>@{user.username}</Text>

        {!!user.bio && (
          <Text style={{ color: palette.text, fontSize: 14.5, lineHeight: 21, marginTop: 10 }}>
            {user.bio}
          </Text>
        )}

        <View style={{ marginTop: 12, gap: 6 }}>
          {user.university && (
            <InfoRow icon="school-outline" text={user.university.name} />
          )}
          {user.department && (
            <InfoRow
              icon="book-outline"
              text={`${user.department}${classYearLabel(user.classYear) ? ` · ${classYearLabel(user.classYear)}` : ""}`}
            />
          )}
          {email && <InfoRow icon="mail-outline" text={email} />}
        </View>

        {/* İstatistikler */}
        <View
          style={{
            flexDirection: "row",
            marginTop: spacing.lg,
            backgroundColor: palette.bgElevated,
            borderWidth: 1,
            borderColor: palette.border,
            borderRadius: radius.lg,
            paddingVertical: spacing.md,
          }}
        >
          <Stat label="gönderi" value={user.counts?.posts ?? 0} />
          <Stat label="takipçi" value={user.counts?.followers ?? 0} />
          <Stat label="takip" value={user.counts?.following ?? 0} />
          <Stat label="karma" value={user.karma} />
        </View>

        {/* Rozetler */}
        {user.badges && user.badges.length > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.lg }}>
            {user.badges.map((badge) => (
              <View
                key={badge.code}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  paddingHorizontal: 11,
                  paddingVertical: 6,
                  borderRadius: radius.full,
                  backgroundColor: palette.bgElevated,
                  borderWidth: 1,
                  borderColor: palette.border,
                }}
              >
                <Text style={{ fontSize: 13 }}>{badge.icon}</Text>
                <Text style={{ color: palette.textMuted, fontSize: 12.5, fontWeight: "600" }}>
                  {badge.label}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Menü */}
        <Card style={{ marginTop: spacing.xl, padding: 0, overflow: "hidden" }}>
          <MenuRow
            icon="bookmark-outline"
            label="Kaydedilenler"
            onPress={() => router.push("/kaydedilenler")}
          />
          <Divider />
          <MenuRow
            icon="notifications-outline"
            label="Bildirimler"
            onPress={() => router.push("/bildirimler")}
          />
          <Divider />
          <MenuRow
            icon="calendar-outline"
            label="Etkinliklerim"
            onPress={() => router.push("/etkinlikler")}
          />
          <Divider />
          <MenuRow
            icon="glasses-outline"
            label="İtiraflarım"
            onPress={() => router.push("/itiraflar")}
          />
          <Divider />
          <MenuRow
            icon="refresh-outline"
            label="Profili yenile"
            onPress={() => void refreshUser()}
          />
        </Card>

        <Button
          title="Çıkış yap"
          variant="secondary"
          fullWidth
          icon="log-out-outline"
          style={{ marginTop: spacing.lg }}
          onPress={() =>
            Alert.alert("Çıkış", "Çıkış yapmak istediğine emin misin?", [
              { text: "Vazgeç", style: "cancel" },
              { text: "Çıkış yap", style: "destructive", onPress: () => void logout() },
            ])
          }
        />

        <Text
          style={{
            color: palette.textFaint,
            fontSize: 12,
            textAlign: "center",
            marginTop: spacing.xl,
            lineHeight: 18,
          }}
        >
          Kampus · Sadece doğrulanmış üniversite öğrencilerine açıktır
        </Text>
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ color: palette.text, fontSize: 17, fontWeight: "800" }}>
        {formatCount(value)}
      </Text>
      <Text style={{ color: palette.textFaint, fontSize: 12 }}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Ionicons name={icon} size={15} color={palette.textFaint} />
      <Text style={{ color: palette.textMuted, fontSize: 13.5, flex: 1 }} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: 14,
        backgroundColor: pressed ? palette.bgSubtle : "transparent",
      })}
    >
      <Ionicons name={icon} size={20} color={palette.textMuted} />
      <Text style={{ color: palette.text, fontSize: 15, flex: 1 }}>{label}</Text>
      <Ionicons name="chevron-forward" size={17} color={palette.textFaint} />
    </Pressable>
  );
}
