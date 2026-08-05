import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { ApiError, api } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { formatCount, palette, radius, spacing, timeAgo } from "../../src/lib/theme";
import type { Comment, Post } from "../../src/lib/types";
import { PostCard } from "../../src/components/PostCard";
import { Avatar, Empty, Loading } from "../../src/components/ui";

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get<{ post: Post }>(`/posts/${id}`),
      api.get<{ items: Comment[]; nextCursor: string | null }>(`/posts/${id}/comments?limit=20`),
    ])
      .then(([p, c]) => {
        setPost(p.post);
        setComments(c.items);
        setCursor(c.nextCursor);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [id]);

  const loadMore = useCallback(async () => {
    if (!cursor) return;
    const data = await api
      .get<{ items: Comment[]; nextCursor: string | null }>(
        `/posts/${id}/comments?limit=20&cursor=${cursor}`,
      )
      .catch(() => null);
    if (!data) return;
    setComments((current) => [...current, ...data.items]);
    setCursor(data.nextCursor);
  }, [cursor, id]);

  async function submit() {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const result = await api.post<{ comment: Comment }>(`/posts/${id}/comments`, {
        content,
        parentId: replyTo?.id ?? null,
      });
      setComments((current) => [result.comment, ...current]);
      setPost((p) => (p ? { ...p, commentCount: p.commentCount + 1 } : p));
      setDraft("");
      setReplyTo(null);
    } catch (err) {
      if (err instanceof ApiError) console.warn(err.message);
    } finally {
      setSending(false);
    }
  }

  if (loading) return <Loading label="Yükleniyor…" />;
  if (!post) {
    return <Empty icon="alert-circle-outline" title="Gönderi bulunamadı" />;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 30 }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View style={{ gap: spacing.md, marginBottom: spacing.sm }}>
            <PostCard post={post} onDeleted={() => router.back()} />
            <Text style={{ color: palette.text, fontSize: 15, fontWeight: "700" }}>
              {formatCount(post.commentCount)} yorum
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={{ color: palette.textFaint, fontSize: 14, textAlign: "center", paddingVertical: 24 }}>
            İlk yorumu sen yaz 💬
          </Text>
        }
        renderItem={({ item }) => (
          <CommentRow
            comment={item}
            onReply={setReplyTo}
            onDeleted={(cid) => {
              setComments((current) => current.filter((c) => c.id !== cid));
              setPost((p) => (p ? { ...p, commentCount: Math.max(0, p.commentCount - 1) } : p));
            }}
          />
        )}
      />

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: palette.border,
          backgroundColor: palette.bgElevated,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        }}
      >
        {replyTo && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingHorizontal: 10,
              paddingVertical: 6,
              backgroundColor: palette.bgSubtle,
              borderRadius: radius.sm,
              marginBottom: 8,
            }}
          >
            <Text style={{ color: palette.textMuted, fontSize: 12.5, flex: 1 }} numberOfLines={1}>
              <Text style={{ fontWeight: "700", color: palette.text }}>
                {replyTo.author.displayName}
              </Text>{" "}
              kişisine yanıt
            </Text>
            <Pressable onPress={() => setReplyTo(null)}>
              <Ionicons name="close" size={16} color={palette.textFaint} />
            </Pressable>
          </View>
        )}

        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: spacing.sm }}>
          <Avatar uri={user?.avatarUrl} name={user?.displayName ?? "?"} size="sm" />
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Yorumunu yaz..."
            placeholderTextColor={palette.textFaint}
            multiline
            maxLength={1000}
            style={{
              flex: 1,
              maxHeight: 100,
              backgroundColor: palette.bgSubtle,
              borderWidth: 1,
              borderColor: palette.border,
              borderRadius: radius.lg,
              paddingHorizontal: 13,
              paddingVertical: 9,
              color: palette.text,
              fontSize: 15,
            }}
          />
          <Pressable
            onPress={submit}
            disabled={!draft.trim() || sending}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: palette.brandStrong,
              alignItems: "center",
              justifyContent: "center",
              opacity: draft.trim() ? 1 : 0.45,
            }}
          >
            <Ionicons name="send" size={16} color={palette.white} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function CommentRow({
  comment: initial,
  onReply,
  onDeleted,
}: {
  comment: Comment;
  onReply: (comment: Comment) => void;
  onDeleted: (id: string) => void;
}) {
  const [comment, setComment] = useState(initial);

  async function toggleLike() {
    const liked = comment.viewer.hasLiked;
    setComment((c) => ({
      ...c,
      viewer: { ...c.viewer, hasLiked: !liked },
      likeCount: c.likeCount + (liked ? -1 : 1),
    }));
    try {
      const result = await (liked
        ? api.delete<{ likeCount: number }>(`/comments/${comment.id}/like`)
        : api.post<{ likeCount: number }>(`/comments/${comment.id}/like`));
      setComment((c) => ({ ...c, likeCount: result.likeCount }));
    } catch {
      setComment((c) => ({
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
        padding: spacing.md,
        flexDirection: "row",
        gap: spacing.md,
      }}
    >
      <Pressable onPress={() => router.push(`/profil/${comment.author.username}`)}>
        <Avatar uri={comment.author.avatarUrl} name={comment.author.displayName} size="sm" />
      </Pressable>

      <View style={{ flex: 1 }}>
        <Text style={{ color: palette.text, fontSize: 14, fontWeight: "700" }}>
          {comment.author.displayName}{" "}
          <Text style={{ color: palette.textFaint, fontSize: 12, fontWeight: "400" }}>
            @{comment.author.username} · {timeAgo(comment.createdAt)}
          </Text>
        </Text>

        <Text style={{ color: palette.text, fontSize: 14.5, lineHeight: 21, marginTop: 3 }}>
          {comment.content}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 8 }}>
          <Pressable onPress={toggleLike} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons
              name={comment.viewer.hasLiked ? "heart" : "heart-outline"}
              size={15}
              color={comment.viewer.hasLiked ? palette.danger : palette.textFaint}
            />
            {comment.likeCount > 0 && (
              <Text
                style={{
                  color: comment.viewer.hasLiked ? palette.danger : palette.textFaint,
                  fontSize: 12.5,
                }}
              >
                {formatCount(comment.likeCount)}
              </Text>
            )}
          </Pressable>

          <Pressable onPress={() => onReply(comment)}>
            <Text style={{ color: palette.textFaint, fontSize: 12.5, fontWeight: "600" }}>
              Yanıtla
            </Text>
          </Pressable>

          {comment.viewer.canDelete && (
            <Pressable
              onPress={async () => {
                await api.delete(`/comments/${comment.id}`).catch(() => undefined);
                onDeleted(comment.id);
              }}
            >
              <Text style={{ color: palette.textFaint, fontSize: 12.5, fontWeight: "600" }}>
                Sil
              </Text>
            </Pressable>
          )}
        </View>

        {comment.replies && comment.replies.length > 0 && (
          <View style={{ marginTop: 10, gap: 8, borderLeftWidth: 2, borderLeftColor: palette.border, paddingLeft: 10 }}>
            {comment.replies.map((reply) => (
              <View key={reply.id}>
                <Text style={{ color: palette.text, fontSize: 13, fontWeight: "700" }}>
                  {reply.author.displayName}{" "}
                  <Text style={{ color: palette.textFaint, fontWeight: "400", fontSize: 11.5 }}>
                    {timeAgo(reply.createdAt)}
                  </Text>
                </Text>
                <Text style={{ color: palette.text, fontSize: 13.5, lineHeight: 20 }}>
                  {reply.content}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
