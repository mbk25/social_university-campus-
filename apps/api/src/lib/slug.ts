const TR_MAP: Record<string, string> = {
  ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", İ: "i", ö: "o", Ö: "o",
  ş: "s", Ş: "s", ü: "u", Ü: "u", â: "a", î: "i", û: "u",
};

export function slugify(input: string, maxLength = 40): string {
  const normalized = input
    .split("")
    .map((ch) => TR_MAP[ch] ?? ch)
    .join("")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.slice(0, maxLength).replace(/-+$/, "") || "topluluk";
}

/** Çakışma olursa sonuna sayı ekleyerek benzersiz slug üretir. */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base);
  if (!(await exists(root))) return root;
  for (let i = 2; i < 100; i++) {
    const candidate = `${root.slice(0, 36)}-${i}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${root.slice(0, 32)}-${Date.now().toString(36)}`;
}
