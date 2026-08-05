# Kampus 🎓

Sadece **üniversite öğrencilerinin** girebildiği sosyal medya platformu. Kayıt olmanın tek yolu
üniversitenin verdiği e-posta adresi (`@ogr.universite.edu.tr` gibi) — Gmail/Hotmail ile hesap
açılamaz.

```
social_university/
├── apps/api        Fastify 5 + Prisma + PostgreSQL + Socket.IO   (:4000)
├── apps/web        Next.js 15 + Tailwind 4 (PWA)                 (:3000)
├── apps/mobile     Expo SDK 53 (React Native) — iOS/Android
└── packages/shared Ortak tipler, zod şemaları, üniversite listesi
```

---

## Kurulum

### 1. Gereksinimler

| Araç | Sürüm | Not |
|---|---|---|
| Node.js | ≥ 20 (24 önerilir) | ✅ kurulu |
| PostgreSQL | ≥ 14 | ⚠️ **kurulması gerekiyor** |

> **Bu makinede kurulum tamamlandı.** PostgreSQL 17 kurulu, veri dizini
> `C:\Users\Bilal\kampus-pgdata`, veritabanı `kampus` oluşturuldu ve tohumlandı.
> Veritabanı Windows **servisi olarak kayıtlı değil**, yani bilgisayarı yeniden
> başlattığında kendiliğinden açılmaz:
>
> ```bash
> npm run pg:start
> ```
>
> Durdurmak için `npm run pg:stop`. Aşağıdaki seçenekler sıfırdan kurulum içindir.

**PostgreSQL için seçenekler** (birini seç):

<details>
<summary><b>0) winget ile Windows'a kurmak</b> — bu projede kullanılan yol</summary>

```bash
winget install PostgreSQL.PostgreSQL.17 --silent --accept-package-agreements --accept-source-agreements
```

Kurulumun veri dizinini oluşturmadığını görürsen (Windows'ta sık karşılaşılır), kümeyi
kendi kullanıcı klasöründe başlat — bu yol yönetici izni gerektirmez:

```powershell
$pg = "C:\Program Files\PostgreSQL\17\bin"
$data = "$HOME\kampus-pgdata"
"kampus" | Set-Content "$env:TEMP\pgpw.txt" -NoNewline
& "$pg\initdb.exe" -D $data -U postgres --pwfile="$env:TEMP\pgpw.txt" --encoding=UTF8 --locale=C
Remove-Item "$env:TEMP\pgpw.txt"
```

Sonra sunucuyu başlat ve veritabanını oluştur:

```powershell
npm run pg:start
$env:PGPASSWORD = "kampus"
& "$pg\psql.exe" -U postgres -h 127.0.0.1 -c "CREATE USER kampus WITH PASSWORD 'kampus' CREATEDB;"
& "$pg\psql.exe" -U postgres -h 127.0.0.1 -c "CREATE DATABASE kampus OWNER kampus ENCODING 'UTF8';"
```
</details>

<details>
<summary><b>a) Docker Desktop</b> — en kolay, önerilen</summary>

[Docker Desktop](https://www.docker.com/products/docker-desktop/) kur, sonra:

```bash
npm run db:up
```

Bu komut PostgreSQL'i **ve** geliştirme maillerini tarayıcıdan okuyabilmen için
Mailpit'i başlatır (http://localhost:8025).
</details>

<details>
<summary><b>b) Windows'a doğrudan PostgreSQL kurmak</b></summary>

[postgresql.org/download/windows](https://www.postgresql.org/download/windows/) üzerinden kur,
sonra `psql` ile:

```sql
CREATE USER kampus WITH PASSWORD 'kampus';
CREATE DATABASE kampus OWNER kampus;
```
</details>

<details>
<summary><b>c) Ücretsiz bulut Postgres</b> — kurulum istemiyorsan</summary>

[neon.tech](https://neon.tech) veya [supabase.com](https://supabase.com) üzerinden ücretsiz bir
PostgreSQL oluştur, verdiği bağlantı adresini `.env` içindeki `DATABASE_URL` alanına yapıştır.
</details>

### 2. Ortam değişkenleri

```bash
cp .env.example .env
```

Geliştirmede varsayılanlar çalışır. **Production'a çıkarken** `JWT_ACCESS_SECRET` ve
`JWT_REFRESH_SECRET` değerlerini mutlaka değiştir:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

### 3. Bağımlılıklar ve veritabanı

```bash
npm install
npm run build -w @kampus/shared
npm run prisma:generate -w @kampus/api
npm run migrate          # tabloları oluşturur
npm run seed             # ~190 üniversiteyi yükler
```

Örnek kullanıcı/topluluk/gönderi ile dolu bir ortam istersen:

```bash
npm run seed:demo
```

Demo giriş bilgileri (şifre hepsinde `Kampus2025`):

| E-posta | Kim |
|---|---|
| `elif.yilmaz@ogr.boun.edu.tr` | Boğaziçi · Bilgisayar Müh. |
| `mert.kaya@ogr.itu.edu.tr` | İTÜ · Elektrik-Elektronik |
| `zeynep.demir@ogr.hacettepe.edu.tr` | Hacettepe · Tıp |

### 4. Çalıştır

```bash
npm run dev
```

| Servis | Adres |
|---|---|
| Web | http://localhost:3100 |
| API | http://localhost:4100/api/v1 |
| Realtime | ws://localhost:4100/socket.io |
| Mailpit (doğrulama kodları) | http://localhost:8025 |

> Portlar **3100 / 4100** olarak seçildi; 3000 ve 4000 çoğu makinede başka projelerce kullanılıyor.
> Değiştirmek istersen üç yeri birden güncelle: `.env` (`PORT`, `API_PUBLIC_URL`, `WEB_PUBLIC_URL`,
> `NEXT_PUBLIC_API_URL`), `apps/web/package.json` (`-p` bayrağı) ve `apps/mobile/src/lib/api.ts`
> (`API_PORT`). `WEB_PUBLIC_URL` yanlışsa API, CORS nedeniyle web'in isteklerini reddeder.

Mobil uygulama için ayrı bir terminalde:

```bash
npm run dev:mobile
```

Çıkan QR kodu telefondaki **Expo Go** uygulamasıyla okut. Telefon ve bilgisayar aynı Wi-Fi ağında
olmalı — API adresi otomatik olarak bilgisayarının LAN IP'sine ayarlanır.

> **Docker kullanmıyorsan** doğrulama kodu maili gönderilemez. Sorun değil: geliştirme modunda kod
> API terminaline yazdırılır, oradan kopyalayabilirsin.

---

## Üniversite doğrulaması nasıl çalışıyor?

Platformun tek kapısı burası:

1. Kullanıcı e-posta adresini girer → `POST /auth/check-email`
2. Alan adı, `packages/shared/src/universities.ts` içindeki **~190 onaylı üniversite** listesiyle
   karşılaştırılır. Eşleşme **alt alan adlarını da kapsar**:

   | Adres | Sonuç |
   |---|---|
   | `ali@ogr.boun.edu.tr` | ✅ Boğaziçi Üniversitesi |
   | `mehmet@ogrenci.karabuk.edu.tr` | ✅ Karabük Üniversitesi |
   | `x@gmail.com` | ❌ reddedilir |
   | `y@edu.tr.sahte.com` | ❌ reddedilir |

3. Kabul edilirse adrese 6 haneli kod gider (10 dk geçerli, 5 hatalı deneme hakkı, 60 sn yeniden
   gönderme bekleme süresi). Kodlar veritabanında **SHA-256 karma** hâlinde tutulur.
4. Kod doğrulanınca hesap açılır ve kullanıcı **üniversitesinin genel topluluğuna + bölüm
   topluluğuna otomatik üye** yapılır.

Üniversite bilgisi e-postadan türetilir ve **kullanıcı tarafından değiştirilemez**.

Kuralı gevşetmek istersen `.env` içinde `ALLOWED_DOMAIN_MODE="edu"` yap — bu modda listede olmayan
ama `*.edu.tr` / `*.edu` / `*.ac.xx` ile biten her adres kabul edilir.

**Yeni üniversite eklemek:** `packages/shared/src/universities.ts` dosyasına satır ekle, sonra
`npm run build -w @kampus/shared && npm run seed`.

---

## Özellikler

**Hesap ve güvenlik**
- Üniversite maili + 6 haneli kod doğrulaması
- Argon2id şifre karması, JWT access + rotasyonlu refresh token
- Refresh token yeniden kullanılırsa tüm oturumlar otomatik kapanır (sızıntı koruması)
- Şifre sıfırlama, tüm cihazlardan çıkış, hesap kapatma
- Uç nokta bazlı hız sınırlama (rate limit)

**Topluluklar**
- 3 kapsam: **Bölüm** (kendi üniversiten + kendi bölümün), **Üniversite** (kampüsün geneli),
  **Genel** (Türkiye'deki tüm öğrenciler)
- Açık / gizli (onaylı katılım) topluluklar
- Kurucu / moderatör / üye rolleri, katılım istekleri, üye çıkarma
- Her topluluğun kendi kuralları ve **canlı grup sohbeti**

**Paylaşım**
- Metin + 4'e kadar görsel, anket, hashtag, @bahsetme
- Anonim paylaşım (yazar kimliği API yanıtlarında hiç yer almaz)
- Beğeni, iç içe yorum, kaydetme, sabitleme
- Akış sekmeleri: Sana Özel / Üniversitem / Bölümüm / Popüler + gündem etiketleri

**Mesajlaşma (Socket.IO)**
- Birebir, grup ve topluluk sohbetleri
- "Yazıyor" göstergesi, çevrimiçi durumu, okundu bilgisi, yanıtlama
- İyimser gönderim + `clientNonce` ile mükerrer mesaj koruması

**Ekstra modüller**
- 📚 **Ders notu paylaşımı** — ders koduna göre arama, 5 yıldız puanlama, indirme sayacı
- 📅 **Etkinlikler** — kontenjan, katılım, topluluk üyelerine otomatik bildirim
- 🎭 **Anonim itiraflar** — üniversiteye özel veya Türkiye geneli, konu başlıkları
- 🏅 **Karma ve rozetler** — 8 rozet (Öncü, Not Kahramanı, Organizatör…)
- 🛡️ **Moderasyon** — şikayet akışı, yönetici paneli uçları, içerik kaldırma/askıya alma
- 🔍 Kişi / topluluk / gönderi / etkinlik / not araması

**Arayüz**
- Koyu + açık tema (sistem tercihini izler)
- Mobil öncelikli, PWA (ana ekrana eklenebilir)
- Sonsuz kaydırma, iskelet yükleyiciler, iyimser güncellemeler

---

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run dev` | API + web birlikte |
| `npm run dev:api` / `dev:web` / `dev:mobile` | Tek tek |
| `npm run pg:start` / `pg:stop` | Yerel PostgreSQL'i başlatır / durdurur |
| `npm run db:up` / `db:down` | Docker: Postgres + Mailpit |
| `npm run migrate` | Prisma migration çalıştırır |
| `npm run db:push` | Migration üretmeden şemayı uygular |
| `npm run seed` / `seed:demo` | Üniversiteler / demo veri |
| `npm run studio` | Prisma Studio (veritabanı arayüzü) |
| `npm run build` | Tümünü derler |

---

## API özeti

Taban adres: `http://localhost:4100/api/v1`

| Grup | Uçlar |
|---|---|
| `/auth` | check-email, register/start, register/complete, login, refresh, logout, forgot-password, me |
| `/users` | profil, takip, engelleme, öneriler, ayarlar |
| `/communities` | listeleme, oluşturma, katılma, üyeler, roller, katılım istekleri |
| `/posts` `/comments` | gönderi, yorum, beğeni, kaydetme, anket oyu |
| `/feed` | akış sekmeleri + gündem |
| `/chat` | sohbetler, mesajlar, okundu, sessize alma |
| `/notifications` | bildirimler, okunmamış sayacı |
| `/events` `/notes` `/confessions` | etkinlik, ders notu, itiraf |
| `/search` `/meta` `/upload` `/reports` | arama, üniversite/bölüm listeleri, yükleme, şikayet |

Realtime olayları `packages/shared/src/types.ts` içindeki `SOCKET_EVENTS` sabitinde tanımlı.

---

## Production'a çıkarken

- [ ] `JWT_ACCESS_SECRET` ve `JWT_REFRESH_SECRET` değerlerini değiştir
- [ ] Gerçek bir SMTP servisi bağla (Resend, SendGrid, Amazon SES…)
- [ ] `NODE_ENV=production`, `WEB_PUBLIC_URL` ve `API_PUBLIC_URL` değerlerini gerçek adreslerle güncelle
- [ ] Yüklenen dosyaları disk yerine S3/R2 gibi bir nesne deposuna taşı (`apps/api/src/routes/upload.ts`)
- [ ] Birden fazla API kopyası çalıştıracaksan Socket.IO için Redis adapter ekle
- [ ] Postgres yedeklemesini ayarla
- [ ] KVKK aydınlatma metnini `apps/web/src/app/gizlilik` altında kendi kurumsal bilgilerinle güncelle
