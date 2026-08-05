import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ImageStyle,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { avatarColor, initials, palette, radius, spacing, typography } from "../lib/theme";

// ------------------------------------------------------------------- Avatar
const AVATAR_SIZES = { xs: 24, sm: 32, md: 42, lg: 56, xl: 84 } as const;

export function Avatar({
  uri,
  name,
  size = "md",
  square,
  style,
}: {
  uri?: string | null;
  name: string;
  size?: keyof typeof AVATAR_SIZES;
  square?: boolean;
  /** Hem View hem Image kabul edebilmesi için ikisinin kesişimi kullanılır. */
  style?: StyleProp<ViewStyle & ImageStyle>;
}) {
  const px = AVATAR_SIZES[size];
  const borderRadius = square ? px * 0.28 : px / 2;

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[
          { width: px, height: px, borderRadius, backgroundColor: palette.bgSubtle },
          style as StyleProp<ImageStyle>,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        {
          width: px,
          height: px,
          borderRadius,
          backgroundColor: avatarColor(name),
          alignItems: "center",
          justifyContent: "center",
        },
        style as StyleProp<ViewStyle>,
      ]}
    >
      <Text style={{ color: palette.white, fontSize: px * 0.38, fontWeight: "700" }}>
        {initials(name) || "?"}
      </Text>
    </View>
  );
}

// ------------------------------------------------------------------- Button
export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  icon,
  style,
  fullWidth,
}: {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
}) {
  const heights = { sm: 34, md: 44, lg: 52 };
  const fonts = { sm: 13, md: 15, lg: 16 };

  const backgrounds: Record<string, string> = {
    primary: palette.brandStrong,
    secondary: palette.bgElevated,
    ghost: "transparent",
    danger: palette.danger,
  };
  const colors: Record<string, string> = {
    primary: palette.white,
    secondary: palette.text,
    ghost: palette.textMuted,
    danger: palette.white,
  };

  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          height: heights[size],
          paddingHorizontal: size === "sm" ? 14 : 20,
          borderRadius: radius.md,
          backgroundColor: backgrounds[variant],
          borderWidth: variant === "secondary" ? 1 : 0,
          borderColor: palette.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? "stretch" : "auto",
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors[variant]} />
      ) : icon ? (
        <Ionicons name={icon} size={fonts[size] + 3} color={colors[variant]} />
      ) : null}
      <Text style={{ color: colors[variant], fontSize: fonts[size], fontWeight: "700" }}>
        {title}
      </Text>
    </Pressable>
  );
}

// -------------------------------------------------------------------- Input
export function Field({
  label,
  error,
  hint,
  success,
  style,
  ...props
}: TextInputProps & {
  label?: string;
  error?: string | null;
  hint?: string;
  success?: string | null;
}) {
  return (
    <View style={{ width: "100%" }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        placeholderTextColor={palette.textFaint}
        style={[styles.input, !!error && { borderColor: palette.danger }, style]}
        {...props}
      />
      {error ? (
        <Text style={[styles.helper, { color: palette.danger }]}>{error}</Text>
      ) : success ? (
        <Text style={[styles.helper, { color: palette.success }]}>{success}</Text>
      ) : hint ? (
        <Text style={styles.helper}>{hint}</Text>
      ) : null}
    </View>
  );
}

// --------------------------------------------------------------------- Card
export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const content = <View style={[styles.card, style]}>{children}</View>;
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      {content}
    </Pressable>
  );
}

// --------------------------------------------------------------------- Chip
export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: radius.full,
        backgroundColor: active ? palette.brandStrong : palette.bgElevated,
        borderWidth: 1,
        borderColor: active ? palette.brandStrong : palette.border,
      }}
    >
      <Text
        style={{
          color: active ? palette.white : palette.textMuted,
          fontSize: 13,
          fontWeight: "600",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// -------------------------------------------------------------------- Durum
export function Loading({ label }: { label?: string }) {
  return (
    <View style={{ paddingVertical: 48, alignItems: "center", gap: 12 }}>
      <ActivityIndicator color={palette.brand} />
      {label && <Text style={{ color: palette.textFaint, fontSize: 13 }}>{label}</Text>}
    </View>
  );
}

export function Empty({
  icon = "sparkles-outline",
  title,
  description,
  action,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <View style={{ paddingVertical: 56, paddingHorizontal: 32, alignItems: "center" }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: radius.lg,
          backgroundColor: palette.brandSoft,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: spacing.lg,
        }}
      >
        <Ionicons name={icon} size={26} color={palette.brand} />
      </View>
      <Text style={[typography.h3, { color: palette.text, textAlign: "center" }]}>{title}</Text>
      {description && (
        <Text
          style={{
            color: palette.textMuted,
            fontSize: 14,
            lineHeight: 21,
            textAlign: "center",
            marginTop: 6,
          }}
        >
          {description}
        </Text>
      )}
      {action && <View style={{ marginTop: spacing.lg }}>{action}</View>}
    </View>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: palette.border }} />;
}

export function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View
      style={{
        position: "absolute",
        top: -4,
        right: -10,
        minWidth: 17,
        height: 17,
        paddingHorizontal: 4,
        borderRadius: 9,
        backgroundColor: palette.danger,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: palette.white, fontSize: 10, fontWeight: "800" }}>
        {count > 99 ? "99+" : count}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: palette.textMuted,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    backgroundColor: palette.bgSubtle,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: palette.text,
  },
  helper: {
    color: palette.textFaint,
    fontSize: 12.5,
    marginTop: 6,
  },
  card: {
    backgroundColor: palette.bgElevated,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
});
