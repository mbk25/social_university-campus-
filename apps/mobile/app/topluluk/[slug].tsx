import { Ionicons } from "@expo/vector-icons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Share, Text, View } from "react-native";
import { ApiError, WEB_URL, api } from "../../src/lib/api";
import { formatCount, palette, radius, spacing } from "../../src/lib/theme";
import type { Community } from "../../src/lib/types";
import { FeedList } from "../../src/components/FeedList";
import { Avatar, Button, Empty, Loading } from "../../src/components/ui";

const SCOPE_LABEL: Record<string, string> = {
  DEPARTMENT: "Bölüm topluluğu",
  UNIVERSITY: "Üniversite topluluğu",
  GLOBAL: "Genel topluluk",
};

export default function CommunityScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [community, setCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get<{ community: Community }>(`/communities/${slug}`);
      setCommunity(data.community);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Topluluk yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleMembership() {
    if (!community) return;
    setBusy(true);
    try {
      if (community.viewer?.isMember) {
        await api.delete(`/communities/${community.id}/leave`);
      } else {
        await api.post(`/communities/${community.id}/join`);
      }
      await load();
    } catch (err) {
      if (err instanceof ApiError) console.warn(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function openChat() {
    if (!community) return;
    try {
      const data = await api.get<{ conversation: { id: string } }>(
        `/chat/conversations/community/${community.id}`,
      );
      router.push(`/sohbet/${data.conversation.id}`);
    } catch (err) {
      if (err instanceof ApiError) console.warn(err.message);
    }
  }

  async function shareCommunity() {
    if (!community) return;
    const url = `${WEB_URL}/topluluk/${community.slug}`;
    try {
      // Sistemin paylaş menüsü: WhatsApp, mesajlar, kopyala hepsi burada.
      await Share.share({ message: `${community.name} — Kampus\n${url}`, url });
    } catch {
      // Kullanıcı vazgeçti; sessizce geç.
    }
  }

  if (loading) return <Loading label="Yükleniyor…" />;
  if (error || !community) {
    return <Empty icon="alert-circle-outline" title="Topluluğa erişilemedi" description={error ?? undefined} />;
  }

  const isMember = !!community.viewer?.isMember;
  const canSeeContent = community.visibility === "PUBLIC" || isMember;

  const header = (
    <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
      <View
        style={{
          backgroundColor: palette.bgElevated,
          borderWidth: 1,
          borderColor: palette.border,
          borderRadius: radius.lg,
          padding: spacing.lg,
        }}
      >
        <View style={{ flexDirection: "row", gap: spacing.md, alignItems: "flex-start" }}>
          <Avatar uri={community.avatarUrl} name={community.name} size="lg" square />
          <View style={{ flex: 1 }}>
            <Text style={{ color: palette.text, fontSize: 18, fontWeight: "800" }}>
              {community.name}
            </Text>
            <View
              style={{
                alignSelf: "flex-start",
                marginTop: 5,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 6,
                backgroundColor: palette.brandSoft,
              }}
            >
              <Text style={{ color: palette.brand, fontSize: 11, fontWeight: "800" }}>
                {SCOPE_LABEL[community.scope]}
              </Text>
            </View>
          </View>
        </View>

        {!!community.description && (
          <Text style={{ color: palette.textMuted, fontSize: 14, lineHeight: 21, marginTop: spacing.md }}>
            {community.description}
          </Text>
        )}

        <Text style={{ color: palette.textFaint, fontSize: 12.5, marginTop: spacing.md }}>
          {formatCount(community.memberCount)} üye · {formatCount(community.postCount)} gönderi
          {community.university ? ` · ${community.university.name}` : ""}
        </Text>

        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
          <Button
            title={
              community.viewer?.hasPendingRequest ? "Beklemede" : isMember ? "Üyesin" : "Katıl"
            }
            variant={isMember ? "secondary" : "primary"}
            loading={busy}
            disabled={community.viewer?.hasPendingRequest}
            onPress={toggleMembership}
            style={{ flex: 1 }}
          />
          {isMember && (
            <Button
              title="Sohbet"
              variant="secondary"
              icon="chatbubble-outline"
              onPress={openChat}
              style={{ flex: 1 }}
            />
          )}
        </View>

        <View style={{ marginTop: spacing.sm }}>
          <Button
            title="Paylaş"
            variant="secondary"
            icon="share-outline"
            onPress={shareCommunity}
          />
        </View>
      </View>

      {community.rules.length > 0 && (
        <View
          style={{
            backgroundColor: palette.bgElevated,
            borderWidth: 1,
            borderColor: palette.border,
            borderRadius: radius.lg,
            padding: spacing.lg,
            gap: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Ionicons name="shield-checkmark-outline" size={16} color={palette.brand} />
            <Text style={{ color: palette.text, fontSize: 14.5, fontWeight: "700" }}>
              Topluluk kuralları
            </Text>
          </View>
          {community.rules.map((rule, i) => (
            <Text key={i} style={{ color: palette.textMuted, fontSize: 13.5, lineHeight: 20 }}>
              {i + 1}. {rule}
            </Text>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Stack.Screen options={{ title: community.name }} />
      {canSeeContent ? (
        <FeedList
          query={`tab=COMMUNITY&community=${community.slug}`}
          header={header}
          emptyTitle="Henüz gönderi yok"
          emptyDescription={isMember ? "İlk paylaşımı sen yap." : "Katıldıktan sonra paylaşım yapabilirsin."}
        />
      ) : (
        <View style={{ padding: spacing.lg }}>
          {header}
          <Empty
            icon="lock-closed-outline"
            title="Bu topluluk gizli"
            description="İçeriği görebilmek için katılım isteği gönder ve onay bekle."
          />
        </View>
      )}
    </View>
  );
}
