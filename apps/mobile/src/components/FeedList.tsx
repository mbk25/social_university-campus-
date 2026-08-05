import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, View, type ListRenderItem } from "react-native";
import { ApiError, api } from "../lib/api";
import { palette, spacing } from "../lib/theme";
import type { Post } from "../lib/types";
import { PostCard } from "./PostCard";
import { Empty, Loading } from "./ui";

export function FeedList({
  query,
  header,
  emptyTitle = "Burada henüz bir şey yok",
  emptyDescription,
}: {
  query: string;
  header?: React.ReactElement;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (next?: string | null) => {
      try {
        const params = new URLSearchParams(query);
        if (next) params.set("cursor", next);
        const data = await api.get<{ items: Post[]; nextCursor: string | null }>(
          `/feed?${params.toString()}`,
        );
        setPosts((current) => (next ? [...current, ...data.items] : data.items));
        setCursor(data.nextCursor);
        setError(null);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Akış yüklenemedi");
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [query],
  );

  useEffect(() => {
    setLoading(true);
    setPosts([]);
    void load(null);
  }, [load]);

  const renderItem: ListRenderItem<Post> = useCallback(
    ({ item }) => (
      <PostCard
        post={item}
        onDeleted={(id) => setPosts((current) => current.filter((p) => p.id !== id))}
      />
    ),
    [],
  );

  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={header}
      contentContainerStyle={{
        padding: spacing.lg,
        paddingBottom: 100,
        gap: spacing.md,
        flexGrow: 1,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={palette.brand}
          colors={[palette.brand]}
          onRefresh={() => {
            setRefreshing(true);
            void load(null);
          }}
        />
      }
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (cursor && !loadingMore && !loading) {
          setLoadingMore(true);
          void load(cursor);
        }
      }}
      ListEmptyComponent={
        loading ? (
          <Loading label="Yükleniyor…" />
        ) : (
          <Empty
            icon={error ? "cloud-offline-outline" : "chatbubbles-outline"}
            title={error ? "Bağlantı kurulamadı" : emptyTitle}
            description={error ?? emptyDescription}
          />
        )
      }
      ListFooterComponent={
        loadingMore ? <Loading /> : <View style={{ height: spacing.lg }} />
      }
      showsVerticalScrollIndicator={false}
    />
  );
}
