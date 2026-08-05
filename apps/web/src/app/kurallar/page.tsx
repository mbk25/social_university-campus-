import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Topluluk Kuralları" };

const RULES = [
  {
    title: "Burası sadece öğrencilerin",
    body: "Kampus'e yalnızca üniversitenin verdiği e-posta adresiyle girilir. Hesabını başkasına devretmek, satmak veya başka birinin adresiyle kayıt olmak yasaktır ve hesabın kalıcı olarak kapatılır.",
  },
  {
    title: "Kişiye saldırma, fikre saldır",
    body: "Tartışabilirsin, katılmayabilirsin. Ama hakaret, aşağılama, alay ve hedef gösterme yok. Bir kişiyi ismiyle/fotoğrafıyla teşhir eden içerikler kaldırılır.",
  },
  {
    title: "Nefret söylemi yok",
    body: "Irk, etnik köken, din, mezhep, cinsiyet, cinsel yönelim, engellilik veya memleket üzerinden aşağılayıcı içerik paylaşılamaz. Bu kural istisnasızdır.",
  },
  {
    title: "Kimsenin özel bilgisini paylaşma",
    body: "Telefon numarası, adres, TC kimlik no, sınav sonucu, özel mesaj ekran görüntüsü — sana ait olmayan hiçbir kişisel bilgiyi paylaşma. Anonim itiraflarda da bu geçerlidir.",
  },
  {
    title: "Taciz ve ısrar yok",
    body: "İstenmeyen mesajlaşma, ısrarlı takip, cinsel içerikli mesaj göndermek yasaktır. Rahatsız edildiğini düşünüyorsan engelle ve şikayet et — bildirimler ciddiye alınır.",
  },
  {
    title: "Akademik dürüstlük",
    body: "Ders notu paylaşımı serbesttir; sınav sırasında cevap paylaşmak, ödev/tez satmak, kopya organize etmek değildir. Telif hakkı olan kitap ve slayt taramaları kaldırılır.",
  },
  {
    title: "Spam ve reklam yok",
    body: "Ticari reklam, referans linki, çoklu hesap, otomatik gönderi, aynı içeriği birden fazla toplulukta tekrarlamak yasaktır.",
  },
  {
    title: "Anonimlik kalkan değildir",
    body: "İtiraflarda ve anonim gönderilerde kimliğin diğer kullanıcılara gösterilmez. Ancak tehdit, taciz ve suç içeren paylaşımlarda moderasyon ekibi kaydı inceler; gerektiğinde yetkili makamlarla paylaşır.",
  },
  {
    title: "Kriz anında",
    body: "Kendine veya bir başkasına zarar verme düşüncesi içeren paylaşımlar görürsen şikayet et. Acil durumlarda 112'yi ara. Kampus bir destek hattı değildir.",
  },
];

export default function RulesPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <Link href="/" className="text-[14px] font-medium brand-text hover:underline">
        ← Kampus
      </Link>

      <h1 className="mt-5 text-[32px] font-black tracking-tight">Topluluk Kuralları</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Kampus, üniversite öğrencilerinin kendini güvende hissettiği bir alan olsun diye kuruldu.
        Aşağıdaki kurallar tüm topluluklarda geçerlidir; toplulukların kendi ek kuralları olabilir.
      </p>

      <ol className="mt-8 space-y-6">
        {RULES.map((rule, i) => (
          <li key={rule.title} className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg brand-soft-bg text-[14px] font-black brand-text">
              {i + 1}
            </span>
            <div>
              <h2 className="text-[16.5px] font-bold">{rule.title}</h2>
              <p className="mt-1 text-[14.5px] leading-relaxed text-muted">{rule.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="surface mt-10 rounded-2xl p-5">
        <h2 className="text-[16px] font-bold">Kural ihlalinde ne olur?</h2>
        <p className="mt-2 text-[14.5px] leading-relaxed text-muted">
          İhlalin ağırlığına göre: içerik kaldırma → uyarı → geçici askıya alma (1–30 gün) → kalıcı
          kapatma. Ağır ihlallerde (tehdit, cinsel içerik, nefret söylemi) doğrudan kalıcı kapatma
          uygulanır. Kararlara itiraz için destek adresinden yazabilirsin.
        </p>
      </section>

      <p className="mt-8 text-[13px] text-faint">
        Son güncelleme: {new Date().toLocaleDateString("tr-TR", { dateStyle: "long" })} ·{" "}
        <Link href="/gizlilik" className="hover:underline">
          Gizlilik politikası
        </Link>
      </p>
    </div>
  );
}
