"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CLASS_YEAR_OPTIONS } from "@kampus/shared";
import { ApiError, api, uploadImage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { MiniUser, University, User } from "@/lib/types";
import { Avatar, Button, Input, Select, Spinner, Textarea, cx, useToast } from "@/components/ui";
import { LockIcon, ShieldCheckIcon } from "@/components/icons";

interface DepartmentGroup {
  faculty: string;
  departments: string[];
}

const TABS = [
  { key: "PROFILE", label: "Profil" },
  { key: "PRIVACY", label: "Gizlilik" },
  { key: "SECURITY", label: "Güvenlik" },
  { key: "ACCOUNT", label: "Hesap" },
] as const;

export default function SettingsPage() {
  const { user, email, setUser, logout } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("PROFILE");

  if (!user) return null;

  return (
    <div className="mx-auto w-full max-w-[680px] space-y-4">
      <h1 className="text-[26px] font-black tracking-tight">Ayarlar</h1>

      <div className="flex gap-1 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cx(
              "shrink-0 rounded-lg px-3.5 py-2 text-[14px] font-semibold transition-colors",
              tab === t.key
                ? "brand-soft-bg brand-text"
                : "text-muted hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "PROFILE" && <ProfileSettings user={user} onSaved={setUser} />}
      {tab === "PRIVACY" && <PrivacySettings user={user} onSaved={setUser} />}
      {tab === "SECURITY" && <SecuritySettings />}
      {tab === "ACCOUNT" && <AccountSettings email={email} onLogout={logout} toast={toast} />}
    </div>
  );
}

function ProfileSettings({ user, onSaved }: { user: User; onSaved: (u: User) => void }) {
  const toast = useToast();
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState(user.bio ?? "");
  const [department, setDepartment] = useState(user.department ?? "");
  const [classYear, setClassYear] = useState(user.classYear ?? 1);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);
  const [coverUrl, setCoverUrl] = useState(user.coverUrl ?? null);
  const [groups, setGroups] = useState<DepartmentGroup[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);

  useEffect(() => {
    api
      .get<{ groups: DepartmentGroup[] }>("/meta/departments")
      .then((d) => setGroups(d.groups))
      .catch(() => undefined);
  }, []);

  async function pickImage(file: File | undefined, preset: "avatar" | "cover") {
    if (!file) return;
    setUploading(preset);
    try {
      const result = await uploadImage(file, preset);
      if (preset === "avatar") setAvatarUrl(result.url);
      else setCoverUrl(result.url);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Görsel yüklenemedi", "error");
    } finally {
      setUploading(null);
    }
  }

  async function save() {
    setBusy(true);
    try {
      const result = await api.patch<{ user: User }>("/users/me", {
        displayName: displayName.trim(),
        bio: bio.trim(),
        department,
        classYear,
        avatarUrl,
        coverUrl,
      });
      onSaved(result.user);
      toast.show("Profilin güncellendi", "success");
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Kaydedilemedi", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="surface space-y-5 rounded-[var(--radius-card)] p-5">
      <div>
        <span className="mb-2 block text-[13px] font-medium text-muted">Kapak görseli</span>
        <input
          ref={coverRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => pickImage(e.target.files?.[0], "cover")}
        />
        <button
          onClick={() => coverRef.current?.click()}
          className="relative h-28 w-full overflow-hidden rounded-xl bg-gradient-to-br from-[#6b46ef] to-[#38e0c4]"
          style={coverUrl ? { backgroundImage: `url(${coverUrl})`, backgroundSize: "cover" } : undefined}
        >
          <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-[13px] font-semibold text-white">
            {uploading === "cover" ? <Spinner size={20} /> : "Kapak görselini değiştir"}
          </span>
        </button>
      </div>

      <div className="flex items-center gap-4">
        <input
          ref={avatarRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => pickImage(e.target.files?.[0], "avatar")}
        />
        <Avatar src={avatarUrl} name={displayName} size="xl" />
        <div>
          <Button
            variant="secondary"
            size="sm"
            loading={uploading === "avatar"}
            onClick={() => avatarRef.current?.click()}
          >
            Fotoğrafı değiştir
          </Button>
          {avatarUrl && (
            <button
              onClick={() => setAvatarUrl(null)}
              className="ml-2 text-[13px] font-medium text-faint hover:text-rose-500"
            >
              Kaldır
            </button>
          )}
        </div>
      </div>

      <Input
        label="Görünen ad"
        value={displayName}
        maxLength={50}
        onChange={(e) => setDisplayName(e.target.value)}
      />

      <Input label="Kullanıcı adı" value={`@${user.username}`} disabled hint="Kullanıcı adı değiştirilemez" />

      <Textarea
        label="Hakkında"
        rows={3}
        maxLength={280}
        placeholder="Kendinden kısaca bahset..."
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        hint={`${bio.length}/280`}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Bölüm" value={department} onChange={(e) => setDepartment(e.target.value)}>
          <option value="">Seçilmedi</option>
          {groups.map((g) => (
            <optgroup key={g.faculty} label={g.faculty}>
              {g.departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>

        <Select label="Sınıf" value={classYear} onChange={(e) => setClassYear(Number(e.target.value))}>
          {CLASS_YEAR_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      {user.university && (
        <div className="flex items-center gap-3 rounded-xl surface-subtle p-3.5">
          <ShieldCheckIcon width={20} height={20} className="shrink-0 brand-text" />
          <div className="min-w-0 text-[13.5px]">
            <span className="block font-semibold">{user.university.name}</span>
            <span className="block text-muted">
              Üniversite bilgin e-posta adresinden doğrulandı, değiştirilemez.
            </span>
          </div>
        </div>
      )}

      <EducationSettings user={user} onSaved={onSaved} groups={groups} />

      <Button loading={busy} onClick={save}>
        Değişiklikleri kaydet
      </Button>
    </div>
  );
}

function EducationSettings({
  user,
  onSaved,
  groups,
}: {
  user: User;
  onSaved: (user: User) => void;
  groups: DepartmentGroup[];
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [department, setDepartment] = useState("");
  const [classYear, setClassYear] = useState(1);
  const [needsUniversity, setNeedsUniversity] = useState(false);
  const [universityId, setUniversityId] = useState("");
  const [universities, setUniversities] = useState<University[]>([]);
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      const result = await api.post<{ needsUniversitySelection: boolean }>("/auth/education/start", { email });
      setNeedsUniversity(result.needsUniversitySelection);
      if (result.needsUniversitySelection && universities.length === 0) {
        const data = await api.get<{ items: University[] }>("/meta/universities");
        setUniversities(data.items);
      }
      setCodeSent(true);
      toast.show("Doğrulama kodu gönderildi", "success");
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Kod gönderilemedi", "error");
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    setBusy(true);
    try {
      await api.post("/auth/education/complete", { email, code, department, classYear, universityId: universityId || undefined });
      const fresh = await api.get<{ user: User }>("/auth/me");
      onSaved(fresh.user);
      setOpen(false);
      setCodeSent(false);
      setEmail(""); setCode(""); setDepartment(""); setUniversityId("");
      toast.show("Eğitim bilgisi doğrulandı ve eklendi", "success");
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Eğitim bilgisi eklenemedi", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl surface-subtle p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-bold">Diğer eğitimlerin</h2>
          <p className="mt-1 text-[12.5px] text-muted">Her okul e-posta adresinle ayrı ayrı doğrulanır.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setOpen((value) => !value)}>
          {open ? "Vazgeç" : "Eğitim ekle"}
        </Button>
      </div>

      {user.educations && user.educations.length > 0 && (
        <div className="mt-3 space-y-2">
          {user.educations.map((education) => (
            <div key={education.id} className="flex items-center gap-2 text-[13px] text-muted">
              <ShieldCheckIcon width={16} height={16} className="shrink-0 brand-text" />
              <span>{education.university.name} · {education.department} · {CLASS_YEAR_OPTIONS.find((item) => item.value === education.classYear)?.label}</span>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="mt-4 grid gap-3 border-t pt-4">
          <Input label="Diğer üniversite e-postan" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ogrenci@universite.edu.tr" />
          {!codeSent ? (
            <Button loading={busy} onClick={start}>Doğrulama kodu gönder</Button>
          ) : (
            <>
              <Input label="E-postadaki 6 haneli kod" inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} />
              {needsUniversity && (
                <Select label="Üniversite" value={universityId} onChange={(event) => setUniversityId(event.target.value)}>
                  <option value="">Üniversite seç</option>
                  {universities.map((university) => <option key={university.id} value={university.id}>{university.name}</option>)}
                </Select>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <Select label="Bölüm" value={department} onChange={(event) => setDepartment(event.target.value)}>
                  <option value="">Bölüm seç</option>
                  {groups.map((group) => <optgroup key={group.faculty} label={group.faculty}>{group.departments.map((item) => <option key={item} value={item}>{item}</option>)}</optgroup>)}
                </Select>
                <Select label="Sınıf" value={classYear} onChange={(event) => setClassYear(Number(event.target.value))}>
                  {CLASS_YEAR_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </Select>
              </div>
              <Button loading={busy} onClick={complete}>Doğrula ve ekle</Button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function PrivacySettings({ user, onSaved }: { user: User; onSaved: (u: User) => void }) {
  const toast = useToast();
  const [isPrivate, setIsPrivate] = useState(user.isPrivate);
  const [showDepartment, setShowDepartment] = useState(user.showDepartment);
  const [blocked, setBlocked] = useState<MiniUser[]>([]);

  useEffect(() => {
    api
      .get<{ items: MiniUser[] }>("/users/me/blocked")
      .then((d) => setBlocked(d.items))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setIsPrivate(user.isPrivate);
    setShowDepartment(user.showDepartment);
  }, [user.isPrivate, user.showDepartment]);

  async function update(patch: Record<string, unknown>) {
    try {
      const result = await api.patch<{ user: User }>("/users/me", patch);
      onSaved(result.user);
      toast.show("Ayarlar güncellendi", "success");
    } catch {
      toast.show("Güncellenemedi", "error");
    }
  }

  async function unblock(username: string) {
    await api.delete(`/users/${username}/block`).catch(() => undefined);
    setBlocked((current) => current.filter((u) => u.username !== username));
  }

  return (
    <div className="space-y-3">
      <div className="surface space-y-1 rounded-[var(--radius-card)] p-2">
        <Toggle
          label="Gizli hesap"
          description="Sadece onayladığın takipçiler gönderilerini görebilir."
          checked={isPrivate}
          onChange={(v) => {
            setIsPrivate(v);
            void update({ isPrivate: v });
          }}
        />
        <Toggle
          label="Bölümümü göster"
          description="Kapatırsan bölüm ve sınıf bilgin profilinde görünmez."
          checked={showDepartment}
          onChange={(v) => {
            setShowDepartment(v);
            void update({ showDepartment: v });
          }}
        />
      </div>

      <section className="surface rounded-[var(--radius-card)] p-5">
        <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold">
          <LockIcon width={17} height={17} className="brand-text" />
          Engellenen hesaplar
        </h2>
        {blocked.length === 0 ? (
          <p className="text-[14px] text-muted">Engellediğin kimse yok.</p>
        ) : (
          <ul className="space-y-2">
            {blocked.map((u) => (
              <li key={u.id} className="flex items-center gap-3">
                <Avatar src={u.avatarUrl} name={u.displayName} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{u.displayName}</span>
                  <span className="block text-[12px] text-faint">@{u.username}</span>
                </span>
                <Button variant="secondary" size="sm" onClick={() => unblock(u.username)}>
                  Engeli kaldır
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="px-1 text-[12.5px] leading-relaxed text-faint">
        Üniversite e-posta adresin ({user.university?.name ?? "kurumun"}) yalnızca doğrulama için
        kullanılır ve hiçbir kullanıcıya gösterilmez.{" "}
        <Link href="/gizlilik" className="brand-text hover:underline">
          Gizlilik politikası
        </Link>
      </p>
    </div>
  );
}

function SecuritySettings() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/change-password", { currentPassword: current, newPassword: next });
      toast.show("Şifren değiştirildi, tekrar giriş yapman gerekecek", "success");
      setCurrent("");
      setNext("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Şifre değiştirilemedi");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <section className="surface space-y-4 rounded-[var(--radius-card)] p-5">
        <h2 className="text-[15px] font-bold">Şifre değiştir</h2>
        <Input
          type="password"
          label="Mevcut şifren"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <Input
          type="password"
          label="Yeni şifre"
          placeholder="En az 8 karakter, bir rakam"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          error={error}
        />
        <Button loading={busy} onClick={change} disabled={!current || next.length < 8}>
          Şifreyi güncelle
        </Button>
      </section>

      <section className="surface space-y-3 rounded-[var(--radius-card)] p-5">
        <h2 className="text-[15px] font-bold">Oturumlar</h2>
        <p className="text-[14px] text-muted">
          Tüm cihazlardaki oturumları kapatarak hesabını güvene alabilirsin.
        </p>
        <Button
          variant="secondary"
          onClick={async () => {
            await api.post("/auth/logout-all").catch(() => undefined);
            toast.show("Tüm oturumlar kapatıldı", "success");
          }}
        >
          Tüm cihazlardan çıkış yap
        </Button>
      </section>
    </div>
  );
}

function AccountSettings({
  email,
  onLogout,
  toast,
}: {
  email: string | null;
  onLogout: () => Promise<void>;
  toast: { show: (m: string, t?: "success" | "error" | "info") => void };
}) {
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <section className="surface space-y-3 rounded-[var(--radius-card)] p-5">
        <h2 className="text-[15px] font-bold">E-posta adresin</h2>
        <p className="rounded-xl surface-subtle px-3.5 py-2.5 font-mono text-[14px]">{email}</p>
        <p className="text-[13px] text-muted">
          Bu adres üniversite doğrulaman için kullanılıyor ve diğer kullanıcılara gösterilmiyor.
        </p>
      </section>

      <section className="surface space-y-3 rounded-[var(--radius-card)] p-5">
        <h2 className="text-[15px] font-bold text-rose-500">Hesabı kapat</h2>
        <p className="text-[14px] leading-relaxed text-muted">
          Hesabını kapattığında profilin ve gönderilerin görünmez olur. Tekrar giriş yaparsan hesabın
          yeniden açılır.
        </p>
        <Button
          variant="danger"
          onClick={async () => {
            if (!confirm("Hesabını kapatmak istediğine emin misin?")) return;
            await api.post("/users/me/deactivate").catch(() => undefined);
            toast.show("Hesabın kapatıldı", "info");
            await onLogout();
          }}
        >
          Hesabımı kapat
        </Button>
      </section>

      <section className="surface space-y-3 rounded-[var(--radius-card)] border border-rose-500/30 p-5">
        <h2 className="text-[15px] font-bold text-rose-500">Hesabı kalıcı olarak sil</h2>
        <p className="text-[14px] leading-relaxed text-muted">
          Hesabın, gönderilerin, yorumların ve mesajların kalıcı olarak silinir.{" "}
          <strong className="text-[var(--text)]">Bu işlem geri alınamaz</strong> — kapatmanın aksine
          tekrar giriş yaparak geri getiremezsin.
        </p>
        <Input
          type="password"
          label="Şifreni gir"
          value={deletePassword}
          onChange={(e) => setDeletePassword(e.target.value)}
          error={deleteError ?? undefined}
          autoComplete="current-password"
        />
        <Button
          variant="danger"
          loading={deleting}
          disabled={!deletePassword}
          onClick={async () => {
            if (!confirm("Hesabın ve tüm içeriğin kalıcı olarak silinecek. Emin misin?")) return;
            setDeleting(true);
            setDeleteError(null);
            try {
              await api.delete("/users/me", { body: { password: deletePassword } });
              toast.show("Hesabın kalıcı olarak silindi", "info");
              await onLogout();
            } catch (err) {
              setDeleteError(
                err instanceof ApiError ? err.message : "Hesap silinemedi, tekrar dene",
              );
            } finally {
              setDeleting(false);
            }
          }}
        >
          Hesabımı kalıcı olarak sil
        </Button>
      </section>

      <Button variant="secondary" fullWidth onClick={() => void onLogout()}>
        Çıkış yap
      </Button>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl p-3 transition-colors hover:bg-[var(--bg-subtle)]">
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-semibold">{label}</span>
        <span className="block text-[13px] leading-relaxed text-muted">{description}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative mt-1 h-6 w-11 shrink-0 appearance-none overflow-hidden rounded-full border-0 p-0 transition-colors",
          checked ? "bg-[var(--brand)]" : "bg-[var(--border-strong)]",
        )}
      >
        <span
          className={cx(
            "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0",
          )}
        />
      </button>
    </label>
  );
}
