import { Stack } from "expo-router";
import { View } from "react-native";
import { palette } from "../src/lib/theme";
import { FeedList } from "../src/components/FeedList";

export default function BookmarksScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Stack.Screen options={{ title: "Kaydedilenler" }} />
      <FeedList
        query="tab=BOOKMARKS"
        emptyTitle="Kaydedilmiş gönderi yok"
        emptyDescription="Beğendiğin gönderileri yer imi simgesine dokunarak buraya kaydedebilirsin."
      />
    </View>
  );
}
