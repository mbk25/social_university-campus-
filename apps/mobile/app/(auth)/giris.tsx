import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import { palette, radius, spacing, typography } from "../../src/lib/theme";
import { Button, Field } from "../../src/components/ui";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Giriş yapılamadı");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: spacing.xl, justifyContent: "center" }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: "center", marginBottom: spacing.xxl }}>
            <View
              style={{
                width: 62,
                height: 62,
                borderRadius: 18,
                backgroundColor: palette.brandStrong,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: spacing.lg,
              }}
            >
              <Text style={{ color: palette.white, fontSize: 30, fontWeight: "900" }}>K</Text>
            </View>
            <Text style={[typography.h1, { color: palette.text }]}>Kampus</Text>
            <Text
              style={{
                color: palette.textMuted,
                fontSize: 14.5,
                textAlign: "center",
                marginTop: 6,
                lineHeight: 21,
              }}
            >
              Sadece üniversite öğrencilerine açık sosyal ağ
            </Text>
          </View>

          <View style={{ gap: spacing.lg }}>
            <Field
              label="Üniversite e-postan"
              placeholder="ad.soyad@ogr.universite.edu.tr"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />
            <Field
              label="Şifre"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              error={error}
            />

            <Button
              title="Giriş yap"
              size="lg"
              fullWidth
              loading={busy}
              disabled={!email.includes("@") || password.length < 6}
              onPress={submit}
            />
          </View>

          <View
            style={{
              marginTop: spacing.xxl,
              padding: spacing.lg,
              backgroundColor: palette.bgElevated,
              borderWidth: 1,
              borderColor: palette.border,
              borderRadius: radius.lg,
              flexDirection: "row",
              gap: spacing.md,
            }}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color={palette.brand} />
            <Text style={{ color: palette.textMuted, fontSize: 13, lineHeight: 19.5, flex: 1 }}>
              Kampus&apos;e yalnızca üniversitenin verdiği e-posta adresiyle kayıt olunur. Gmail,
              Hotmail gibi kişisel adresler kabul edilmez.
            </Text>
          </View>

          <Link href="/(auth)/kayit" asChild>
            <Pressable style={{ marginTop: spacing.xl, alignItems: "center" }}>
              <Text style={{ color: palette.textMuted, fontSize: 14.5 }}>
                Hesabın yok mu?{" "}
                <Text style={{ color: palette.brand, fontWeight: "700" }}>Kayıt ol</Text>
              </Text>
            </Pressable>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
