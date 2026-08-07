export * from "./universities";
export * from "./departments";
export * from "./schemas";
export * from "./types";

/** Anonim gönderiler/itiraflar için okunabilir takma ad üretir. */
const ANON_ADJECTIVES = [
  "Uykusuz", "Kafeinli", "Vizeye Hazır", "Bütünlemeci", "Yurtlu", "Kantinci",
  "Ders Kaçkını", "Not Tutan", "Ön Sıradaki", "Arka Sıradaki", "Gizemli",
  "Sabahçı", "Gece Kuşu", "Bursu Kesilmiş", "Stajyer", "Mezuniyet Bekleyen",
];
const ANON_NOUNS = [
  "Öğrenci", "Kampüsçü", "Mühendis Adayı", "Kütüphaneci", "Amfi Sakini",
  "Simit Sever", "Otobüs Yolcusu", "Laborant", "Proje Kurbanı", "Devamsız",
  "Ödevzede", "Final Savaşçısı",
];

export function generateAnonymousAlias(seed?: string): string {
  const hash = seed
    ? Array.from(seed).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
    : Math.floor(Math.random() * 0xffffffff);
  const adj = ANON_ADJECTIVES[hash % ANON_ADJECTIVES.length];
  const noun = ANON_NOUNS[(hash >>> 8) % ANON_NOUNS.length];
  const num = (hash >>> 16) % 100;
  return `${adj} ${noun} #${num.toString().padStart(2, "0")}`;
}

/** Metinden @kullanıcı ve #etiket çıkarır. */
export function extractMentions(text: string): string[] {
  return Array.from(new Set((text.match(/@([a-z0-9_]{3,24})/gi) ?? []).map((m) => m.slice(1).toLowerCase())));
}

export function extractHashtags(text: string): string[] {
  return Array.from(
    new Set(
      (text.match(/#([\p{L}\p{N}_]{2,30})/gu) ?? []).map((m) => m.slice(1).toLocaleLowerCase("tr")),
    ),
  );
}

/** "3 dk önce" biçiminde göreli zaman. */
export function timeAgo(input: string | number | Date, now: Date = new Date()): string {
  const date = input instanceof Date ? input : new Date(input);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 45) return "şimdi";
  const units: [number, string][] = [
    [60, "dk"],
    [3600, "sa"],
    [86400, "g"],
    [604800, "hf"],
    [2592000, "ay"],
    [31536000, "y"],
  ];
  if (seconds < 3600) return `${Math.floor(seconds / 60)} dk`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} sa`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} g`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)} hf`;
  if (seconds < 31536000) return `${Math.floor(seconds / 2592000)} ay`;
  void units;
  return `${Math.floor(seconds / 31536000)} y`;
}

/**
 * Sınıf seçenekleri. 7 ve sonrası sınıf numarası değil aşama bildirir, bu yüzden
 * etiket tek yerden üretilir — aksi halde "7. sınıf" gibi yanlış metinler çıkıyor.
 */
export const CLASS_YEAR_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 1, label: "1. sınıf" },
  { value: 2, label: "2. sınıf" },
  { value: 3, label: "3. sınıf" },
  { value: 4, label: "4. sınıf" },
  { value: 5, label: "5. sınıf" },
  { value: 6, label: "6. sınıf" },
  { value: 7, label: "Yüksek lisans" },
  { value: 8, label: "Doktora" },
  { value: 9, label: "Mezun" },
];

export const CLASS_YEAR_MAX = 9;

export function classYearLabel(year: number | null | undefined): string | null {
  if (year == null) return null;
  return CLASS_YEAR_OPTIONS.find((o) => o.value === year)?.label ?? null;
}

export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(".0", "")}B`;
  return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`;
}

export const BADGES: Record<string, { label: string; icon: string; description: string }> = {
  EARLY_ADOPTER: { label: "Öncü", icon: "🚀", description: "İlk 1000 kullanıcıdan biri" },
  VERIFIED_STUDENT: { label: "Doğrulanmış Öğrenci", icon: "🎓", description: "Üniversite e-postası doğrulandı" },
  COMMUNITY_FOUNDER: { label: "Kurucu", icon: "🏛️", description: "Bir topluluk kurdu" },
  NOTE_HERO: { label: "Not Kahramanı", icon: "📚", description: "10+ ders notu paylaştı" },
  SOCIAL_BUTTERFLY: { label: "Sosyal Kelebek", icon: "🦋", description: "100+ takipçi" },
  EVENT_ORGANIZER: { label: "Organizatör", icon: "🎪", description: "5+ etkinlik düzenledi" },
  HELPFUL: { label: "Yardımsever", icon: "💡", description: "Yorumları 500+ beğeni aldı" },
  NIGHT_OWL: { label: "Gece Kuşu", icon: "🦉", description: "Gece 02:00-05:00 arası 50 gönderi" },
};
