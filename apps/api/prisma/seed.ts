/**
 * Veritabanı tohumlama.
 *   npm run seed              -> sadece üniversite listesi
 *   npm run seed -- --demo    -> ek olarak örnek kullanıcı/topluluk/gönderi
 */
import path from "node:path";
import argon2 from "argon2";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { UNIVERSITIES, generateAnonymousAlias } from "@kampus/shared";

// Prisma Client .env'i kendisi okumaz; kök dizindeki dosyayı burada yüklüyoruz.
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });

if (!process.env.DATABASE_URL) {
  console.error(
    "\n❌ DATABASE_URL bulunamadı.\n   Kök dizindeki .env dosyasında tanımlı olduğundan emin olun.\n",
  );
  process.exit(1);
}

const prisma = new PrismaClient();
const withDemo = process.argv.includes("--demo");

async function seedUniversities() {
  console.log(`📚 ${UNIVERSITIES.length} üniversite yükleniyor...`);
  let created = 0;
  let updated = 0;

  for (const uni of UNIVERSITIES) {
    const existing = await prisma.university.findFirst({ where: { name: uni.name } });
    if (existing) {
      await prisma.university.update({
        where: { id: existing.id },
        data: {
          shortName: uni.shortName,
          city: uni.city,
          type: uni.type,
          domains: uni.domains,
          isActive: true,
        },
      });
      updated += 1;
    } else {
      await prisma.university.create({
        data: {
          name: uni.name,
          shortName: uni.shortName,
          city: uni.city,
          type: uni.type,
          domains: uni.domains,
        },
      });
      created += 1;
    }
  }

  console.log(`   ✔ ${created} yeni, ${updated} güncellendi`);
}

const DEMO_PASSWORD = "Kampus2025";

const DEMO_USERS = [
  {
    email: "elif.yilmaz@ogr.boun.edu.tr",
    username: "elifyilmaz",
    displayName: "Elif Yılmaz",
    department: "Bilgisayar Mühendisliği",
    classYear: 3,
    bio: "BOUN CmpE '27 · açık kaynak ve kahve. Bitirme projesi arıyorum.",
  },
  {
    email: "mert.kaya@ogr.itu.edu.tr",
    username: "mertkaya",
    displayName: "Mert Kaya",
    department: "Elektrik-Elektronik Mühendisliği",
    classYear: 2,
    bio: "İTÜ EEM · robotik kulübü · gömülü sistemler",
  },
  {
    email: "zeynep.demir@ogr.hacettepe.edu.tr",
    username: "zeynepdemir",
    displayName: "Zeynep Demir",
    department: "Tıp",
    classYear: 4,
    bio: "Hacettepe Tıp · dönem 4 · nöbet sonrası kahve bağımlısı ☕",
  },
  {
    email: "can.ozturk@metu.edu.tr",
    username: "canozturk",
    displayName: "Can Öztürk",
    department: "Endüstri Mühendisliği",
    classYear: 4,
    bio: "ODTÜ EM · veri analizi, satranç, kampüs kedileri",
  },
  {
    email: "ayse.sahin@ogr.ege.edu.tr",
    username: "aysesahin",
    displayName: "Ayşe Şahin",
    department: "Psikoloji",
    classYear: 2,
    bio: "Ege Psikoloji · kitap kulübü kurucusu 📚",
  },
  {
    email: "burak.arslan@ogr.deu.edu.tr",
    username: "burakarslan",
    displayName: "Burak Arslan",
    department: "Mimarlık",
    classYear: 3,
    bio: "DEÜ Mimarlık · maket ve kahve · İzmir",
  },
];

async function seedDemo() {
  console.log("🌱 Demo veriler oluşturuluyor...");

  const passwordHash = await argon2.hash(DEMO_PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const users: { id: string; universityId: string | null; department: string | null; username: string }[] = [];

  for (const demo of DEMO_USERS) {
    const domain = demo.email.split("@")[1];
    const rootDomain = domain.split(".").slice(-3).join(".");
    const university = await prisma.university.findFirst({
      where: { domains: { has: rootDomain } },
      select: { id: true },
    });

    const user = await prisma.user.upsert({
      where: { email: demo.email },
      update: {},
      create: {
        email: demo.email,
        emailDomain: domain,
        passwordHash,
        username: demo.username,
        displayName: demo.displayName,
        bio: demo.bio,
        department: demo.department,
        classYear: demo.classYear,
        universityId: university?.id ?? null,
        isStudentAddress: domain.startsWith("ogr."),
        status: "ACTIVE",
        verifiedAt: new Date(),
        karma: Math.floor(Math.random() * 400) + 50,
        badges: { create: [{ code: "VERIFIED_STUDENT" }, { code: "EARLY_ADOPTER" }] },
      },
      select: { id: true, universityId: true, department: true, username: true },
    });

    users.push(user);
  }

  console.log(`   ✔ ${users.length} kullanıcı`);

  // ---- Topluluklar
  const globalCommunities = [
    {
      slug: "yazilim-gelistirme",
      name: "Yazılım Geliştirme",
      description: "Tüm üniversitelerden yazılımcılar. Proje, staj, teknoloji sohbeti.",
      tags: ["yazılım", "kod", "kariyer"],
      rules: [
        "Soru sorarken hata mesajını ve denediklerini paylaş.",
        "İş ilanı paylaşırken maaş aralığını belirt.",
        "Reklam ve referans linki yasak.",
      ],
    },
    {
      slug: "erasmus-degisim",
      name: "Erasmus & Değişim",
      description: "Erasmus, Mevlana, Farabi başvuruları ve deneyimleri.",
      tags: ["erasmus", "yurtdışı"],
      rules: ["Deneyim paylaşırken yıl ve üniversite belirt."],
    },
    {
      slug: "kariyer-staj",
      name: "Kariyer & Staj",
      description: "Staj ilanları, CV incelemesi, mülakat deneyimleri.",
      tags: ["staj", "kariyer", "cv"],
      rules: ["Sadece gerçek ilan paylaş.", "Kişisel iletişim bilgisi paylaşma."],
    },
    {
      slug: "kitap-kulubu",
      name: "Kitap Kulübü",
      description: "Ayın kitabı, okuma listeleri ve tartışmalar.",
      tags: ["kitap", "edebiyat"],
      rules: ["Spoiler verirken uyar."],
    },
    {
      slug: "kampus-yemek",
      name: "Kampüs & Yemek",
      description: "Yemekhane değerlendirmeleri, kampüs çevresi mekanlar, öğrenci indirimleri.",
      tags: ["yemek", "kampüs", "indirim"],
      rules: [],
    },
  ];

  const created: { id: string; slug: string }[] = [];
  for (const [i, c] of globalCommunities.entries()) {
    const owner = users[i % users.length];
    const community = await prisma.community.upsert({
      where: { slug: c.slug },
      update: {},
      create: {
        slug: c.slug,
        name: c.name,
        description: c.description,
        scope: "GLOBAL",
        visibility: "PUBLIC",
        tags: c.tags,
        rules: c.rules,
        createdById: owner.id,
      },
      select: { id: true, slug: true },
    });
    created.push(community);

    // Herkesi üye yap
    for (const [j, user] of users.entries()) {
      await prisma.communityMember.upsert({
        where: { communityId_userId: { communityId: community.id, userId: user.id } },
        update: {},
        create: {
          communityId: community.id,
          userId: user.id,
          role: user.id === owner.id ? "OWNER" : j % 4 === 0 ? "MODERATOR" : "MEMBER",
        },
      });
    }
    await prisma.community.update({
      where: { id: community.id },
      data: { memberCount: users.length },
    });
  }

  // Üniversite + bölüm toplulukları
  for (const user of users) {
    if (!user.universityId) continue;
    const uni = await prisma.university.findUniqueOrThrow({
      where: { id: user.universityId },
      select: { name: true, shortName: true },
    });
    const slugBase = uni.shortName.toLowerCase().replace(/[^a-z0-9]/g, "");

    const uniCommunity = await prisma.community.upsert({
      where: { slug: `${slugBase}-genel` },
      update: {},
      create: {
        slug: `${slugBase}-genel`,
        name: `${uni.name} — Genel`,
        description: `${uni.name} öğrencilerinin ortak alanı.`,
        scope: "UNIVERSITY",
        universityId: user.universityId,
        tags: ["kampüs", "genel"],
        createdById: user.id,
        memberCount: 1,
      },
      select: { id: true },
    });
    await prisma.communityMember.upsert({
      where: { communityId_userId: { communityId: uniCommunity.id, userId: user.id } },
      update: {},
      create: { communityId: uniCommunity.id, userId: user.id, role: "OWNER" },
    });
  }

  console.log(`   ✔ ${created.length} genel topluluk + üniversite toplulukları`);

  // ---- Takipleşme
  for (const a of users) {
    for (const b of users) {
      if (a.id === b.id || Math.random() > 0.6) continue;
      await prisma.follow.upsert({
        where: { followerId_followingId: { followerId: a.id, followingId: b.id } },
        update: {},
        create: { followerId: a.id, followingId: b.id },
      });
    }
  }

  // ---- Gönderiler
  const samplePosts: { content: string; slug?: string; anon?: boolean }[] = [
    {
      content:
        "Bitirme projesi için takım arkadaşı arıyorum. Konu: kampüs içi yol bulma uygulaması (indoor navigation). React Native + BLE beacon düşünüyorum. İlgilenen var mı? #bitirme #proje",
      slug: "yazilim-gelistirme",
    },
    {
      content:
        "Vize haftası taktiği: kütüphanenin 4. katı 08:00'de tamamen boş oluyor. 10:00'dan sonra yer bulmak imkansız. Not düşeyim dedim ☕ #vize",
    },
    {
      content:
        "Erasmus başvurusu yapacaklar: dil sınavı sonucu geçen sene 2 hafta sürmüştü, bu sene 5 gün. Başvuru son tarihinden en az 3 hafta önce girin derim. #erasmus",
      slug: "erasmus-degisim",
    },
    {
      content:
        "Staj mülakatında \"kendinizi tanıtın\" sorusuna 5 dakika konuşmayın. 90 saniye yeterli: okul, ilgi alanı, neden buradasın. Kalan zamanı proje anlatmaya ayırın. #staj #mülakat",
      slug: "kariyer-staj",
    },
    {
      content:
        "Bu ayın kitabı: Sapiens. Cuma 19:00'da online tartışma yapıyoruz, katılmak isteyen yorumlara yazsın 📚",
      slug: "kitap-kulubu",
    },
    {
      content:
        "Yemekhanede bugünkü menü beklenenin çok üstündeydi. Tavuk sote gerçekten tavuk sote gibiydi, şaka değil. Puan: 8/10 🍽️",
      slug: "kampus-yemek",
    },
    {
      content:
        "Sınav döneminde uykusuzluk normal sanılıyor ama değil. 3 gecedir 4 saat uyuyorum ve artık okuduğumu anlamıyorum. Aynı durumda olan var mı?",
      anon: true,
    },
    {
      content:
        "Yeni öğrendim: öğrenci kimliğiyle müzelerin çoğu ücretsiz, tren biletlerinde %20 indirim var. 3 senedir tam bilet alıyormuşum 🤦",
    },
  ];

  for (const [i, sample] of samplePosts.entries()) {
    const author = users[i % users.length];
    const community = sample.slug ? created.find((c) => c.slug === sample.slug) : null;

    await prisma.post.create({
      data: {
        content: sample.content,
        authorId: author.id,
        communityId: community?.id ?? null,
        isAnonymous: !!sample.anon,
        anonymousAlias: sample.anon ? generateAnonymousAlias(`${author.id}-${i}`) : null,
        hashtags: (sample.content.match(/#([\p{L}\p{N}_]{2,30})/gu) ?? []).map((t) =>
          t.slice(1).toLocaleLowerCase("tr"),
        ),
        likeCount: Math.floor(Math.random() * 40),
        createdAt: new Date(Date.now() - i * 3_600_000 * 3),
        hotScore: 100 - i,
      },
    });
  }

  // Anket içeren gönderi
  const pollAuthor = users[0];
  await prisma.post.create({
    data: {
      content: "Finaller online mı yüz yüze mi olsun? #anket",
      authorId: pollAuthor.id,
      communityId: created[0]?.id,
      hashtags: ["anket"],
      hotScore: 95,
      poll: {
        create: {
          question: "Finaller nasıl yapılsın?",
          endsAt: new Date(Date.now() + 5 * 86_400_000),
          options: {
            create: [
              { text: "Yüz yüze", position: 0, voteCount: 12 },
              { text: "Online", position: 1, voteCount: 31 },
              { text: "Hibrit (seçmeli)", position: 2, voteCount: 24 },
            ],
          },
        },
      },
    },
  });

  console.log(`   ✔ ${samplePosts.length + 1} gönderi`);

  // ---- Etkinlikler
  const events = [
    {
      title: "Kampüs Hackathon 2025",
      description: "48 saat, 4 kişilik takımlar, ödüller. Yemek ve kahve bizden ☕",
      location: "Mühendislik Fakültesi B Blok",
      days: 12,
    },
    {
      title: "Kariyer Günleri: CV Atölyesi",
      description: "İK uzmanlarıyla birebir CV incelemesi. Kontenjan sınırlı.",
      location: "Konferans Salonu",
      days: 5,
    },
    {
      title: "Online: Erasmus Bilgilendirme",
      description: "Geçen dönem gidenlerle soru-cevap.",
      location: null,
      days: 3,
      online: true,
    },
  ];

  for (const [i, e] of events.entries()) {
    const creator = users[i % users.length];
    await prisma.event.create({
      data: {
        title: e.title,
        description: e.description,
        location: e.location,
        isOnline: !!e.online,
        startsAt: new Date(Date.now() + e.days * 86_400_000),
        endsAt: new Date(Date.now() + e.days * 86_400_000 + 6 * 3_600_000),
        capacity: 100,
        creatorId: creator.id,
        communityId: created[i % created.length]?.id,
        attendeeCount: 1,
        attendees: { create: { userId: creator.id } },
      },
    });
  }

  console.log(`   ✔ ${events.length} etkinlik`);

  // ---- Ders notları
  const notes = [
    { title: "Veri Yapıları — Tüm Dönem Özeti", courseCode: "CMPE250", courseName: "Veri Yapıları" },
    { title: "Diferansiyel Denklemler Vize Soruları + Çözümler", courseCode: "MATH219", courseName: "Diferansiyel Denklemler" },
    { title: "Anatomi Ders Notları (Dönem 1)", courseCode: "MED101", courseName: "Anatomi" },
  ];

  for (const [i, n] of notes.entries()) {
    const uploader = users[i % users.length];
    await prisma.note.create({
      data: {
        title: n.title,
        description: "Derste tuttuğum notlar + geçmiş yıl sorularının çözümleri.",
        courseCode: n.courseCode,
        courseName: n.courseName,
        department: uploader.department,
        visibility: "GLOBAL",
        files: [{ url: "https://example.com/ornek-not.pdf", type: "FILE", name: "not.pdf", size: 482_311 }],
        uploaderId: uploader.id,
        universityId: uploader.universityId,
        downloadCount: Math.floor(Math.random() * 200),
        ratingSum: 22,
        ratingCount: 5,
      },
    });
  }

  console.log(`   ✔ ${notes.length} ders notu`);

  // ---- İtiraflar
  const confessions = [
    { content: "3. sınıfım ve hâlâ hangi bölümde okuduğumu aileme tam anlatamadım. Herkes doktor sanıyor.", topic: "aile" },
    { content: "Kütüphanede her gün aynı masada oturan biri var, 2 aydır selam vermeye cesaret edemiyorum.", topic: "aşk" },
    { content: "Bugün hocaya soru sordum ve bütün sınıf bana baktı. Bir daha asla.", topic: "ders" },
  ];

  for (const [i, c] of confessions.entries()) {
    const author = users[i % users.length];
    await prisma.confession.create({
      data: {
        content: c.content,
        topic: c.topic,
        scope: "GLOBAL",
        alias: generateAnonymousAlias(`${author.id}-conf-${i}`),
        authorId: author.id,
        likeCount: Math.floor(Math.random() * 90),
      },
    });
  }

  console.log(`   ✔ ${confessions.length} itiraf`);

  console.log("\n🔑 Demo giriş bilgileri:");
  for (const demo of DEMO_USERS.slice(0, 3)) {
    console.log(`   ${demo.email}  /  ${DEMO_PASSWORD}`);
  }
}

async function main() {
  await seedUniversities();
  if (withDemo) await seedDemo();
  console.log("\n✅ Tohumlama tamamlandı.");
}

main()
  .catch((err) => {
    console.error("❌ Tohumlama hatası:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
