import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Image, Modal, Pressable, Share, Text, View } from "react-native";
import { ApiError, api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { formatCount, palette, radius, spacing, timeAgo } from "../lib/theme";
import type { MiniUser, Post } from "../lib/types";
import { Avatar } from "./ui";

export function PostCard({
  post: initial,
  onDeleted,
}: {
  post: Post;
  onDeleted?: (id: string) => void;
}) {
  const [post, setPost] = useState(initial);
  const [voting, setVoting] = useState(false);
  const { user } = useAuth();
  const [shareOpen, setShareOpen] = useState(false);
  const [friends, setFriends] = useState<MiniUser[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);

  const author = post.author;
  const displayName = post.isAnonymous ? post.anonymousAlias ?? "Anonim" : author?.displayName ?? "";

  async function openShare() {
    if (!user) return;
    setSelectedFriendIds([]);
    setShareOpen(true);
    try {
      const data = await api.get<{ items: MiniUser[] }>(`/users/${user.username}/following?limit=50`);
      setFriends(data.items);
    } catch {
      setFriends([]);
    }
  }

  function toggleFriend(friendId: string) {
    setSelectedFriendIds((current) => current.includes(friendId) ? current.filter((id) => id !== friendId) : [...current, friendId]);
  }

  async function sendToFriends() {
    const recipients = friends.filter((friend) => selectedFriendIds.includes(friend.id));
    if (recipients.length === 0) return;
    setSharing(true);
    try {
      await Promise.all(recipients.map(async (friend) => {
        const { conversation } = await api.post<{ conversation: { id: string } }>("/chat/conversations", { type: "DIRECT", memberIds: [friend.id] });
        await api.post(`/chat/conversations/${conversation.id}/messages`, { content: "", sharedPostId: post.id });
      }));
      setShareOpen(false);
    } finally {
      setSharing(false);
    }
  }

  async function toggleLike() {
    const liked = post.viewer.hasLiked;
    setPost((p) => ({
      ...p,
      viewer: { ...p.viewer, hasLiked: !liked },
      likeCount: p.likeCount + (liked ? -1 : 1),
    }));
    try {
      const result = await (liked
        ? api.delete<{ likeCount: number }>(`/posts/${post.id}/like`)
        : api.post<{ likeCount: number }>(`/posts/${post.id}/like`));
      setPost((p) => ({ ...p, likeCount: result.likeCount }));
    } catch {
      setPost((p) => ({
        ...p,
        viewer: { ...p.viewer, hasLiked: liked },
        likeCount: p.likeCount + (liked ? 1 : -1),
      }));
    }
  }

  async function toggleBookmark() {
    const saved = post.viewer.hasBookmarked;
    setPost((p) => ({ ...p, viewer: { ...p.viewer, hasBookmarked: !saved } }));
    try {
      await (saved ? api.delete(`/posts/${post.id}/bookmark`) : api.post(`/posts/${post.id}/bookmark`));
    } catch {
      setPost((p) => ({ ...p, viewer: { ...p.viewer, hasBookmarked: saved } }));
    }
  }

  async function vote(optionId: string) {
    if (voting) return;
    setVoting(true);
    try {
      const result = await api.post<{ post: Post }>(`/posts/${post.id}/poll/vote`, { optionId });
      setPost(result.post);
    } catch (err) {
      if (err instanceof ApiError) console.warn(err.message);
    } finally {
      setVoting(false);
    }
  }

  const mediaCount = post.media.length;

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
      {post.isPinned && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 8 }}>
          <Ionicons name="pin" size={12} color={palette.brand} />
          <Text style={{ color: palette.brand, fontSize: 11.5, fontWeight: "700" }}>
            Sabitlenmiş
          </Text>
        </View>
      )}

      {/* -------------------------------------------------------------- Üst */}
      <View style={{ flexDirection: "row", gap: 11 }}>
        <Pressable
          onPress={() => !post.isAnonymous && author && router.push(`/profil/${author.username}`)}
        >
          {post.isAnonymous ? (
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: palette.bgSubtle,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="glasses-outline" size={20} color={palette.textMuted} />
            </View>
          ) : (
            <Avatar uri={author?.avatarUrl} name={displayName} size="md" />
          )}
        </Pressable>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5 }}>
            <Text style={{ color: palette.text, fontSize: 15, fontWeight: "700" }} numberOfLines={1}>
              {displayName}
            </Text>
            {author?.isVerifiedStudent && (
              <Ionicons name="shield-checkmark" size={13} color={palette.brand} />
            )}
            <Text style={{ color: palette.textFaint, fontSize: 12.5 }}>
              {!post.isAnonymous && author ? `@${author.username} · ` : ""}
              {timeAgo(post.createdAt)}
            </Text>
          </View>

          <Text style={{ color: palette.textMuted, fontSize: 12.5, marginTop: 1 }} numberOfLines={1}>
            {[
              post.community?.name,
              !post.isAnonymous ? author?.university?.shortName : null,
              !post.isAnonymous ? author?.department : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
      </View>

      {/* ------------------------------------------------------------ İçerik */}
      {!!post.content && (
        <Pressable onPress={() => router.push(`/gonderi/${post.id}`)}>
          <Text style={{ color: palette.text, fontSize: 15, lineHeight: 22.5, marginTop: 10 }}>
            {post.content}
          </Text>
        </Pressable>
      )}

      {mediaCount > 0 && (
        <View
          style={{
            marginTop: 12,
            borderRadius: radius.md,
            overflow: "hidden",
            flexDirection: mediaCount > 1 ? "row" : "column",
            flexWrap: "wrap",
            gap: 4,
          }}
        >
          {post.media.slice(0, 4).map((media) => (
            <Image
              key={media.url}
              source={{ uri: media.url }}
              style={{
                width: mediaCount === 1 ? "100%" : "49%",
                height: mediaCount === 1 ? 240 : 130,
                backgroundColor: palette.bgSubtle,
                borderRadius: mediaCount === 1 ? radius.md : radius.sm,
              }}
              resizeMode="cover"
            />
          ))}
        </View>
      )}

      {post.poll && (
        <View style={{ marginTop: 12, gap: 8 }}>
          <Text style={{ color: palette.text, fontSize: 14, fontWeight: "700" }}>
            {post.poll.question}
          </Text>
          {post.poll.options.map((option) => {
            const total = post.poll!.totalVotes || 1;
            const pct = Math.round((option.voteCount / total) * 100);
            const voted = post.poll!.viewerVotedOptionId === option.id;
            const revealed = !!post.poll!.viewerVotedOptionId || new Date(post.poll!.endsAt) < new Date();

            return (
              <Pressable
                key={option.id}
                onPress={() => vote(option.id)}
                style={{
                  borderWidth: 1,
                  borderColor: voted ? palette.brand : palette.border,
                  borderRadius: radius.md,
                  overflow: "hidden",
                }}
              >
                {revealed && (
                  <View
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${pct}%`,
                      backgroundColor: palette.brandSoft,
                    }}
                  />
                )}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingHorizontal: 13,
                    paddingVertical: 10,
                  }}
                >
                  <Text
                    style={{
                      color: voted ? palette.brand : palette.text,
                      fontSize: 14,
                      fontWeight: voted ? "700" : "500",
                      flex: 1,
                    }}
                    numberOfLines={1}
                  >
                    {option.text}
                  </Text>
                  {revealed && (
                    <Text style={{ color: palette.textMuted, fontSize: 13 }}>%{pct}</Text>
                  )}
                </View>
              </Pressable>
            );
          })}
          <Text style={{ color: palette.textFaint, fontSize: 12 }}>
            {formatCount(post.poll.totalVotes)} oy
          </Text>
        </View>
      )}

      {/* ------------------------------------------------------------ Aksiyon */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: 12,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: palette.border,
        }}
      >
        <Action
          icon={post.viewer.hasLiked ? "heart" : "heart-outline"}
          color={post.viewer.hasLiked ? palette.danger : palette.textMuted}
          label={post.likeCount > 0 ? formatCount(post.likeCount) : undefined}
          onPress={toggleLike}
        />
        <Action
          icon="chatbubble-outline"
          color={palette.textMuted}
          label={post.commentCount > 0 ? formatCount(post.commentCount) : undefined}
          onPress={() => router.push(`/gonderi/${post.id}`)}
        />
        <Action
          icon="share-outline"
          color={palette.textMuted}
          onPress={openShare}
        />
        <View style={{ flex: 1 }} />
        <Action
          icon={post.viewer.hasBookmarked ? "bookmark" : "bookmark-outline"}
          color={post.viewer.hasBookmarked ? palette.brand : palette.textMuted}
          onPress={toggleBookmark}
        />
        {post.viewer.canDelete && (
          <Action
            icon="trash-outline"
            color={palette.textFaint}
            onPress={async () => {
              await api.delete(`/posts/${post.id}`).catch(() => undefined);
              onDeleted?.(post.id);
            }}
          />
        )}
      </View>

      <Modal visible={shareOpen} transparent animationType="slide" onRequestClose={() => setShareOpen(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" }}>
          <View style={{ maxHeight: "70%", borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: palette.bgElevated, padding: spacing.lg }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md }}>
              <Text style={{ color: palette.text, fontSize: 17, fontWeight: "700" }}>Arkadaşına gönder</Text>
              <Pressable onPress={() => setShareOpen(false)}><Ionicons name="close" size={22} color={palette.textMuted} /></Pressable>
            </View>
            {friends.length === 0 ? (
              <Text style={{ color: palette.textMuted, fontSize: 14, paddingVertical: spacing.md }}>Gönderebileceğin biri için önce bir kullanıcıyı takip et.</Text>
            ) : (
              <FlatList data={friends} keyExtractor={(friend) => friend.id} renderItem={({ item: friend }) => (
                <Pressable onPress={() => toggleFriend(friend.id)} disabled={sharing} style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 10, opacity: sharing ? 0.55 : 1 }}>
                  <Avatar uri={friend.avatarUrl} name={friend.displayName} size="sm" />
                  <View style={{ flex: 1 }}><Text style={{ color: palette.text, fontSize: 14, fontWeight: "600" }}>{friend.displayName}</Text><Text style={{ color: palette.textFaint, fontSize: 12 }}>@{friend.username}</Text></View>
                  <View style={{ width: 20, height: 20, alignItems: "center", justifyContent: "center", borderRadius: 6, borderWidth: 1, borderColor: selectedFriendIds.includes(friend.id) ? palette.brand : palette.borderStrong, backgroundColor: selectedFriendIds.includes(friend.id) ? palette.brandStrong : "transparent" }}>
                    {selectedFriendIds.includes(friend.id) && <Ionicons name="checkmark" size={15} color={palette.white} />}
                  </View>
                </Pressable>
              )} />
            )}
            {friends.length > 0 && (
              <Pressable disabled={selectedFriendIds.length === 0 || sharing} onPress={() => void sendToFriends()} style={{ marginTop: spacing.md, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: palette.brandStrong, opacity: selectedFriendIds.length === 0 || sharing ? 0.5 : 1 }}>
                <Text style={{ color: palette.white, fontSize: 15, fontWeight: "700" }}>{selectedFriendIds.length > 0 ? `${selectedFriendIds.length} kişiye gönder` : "Gönder"}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Action({
  icon,
  color,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 6,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} size={19} color={color} />
      {label && <Text style={{ color, fontSize: 13, fontWeight: "600" }}>{label}</Text>}
    </Pressable>
  );
}
