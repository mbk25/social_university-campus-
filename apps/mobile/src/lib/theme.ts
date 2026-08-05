export const palette = {
  bg: "#0b0d13",
  bgElevated: "#151823",
  bgSubtle: "#10131c",
  border: "#232838",
  borderStrong: "#2d3348",
  text: "#f2f4f8",
  textMuted: "#9aa1b4",
  textFaint: "#6b7288",
  brand: "#8f74ff",
  brandStrong: "#7c5cff",
  brandSoft: "rgba(124, 92, 255, 0.16)",
  accent: "#38e0c4",
  danger: "#f43f5e",
  success: "#10b981",
  warning: "#f59e0b",
  white: "#ffffff",
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: "800" as const, letterSpacing: -0.6 },
  h2: { fontSize: 22, fontWeight: "800" as const, letterSpacing: -0.4 },
  h3: { fontSize: 17, fontWeight: "700" as const },
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13 },
  tiny: { fontSize: 11.5 },
};

/** İsimden tutarlı avatar rengi üretir. */
const AVATAR_COLORS = ["#8f74ff", "#38bdf8", "#34d399", "#fbbf24", "#fb7185", "#818cf8"];

export function avatarColor(name: string): string {
  const sum = Array.from(name).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toLocaleUpperCase("tr") ?? "")
    .join("");
}

export function timeAgo(input: string | Date): string {
  const date = typeof input === "string" ? new Date(input) : input;
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return "şimdi";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} dk`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} sa`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} g`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)} hf`;
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(".0", "")}B`;
  return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`;
}
