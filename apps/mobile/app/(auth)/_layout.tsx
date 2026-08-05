import { Stack } from "expo-router";
import { palette } from "../../src/lib/theme";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.bg },
      }}
    />
  );
}
