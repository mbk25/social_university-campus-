"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Button, Input, Modal, useToast } from "@/components/ui";
import { GraduationIcon, ShieldCheckIcon, UsersIcon } from "@/components/icons";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { login, user, loading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);

  const next = params.get("next") ?? "/";

  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, router, next]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim().toLowerCase(), password);
      toast.show("Hoş geldin! 🎓", "success");
      router.replace(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Giriş yapılamadı");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1.05fr_minmax(360px,420px)]">
      {/* -------------------------------------------------------- Tanıtım */}
      <section className="hidden lg:block">
        <h1 className="text-[42px] font-black leading-[1.08] tracking-tight">
          Kampüsün,
          <br />
          <span className="bg-gradient-to-r from-[#8f74ff] via-[#a78bfa] to-[#38e0c4] bg-clip-text text-transparent">
            senin sosyal ağın.
          </span>
        </h1>
        <p className="mt-4 max-w-md text-[16px] leading-relaxed text-muted">
          Kampus&apos;e yalnızca üniversitenin sana verdiği e-posta adresiyle girilir. Reklam
          hesabı yok, bot yok, tanımadığın kalabalık yok — sadece öğrenciler.
        </p>

        <ul className="mt-8 space-y-4">
          <Feature
            icon={<ShieldCheckIcon width={20} height={20} />}
            title="Doğrulanmış öğrenci topluluğu"
            description="@ogr.universite.edu.tr adresine gönderilen kodla doğrulanır. Gmail ile giriş yok."
          />
          <Feature
            icon={<UsersIcon width={20} height={20} />}
            title="Bölümüne özel topluluklar"
            description="Kayıt olur olmaz üniversitenin ve bölümünün topluluğuna otomatik katılırsın."
          />
          <Feature
            icon={<GraduationIcon width={20} height={20} />}
            title="Ders notu, etkinlik, anonim itiraf"
            description="Not paylaş, kampüs etkinliklerine katıl, anonim olarak içini dök."
          />
        </ul>
      </section>

      {/* ---------------------------------------------------------- Form */}
      <section className="surface w-full rounded-3xl p-6 sm:p-8">
        <h2 className="text-[24px] font-black tracking-tight">Giriş yap</h2>
        <p className="mt-1.5 text-[14px] text-muted">Üniversite e-postan ve şifrenle devam et.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <Input
            name="email"
            type="email"
            label="Üniversite e-postan"
            placeholder="ad.soyad@ogr.universite.edu.tr"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div>
            <Input
              name="password"
              type="password"
              label="Şifre"
              placeholder="••••••••"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={error}
            />
            <button
              type="button"
              onClick={() => setForgotOpen(true)}
              className="mt-2 text-[13px] font-medium brand-text hover:underline"
            >
              Şifremi unuttum
            </button>
          </div>

          <Button type="submit" size="lg" fullWidth loading={busy}>
            Giriş yap
          </Button>
        </form>

        <p className="mt-6 text-center text-[14px] text-muted">
          Hesabın yok mu?{" "}
          <Link href="/kayit" className="font-semibold brand-text hover:underline">
            Üniversite mailinle kayıt ol
          </Link>
        </p>
      </section>

      <ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} />
    </div>
  );
}

function Feature({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <li className="flex gap-3.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl brand-soft-bg brand-text">
        {icon}
      </span>
      <span>
        <span className="block text-[15px] font-bold">{title}</span>
        <span className="mt-0.5 block text-[14px] leading-relaxed text-muted">{description}</span>
      </span>
    </li>
  );
}

function ForgotPasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [step, setStep] = useState<"EMAIL" | "RESET">("EMAIL");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestCode() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/forgot-password", { email: email.trim().toLowerCase() }, { auth: false });
      toast.show("Adres kayıtlıysa kod gönderildi", "success");
      setStep("RESET");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "İstek gönderilemedi");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setError(null);
    try {
      await api.post(
        "/auth/reset-password",
        { email: email.trim().toLowerCase(), code, password },
        { auth: false },
      );
      toast.show("Şifren güncellendi, giriş yapabilirsin", "success");
      onClose();
      setStep("EMAIL");
      setCode("");
      setPassword("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Şifre sıfırlanamadı");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Şifreni sıfırla" size="sm">
      {step === "EMAIL" ? (
        <div className="space-y-4">
          <Input
            type="email"
            label="Üniversite e-postan"
            placeholder="ad.soyad@ogr.universite.edu.tr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error}
          />
          <Button fullWidth loading={busy} onClick={requestCode} disabled={!email.includes("@")}>
            Sıfırlama kodu gönder
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Input
            label="E-postana gelen 6 haneli kod"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="text-center text-2xl font-bold tracking-[0.4em]"
          />
          <Input
            type="password"
            label="Yeni şifren"
            placeholder="En az 8 karakter, bir rakam"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={error}
          />
          <Button fullWidth loading={busy} onClick={reset} disabled={code.length !== 6}>
            Şifreyi güncelle
          </Button>
        </div>
      )}
    </Modal>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
