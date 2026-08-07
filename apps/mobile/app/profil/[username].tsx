import { Ionicons } from "@expo/vector-icons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { classYearLabel } from "@kampus/shared";
import { ApiError, api } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { formatCount, palette, radius, spacing } from "../../src/lib/theme";
import type { User } from "../../src/lib/types";
import { FeedList } from "../../src/components/FeedList";
import { Avatar, Button, Empty, Loading } from "../../src/components/ui";

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { user: me } = useAuth();

  const [profile, setProfile] = useState<User | null>(null);
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ user: User; online: boolean }>(`/users/${username}`);
      setProfile(data.user);
      setOnline(data.online);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Profil yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleFollow() {
    if (!profile) return;
    setBusy(true);
    try {
      const following = profile.viewer?.isFollowing;
      const result = await (following
        ? api.delete<{ followers: number }>(`/users/${profile.username}/follow`)
        : api.post<{ followers: number }>(`/users/${profile.username}/follow`));
      setProfile((p) =>
        p
          ? {
              ...p,
              viewer: { ...p.viewer!, isFollowing: !following },
              counts: p.counts ? { ...p.counts, followers: result.followers } : p.counts,
            }
          : p,
      );
    } catch (err) {
      if (err instanceof ApiError) console.warn(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function startChat() {
    if (!profile) return;
    try {
      const data = await api.post<{ conversation: { id: string } }>("/chat/conversations", {
        type: "DIRECT",
        memberIds: [profile.id],
      });
      router.push(`/sohbet/${data.conversation.id}`);
    } catch (err) {
      if (err instanceof ApiError) console.warn(err.message);
    }
  }

  if (loading) return <Loading label="Yükleniyor…" />;
  if (error || !profile) {
    return <Empty icon="person-outline" title="Profil bulunamadı" description={error ?? undefined} />;
  }

  const isSelf = profile.viewer?.isSelf || me?.id === profile.id;

  const header = (
    <View
      style={{
        backgroundColor: palette.bgElevated,
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: radius.lg,
        padding: spacing.lg,
        marginBottom: spacing.sm,
      }}
    >
      <View style={{ flexDirection: "row", gap: spacing.lg, alignItems: "flex-start" }}>
        <View>
          <Avatar uri={profile.avatarUrl} name={profile.displayName} size="lg" />
          {online && (
            <View
              style={{
                position: "absolute",
                right: 1,
                bottom: 1,
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: palette.success,
                borderWidth: 3,
                borderColor: palette.bgElevated,
              }}
            />
          )}
        </View>

        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800" }}>
              {profile.displayName}
            </Text>
            {profile.isVerifiedStudent && (
              <Ionicons name="shield-checkmark" size={15} color={palette.brand} />
            )}
          </View>
          <Text style={{ color: palette.textFaint, fontSize: 13 }}>@{profile.username}</Text>

          {!!profile.bio && (
            <Text style={{ color: palette.text, fontSize: 14, lineHeight: 20, marginTop: 8 }}>
              {profile.bio}
            </Text>
          )}

          <Text style={{ color: palette.textMuted, fontSize: 12.5, marginTop: 8 }}>
            {[
              profile.university?.name,
              profile.department,
              classYearLabel(profile.classYear),
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", marginTop: spacing.lg }}>
        <Stat label="gönderi" value={profile.counts?.posts ?? 0} />
        <Stat label="takipçi" value={profile.counts?.followers ?? 0} />
        <Stat label="takip" value={profile.counts?.following ?? 0} />
        <Stat label="karma" value={profile.karma} />
      </View>

      {!isSelf && (
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
          <Button
            title={profile.viewer?.isFollowing ? "Takiptesin" : "Takip et"}
            variant={profile.viewer?.isFollowing ? "secondary" : "primary"}
            loading={busy}
            onPress={toggleFollow}
            style={{ flex: 1 }}
          />
          <Button
            title="Mesaj"
            variant="secondary"
            icon="chatbubble-outline"
            onPress={startChat}
            style={{ flex: 1 }}
          />
        </View>
      )}

      {profile.badges && profile.badges.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.lg }}>
          {profile.badges.map((badge) => (
            <View
              key={badge.code}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: 9,
                paddingVertical: 5,
                borderRadius: radius.full,
                backgroundColor: palette.bgSubtle,
              }}
            >
              <Text style={{ fontSize: 12 }}>{badge.icon}</Text>
              <Text style={{ color: palette.textMuted, fontSize: 11.5, fontWeight: "600" }}>
                {badge.label}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Stack.Screen options={{ title: profile.displayName }} />
      <FeedList
        query={`tab=USER&username=${profile.username}`}
        header={header}
        emptyTitle="Henüz paylaşım yok"
      />
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ color: palette.text, fontSize: 16, fontWeight: "800" }}>
        {formatCount(value)}
      </Text>
      <Text style={{ color: palette.textFaint, fontSize: 11.5 }}>{label}</Text>
    </View>
  );
}
