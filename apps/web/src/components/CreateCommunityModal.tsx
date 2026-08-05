"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Community } from "@/lib/types";
import { Button, Input, Modal, Select, Textarea, cx, useToast } from "./ui";

function slugify(value: string) {
  const map: Record<string, string> = {
    ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", İ: "i",
  };
  return value
    .split("")
    .map((c) => map[c] ?? c)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function CreateCommunityModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (community: Community) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState<"GLOBAL" | "UNIVERSITY" | "DEPARTMENT">("GLOBAL");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  async function submit() {
    setBusy(true);
    setErrors({});
    try {
      const result = await api.post<{ community: Community }>("/communities", {
        name: name.trim(),
        slug,
        description: description.trim() || undefined,
        scope,
        visibility,
        department: scope === "DEPARTMENT" ? user?.department : undefined,
        tags: tags
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 8),
      });
      toast.show("Topluluk kuruldu 🎉", "success");
      onCreated?.(result.community);
      onClose();
      router.push(`/topluluk/${result.community.slug}`);
      setName("");
      setSlug("");
      setDescription("");
      setTags("");
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields ?? { _: err.message });
        if (!err.fields) toast.show(err.message, "error");
      }
    } finally {
      setBusy(false);
    }
  }

  const SCOPE_OPTIONS = [
    {
      value: "GLOBAL",
      title: "Genel",
      description: "Tüm üniversitelerden öğrenciler katılabilir",
      disabled: false,
    },
    {
      value: "UNIVERSITY",
      title: user?.university?.shortName ?? "Üniversiteme özel",
      description: user?.university
        ? `Sadece ${user.university.name} öğrencileri`
        : "Üniversite bilgin olmadığı için kullanılamaz",
      disabled: !user?.university,
    },
    {
      value: "DEPARTMENT",
      title: user?.department ?? "Bölümüme özel",
      description: user?.department
        ? `Sadece ${user.university?.shortName ?? "üniversiten"} ${user.department} öğrencileri`
        : "Profilinde bölüm seçili değil",
      disabled: !user?.department || !user?.university,
    },
  ] as const;

  return (
    <Modal open={open} onClose={onClose} title="Topluluk kur">
      <div className="space-y-4">
        <Input
          label="Topluluk adı"
          placeholder="Örn. Yazılım Geliştirme Kulübü"
          value={name}
          maxLength={50}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />

        <Input
          label="Adres (slug)"
          value={slug}
          maxLength={40}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(slugify(e.target.value));
          }}
          hint={`kampus.app/topluluk/${slug || "adres"}`}
          error={errors.slug}
        />

        <Textarea
          label="Açıklama"
          placeholder="Bu topluluk ne hakkında? Kimler katılmalı?"
          rows={3}
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={errors.description}
        />

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-muted">Kimler katılabilir?</span>
          <div className="space-y-2">
            {SCOPE_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={cx(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                  option.disabled && "cursor-not-allowed opacity-50",
                  scope === option.value
                    ? "border-[var(--brand)] brand-soft-bg"
                    : "border-[var(--border)] hover:bg-[var(--bg-subtle)]",
                )}
              >
                <input
                  type="radio"
                  name="scope"
                  disabled={option.disabled}
                  checked={scope === option.value}
                  onChange={() => setScope(option.value)}
                  className="mt-1 accent-[var(--brand)]"
                />
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold">{option.title}</span>
                  <span className="block text-[12.5px] text-muted">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <Select
          label="Görünürlük"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as "PUBLIC" | "PRIVATE")}
          hint={
            visibility === "PRIVATE"
              ? "Gizli topluluklarda katılım isteği yöneticiler tarafından onaylanır"
              : "Herkes içeriği görebilir ve doğrudan katılabilir"
          }
        >
          <option value="PUBLIC">Açık</option>
          <option value="PRIVATE">Gizli (onaylı katılım)</option>
        </Select>

        <Input
          label="Etiketler"
          placeholder="yazılım, kariyer, proje"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          hint="Virgülle ayır, en fazla 8 etiket"
        />

        {errors._ && <p className="text-[13px] text-rose-500">{errors._}</p>}

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" fullWidth onClick={onClose}>
            Vazgeç
          </Button>
          <Button
            fullWidth
            loading={busy}
            onClick={submit}
            disabled={name.trim().length < 3 || slug.length < 3}
          >
            Topluluğu kur
          </Button>
        </div>
      </div>
    </Modal>
  );
}
