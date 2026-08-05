import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../src/lib/auth";
import { palette } from "../src/lib/theme";

/** Oturum durumuna göre (auth) ↔ (tabs) yönlendirmesi. */
function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "(auth)";

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/giris");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [user, loading, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={palette.brand} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.bg }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <RouteGuard>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: palette.bg },
                headerTintColor: palette.text,
                headerTitleStyle: { fontWeight: "700", fontSize: 17 },
                headerShadowVisible: false,
                contentStyle: { backgroundColor: palette.bg },
                animation: "slide_from_right",
              }}
            >
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="gonderi/[id]" options={{ title: "Gönderi" }} />
              <Stack.Screen name="profil/[username]" options={{ title: "Profil" }} />
              <Stack.Screen name="topluluk/[slug]" options={{ title: "Topluluk" }} />
              <Stack.Screen name="sohbet/[id]" options={{ title: "Sohbet" }} />
              <Stack.Screen name="bildirimler" options={{ title: "Bildirimler" }} />
              <Stack.Screen name="itiraflar" options={{ title: "İtiraflar" }} />
              <Stack.Screen name="etkinlikler" options={{ title: "Etkinlikler" }} />
              <Stack.Screen
                name="paylas"
                options={{ title: "Yeni gönderi", presentation: "modal" }}
              />
            </Stack>
          </RouteGuard>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
