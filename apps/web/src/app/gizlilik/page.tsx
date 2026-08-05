import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Gizlilik Politikası" };

const SECTIONS = [
  {
    title: "Hangi verileri topluyoruz?",
    items: [
      "Üniversite e-posta adresin (doğrulama ve giriş için)",
      "Kullanıcı adın, görünen adın, biyografin, profil ve kapak görselin",
      "Üniversite, bölüm ve sınıf bilgin",
      "Paylaştığın gönderiler, yorumlar, mesajlar, notlar ve etkinlikler",
      "Oturum bilgisi (cihaz/tarayıcı türü, IP adresi) — güvenlik amacıyla",
    ],
  },
  {
    title: "E-posta adresin kimseye gösterilmez",
    items: [
      "E-posta adresin yalnızca üniversite doğrulaman ve giriş için kullanılır.",
      "Hiçbir kullanıcı, hiçbir ekranda e-posta adresini göremez.",
      "Üçüncü taraflara satılmaz, reklam amacıyla kullanılmaz.",
    ],
  },
  {
    title: "Anonim paylaşımlar",
    items: [
      "Anonim gönderi ve itiraflarda adın, kullanıcı adın ve profilin API yanıtlarında dahi yer almaz.",
      "Kayıt, yalnızca moderasyon amacıyla veritabanında yazarla ilişkilendirilir.",
      "Bu ilişki yalnızca tehdit, taciz ve suç içeren bildirimler incelenirken kullanılır.",
    ],
  },
  {
    title: "Şifreler ve güvenlik",
    items: [
      "Şifreler Argon2id ile karma hâlinde saklanır; düz metin şifre hiçbir yerde tutulmaz.",
      "Oturum jetonları belirli aralıklarla yenilenir; çalınma şüphesinde tüm oturumlar kapatılır.",
      "Doğrulama kodları karma hâlinde saklanır ve 10 dakika sonra geçersiz olur.",
    ],
  },
  {
    title: "Haklarını nasıl kullanırsın?",
    items: [
      "Profil bilgilerini Ayarlar sayfasından dilediğin zaman güncelleyebilirsin.",
      "Hesabını kapatabilirsin; kapatılan hesabın profili ve gönderileri görünmez olur.",
      "Verilerinin tamamen silinmesini istersen destek adresine yazman yeterlidir.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <Link href="/" className="text-[14px] font-medium brand-text hover:underline">
        ← Kampus
      </Link>

      <h1 className="mt-5 text-[32px] font-black tracking-tight">Gizlilik Politikası</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Kampus, çalışabilmesi için gereken en az veriyi toplar. Bu sayfa hangi verinin neden
        tutulduğunu sade bir dille anlatır.
      </p>

      <div className="mt-8 space-y-8">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="text-[17px] font-bold">{section.title}</h2>
            <ul className="mt-2.5 space-y-2">
              {section.items.map((item) => (
                <li key={item} className="flex gap-2.5 text-[14.5px] leading-relaxed text-muted">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-10 text-[13px] text-faint">
        Son güncelleme: {new Date().toLocaleDateString("tr-TR", { dateStyle: "long" })} ·{" "}
        <Link href="/kurallar" className="hover:underline">
          Topluluk kuralları
        </Link>
      </p>
    </div>
  );
}
