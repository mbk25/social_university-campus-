import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { ApiError, api, uploadImageAsset } from "../src/lib/api";
import { useAuth } from "../src/lib/auth";
import { palette, radius, spacing } from "../src/lib/theme";
import type { Community, MediaAsset } from "../src/lib/types";
import { Avatar, Button } from "../src/components/ui";

const MAX_LENGTH = 2000;

export default function ComposeScreen() {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [communityId, setCommunityId] = useState<string | null>(null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    api
      .get<{ items: Community[] }>("/communities?filter=MINE&limit=50")
      .then((d) => setCommunities(d.items))
      .catch(() => undefined);
  }, []);

  async function pickImages() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("İzin gerekli", "Görsel eklemek için galeri iznine ihtiyacımız var.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 4 - media.length,
      quality: 0.85,
    });
    if (result.canceled) return;

    setUploading(true);
    try {
      const uploads = await Promise.all(
        result.assets.map((asset) => uploadImageAsset(asset.uri, "post")),
      );
      setMedia((current) => [...current, ...uploads].slice(0, 4));
    } catch {
      Alert.alert("Hata", "Görsel yüklenemedi.");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    const trimmed = content.trim();
    if (!trimmed && media.length === 0) return;

    setPosting(true);
    try {
      await api.post("/posts", {
        content: trimmed,
        communityId,
        media,
        isAnonymous,
      });
      router.back();
    } catch (err) {
      Alert.alert("Paylaşılamadı", err instanceof ApiError ? err.message : "Bir hata oluştu");
    } finally {
      setPosting(false);
    }
  }

  const selected = communities.find((c) => c.id === communityId);
  const remaining = MAX_LENGTH - content.length;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          {isAnonymous ? (
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
              <Ionicons name="glasses-outline" size={20} color={palette.textMuted} />
            </View>
          ) : (
            <Avatar uri={user?.avatarUrl} name={user?.displayName ?? "?"} size="md" />
          )}

          <View style={{ flex: 1 }}>
            <Pressable
              onPress={() => setShowPicker((v) => !v)}
              style={{
                alignSelf: "flex-start",
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 11,
                paddingVertical: 6,
                borderRadius: radius.full,
                backgroundColor: palette.brandSoft,
                marginBottom: 10,
              }}
            >
              <Text style={{ color: palette.brand, fontSize: 12.5, fontWeight: "700" }}>
                {selected ? selected.name : "Herkese açık akış"}
              </Text>
              <Ionicons name="chevron-down" size={13} color={palette.brand} />
            </Pressable>

            {showPicker && (
              <View
                style={{
                  backgroundColor: palette.bgElevated,
                  borderWidth: 1,
                  borderColor: palette.border,
                  borderRadius: radius.md,
                  marginBottom: 12,
                  maxHeight: 220,
                }}
              >
                <ScrollView nestedScrollEnabled>
                  <Pressable
                    onPress={() => {
                      setCommunityId(null);
                      setShowPicker(false);
                    }}
                    style={{ padding: spacing.md }}
                  >
                    <Text style={{ color: palette.text, fontSize: 14.5 }}>Herkese açık akış</Text>
                  </Pressable>
                  {communities.map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={() => {
                        setCommunityId(c.id);
                        setShowPicker(false);
                      }}
                      style={{ padding: spacing.md }}
                    >
                      <Text style={{ color: palette.text, fontSize: 14.5 }}>{c.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="Kampüste neler oluyor?"
              placeholderTextColor={palette.textFaint}
              multiline
              autoFocus
              maxLength={MAX_LENGTH}
              style={{
                color: palette.text,
                fontSize: 16.5,
                lineHeight: 24,
                minHeight: 120,
                textAlignVertical: "top",
              }}
            />

            {media.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                {media.map((item) => (
                  <View key={item.url}>
                    <Image
                      source={{ uri: item.url }}
                      style={{ width: 78, height: 78, borderRadius: radius.md }}
                    />
                    <Pressable
                      onPress={() => setMedia((m) => m.filter((x) => x.url !== item.url))}
                      style={{
                        position: "absolute",
                        top: 4,
                        right: 4,
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: "rgba(0,0,0,0.7)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="close" size={13} color={palette.white} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Alt araç çubuğu */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderTopWidth: 1,
          borderTopColor: palette.border,
          backgroundColor: palette.bgElevated,
        }}
      >
        <Tool icon="image-outline" onPress={pickImages} disabled={uploading || media.length >= 4} />
        <Tool
          icon="glasses-outline"
          active={isAnonymous}
          onPress={() => setIsAnonymous((v) => !v)}
        />

        <View style={{ flex: 1 }} />

        {content.length > 0 && (
          <Text
            style={{
              color: remaining < 100 ? palette.warning : palette.textFaint,
              fontSize: 12.5,
            }}
          >
            {remaining}
          </Text>
        )}

        <Button
          title="Paylaş"
          size="sm"
          loading={posting}
          disabled={!content.trim() && media.length === 0}
          onPress={submit}
        />
      </View>

      {isAnonymous && (
        <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: palette.bgElevated }}>
          <Text style={{ color: palette.textMuted, fontSize: 12, lineHeight: 18 }}>
            🎭 Anonim paylaşımda adın ve profilin görünmez.
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function Tool({
  icon,
  onPress,
  active,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        width: 38,
        height: 38,
        borderRadius: radius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? palette.brandSoft : "transparent",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Ionicons name={icon} size={21} color={active ? palette.brand : palette.textMuted} />
    </Pressable>
  );
}
