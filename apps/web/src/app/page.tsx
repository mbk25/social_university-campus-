import type { Metadata } from "next";
import Link from "next/link";
import { LandingRedirect } from "@/components/LandingRedirect";
import {
  BookIcon,
  CalendarIcon,
  ChatIcon,
  GraduationIcon,
  MaskIcon,
  PollIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "Kampus — Üniversite öğrencilerinin sosyal ağı",
  description:
    "Sadece üniversite e-postasıyla girilebilen sosyal ağ. Bölümünün topluluğuna katıl, ders notu paylaş, kampüsündeki etkinlikleri kaçırma.",
  alternates: { canonical: "/" },
};

const FEATURES = [
  {
    icon: UsersIcon,
    title: "Topluluklar",
    text: "Bölümün, kulübün, yurdun… Kendi topluluğunu kur ya da var olanlara katıl.",
  },
  {
    icon: BookIcon,
    title: "Ders notları",
    text: "Vize öncesi aradığın notu bul. Paylaş, puanla, kimin işine yaradığını gör.",
  },
  {
    icon: CalendarIcon,
    title: "Etkinlikler",
    text: "Kampüsteki söyleşi, parti ve turnuvalar tek yerde. Katılacakları işaretle.",
  },
  {
    icon: ChatIcon,
    title: "Mesajlaşma",
    text: "Birebir ve grup sohbetleri. Anlık, hızlı, sadece öğrenciler arasında.",
  },
  {
    icon: MaskIcon,
    title: "İtiraflar",
    text: "Adın görünmeden paylaş. Kampüsün en çok konuşulan köşesi.",
  },
  {
    icon: PollIcon,
    title: "Anketler",
    text: "Bir soru sor, kampüs cevaplasın. Sonuçları anında gör.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Üniversite e-postanı gir",
    text: "@ogr.universite.edu.tr gibi okulunun verdiği adres. Gmail, Hotmail kabul edilmiyor.",
  },
  {
    n: "2",
    title: "Gelen kodu doğrula",
    text: "Adresine altı haneli bir kod gönderiyoruz. Girdiğin an hesabın açılıyor.",
  },
  {
    n: "3",
    title: "Kampüsüne bağlan",
    text: "Üniversiten ve bölümün otomatik tanınır, doğru akışlara ve topluluklara düşersin.",
  },
];

export default function LandingPage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      <LandingRedirect />

      {/* Arka plan ışıkları */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="aurora h-[420px] w-[420px] bg-[#7c5cff]"
          style={{ top: "-140px", left: "-100px" }}
        />
        <div
          className="aurora h-[380px] w-[380px] bg-[#14c8a8]"
          style={{ top: "10%", right: "-120px", animationDelay: "3s" }}
        />
        <div
          className="aurora h-[320px] w-[320px] bg-[#ff5cae]"
          style={{ top: "55%", left: "10%", animationDelay: "6s", opacity: 0.22 }}
        />
      </div>

      {/* ----------------------------------------------------------- başlık */}
      <header className="mx-auto flex w-full max-w-[1100px] items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#8f74ff] to-[#5836c9] text-lg font-black text-white">
            K
          </span>
          <span className="text-[19px] font-black tracking-tight">Kampus</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/giris"
            className="rounded-xl px-3.5 py-2 text-[14px] font-semibold text-muted transition-colors hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]"
          >
            Giriş yap
          </Link>
          <Link
            href="/kayit"
            className="rounded-xl bg-[var(--brand)] px-4 py-2 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            Katıl
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-5 sm:px-8">
        {/* ------------------------------------------------------------ hero */}
        <section className="py-14 text-center sm:py-20">
          <span className="inline-flex items-center gap-1.5 rounded-full brand-soft-bg px-3 py-1.5 text-[12.5px] font-semibold brand-text">
            <ShieldCheckIcon width={14} height={14} />
            Sadece doğrulanmış öğrenciler
          </span>

          <h1 className="mx-auto mt-5 max-w-[720px] text-[34px] font-black leading-[1.1] tracking-tight sm:text-[52px]">
            Kampüsün kendi
            <br className="hidden sm:block" />{" "}
            <span className="brand-text">sosyal ağı</span>
          </h1>

          <p className="mx-auto mt-5 max-w-[540px] text-[16px] leading-relaxed text-muted sm:text-[18px]">
            Bot yok, reklam hesabı yok, tanımadığın kimse yok. Kapıda tek bir şart var:
            üniversitenin sana verdiği e-posta adresi.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/kayit"
              className="w-full rounded-xl bg-[var(--brand)] px-6 py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 sm:w-auto"
            >
              Üniversite e-postanla katıl
            </Link>
            <Link
              href="/giris"
              className="w-full rounded-xl surface px-6 py-3.5 text-[15px] font-semibold transition-colors hover:bg-[var(--bg-subtle)] sm:w-auto"
            >
              Zaten hesabım var
            </Link>
          </div>

          <p className="mt-4 text-[13px] text-faint">Ücretsiz · 30 saniyede kayıt</p>
        </section>

        {/* -------------------------------------------------- neden e-posta */}
        <section className="surface rounded-[var(--radius-card)] p-6 sm:p-9">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-10">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl brand-soft-bg brand-text">
              <GraduationIcon width={28} height={28} />
            </div>
            <div>
              <h2 className="text-[20px] font-bold tracking-tight sm:text-[24px]">
                Neden üniversite e-postası?
              </h2>
              <p className="mt-2.5 text-[15px] leading-relaxed text-muted">
                Çünkü karşındakinin gerçekten öğrenci olduğunu bilmek her şeyi değiştirir.
                Sahte hesap açmak, bot sürmek, reklam yağdırmak mümkün değil — kayıt olmak
                için bir üniversitenin sana o adresi vermiş olması gerekiyor. Kampus küçük
                ve gerçek bir yer; büyük sosyal medyanın gürültüsü burada yok.
              </p>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------- nasıl çalışır */}
        <section className="py-14 sm:py-20">
          <h2 className="text-center text-[24px] font-bold tracking-tight sm:text-[30px]">
            Nasıl katılırsın
          </h2>
          <div className="mt-9 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="surface rounded-[var(--radius-card)] p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg brand-soft-bg text-[15px] font-black brand-text">
                  {s.n}
                </span>
                <h3 className="mt-3.5 text-[16px] font-bold tracking-tight">{s.title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------- özellikler */}
        <section className="pb-14 sm:pb-20">
          <h2 className="text-center text-[24px] font-bold tracking-tight sm:text-[30px]">
            Kampus&apos;te neler var
          </h2>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="surface rounded-[var(--radius-card)] p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl brand-soft-bg brand-text">
                  <f.icon width={20} height={20} />
                </span>
                <h3 className="mt-3.5 text-[16px] font-bold tracking-tight">{f.title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------------- son çağrı */}
        <section className="surface relative overflow-hidden rounded-[var(--radius-card)] p-8 text-center sm:p-14">
          <h2 className="text-[24px] font-black tracking-tight sm:text-[34px]">
            Kampüsünde ilk sen ol
          </h2>
          <p className="mx-auto mt-3 max-w-[440px] text-[15px] leading-relaxed text-muted">
            Üniversiten Kampus&apos;te yeniyse başlatan kişi sen olursun. Topluluğunu kur,
            arkadaşlarını çağır.
          </p>
          <Link
            href="/kayit"
            className="mt-7 inline-block rounded-xl bg-[var(--brand)] px-7 py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            Hesabını oluştur
          </Link>
        </section>
      </main>

      {/* ------------------------------------------------------------- altlık */}
      <footer className="mx-auto mt-14 w-full max-w-[1100px] border-t border-[var(--border)] px-5 py-8 sm:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="text-[13px] text-faint">
            Kampus · Sadece doğrulanmış üniversite öğrencilerine açıktır
          </span>
          <div className="flex items-center gap-5">
            <Link
              href="/kurallar"
              className="text-[13px] text-muted transition-colors hover:text-[var(--text)]"
            >
              Topluluk kuralları
            </Link>
            <Link
              href="/gizlilik"
              className="text-[13px] text-muted transition-colors hover:text-[var(--text)]"
            >
              Gizlilik
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
