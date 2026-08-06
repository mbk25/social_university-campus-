# Yayına alma kılavuzu

Toplam süre: **30–40 dakika**. Dört servis kullanılıyor, hepsinin ücretsiz katmanı
bu proje için yeterli.

| Parça | Servis | Neden |
|---|---|---|
| Web (Next.js) | **Vercel** | Next.js'i en iyi çalıştıran yer |
| API + Socket.IO | **Railway** | Sürekli açık süreç ve WebSocket gerekiyor |
| PostgreSQL | **Railway** | Aynı projede, bağlantı otomatik kuruluyor |
| Dosyalar | **Cloudflare R2** | Sunucu diski her dağıtımda sıfırlanır |
| E-posta | **Resend** | Doğrulama kodları gerçekten gitsin |

> **Neden API Vercel'de değil?** Vercel serverless çalışır: istek gelir, işlenir,
> süreç kapanır. Socket.IO ise sürekli açık kalan bağlantılar ister. API'yi
> Vercel'e koyarsanız mesajlaşma, "yazıyor" göstergesi ve anlık bildirimler
> çalışmaz.

---

## 0. Kodu GitHub'a yükle

Vercel ve Railway dağıtımı GitHub'dan yapıyor.

```bash
git add -A
git commit -m "Yayina hazirlik"
```

[github.com/new](https://github.com/new) adresinden **boş** bir depo oluştur
(README ekleme), sonra:

```bash
git remote add origin https://github.com/KULLANICI_ADIN/kampus.git
git branch -M main
git push -u origin main
```

> `.env` dosyası `.gitignore` içinde — şifreler GitHub'a gitmez. Bu bilinçli:
> gerçek değerleri panellere elle gireceğiz.

---

## 1. Veritabanı — Railway PostgreSQL

Veritabanını API ile aynı projeye koymak en pratiği: bağlantı adresini hiç
kopyalamana gerek kalmaz, Railway iki servisi kendi ağı üzerinden birbirine
bağlar.

Bu adımı **4. bölümde**, Railway projesini oluştururken yapacaksın:

> **New** → **Database** → **Add PostgreSQL**

Railway `DATABASE_URL` değişkenini otomatik üretir; API servisinde buna
`${{Postgres.DATABASE_URL}}` şeklinde referans verirsin (detay 4. bölümde).

<details>
<summary>Alternatif: Neon (harici, ücretsiz 0.5 GB)</summary>

Veritabanını ayrı tutmak istersen:

1. [neon.tech](https://neon.tech) → GitHub ile giriş → **New project**
2. İsim `kampus`, bölge **Europe (Frankfurt)**
3. **Connect** → **Connection pooling** seçeneğini **KAPAT** → adresi kopyala

Bu adresi Railway'de `DATABASE_URL` olarak elle girersin.

Neon panelinde "Bir şeyler ters gitti" hatası alırsan tarayıcı eklentilerinden
kaynaklanıyor olabilir — gizli sekmede (Ctrl+Shift+N) dene. Şifreyi görmek için
"Şifreyi göster"e basman gerekmez; "Kod parçasını kopyala" zaten gerçek şifreyi
kopyalar.
</details>

---

## 2. Dosya depolama — Cloudflare R2

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **R2** → hesabı etkinleştir
   (kredi kartı ister ama 10 GB'a kadar ücretsiz)
2. **Create bucket** → isim `kampus-uploads`
3. Bucket → **Settings** → **Public access** → **R2.dev subdomain**'i aç.
   Verilen adres (`https://pub-xxxx.r2.dev`) → `S3_PUBLIC_URL`
4. R2 ana sayfa → **Manage API tokens** → **Create API token**
   → izin: **Object Read & Write** → oluştur

Kaydet: Access Key ID, Secret Access Key ve endpoint
(`https://HESAP_ID.r2.cloudflarestorage.com`).

> Bu adımı atlarsan uygulama yine çalışır ama yüklenen fotoğraflar her
> dağıtımda silinir. Denemelik bir sürüm için atlanabilir — `S3_BUCKET`
> değişkenini hiç girme, kod otomatik olarak diske yazar.

---

## 3. E-posta — Resend

1. [resend.com](https://resend.com) → GitHub ile giriş
2. **API Keys** → **Create API Key** → değeri kopyala (`re_...`)
3. **Domains** → alan adını ekle ve DNS kayıtlarını doğrula

Alan adın yoksa Resend'in test göndericisi `onboarding@resend.dev` yalnızca
**kendi kayıtlı e-postana** gönderim yapar. Kendi kendine test için yeterli,
gerçek kullanıcılar için alan adı doğrulaman gerekir.

---

## 4. API — Railway

1. [railway.app](https://railway.app) → GitHub ile giriş
2. **New Project** → **Deploy from GitHub repo** → depoyu seç
3. Railway kökteki `railway.json` dosyasını görüp `apps/api/Dockerfile` ile derler

### 4a. Veritabanını ekle

Aynı projede: **New** → **Database** → **Add PostgreSQL**.

Birkaç saniyede hazır olur. Bağlantı adresini kopyalamana gerek yok — bir
sonraki adımda referansla bağlayacağız.

### 4b. Ortam değişkenleri

API servisine tıkla → **Variables**. `.env.production.example` içindeki
**API bölümünü** gir. Zorunlu olanlar:

```
NODE_ENV=production
PORT=4100
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_ACCESS_SECRET=<üretilmiş değer>
JWT_REFRESH_SECRET=<farklı üretilmiş değer>
API_PUBLIC_URL=<Railway'in verdiği adres>
WEB_PUBLIC_URL=<Vercel'in verdiği adres>
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASS=<Resend anahtarı>
MAIL_FROM=Kampus <noreply@ALAN_ADIN>
```

> `${{Postgres.DATABASE_URL}}` bir yazım hatası değil — Railway'in referans
> söz dizimi. Aynen böyle yaz; veritabanı servisinin adı farklıysa (örn.
> `PostgreSQL`) onu kullan. Şifre değişse bile bağlantı bozulmaz.

Gizli anahtarları üretmek için (her biri için ayrı ayrı çalıştır):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

5. **Settings** → **Networking** → **Generate Domain**. Çıkan adresi
   `API_PUBLIC_URL` değişkenine yaz ve yeniden dağıt.

Migration'lar açılışta otomatik uygulanır (`prisma migrate deploy`).

### Üniversite listesini yükle

Migration tabloları oluşturur ama içlerini doldurmaz; 190 üniversiteyi bir kez
yüklemek gerekir. Bunu **kendi bilgisayarından** yap — sunucu imajında `tsx`
bulunmuyor.

Railway'de veritabanı servisine tıkla → **Variables** → `DATABASE_PUBLIC_URL`
değerini kopyala (dışarıdan erişim için olan adres budur; `DATABASE_URL` yalnızca
Railway'in iç ağında çalışır).

Kendi terminalinde:

```bash
$env:DATABASE_URL="<DATABASE_PUBLIC_URL degeri>"; npm run seed
```

Bu yalnızca o terminal oturumunu etkiler, `.env` dosyana dokunmaz — pencereyi
kapattığında yerel ayarların geri gelir.

Yüklendiğini doğrulamak için tarayıcıdan:
`https://API_ADRESI/api/v1/meta/universities` → 190 kayıt dönmeli.

> Demo gönderi/kullanıcı **yükleme** (`seed:demo`). Gerçek kullanıcıların
> göreceği bir ortamda sahte hesaplar istemezsin.

---

## 5. Web — Vercel

1. [vercel.com](https://vercel.com) → GitHub ile giriş → **Add New Project**
2. Depoyu seç
3. **Root Directory** → `apps/web` olarak ayarla ← *en sık atlanan adım*
4. **Environment Variables**:

```
NEXT_PUBLIC_API_URL=<Railway adresi>
```

5. **Deploy**

Dağıtım bitince Vercel'in verdiği adresi Railway'deki `WEB_PUBLIC_URL`
değişkenine yaz ve API'yi yeniden başlat. **Bu adım atlanırsa** tarayıcı
istekleri CORS'a takılır ve site boş görünür.

---

## 6. Kontrol listesi

```
□ https://API_ADRESI/health           → {"ok":true}
□ Siteye gir, kayıt ol                → doğrulama kodu mailine düştü mü?
□ Gönderi paylaş, fotoğraf ekle       → fotoğraf sayfa yenileyince duruyor mu?
□ İki tarayıcıda aç, mesaj gönder     → anında düşüyor mu? (Socket.IO)
□ Topluluk kur, katıl
```

Sorun çıkarsa Railway → **Deployments** → **View Logs**.

| Belirti | Sebep |
|---|---|
| Site açılıyor ama veri gelmiyor | `WEB_PUBLIC_URL` yanlış (CORS) |
| Mesajlar anlık düşmüyor | API serverless bir yerde çalışıyor |
| Fotoğraflar bir süre sonra kayboluyor | R2 yapılandırılmamış |
| Doğrulama kodu gelmiyor | Resend alan adı doğrulanmamış |
| `P1001` | `DATABASE_URL` yanlış ya da Neon'da pooling açık |

---

## 7. Mobil uygulama

Mağazalara çıkmak ayrı bir süreç: Apple Developer yılda 99 $, Google Play tek
seferlik 25 $ ve inceleme süreçleri var.

Öncesinde `apps/mobile/app.json` içindeki `extra.apiUrl` değerini Railway
adresiyle güncelle, sonra:

```bash
npx eas build --platform android --profile preview
```

Bu, arkadaşlarına gönderebileceğin bir APK üretir — mağazaya gerek kalmadan
test edebilirsin.

---

## Aylık maliyet

| Servis | Ücretsiz katman | Yetmezse |
|---|---|---|
| Vercel | Hobi projeleri için sınırsız | 20 $ |
| Railway | 5 $ deneme kredisi | ~5 $ |
| Neon | 0.5 GB depolama | 19 $ |
| R2 | 10 GB | 0.015 $/GB |
| Resend | Aylık 3.000 e-posta | 20 $ |

Birkaç yüz kullanıcıya kadar **ayda ~5 $** (yalnızca Railway) ile döner.
