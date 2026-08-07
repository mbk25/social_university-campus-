/** Bölüm listesi — kayıt sırasında ve bölüm topluluklarında kullanılır. */

export interface DepartmentGroup {
  faculty: string;
  departments: string[];
}

export const DEPARTMENTS: DepartmentGroup[] = [
  {
    faculty: "Mühendislik",
    departments: [
      "Bilgisayar Mühendisliği",
      "Yazılım Mühendisliği",
      "Elektrik-Elektronik Mühendisliği",
      "Makine Mühendisliği",
      "Endüstri Mühendisliği",
      "İnşaat Mühendisliği",
      "Kimya Mühendisliği",
      "Gıda Mühendisliği",
      "Çevre Mühendisliği",
      "Biyomedikal Mühendisliği",
      "Havacılık ve Uzay Mühendisliği",
      "Malzeme Bilimi ve Mühendisliği",
      "Mekatronik Mühendisliği",
      "Metalurji ve Malzeme Mühendisliği",
      "Harita Mühendisliği",
      "Jeoloji Mühendisliği",
      "Maden Mühendisliği",
      "Petrol ve Doğalgaz Mühendisliği",
      "Yapay Zeka ve Veri Mühendisliği",
    ],
  },
  {
    faculty: "Sağlık Bilimleri",
    departments: [
      "Tıp",
      "Diş Hekimliği",
      "Eczacılık",
      "Hemşirelik",
      "Beslenme ve Diyetetik",
      "Fizyoterapi ve Rehabilitasyon",
      "Veteriner Hekimliği",
      "Ebelik",
      "Odyoloji",
      "Sağlık Yönetimi",
    ],
  },
  {
    faculty: "İktisadi ve İdari Bilimler",
    departments: [
      "İşletme",
      "İktisat",
      "Uluslararası İlişkiler",
      "Siyaset Bilimi ve Kamu Yönetimi",
      "Maliye",
      "Ekonometri",
      "Çalışma Ekonomisi ve Endüstri İlişkileri",
      "Uluslararası Ticaret ve Lojistik",
      "Yönetim Bilişim Sistemleri",
    ],
  },
  {
    faculty: "Fen-Edebiyat",
    departments: [
      "Matematik",
      "Fizik",
      "Kimya",
      "Biyoloji",
      "Moleküler Biyoloji ve Genetik",
      "İstatistik",
      "Psikoloji",
      "Sosyoloji",
      "Felsefe",
      "Tarih",
      "Coğrafya",
      "Türk Dili ve Edebiyatı",
      "İngiliz Dili ve Edebiyatı",
      "Arkeoloji",
      "Sanat Tarihi",
      "Mütercim-Tercümanlık",
    ],
  },
  {
    faculty: "Eğitim",
    departments: [
      "Sınıf Öğretmenliği",
      "Okul Öncesi Öğretmenliği",
      "Rehberlik ve Psikolojik Danışmanlık",
      "Matematik Öğretmenliği",
      "Fen Bilgisi Öğretmenliği",
      "Türkçe Öğretmenliği",
      "İngilizce Öğretmenliği",
      "Özel Eğitim Öğretmenliği",
      "Beden Eğitimi ve Spor Öğretmenliği",
    ],
  },
  {
    faculty: "Hukuk ve İletişim",
    departments: [
      "Hukuk",
      "Gazetecilik",
      "Halkla İlişkiler ve Tanıtım",
      "Radyo Televizyon ve Sinema",
      "Yeni Medya ve İletişim",
      "Reklamcılık",
    ],
  },
  {
    faculty: "Mimarlık ve Tasarım",
    departments: [
      "Mimarlık",
      "İç Mimarlık",
      "Şehir ve Bölge Planlama",
      "Peyzaj Mimarlığı",
      "Endüstriyel Tasarım",
      "Grafik Tasarım",
    ],
  },
  {
    faculty: "Diğer",
    departments: [
      "Bilgisayar Programcılığı",
      "Web Tasarımı ve Kodlama",
      "Bankacılık ve Sigortacılık",
      "Turizm ve Otel İşletmeciliği",
      "Gastronomi ve Mutfak Sanatları",
      "Ziraat",
      "Denizcilik",
      "Havacılık",
      "Müzik",
      "Resim",
      "Tiyatro",
      "Diğer",
    ],
  },
];

export const ALL_DEPARTMENTS: string[] = Array.from(
  new Set(DEPARTMENTS.flatMap((g) => g.departments)),
).sort((a, b) => a.localeCompare(b, "tr"));

export function facultyOf(department: string): string | null {
  for (const group of DEPARTMENTS) {
    if (group.departments.includes(department)) return group.faculty;
  }
  return null;
}
