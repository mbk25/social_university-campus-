import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { ApiError, api } from "../src/lib/api";
import { useAuth } from "../src/lib/auth";
import { formatCount, palette, radius, spacing, timeAgo } from "../src/lib/theme";
import type { Confession } from "../src/lib/types";
import { Button, Chip, Empty, Loading } from "../src/components/ui";

const TOPICS = ["ders", "aşk", "aile", "para", "kampüs", "yurt", "staj", "gelecek", "arkadaşlık"];

export default function ConfessionsScreen() {
  const { user } = useAuth();
  const [scope, setScope] = useState<"UNIVERSITY" | "GLOBAL" | "MINE">("UNIVERSITY");
  const [items, setItems] = useState<Confession[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);

  const load = useCallback(
    async (next?: string | null) => {
      try {
        const params = new URLSearchParams({ scope, limit: "20" });
        if (next) params.set("cursor", next);
        const data = await api.get<{ items: Confession[]; nextCursor: string | null }>(
          `/confessions?${params}`,
        );
        setItems((current) => (next ? [...current, ...data.items] : data.items));
        setCursor(data.nextCursor);
      } catch {
        if (!next) setItems([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [scope],
  );

  useEffect(() => {
    setLoading(true);
    void load(null);
  }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Stack.Screen options={{ title: "İtiraflar" }} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, gap: 8 }}
        style={{ flexGrow: 0 }}
      >
        <Chip
          label={user?.university?.shortName ?? "Üniversitem"}
          active={scope === "UNIVERSITY"}
          onPress={() => setScope("UNIVERSITY")}
        />
        <Chip label="Türkiye geneli" active={scope === "GLOBAL"} onPress={() => setScope("GLOBAL")} />
        <Chip label="Benimkiler" active={scope === "MINE"} onPress={() => setScope("MINE")} />
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
              icon="glasses-outline"
              title="Henüz itiraf yok"
              description="İlk itirafı sen yaz. Kimse kim olduğunu bilmeyecek."
            />
          )
        }
        renderItem={({ item }) => (
          <ConfessionCard
            confession={item}
            onDeleted={(cid) => setItems((current) => current.filter((c) => c.id !== cid))}
          />
        )}
      />

      <Pressable
        onPress={() => setComposeOpen(true)}
        style={{
          position: "absolute",
          right: spacing.lg,
          bottom: spacing.xl,
          height: 52,
          paddingHorizontal: 20,
          borderRadius: 26,
          backgroundColor: palette.brandStrong,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Ionicons name="glasses-outline" size={20} color={palette.white} />
        <Text style={{ color: palette.white, fontSize: 15, fontWeight: "700" }}>İtiraf et</Text>
      </Pressable>

      <ComposeModal
        visible={composeOpen}
        onClose={() => setComposeOpen(false)}
        onCreated={(c) => setItems((current) => [c, ...current])}
      />
    </View>
  );
}

function ConfessionCard({
  confession: initial,
  onDeleted,
}: {
  confession: Confession;
  onDeleted: (id: string) => void;
}) {
  const [confession, setConfession] = useState(initial);

  async function toggleLike() {
    const liked = confession.viewer.hasLiked;
    setConfession((c) => ({
      ...c,
      viewer: { ...c.viewer, hasLiked: !liked },
      likeCount: c.likeCount + (liked ? -1 : 1),
    }));
    try {
      const result = await (liked
        ? api.delete<{ likeCount: number }>(`/confessions/${confession.id}/like`)
        : api.post<{ likeCount: number }>(`/confessions/${confession.id}/like`));
      setConfession((c) => ({ ...c, likeCount: result.likeCount }));
    } catch {
      setConfession((c) => ({
        ...c,
        viewer: { ...c.viewer, hasLiked: liked },
        likeCount: c.likeCount + (liked ? 1 : -1),
      }));
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
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: palette.bgSubtle,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="glasses-outline" size={18} color={palette.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: palette.text, fontSize: 14, fontWeight: "700" }}>
            {confession.alias}
          </Text>
          <Text style={{ color: palette.textFaint, fontSize: 11.5 }}>
            {timeAgo(confession.createdAt)}
            {confession.university ? ` · ${confession.university.shortName}` : " · Türkiye geneli"}
            {confession.topic ? ` · #${confession.topic}` : ""}
          </Text>
        </View>
        {confession.viewer.isMine && (
          <Pressable
            onPress={async () => {
              await api.delete(`/confessions/${confession.id}`).catch(() => undefined);
              onDeleted(confession.id);
            }}
          >
            <Ionicons name="trash-outline" size={17} color={palette.textFaint} />
          </Pressable>
        )}
      </View>

      <Text style={{ color: palette.text, fontSize: 15, lineHeight: 23, marginTop: 10 }}>
        {confession.content}
      </Text>

      <Pressable
        onPress={toggleLike}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          marginTop: 12,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: palette.border,
        }}
      >
        <Ionicons
          name={confession.viewer.hasLiked ? "heart" : "heart-outline"}
          size={19}
          color={confession.viewer.hasLiked ? palette.danger : palette.textMuted}
        />
        {confession.likeCount > 0 && (
          <Text
            style={{
              color: confession.viewer.hasLiked ? palette.danger : palette.textMuted,
              fontSize: 13,
              fontWeight: "600",
            }}
          >
            {formatCount(confession.likeCount)}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

function ComposeModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (confession: Confession) => void;
}) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  const [scope, setScope] = useState<"UNIVERSITY" | "GLOBAL">("UNIVERSITY");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{ confession: Confession }>("/confessions", {
        content: content.trim(),
        scope,
        topic: topic ?? undefined,
      });
      onCreated(result.confession);
      setContent("");
      setTopic(null);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Paylaşılamadı");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: palette.bg }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: spacing.lg,
            borderBottomWidth: 1,
            borderBottomColor: palette.border,
          }}
        >
          <Pressable onPress={onClose}>
            <Text style={{ color: palette.textMuted, fontSize: 15 }}>Vazgeç</Text>
          </Pressable>
          <Text style={{ color: palette.text, fontSize: 16, fontWeight: "800" }}>Anonim itiraf</Text>
          <Button
            title="Paylaş"
            size="sm"
            loading={busy}
            disabled={content.trim().length < 10}
            onPress={submit}
          />
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="İçinden geçenleri yaz. Kimse kim olduğunu bilmeyecek..."
            placeholderTextColor={palette.textFaint}
            multiline
            autoFocus
            maxLength={1000}
            style={{
              color: palette.text,
              fontSize: 16,
              lineHeight: 24,
              minHeight: 140,
              textAlignVertical: "top",
            }}
          />

          <Text style={{ color: palette.textFaint, fontSize: 12.5, textAlign: "right" }}>
            {content.length}/1000
          </Text>

          <View>
            <Text style={{ color: palette.textMuted, fontSize: 13, fontWeight: "600", marginBottom: 8 }}>
              Konu (isteğe bağlı)
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {TOPICS.map((t) => (
                <Chip
                  key={t}
                  label={`#${t}`}
                  active={topic === t}
                  onPress={() => setTopic(topic === t ? null : t)}
                />
              ))}
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip
              label={`Sadece ${user?.university?.shortName ?? "üniversitem"}`}
              active={scope === "UNIVERSITY"}
              onPress={() => setScope("UNIVERSITY")}
            />
            <Chip
              label="Türkiye geneli"
              active={scope === "GLOBAL"}
              onPress={() => setScope("GLOBAL")}
            />
          </View>

          {error && <Text style={{ color: palette.danger, fontSize: 13.5 }}>{error}</Text>}

          <Text
            style={{
              color: palette.textMuted,
              fontSize: 12.5,
              lineHeight: 19,
              backgroundColor: palette.bgElevated,
              padding: spacing.md,
              borderRadius: radius.md,
            }}
          >
            🔒 Adın, kullanıcı adın ve profilin hiçbir yerde görünmez. Ancak hakaret, tehdit ve hedef
            gösterme durumunda moderasyon ekibi kaydı inceleyebilir.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
