"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CLASS_YEAR_OPTIONS } from "@kampus/shared";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { User } from "@/lib/types";
import { Button, Input, Select, cx, useToast } from "@/components/ui";
import { CheckIcon, GraduationIcon, ShieldCheckIcon } from "@/components/icons";

interface DepartmentGroup {
  faculty: string;
  departments: string[];
}

type Step = "EMAIL" | "CODE" | "PROFILE";

interface DetectedUniversity {
  id: string;
  name: string;
  shortName: string;
  city: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const toast = useToast();
  const { applyAuthResponse, refreshUser } = useAuth();

  const [step, setStep] = useState<Step>("EMAIL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // adım 1
  const [email, setEmail] = useState("");
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<{
    allowed: boolean;
    university?: DetectedUniversity | null;
    message?: string;
    taken?: boolean;
    isStudentAddress?: boolean;
    /** Alan adı listede yok; kullanıcı üniversitesini kendisi seçecek. */
    needsUniversitySelection?: boolean;
  } | null>(null);

  // adım 2
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [codeExpiresIn, setCodeExpiresIn] = useState(0);
  const [verifying, setVerifying] = useState(false);

  // adım 3
  const [username, setUsername] = useState("");
  const [usernameState, setUsernameState] = useState<{ available: boolean; reason: string | null } | null>(
    null,
  );
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState("");
  const [classYear, setClassYear] = useState(1);
  const [accepted, setAccepted] = useState(false);
  const [groups, setGroups] = useState<DepartmentGroup[]>([]);
  const [universityId, setUniversityId] = useState("");
  const [universities, setUniversities] = useState<{ id: string; name: string; city: string }[]>([]);

  const emailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usernameTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Bölüm listesi
  useEffect(() => {
    api
      .get<{ groups: DepartmentGroup[] }>("/meta/departments", { auth: false })
      .then((d) => setGroups(d.groups))
      .catch(() => undefined);
  }, []);

  // Üniversite listesi — yalnızca alan adı tanınmadığında seçtireceğiz.
  useEffect(() => {
    if (!check?.needsUniversitySelection || universities.length > 0) return;
    api
      .get<{ items: { id: string; name: string; city: string }[] }>("/meta/universities", {
        auth: false,
      })
      .then((d) => setUniversities(d.items))
      .catch(() => undefined);
  }, [check?.needsUniversitySelection, universities.length]);

  // Yeniden gönderme sayacı
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Kodun geçerlilik süresi
  useEffect(() => {
    if (codeExpiresIn <= 0) return;
    const t = setTimeout(() => setCodeExpiresIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [codeExpiresIn]);

  // E-posta alan adı kontrolü (yazarken)
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
        .post<typeof check>("/auth/check-email", { email: value }, { auth: false })
        .then((data) => setCheck(data))
        .catch(() => setCheck(null))
        .finally(() => setChecking(false));
    }, 450);
    return () => {
      if (emailTimer.current) clearTimeout(emailTimer.current);
    };
  }, [email]);

  // Kullanıcı adı müsaitlik kontrolü
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
    }, 350);
  }, [username]);

  const allDepartments = useMemo(() => groups, [groups]);

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
      toast.show("Doğrulama kodu gönderildi 📧", "success");
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
      // Eski kod artık geçersiz — ekranda kalıp yanlışlıkla gönderilmesin.
      setCode("");
      setError(null);
      setFieldErrors({});
      toast.show("Yeni kod gönderildi. Önceki kod geçersiz oldu.", "success");
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Kod gönderilemedi", "error");
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
      const result = await api.post<{
        accessToken: string;
        refreshToken: string;
        user: User;
      }>(
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
          ...(check?.needsUniversitySelection ? { universityId } : {}),
        },
        { auth: false },
      );
      applyAuthResponse(result);
      await refreshUser();
      toast.show("Hesabın hazır! Kampüse hoş geldin 🎓", "success");
      // Yeni kullanıcı boş akışa düşmesin — önce takip/topluluk önerileri.
      router.replace("/hosgeldin");
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
    !!department &&
    (!check?.needsUniversitySelection || !!universityId) &&
    accepted;

  return (
    <div className="w-full max-w-[480px]">
      <StepIndicator step={step} />

      <div className="surface mt-5 rounded-3xl p-6 sm:p-8">
        {/* ---------------------------------------------------- Adım 1 */}
        {step === "EMAIL" && (
          <>
            <h1 className="text-[24px] font-black tracking-tight">Üniversite mailinle başla</h1>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
              Kampus&apos;e yalnızca üniversitenin verdiği adresle kayıt olunur. Gmail, Hotmail gibi
              kişisel adresler kabul edilmez.
            </p>

            <div className="mt-6 space-y-4">
              <Input
                type="email"
                label="Üniversite e-posta adresin"
                placeholder="ad.soyad@ogr.universite.edu.tr"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canSendCode && sendCode()}
                error={error}
              />

              {checking && <p className="text-[13px] text-faint">Adres kontrol ediliyor…</p>}

              {check && !checking && (
                <div
                  className={cx(
                    "flex items-start gap-3 rounded-xl border p-3.5",
                    check.allowed && !check.taken
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : "border-rose-500/40 bg-rose-500/10",
                  )}
                >
                  <span
                    className={cx(
                      "mt-0.5 shrink-0",
                      check.allowed && !check.taken ? "text-emerald-500" : "text-rose-500",
                    )}
                  >
                    {check.allowed && !check.taken ? (
                      <ShieldCheckIcon width={19} height={19} />
                    ) : (
                      <span className="block text-lg leading-none">!</span>
                    )}
                  </span>
                  <div className="min-w-0 text-[13.5px] leading-relaxed">
                    {check.taken ? (
                      <>
                        Bu adresle zaten bir hesap var.{" "}
                        <Link href="/giris" className="font-semibold underline">
                          Giriş yap
                        </Link>
                      </>
                    ) : check.allowed ? (
                      <>
                        <span className="font-semibold">
                          {check.university?.name ?? "Akademik adres doğrulandı"}
                          {check.university ? " doğrulandı" : ""}
                        </span>
                        {check.university ? (
                          <span className="block text-muted">
                            {check.university.city}
                            {check.isStudentAddress ? " · öğrenci adresi" : ""}
                          </span>
                        ) : (
                          <span className="block text-muted">
                            Üniversiteni tanıyamadık — birazdan listeden kendin seçeceksin.
                          </span>
                        )}
                      </>
                    ) : (
                      check.message
                    )}
                  </div>
                </div>
              )}

              <Button
                size="lg"
                fullWidth
                loading={busy}
                disabled={!canSendCode}
                onClick={sendCode}
              >
                Doğrulama kodu gönder
              </Button>
            </div>

            <p className="mt-6 text-center text-[14px] text-muted">
              Zaten hesabın var mı?{" "}
              <Link href="/giris" className="font-semibold brand-text hover:underline">
                Giriş yap
              </Link>
            </p>
          </>
        )}

        {/* ---------------------------------------------------- Adım 2 */}
        {step === "CODE" && (
          <>
            <h1 className="text-[24px] font-black tracking-tight">E-postanı doğrula</h1>
            <p className="mt-1.5 text-[14px] leading-relaxed text-muted">
              <span className="font-semibold text-[var(--text)]">{email}</span> adresine 6 haneli bir
              kod gönderdik. Kod 10 dakika geçerli.
            </p>

            <div className="mt-6 space-y-4">
              <Input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && code.length === 6 && verifyCode()}
                error={error ?? fieldErrors.code}
                className="text-center text-[30px] font-black tracking-[0.35em]"
                autoFocus
              />

              {codeExpiresIn > 0 ? (
                <p className="text-center text-[13px] text-muted">
                  Kodun geçerlilik süresi:{" "}
                  <strong className={codeExpiresIn < 120 ? "text-amber-500" : "text-[var(--text)]"}>
                    {Math.floor(codeExpiresIn / 60)}:
                    {String(codeExpiresIn % 60).padStart(2, "0")}
                  </strong>
                </p>
              ) : (
                <p className="text-center text-[13px] text-rose-500">
                  Kodun süresi doldu — aşağıdan yeni kod iste.
                </p>
              )}

              <Button
                size="lg"
                fullWidth
                loading={verifying}
                disabled={code.length !== 6}
                onClick={verifyCode}
              >
                Kodu doğrula ve devam et
              </Button>

              <div className="flex items-center justify-between text-[13px]">
                <button
                  onClick={() => {
                    setStep("EMAIL");
                    setError(null);
                  }}
                  className="font-medium text-muted hover:text-[var(--text)]"
                >
                  ← E-postayı değiştir
                </button>
                <button
                  onClick={resend}
                  disabled={resendIn > 0}
                  className="font-medium brand-text disabled:text-faint"
                >
                  {resendIn > 0 ? `Yeniden gönder (${resendIn})` : "Kodu yeniden gönder"}
                </button>
              </div>

              <p className="rounded-xl bg-[var(--bg-subtle)] p-3 text-[12.5px] leading-relaxed text-muted">
                Kod gelmediyse spam/gereksiz klasörünü kontrol et. Bazı üniversitelerde dış
                e-postalar birkaç dakika gecikebiliyor.
              </p>
            </div>
          </>
        )}

        {/* ---------------------------------------------------- Adım 3 */}
        {step === "PROFILE" && (
          <>
            <h1 className="text-[24px] font-black tracking-tight">Profilini oluştur</h1>
            <p className="mt-1.5 text-[14px] text-muted">
              Bölümünü seçince ilgili topluluklara otomatik katılacaksın.
            </p>

            <div className="mt-6 space-y-4">
              <Input
                label="Kullanıcı adı"
                placeholder="ornekkullanici"
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24))
                }
                error={
                  usernameState && !usernameState.available ? usernameState.reason : fieldErrors.username
                }
                success={usernameState?.available ? "Bu kullanıcı adı müsait" : null}
                hint={!usernameState ? "3-24 karakter · küçük harf, rakam, alt çizgi" : undefined}
              />

              <Input
                label="Görünen adın"
                placeholder="Ad Soyad"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                error={fieldErrors.displayName}
              />

              {check?.needsUniversitySelection && (
                <Select
                  label="Üniversiten"
                  value={universityId}
                  onChange={(e) => setUniversityId(e.target.value)}
                  error={fieldErrors.universityId}
                  hint="Adresini tanıyamadık, üniversiteni sen seç."
                >
                  <option value="">Üniversite seç…</option>
                  {universities.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.city}
                    </option>
                  ))}
                </Select>
              )}

              <Select
                label="Bölümün"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                error={fieldErrors.department}
              >
                <option value="">Bölüm seç…</option>
                {allDepartments.map((group) => (
                  <optgroup key={group.faculty} label={group.faculty}>
                    {group.departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>

              <Select
                label="Sınıfın"
                value={classYear}
                onChange={(e) => setClassYear(Number(e.target.value))}
              >
                {CLASS_YEAR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>

              <div>
                <Input
                  type="password"
                  label="Şifre"
                  placeholder="En az 8 karakter"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={fieldErrors.password}
                />
                <PasswordStrength password={password} />
              </div>

              <label className="flex cursor-pointer items-start gap-2.5 text-[13px] leading-relaxed text-muted">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand)]"
                />
                <span>
                  <Link href="/kurallar" className="font-medium brand-text hover:underline">
                    Topluluk kurallarını
                  </Link>{" "}
                  ve{" "}
                  <Link href="/gizlilik" className="font-medium brand-text hover:underline">
                    gizlilik politikasını
                  </Link>{" "}
                  okudum, kabul ediyorum.
                </span>
              </label>

              {error && <p className="text-[13px] text-rose-500">{error}</p>}

              <Button size="lg" fullWidth loading={busy} disabled={!canComplete} onClick={complete}>
                Hesabımı oluştur
              </Button>

              <button
                onClick={() => setStep("CODE")}
                className="w-full text-center text-[13px] font-medium text-muted hover:text-[var(--text)]"
              >
                ← Geri
              </button>
            </div>
          </>
        )}
      </div>

      {step === "EMAIL" && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-subtle)] p-4 text-[13px] leading-relaxed text-muted">
          <GraduationIcon width={18} height={18} className="mt-0.5 shrink-0 brand-text" />
          <span>
            Üniversitenin verdiği adresi bilmiyor musun? Genelde öğrenci bilgi sisteminde
            (OBS/OİBS) yazar ve <code className="rounded bg-[var(--bg-elevated)] px-1 py-0.5">
              ad.soyad@ogr.…edu.tr
            </code>{" "}
            biçimindedir.
          </span>
        </div>
      )}
    </div>
  );
}

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "EMAIL", label: "E-posta" },
    { key: "CODE", label: "Doğrulama" },
    { key: "PROFILE", label: "Profil" },
  ];
  const currentIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <div key={s.key} className="flex flex-1 items-center gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <div
                className={cx(
                  "h-1 rounded-full transition-colors",
                  done || active ? "bg-[var(--brand)]" : "bg-[var(--border-strong)]",
                )}
              />
              <span
                className={cx(
                  "flex items-center gap-1 text-[12px] font-medium",
                  active ? "brand-text" : done ? "text-muted" : "text-faint",
                )}
              >
                {done && <CheckIcon width={12} height={12} />}
                {s.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const checks = [
    { ok: password.length >= 8, label: "8+ karakter" },
    { ok: /[0-9]/.test(password), label: "rakam" },
    { ok: /[a-zA-ZğüşöçıİĞÜŞÖÇ]/.test(password), label: "harf" },
    { ok: password.length >= 12 || /[^a-zA-Z0-9]/.test(password), label: "güçlü" },
  ];
  const score = checks.filter((c) => c.ok).length;

  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cx(
              "h-1 flex-1 rounded-full transition-colors",
              i < score
                ? score <= 1
                  ? "bg-rose-500"
                  : score === 2
                    ? "bg-amber-500"
                    : score === 3
                      ? "bg-lime-500"
                      : "bg-emerald-500"
                : "bg-[var(--border-strong)]",
            )}
          />
        ))}
      </div>
      <p className="mt-1.5 text-[12px] text-faint">
        {checks
          .filter((c) => !c.ok)
          .map((c) => c.label)
          .join(", ") || "Şifren güçlü görünüyor"}
        {checks.some((c) => !c.ok) && " gerekli"}
      </p>
    </div>
  );
}
