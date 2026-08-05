import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ApiError, api } from "../../src/lib/api";
import { useAuth } from "../../src/lib/auth";
import type { User } from "../../src/lib/types";
import { palette, radius, spacing, typography } from "../../src/lib/theme";
import { Button, Field } from "../../src/components/ui";

type Step = "EMAIL" | "CODE" | "PROFILE";

interface DepartmentGroup {
  faculty: string;
  departments: string[];
}

interface EmailCheck {
  allowed: boolean;
  taken?: boolean;
  message?: string;
  isStudentAddress?: boolean;
  university?: { id: string; name: string; city: string } | null;
}

export default function RegisterScreen() {
  const { applyAuthResponse, refreshUser } = useAuth();

  const [step, setStep] = useState<Step>("EMAIL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [email, setEmail] = useState("");
  const [check, setCheck] = useState<EmailCheck | null>(null);
  const [checking, setChecking] = useState(false);

  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [codeExpiresIn, setCodeExpiresIn] = useState(0);
  const [verifying, setVerifying] = useState(false);

  const [username, setUsername] = useState("");
  const [usernameState, setUsernameState] = useState<{ available: boolean; reason: string | null } | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState("");
  const [classYear, setClassYear] = useState(1);
  const [groups, setGroups] = useState<DepartmentGroup[]>([]);
  const [showDepartments, setShowDepartments] = useState(false);

  const emailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api
      .get<{ groups: DepartmentGroup[] }>("/meta/departments", { auth: false })
      .then((d) => setGroups(d.groups))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    if (codeExpiresIn <= 0) return;
    const t = setTimeout(() => setCodeExpiresIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [codeExpiresIn]);

  useEffect(() => {
    if (emailTimer.current) clearTimeout(emailTimer.current);
    const value = email.trim().toLowerCase();
    if (!value.includes("@") || value.length < 6) {
      setCheck(null);
      return;
    }
    setChecking(true);
    emailTimer.current = setTimeout(() => {
      api
        .post<EmailCheck>("/auth/check-email", { email: value }, { auth: false })
        .then(setCheck)
        .catch(() => setCheck(null))
        .finally(() => setChecking(false));
    }, 500);
  }, [email]);

  useEffect(() => {
    if (usernameTimer.current) clearTimeout(usernameTimer.current);
    if (username.length < 3) {
      setUsernameState(null);
      return;
    }
    usernameTimer.current = setTimeout(() => {
      api
        .get<{ available: boolean; reason: string | null }>(
          `/auth/username-available?username=${encodeURIComponent(username)}`,
          { auth: false },
        )
        .then(setUsernameState)
        .catch(() => setUsernameState(null));
    }, 400);
  }, [username]);

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<{ expiresInSeconds: number }>(
        "/auth/register/start",
        { email: email.trim().toLowerCase() },
        { auth: false },
      );
      setStep("CODE");
      setResendIn(60);
      setCode("");
      setCodeExpiresIn(result.expiresInSeconds ?? 600);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kod gönderilemedi");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (resendIn > 0) return;
    try {
      await api.post("/auth/register/resend", { email: email.trim().toLowerCase() }, { auth: false });
      setResendIn(60);
      setCodeExpiresIn(600);
      // Eski kod geçersizleşti — ekranda kalmasın.
      setCode("");
      setError(null);
      setFieldErrors({});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kod gönderilemedi");
    }
  }

  /** Kodu profil adımına geçmeden önce sunucuda doğrular. */
  async function verifyCode() {
    setVerifying(true);
    setError(null);
    setFieldErrors({});
    try {
      await api.post(
        "/auth/register/verify-code",
        { email: email.trim().toLowerCase(), code },
        { auth: false },
      );
      setStep("PROFILE");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kod doğrulanamadı");
    } finally {
      setVerifying(false);
    }
  }

  async function complete() {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const result = await api.post<{ accessToken: string; refreshToken: string; user: User }>(
        "/auth/register/complete",
        {
          email: email.trim().toLowerCase(),
          code,
          username: username.toLowerCase(),
          displayName: displayName.trim(),
          password,
          department,
          classYear,
          acceptedTerms: true,
        },
        { auth: false },
      );
      await applyAuthResponse(result);
      await refreshUser();
      router.replace("/(tabs)");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fields ?? {});
        if (err.fields?.code) setStep("CODE");
      } else {
        setError("Kayıt tamamlanamadı");
      }
    } finally {
      setBusy(false);
    }
  }

  const canSendCode = !!check?.allowed && !check.taken && !checking;
  const passwordOk = password.length >= 8 && /[0-9]/.test(password) && /[a-zA-Z]/.test(password);
  const canComplete =
    code.length === 6 &&
    usernameState?.available === true &&
    displayName.trim().length >= 2 &&
    passwordOk &&
    !!department;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: palette.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.xl, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            onPress={() => (step === "EMAIL" ? router.back() : setStep(step === "PROFILE" ? "CODE" : "EMAIL"))}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.lg }}
          >
            <Ionicons name="arrow-back" size={20} color={palette.textMuted} />
            <Text style={{ color: palette.textMuted, fontSize: 14.5 }}>Geri</Text>
          </Pressable>

          <StepBar step={step} />

          {step === "EMAIL" && (
            <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
              <View>
                <Text style={[typography.h2, { color: palette.text }]}>
                  Üniversite mailinle başla
                </Text>
                <Text
                  style={{ color: palette.textMuted, fontSize: 14, lineHeight: 21, marginTop: 6 }}
                >
                  Kampus&apos;e yalnızca üniversitenin verdiği adresle kayıt olunur.
                </Text>
              </View>

              <Field
                label="Üniversite e-posta adresin"
                placeholder="ad.soyad@ogr.universite.edu.tr"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                error={error}
              />

              {checking && (
                <Text style={{ color: palette.textFaint, fontSize: 13 }}>
                  Adres kontrol ediliyor…
                </Text>
              )}

              {check && !checking && (
                <View
                  style={{
                    flexDirection: "row",
                    gap: spacing.md,
                    padding: spacing.lg,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: check.allowed && !check.taken ? palette.success : palette.danger,
                    backgroundColor:
                      check.allowed && !check.taken
                        ? "rgba(16,185,129,0.12)"
                        : "rgba(244,63,94,0.12)",
                  }}
                >
                  <Ionicons
                    name={check.allowed && !check.taken ? "shield-checkmark" : "alert-circle"}
                    size={20}
                    color={check.allowed && !check.taken ? palette.success : palette.danger}
                  />
                  <Text style={{ color: palette.text, fontSize: 13.5, lineHeight: 20, flex: 1 }}>
                    {check.taken
                      ? "Bu adresle zaten bir hesap var. Giriş yapmayı dene."
                      : check.allowed
                        ? `${check.university?.name ?? "Akademik adres"} doğrulandı${
                            check.university ? ` · ${check.university.city}` : ""
                          }`
                        : check.message}
                  </Text>
                </View>
              )}

              <Button
                title="Doğrulama kodu gönder"
                size="lg"
                fullWidth
                loading={busy}
                disabled={!canSendCode}
                onPress={sendCode}
              />
            </View>
          )}

          {step === "CODE" && (
            <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
              <View>
                <Text style={[typography.h2, { color: palette.text }]}>E-postanı doğrula</Text>
                <Text
                  style={{ color: palette.textMuted, fontSize: 14, lineHeight: 21, marginTop: 6 }}
                >
                  <Text style={{ color: palette.text, fontWeight: "700" }}>{email}</Text> adresine 6
                  haneli bir kod gönderdik.
                </Text>
              </View>

              <Field
                placeholder="000000"
                value={code}
                onChangeText={(v) => {
                  setCode(v.replace(/\D/g, "").slice(0, 6));
                  setError(null);
                }}
                keyboardType="number-pad"
                maxLength={6}
                textContentType="oneTimeCode"
                error={error ?? fieldErrors.code}
                style={{
                  fontSize: 30,
                  fontWeight: "800",
                  letterSpacing: 12,
                  textAlign: "center",
                  paddingVertical: 16,
                }}
              />

              <Text
                style={{
                  color: codeExpiresIn > 0 ? palette.textMuted : palette.danger,
                  fontSize: 13,
                  textAlign: "center",
                }}
              >
                {codeExpiresIn > 0
                  ? `Kodun geçerlilik süresi: ${Math.floor(codeExpiresIn / 60)}:${String(
                      codeExpiresIn % 60,
                    ).padStart(2, "0")}`
                  : "Kodun süresi doldu — aşağıdan yeni kod iste."}
              </Text>

              <Button
                title="Kodu doğrula ve devam et"
                size="lg"
                fullWidth
                loading={verifying}
                disabled={code.length !== 6}
                onPress={verifyCode}
              />

              <Pressable onPress={resend} disabled={resendIn > 0}>
                <Text
                  style={{
                    color: resendIn > 0 ? palette.textFaint : palette.brand,
                    fontSize: 14,
                    fontWeight: "600",
                    textAlign: "center",
                  }}
                >
                  {resendIn > 0 ? `Yeniden gönder (${resendIn})` : "Kodu yeniden gönder"}
                </Text>
              </Pressable>

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
                Kod gelmediyse spam klasörünü kontrol et. Bazı üniversitelerde dış e-postalar birkaç
                dakika gecikebiliyor.
              </Text>
            </View>
          )}

          {step === "PROFILE" && (
            <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
              <View>
                <Text style={[typography.h2, { color: palette.text }]}>Profilini oluştur</Text>
                <Text style={{ color: palette.textMuted, fontSize: 14, marginTop: 6 }}>
                  Bölümünü seçince ilgili topluluklara otomatik katılacaksın.
                </Text>
              </View>

              <Field
                label="Kullanıcı adı"
                placeholder="ornekkullanici"
                value={username}
                onChangeText={(v) =>
                  setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24))
                }
                autoCapitalize="none"
                autoCorrect={false}
                error={usernameState && !usernameState.available ? usernameState.reason : fieldErrors.username}
                success={usernameState?.available ? "Bu kullanıcı adı müsait" : null}
              />

              <Field
                label="Görünen adın"
                placeholder="Ad Soyad"
                value={displayName}
                onChangeText={setDisplayName}
                error={fieldErrors.displayName}
              />

              <View>
                <Text
                  style={{
                    color: palette.textMuted,
                    fontSize: 13,
                    fontWeight: "600",
                    marginBottom: 6,
                  }}
                >
                  Bölümün
                </Text>
                <Pressable
                  onPress={() => setShowDepartments((v) => !v)}
                  style={{
                    backgroundColor: palette.bgSubtle,
                    borderWidth: 1,
                    borderColor: palette.border,
                    borderRadius: radius.md,
                    paddingHorizontal: 14,
                    paddingVertical: 13,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{ color: department ? palette.text : palette.textFaint, fontSize: 15 }}
                  >
                    {department || "Bölüm seç…"}
                  </Text>
                  <Ionicons
                    name={showDepartments ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={palette.textMuted}
                  />
                </Pressable>

                {showDepartments && (
                  <View
                    style={{
                      marginTop: 8,
                      maxHeight: 280,
                      backgroundColor: palette.bgElevated,
                      borderWidth: 1,
                      borderColor: palette.border,
                      borderRadius: radius.md,
                      overflow: "hidden",
                    }}
                  >
                    <ScrollView nestedScrollEnabled>
                      {groups.map((group) => (
                        <View key={group.faculty}>
                          <Text
                            style={{
                              color: palette.textFaint,
                              fontSize: 11.5,
                              fontWeight: "800",
                              textTransform: "uppercase",
                              paddingHorizontal: 14,
                              paddingTop: 12,
                              paddingBottom: 4,
                            }}
                          >
                            {group.faculty}
                          </Text>
                          {group.departments.map((d) => (
                            <Pressable
                              key={d}
                              onPress={() => {
                                setDepartment(d);
                                setShowDepartments(false);
                              }}
                              style={{ paddingHorizontal: 14, paddingVertical: 11 }}
                            >
                              <Text
                                style={{
                                  color: department === d ? palette.brand : palette.text,
                                  fontSize: 14.5,
                                  fontWeight: department === d ? "700" : "400",
                                }}
                              >
                                {d}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View>
                <Text
                  style={{
                    color: palette.textMuted,
                    fontSize: 13,
                    fontWeight: "600",
                    marginBottom: 8,
                  }}
                >
                  Sınıfın
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {[
                    { value: 1, label: "1" },
                    { value: 2, label: "2" },
                    { value: 3, label: "3" },
                    { value: 4, label: "4" },
                    { value: 5, label: "5" },
                    { value: 6, label: "6" },
                    { value: 7, label: "Y.Lisans" },
                    { value: 8, label: "Doktora" },
                  ].map((option) => (
                    <Pressable
                      key={option.value}
                      onPress={() => setClassYear(option.value)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 9,
                        borderRadius: radius.full,
                        backgroundColor:
                          classYear === option.value ? palette.brandStrong : palette.bgElevated,
                        borderWidth: 1,
                        borderColor: classYear === option.value ? palette.brandStrong : palette.border,
                      }}
                    >
                      <Text
                        style={{
                          color: classYear === option.value ? palette.white : palette.textMuted,
                          fontSize: 13.5,
                          fontWeight: "600",
                        }}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Field
                label="Şifre"
                placeholder="En az 8 karakter, bir rakam"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                error={fieldErrors.password}
              />

              {error && (
                <Text style={{ color: palette.danger, fontSize: 13.5 }}>{error}</Text>
              )}

              <Text style={{ color: palette.textFaint, fontSize: 12.5, lineHeight: 19 }}>
                Devam ederek topluluk kurallarını ve gizlilik politikasını kabul etmiş olursun.
              </Text>

              <Button
                title="Hesabımı oluştur"
                size="lg"
                fullWidth
                loading={busy}
                disabled={!canComplete}
                onPress={complete}
              />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StepBar({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "EMAIL", label: "E-posta" },
    { key: "CODE", label: "Doğrulama" },
    { key: "PROFILE", label: "Profil" },
  ];
  const index = steps.findIndex((s) => s.key === step);

  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {steps.map((s, i) => (
        <View key={s.key} style={{ flex: 1, gap: 6 }}>
          <View
            style={{
              height: 4,
              borderRadius: 2,
              backgroundColor: i <= index ? palette.brandStrong : palette.borderStrong,
            }}
          />
          <Text
            style={{
              color: i === index ? palette.brand : palette.textFaint,
              fontSize: 12,
              fontWeight: "600",
            }}
          >
            {s.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
