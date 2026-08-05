import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { api } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { getSocket } from "../../src/lib/socket";
import { palette } from "../../src/lib/theme";
import { Badge } from "../../src/components/ui";

export default function TabsLayout() {
  const { user, unreadMessages, setCounts } = useAuth();

  // Okunmamış sayaçları + canlı olaylar
  useEffect(() => {
    if (!user) return;

    const load = () =>
      api
        .get<{ notifications: number; messages: number }>("/notifications/unread-count")
        .then(setCounts)
        .catch(() => undefined);

    void load();
    const interval = setInterval(load, 45_000);

    const socket = getSocket();
    socket?.on("notification:new", load);
    socket?.on("conversation:updated", load);

    return () => {
      clearInterval(interval);
      socket?.off("notification:new", load);
      socket?.off("conversation:updated", load);
    };
  }, [user, setCounts]);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: palette.bg },
        headerTintColor: palette.text,
        headerTitleStyle: { fontWeight: "800", fontSize: 18 },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: palette.bgElevated,
          borderTopColor: palette.border,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: palette.brand,
        tabBarInactiveTintColor: palette.textFaint,
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: "600" },
        sceneStyle: { backgroundColor: palette.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Ana Sayfa",
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="kesfet"
        options={{
          title: "Keşfet",
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => (
            <Ionicons name={focused ? "compass" : "compass-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="topluluklar"
        options={{
          title: "Topluluklar",
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => (
            <Ionicons name={focused ? "people" : "people-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="mesajlar"
        options={{
          title: "Mesajlar",
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => (
            <View>
              <Ionicons
                name={focused ? "chatbubble" : "chatbubble-outline"}
                size={22}
                color={color}
              />
              <Badge count={unreadMessages} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, focused }: { color: string; focused: boolean }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

