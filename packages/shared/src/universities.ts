/**
 * Onaylı üniversite alan adları.
 *
 * Eşleştirme kuralı: bir e-posta alan adı, listedeki bir alan adına *eşitse*
 * ya da onun *alt alan adıysa* kabul edilir.
 *   ornek@karabuk.edu.tr           -> karabuk.edu.tr        ✔
 *   ornek@ogrenci.karabuk.edu.tr   -> karabuk.edu.tr        ✔ (alt alan adı)
 *   ornek@gmail.com                -> eşleşme yok           ✘
 *
 * Türkiye'deki üniversitelerin büyük çoğunluğu öğrencilerine
 * @ogr.X.edu.tr / @ogrenci.X.edu.tr / @student.X.edu.tr biçiminde adres verdiği
 * için alt alan adı desteği zorunludur.
 */

export type UniversityType = "STATE" | "FOUNDATION" | "OTHER";

export interface UniversitySeed {
  name: string;
  shortName: string;
  city: string;
  type: UniversityType;
  domains: string[];
}

export const UNIVERSITIES: UniversitySeed[] = [
  // ---------------------------------------------------------------- İstanbul
  { name: "Boğaziçi Üniversitesi", shortName: "BOUN", city: "İstanbul", type: "STATE", domains: ["boun.edu.tr"] },
  { name: "İstanbul Teknik Üniversitesi", shortName: "İTÜ", city: "İstanbul", type: "STATE", domains: ["itu.edu.tr"] },
  { name: "İstanbul Üniversitesi", shortName: "İÜ", city: "İstanbul", type: "STATE", domains: ["istanbul.edu.tr"] },
  { name: "İstanbul Üniversitesi-Cerrahpaşa", shortName: "İÜC", city: "İstanbul", type: "STATE", domains: ["iuc.edu.tr"] },
  { name: "Marmara Üniversitesi", shortName: "MÜ", city: "İstanbul", type: "STATE", domains: ["marmara.edu.tr"] },
  { name: "Yıldız Teknik Üniversitesi", shortName: "YTÜ", city: "İstanbul", type: "STATE", domains: ["yildiz.edu.tr", "std.yildiz.edu.tr"] },
  { name: "Galatasaray Üniversitesi", shortName: "GSÜ", city: "İstanbul", type: "STATE", domains: ["gsu.edu.tr"] },
  { name: "Mimar Sinan Güzel Sanatlar Üniversitesi", shortName: "MSGSÜ", city: "İstanbul", type: "STATE", domains: ["msgsu.edu.tr"] },
  { name: "İstanbul Medeniyet Üniversitesi", shortName: "İMÜ", city: "İstanbul", type: "STATE", domains: ["medeniyet.edu.tr"] },
  { name: "Türk-Alman Üniversitesi", shortName: "TAÜ", city: "İstanbul", type: "STATE", domains: ["tau.edu.tr"] },
  { name: "Koç Üniversitesi", shortName: "KU", city: "İstanbul", type: "FOUNDATION", domains: ["ku.edu.tr"] },
  { name: "Sabancı Üniversitesi", shortName: "SU", city: "İstanbul", type: "FOUNDATION", domains: ["sabanciuniv.edu"] },
  { name: "Özyeğin Üniversitesi", shortName: "OzU", city: "İstanbul", type: "FOUNDATION", domains: ["ozyegin.edu.tr", "ozu.edu.tr"] },
  { name: "Bahçeşehir Üniversitesi", shortName: "BAU", city: "İstanbul", type: "FOUNDATION", domains: ["bahcesehir.edu.tr", "bau.edu.tr"] },
  { name: "İstanbul Bilgi Üniversitesi", shortName: "BİLGİ", city: "İstanbul", type: "FOUNDATION", domains: ["bilgi.edu.tr"] },
  { name: "Kadir Has Üniversitesi", shortName: "KHAS", city: "İstanbul", type: "FOUNDATION", domains: ["khas.edu.tr"] },
  { name: "Yeditepe Üniversitesi", shortName: "YÜ", city: "İstanbul", type: "FOUNDATION", domains: ["yeditepe.edu.tr"] },
  { name: "Acıbadem Mehmet Ali Aydınlar Üniversitesi", shortName: "ACU", city: "İstanbul", type: "FOUNDATION", domains: ["acibadem.edu.tr"] },
  { name: "İstanbul Medipol Üniversitesi", shortName: "MEDİPOL", city: "İstanbul", type: "FOUNDATION", domains: ["medipol.edu.tr"] },
  { name: "İstanbul Aydın Üniversitesi", shortName: "İAÜ", city: "İstanbul", type: "FOUNDATION", domains: ["aydin.edu.tr"] },
  { name: "İstanbul Kültür Üniversitesi", shortName: "İKÜ", city: "İstanbul", type: "FOUNDATION", domains: ["iku.edu.tr"] },
  { name: "İstanbul Ticaret Üniversitesi", shortName: "İTİCÜ", city: "İstanbul", type: "FOUNDATION", domains: ["ticaret.edu.tr"] },
  { name: "İstanbul Arel Üniversitesi", shortName: "AREL", city: "İstanbul", type: "FOUNDATION", domains: ["arel.edu.tr"] },
  { name: "İstanbul Gelişim Üniversitesi", shortName: "İGÜ", city: "İstanbul", type: "FOUNDATION", domains: ["gelisim.edu.tr"] },
  { name: "İstanbul Okan Üniversitesi", shortName: "OKAN", city: "İstanbul", type: "FOUNDATION", domains: ["okan.edu.tr"] },
  { name: "İstanbul Kent Üniversitesi", shortName: "KENT", city: "İstanbul", type: "FOUNDATION", domains: ["kent.edu.tr"] },
  { name: "İstanbul Atlas Üniversitesi", shortName: "ATLAS", city: "İstanbul", type: "FOUNDATION", domains: ["atlas.edu.tr"] },
  { name: "İstanbul Esenyurt Üniversitesi", shortName: "ESENYURT", city: "İstanbul", type: "FOUNDATION", domains: ["esenyurt.edu.tr"] },
  { name: "İstanbul Rumeli Üniversitesi", shortName: "RUMELİ", city: "İstanbul", type: "FOUNDATION", domains: ["rumeli.edu.tr"] },
  { name: "İstanbul Sabahattin Zaim Üniversitesi", shortName: "İZÜ", city: "İstanbul", type: "FOUNDATION", domains: ["izu.edu.tr"] },
  { name: "İstinye Üniversitesi", shortName: "İSÜ", city: "İstanbul", type: "FOUNDATION", domains: ["istinye.edu.tr"] },
  { name: "Altınbaş Üniversitesi", shortName: "ALTINBAŞ", city: "İstanbul", type: "FOUNDATION", domains: ["altinbas.edu.tr"] },
  { name: "Biruni Üniversitesi", shortName: "BİRUNİ", city: "İstanbul", type: "FOUNDATION", domains: ["biruni.edu.tr"] },
  { name: "Bezmiâlem Vakıf Üniversitesi", shortName: "BEZMİALEM", city: "İstanbul", type: "FOUNDATION", domains: ["bezmialem.edu.tr"] },
  { name: "İbn Haldun Üniversitesi", shortName: "İHÜ", city: "İstanbul", type: "FOUNDATION", domains: ["ihu.edu.tr"] },
  { name: "MEF Üniversitesi", shortName: "MEF", city: "İstanbul", type: "FOUNDATION", domains: ["mef.edu.tr"] },
  { name: "Maltepe Üniversitesi", shortName: "MALTEPE", city: "İstanbul", type: "FOUNDATION", domains: ["maltepe.edu.tr"] },
  { name: "Beykent Üniversitesi", shortName: "BEYKENT", city: "İstanbul", type: "FOUNDATION", domains: ["beykent.edu.tr"] },
  { name: "Beykoz Üniversitesi", shortName: "BEYKOZ", city: "İstanbul", type: "FOUNDATION", domains: ["beykoz.edu.tr"] },
  { name: "Doğuş Üniversitesi", shortName: "DOĞUŞ", city: "İstanbul", type: "FOUNDATION", domains: ["dogus.edu.tr"] },
  { name: "Haliç Üniversitesi", shortName: "HALİÇ", city: "İstanbul", type: "FOUNDATION", domains: ["halic.edu.tr"] },
  { name: "Işık Üniversitesi", shortName: "IŞIK", city: "İstanbul", type: "FOUNDATION", domains: ["isikun.edu.tr"] },
  { name: "Nişantaşı Üniversitesi", shortName: "NİŞANTAŞI", city: "İstanbul", type: "FOUNDATION", domains: ["nisantasi.edu.tr"] },
  { name: "Üsküdar Üniversitesi", shortName: "ÜSKÜDAR", city: "İstanbul", type: "FOUNDATION", domains: ["uskudar.edu.tr"] },
  { name: "Fatih Sultan Mehmet Vakıf Üniversitesi", shortName: "FSMVÜ", city: "İstanbul", type: "FOUNDATION", domains: ["fsm.edu.tr"] },
  { name: "Fenerbahçe Üniversitesi", shortName: "FBÜ", city: "İstanbul", type: "FOUNDATION", domains: ["fbu.edu.tr"] },
  { name: "Piri Reis Üniversitesi", shortName: "PRÜ", city: "İstanbul", type: "FOUNDATION", domains: ["pirireis.edu.tr"] },
  { name: "Yeni Yüzyıl Üniversitesi", shortName: "YYÜ-İST", city: "İstanbul", type: "FOUNDATION", domains: ["yeniyuzyil.edu.tr"] },
  { name: "Sağlık Bilimleri Üniversitesi", shortName: "SBÜ", city: "İstanbul", type: "STATE", domains: ["sbu.edu.tr"] },
  { name: "Milli Savunma Üniversitesi", shortName: "MSÜ", city: "İstanbul", type: "STATE", domains: ["msu.edu.tr"] },

  // ------------------------------------------------------------------ Ankara
  { name: "Orta Doğu Teknik Üniversitesi", shortName: "ODTÜ", city: "Ankara", type: "STATE", domains: ["metu.edu.tr"] },
  { name: "Hacettepe Üniversitesi", shortName: "HÜ", city: "Ankara", type: "STATE", domains: ["hacettepe.edu.tr"] },
  { name: "Ankara Üniversitesi", shortName: "AÜ", city: "Ankara", type: "STATE", domains: ["ankara.edu.tr"] },
  { name: "Gazi Üniversitesi", shortName: "GÜ", city: "Ankara", type: "STATE", domains: ["gazi.edu.tr"] },
  { name: "Ankara Yıldırım Beyazıt Üniversitesi", shortName: "AYBÜ", city: "Ankara", type: "STATE", domains: ["aybu.edu.tr", "ybu.edu.tr"] },
  { name: "Ankara Hacı Bayram Veli Üniversitesi", shortName: "HBV", city: "Ankara", type: "STATE", domains: ["hbv.edu.tr"] },
  { name: "Ankara Sosyal Bilimler Üniversitesi", shortName: "ASBÜ", city: "Ankara", type: "STATE", domains: ["asbu.edu.tr"] },
  { name: "Bilkent Üniversitesi", shortName: "BİLKENT", city: "Ankara", type: "FOUNDATION", domains: ["bilkent.edu.tr"] },
  { name: "TOBB Ekonomi ve Teknoloji Üniversitesi", shortName: "TOBB ETÜ", city: "Ankara", type: "FOUNDATION", domains: ["etu.edu.tr"] },
  { name: "TED Üniversitesi", shortName: "TEDU", city: "Ankara", type: "FOUNDATION", domains: ["tedu.edu.tr"] },
  { name: "Atılım Üniversitesi", shortName: "ATILIM", city: "Ankara", type: "FOUNDATION", domains: ["atilim.edu.tr"] },
  { name: "Başkent Üniversitesi", shortName: "BAŞKENT", city: "Ankara", type: "FOUNDATION", domains: ["baskent.edu.tr"] },
  { name: "Çankaya Üniversitesi", shortName: "ÇANKAYA", city: "Ankara", type: "FOUNDATION", domains: ["cankaya.edu.tr"] },
  { name: "Ufuk Üniversitesi", shortName: "UFUK", city: "Ankara", type: "FOUNDATION", domains: ["ufuk.edu.tr"] },
  { name: "OSTİM Teknik Üniversitesi", shortName: "OSTİM", city: "Ankara", type: "FOUNDATION", domains: ["ostimteknik.edu.tr"] },
  { name: "Ankara Bilim Üniversitesi", shortName: "ABÜ", city: "Ankara", type: "FOUNDATION", domains: ["ankarabilim.edu.tr"] },
  { name: "Ankara Medipol Üniversitesi", shortName: "AMÜ", city: "Ankara", type: "FOUNDATION", domains: ["ankaramedipol.edu.tr"] },
  { name: "Lokman Hekim Üniversitesi", shortName: "LHÜ", city: "Ankara", type: "FOUNDATION", domains: ["lokmanhekim.edu.tr"] },
  { name: "Ankara Müzik ve Güzel Sanatlar Üniversitesi", shortName: "MGÜ", city: "Ankara", type: "STATE", domains: ["mgu.edu.tr"] },
  { name: "Polis Akademisi", shortName: "PA", city: "Ankara", type: "STATE", domains: ["pa.edu.tr"] },

  // -------------------------------------------------------------------- İzmir
  { name: "Ege Üniversitesi", shortName: "EÜ", city: "İzmir", type: "STATE", domains: ["ege.edu.tr"] },
  { name: "Dokuz Eylül Üniversitesi", shortName: "DEÜ", city: "İzmir", type: "STATE", domains: ["deu.edu.tr", "ogr.deu.edu.tr"] },
  { name: "İzmir Yüksek Teknoloji Enstitüsü", shortName: "İYTE", city: "İzmir", type: "STATE", domains: ["iyte.edu.tr"] },
  { name: "İzmir Kâtip Çelebi Üniversitesi", shortName: "İKÇÜ", city: "İzmir", type: "STATE", domains: ["ikcu.edu.tr", "ikc.edu.tr"] },
  { name: "İzmir Bakırçay Üniversitesi", shortName: "BAKIRÇAY", city: "İzmir", type: "STATE", domains: ["bakircay.edu.tr"] },
  { name: "İzmir Demokrasi Üniversitesi", shortName: "İDÜ", city: "İzmir", type: "STATE", domains: ["idu.edu.tr"] },
  { name: "İzmir Ekonomi Üniversitesi", shortName: "İEÜ", city: "İzmir", type: "FOUNDATION", domains: ["ieu.edu.tr"] },
  { name: "Yaşar Üniversitesi", shortName: "YAŞAR", city: "İzmir", type: "FOUNDATION", domains: ["yasar.edu.tr"] },
  { name: "İzmir Tınaztepe Üniversitesi", shortName: "TINAZTEPE", city: "İzmir", type: "FOUNDATION", domains: ["tinaztepe.edu.tr"] },

  // ------------------------------------------------------- Diğer büyük şehirler
  { name: "Bursa Uludağ Üniversitesi", shortName: "BUÜ", city: "Bursa", type: "STATE", domains: ["uludag.edu.tr"] },
  { name: "Bursa Teknik Üniversitesi", shortName: "BTÜ", city: "Bursa", type: "STATE", domains: ["btu.edu.tr"] },
  { name: "Anadolu Üniversitesi", shortName: "AÜ-ESK", city: "Eskişehir", type: "STATE", domains: ["anadolu.edu.tr"] },
  { name: "Eskişehir Osmangazi Üniversitesi", shortName: "ESOGÜ", city: "Eskişehir", type: "STATE", domains: ["ogu.edu.tr"] },
  { name: "Eskişehir Teknik Üniversitesi", shortName: "ESTÜ", city: "Eskişehir", type: "STATE", domains: ["eskisehir.edu.tr"] },
  { name: "Kocaeli Üniversitesi", shortName: "KOÜ", city: "Kocaeli", type: "STATE", domains: ["kocaeli.edu.tr"] },
  { name: "Gebze Teknik Üniversitesi", shortName: "GTÜ", city: "Kocaeli", type: "STATE", domains: ["gtu.edu.tr"] },
  { name: "Sakarya Üniversitesi", shortName: "SAÜ", city: "Sakarya", type: "STATE", domains: ["sakarya.edu.tr"] },
  { name: "Sakarya Uygulamalı Bilimler Üniversitesi", shortName: "SUBÜ", city: "Sakarya", type: "STATE", domains: ["subu.edu.tr"] },
  { name: "Çukurova Üniversitesi", shortName: "ÇÜ", city: "Adana", type: "STATE", domains: ["cu.edu.tr"] },
  { name: "Adana Alparslan Türkeş Bilim ve Teknoloji Üniversitesi", shortName: "ATÜ", city: "Adana", type: "STATE", domains: ["atu.edu.tr"] },
  { name: "Akdeniz Üniversitesi", shortName: "AKÜ-ANT", city: "Antalya", type: "STATE", domains: ["akdeniz.edu.tr"] },
  { name: "Alanya Alaaddin Keykubat Üniversitesi", shortName: "ALKÜ", city: "Antalya", type: "STATE", domains: ["alanya.edu.tr"] },
  { name: "Antalya Belek Üniversitesi", shortName: "ABÜ-ANT", city: "Antalya", type: "FOUNDATION", domains: ["antalya.edu.tr"] },
  { name: "Erciyes Üniversitesi", shortName: "ERÜ", city: "Kayseri", type: "STATE", domains: ["erciyes.edu.tr"] },
  { name: "Kayseri Üniversitesi", shortName: "KAYÜ", city: "Kayseri", type: "STATE", domains: ["kayseri.edu.tr"] },
  { name: "Nuh Naci Yazgan Üniversitesi", shortName: "NNY", city: "Kayseri", type: "FOUNDATION", domains: ["nny.edu.tr"] },
  { name: "Atatürk Üniversitesi", shortName: "ATAUNİ", city: "Erzurum", type: "STATE", domains: ["atauni.edu.tr"] },
  { name: "Erzurum Teknik Üniversitesi", shortName: "ETÜ-ERZ", city: "Erzurum", type: "STATE", domains: ["erzurum.edu.tr"] },
  { name: "Karadeniz Teknik Üniversitesi", shortName: "KTÜ", city: "Trabzon", type: "STATE", domains: ["ktu.edu.tr"] },
  { name: "Trabzon Üniversitesi", shortName: "TRÜ", city: "Trabzon", type: "STATE", domains: ["trabzon.edu.tr"] },
  { name: "Ondokuz Mayıs Üniversitesi", shortName: "OMÜ", city: "Samsun", type: "STATE", domains: ["omu.edu.tr"] },
  { name: "Samsun Üniversitesi", shortName: "SAMÜ", city: "Samsun", type: "STATE", domains: ["samsun.edu.tr"] },
  { name: "Selçuk Üniversitesi", shortName: "SÜ-KON", city: "Konya", type: "STATE", domains: ["selcuk.edu.tr"] },
  { name: "Necmettin Erbakan Üniversitesi", shortName: "NEÜ", city: "Konya", type: "STATE", domains: ["erbakan.edu.tr"] },
  { name: "Konya Teknik Üniversitesi", shortName: "KTÜN", city: "Konya", type: "STATE", domains: ["ktun.edu.tr"] },
  { name: "KTO Karatay Üniversitesi", shortName: "KARATAY", city: "Konya", type: "FOUNDATION", domains: ["karatay.edu.tr"] },
  { name: "Gaziantep Üniversitesi", shortName: "GAÜN", city: "Gaziantep", type: "STATE", domains: ["gantep.edu.tr"] },
  { name: "Gaziantep İslam Bilim ve Teknoloji Üniversitesi", shortName: "GİBTÜ", city: "Gaziantep", type: "STATE", domains: ["gibtu.edu.tr"] },
  { name: "Hasan Kalyoncu Üniversitesi", shortName: "HKÜ", city: "Gaziantep", type: "FOUNDATION", domains: ["hku.edu.tr"] },
  { name: "SANKO Üniversitesi", shortName: "SANKO", city: "Gaziantep", type: "FOUNDATION", domains: ["sanko.edu.tr"] },
  { name: "Dicle Üniversitesi", shortName: "DÜ", city: "Diyarbakır", type: "STATE", domains: ["dicle.edu.tr"] },
  { name: "Fırat Üniversitesi", shortName: "FÜ", city: "Elazığ", type: "STATE", domains: ["firat.edu.tr"] },
  { name: "İnönü Üniversitesi", shortName: "İNÖNÜ", city: "Malatya", type: "STATE", domains: ["inonu.edu.tr"] },
  { name: "Malatya Turgut Özal Üniversitesi", shortName: "MTÖÜ", city: "Malatya", type: "STATE", domains: ["ozal.edu.tr"] },
  { name: "Mersin Üniversitesi", shortName: "MEÜ", city: "Mersin", type: "STATE", domains: ["mersin.edu.tr"] },
  { name: "Tarsus Üniversitesi", shortName: "TARSUS", city: "Mersin", type: "STATE", domains: ["tarsus.edu.tr"] },
  { name: "Çağ Üniversitesi", shortName: "ÇAĞ", city: "Mersin", type: "FOUNDATION", domains: ["cag.edu.tr"] },
  { name: "Toros Üniversitesi", shortName: "TOROS", city: "Mersin", type: "FOUNDATION", domains: ["toros.edu.tr"] },

  // ------------------------------------------------------------------ Anadolu
  { name: "Pamukkale Üniversitesi", shortName: "PAÜ", city: "Denizli", type: "STATE", domains: ["pau.edu.tr"] },
  { name: "Süleyman Demirel Üniversitesi", shortName: "SDÜ", city: "Isparta", type: "STATE", domains: ["sdu.edu.tr"] },
  { name: "Isparta Uygulamalı Bilimler Üniversitesi", shortName: "ISUBÜ", city: "Isparta", type: "STATE", domains: ["isparta.edu.tr"] },
  { name: "Aydın Adnan Menderes Üniversitesi", shortName: "ADÜ", city: "Aydın", type: "STATE", domains: ["adu.edu.tr"] },
  { name: "Muğla Sıtkı Koçman Üniversitesi", shortName: "MSKÜ", city: "Muğla", type: "STATE", domains: ["mu.edu.tr"] },
  { name: "Manisa Celal Bayar Üniversitesi", shortName: "MCBÜ", city: "Manisa", type: "STATE", domains: ["cbu.edu.tr"] },
  { name: "Balıkesir Üniversitesi", shortName: "BAUN", city: "Balıkesir", type: "STATE", domains: ["balikesir.edu.tr"] },
  { name: "Bandırma Onyedi Eylül Üniversitesi", shortName: "BANÜ", city: "Balıkesir", type: "STATE", domains: ["bandirma.edu.tr"] },
  { name: "Çanakkale Onsekiz Mart Üniversitesi", shortName: "ÇOMÜ", city: "Çanakkale", type: "STATE", domains: ["comu.edu.tr"] },
  { name: "Trakya Üniversitesi", shortName: "TÜ", city: "Edirne", type: "STATE", domains: ["trakya.edu.tr"] },
  { name: "Kırklareli Üniversitesi", shortName: "KLÜ", city: "Kırklareli", type: "STATE", domains: ["klu.edu.tr"] },
  { name: "Tekirdağ Namık Kemal Üniversitesi", shortName: "NKÜ", city: "Tekirdağ", type: "STATE", domains: ["nku.edu.tr"] },
  { name: "Yalova Üniversitesi", shortName: "YALOVA", city: "Yalova", type: "STATE", domains: ["yalova.edu.tr"] },
  { name: "Bilecik Şeyh Edebali Üniversitesi", shortName: "BŞEÜ", city: "Bilecik", type: "STATE", domains: ["bilecik.edu.tr"] },
  { name: "Afyon Kocatepe Üniversitesi", shortName: "AKÜ", city: "Afyonkarahisar", type: "STATE", domains: ["aku.edu.tr"] },
  { name: "Afyonkarahisar Sağlık Bilimleri Üniversitesi", shortName: "AFSÜ", city: "Afyonkarahisar", type: "STATE", domains: ["afsu.edu.tr"] },
  { name: "Kütahya Dumlupınar Üniversitesi", shortName: "DPÜ", city: "Kütahya", type: "STATE", domains: ["dpu.edu.tr"] },
  { name: "Kütahya Sağlık Bilimleri Üniversitesi", shortName: "KSBÜ", city: "Kütahya", type: "STATE", domains: ["ksbu.edu.tr"] },
  { name: "Uşak Üniversitesi", shortName: "UŞAK", city: "Uşak", type: "STATE", domains: ["usak.edu.tr"] },
  { name: "Burdur Mehmet Akif Ersoy Üniversitesi", shortName: "MAKÜ", city: "Burdur", type: "STATE", domains: ["mehmetakif.edu.tr"] },
  { name: "Karamanoğlu Mehmetbey Üniversitesi", shortName: "KMÜ", city: "Karaman", type: "STATE", domains: ["kmu.edu.tr"] },
  { name: "Aksaray Üniversitesi", shortName: "ASÜ", city: "Aksaray", type: "STATE", domains: ["aksaray.edu.tr"] },
  { name: "Niğde Ömer Halisdemir Üniversitesi", shortName: "OHÜ", city: "Niğde", type: "STATE", domains: ["ohu.edu.tr"] },
  { name: "Nevşehir Hacı Bektaş Veli Üniversitesi", shortName: "NEVÜ", city: "Nevşehir", type: "STATE", domains: ["nevsehir.edu.tr"] },
  { name: "Kapadokya Üniversitesi", shortName: "KÜN", city: "Nevşehir", type: "FOUNDATION", domains: ["kapadokya.edu.tr"] },
  { name: "Kırşehir Ahi Evran Üniversitesi", shortName: "AEÜ", city: "Kırşehir", type: "STATE", domains: ["ahievran.edu.tr"] },
  { name: "Kırıkkale Üniversitesi", shortName: "KKÜ", city: "Kırıkkale", type: "STATE", domains: ["kku.edu.tr"] },
  { name: "Yozgat Bozok Üniversitesi", shortName: "BOZOK", city: "Yozgat", type: "STATE", domains: ["bozok.edu.tr"] },
  { name: "Sivas Cumhuriyet Üniversitesi", shortName: "CÜ", city: "Sivas", type: "STATE", domains: ["cumhuriyet.edu.tr"] },
  { name: "Sivas Bilim ve Teknoloji Üniversitesi", shortName: "SBTÜ", city: "Sivas", type: "STATE", domains: ["sivas.edu.tr"] },
  { name: "Tokat Gaziosmanpaşa Üniversitesi", shortName: "GOP", city: "Tokat", type: "STATE", domains: ["gop.edu.tr"] },
  { name: "Amasya Üniversitesi", shortName: "AMASYA", city: "Amasya", type: "STATE", domains: ["amasya.edu.tr"] },
  { name: "Hitit Üniversitesi", shortName: "HİTİT", city: "Çorum", type: "STATE", domains: ["hitit.edu.tr"] },
  { name: "Bolu Abant İzzet Baysal Üniversitesi", shortName: "İBÜ", city: "Bolu", type: "STATE", domains: ["ibu.edu.tr"] },
  { name: "Düzce Üniversitesi", shortName: "DÜZCE", city: "Düzce", type: "STATE", domains: ["duzce.edu.tr"] },
  { name: "Karabük Üniversitesi", shortName: "KBÜ", city: "Karabük", type: "STATE", domains: ["karabuk.edu.tr"] },
  { name: "Zonguldak Bülent Ecevit Üniversitesi", shortName: "BEÜ-ZON", city: "Zonguldak", type: "STATE", domains: ["beun.edu.tr"] },
  { name: "Kastamonu Üniversitesi", shortName: "KÜ-KAS", city: "Kastamonu", type: "STATE", domains: ["kastamonu.edu.tr"] },
  { name: "Sinop Üniversitesi", shortName: "SİNOP", city: "Sinop", type: "STATE", domains: ["sinop.edu.tr"] },
  { name: "Ordu Üniversitesi", shortName: "ODÜ", city: "Ordu", type: "STATE", domains: ["odu.edu.tr"] },
  { name: "Giresun Üniversitesi", shortName: "GRÜ", city: "Giresun", type: "STATE", domains: ["giresun.edu.tr"] },
  { name: "Recep Tayyip Erdoğan Üniversitesi", shortName: "RTEÜ", city: "Rize", type: "STATE", domains: ["erdogan.edu.tr"] },
  { name: "Artvin Çoruh Üniversitesi", shortName: "AÇÜ", city: "Artvin", type: "STATE", domains: ["artvin.edu.tr"] },
  { name: "Gümüşhane Üniversitesi", shortName: "GÜ-GÜM", city: "Gümüşhane", type: "STATE", domains: ["gumushane.edu.tr"] },
  { name: "Bayburt Üniversitesi", shortName: "BAYBURT", city: "Bayburt", type: "STATE", domains: ["bayburt.edu.tr"] },
  { name: "Erzincan Binali Yıldırım Üniversitesi", shortName: "EBYÜ", city: "Erzincan", type: "STATE", domains: ["ebyu.edu.tr"] },
  { name: "Munzur Üniversitesi", shortName: "MUNZUR", city: "Tunceli", type: "STATE", domains: ["munzur.edu.tr"] },
  { name: "Bingöl Üniversitesi", shortName: "BİNGÖL", city: "Bingöl", type: "STATE", domains: ["bingol.edu.tr"] },
  { name: "Muş Alparslan Üniversitesi", shortName: "MŞÜ", city: "Muş", type: "STATE", domains: ["alparslan.edu.tr"] },
  { name: "Bitlis Eren Üniversitesi", shortName: "BEÜ-BİT", city: "Bitlis", type: "STATE", domains: ["beu.edu.tr"] },
  { name: "Siirt Üniversitesi", shortName: "SİİRT", city: "Siirt", type: "STATE", domains: ["siirt.edu.tr"] },
  { name: "Şırnak Üniversitesi", shortName: "ŞIRNAK", city: "Şırnak", type: "STATE", domains: ["sirnak.edu.tr"] },
  { name: "Mardin Artuklu Üniversitesi", shortName: "ARTUKLU", city: "Mardin", type: "STATE", domains: ["artuklu.edu.tr"] },
  { name: "Batman Üniversitesi", shortName: "BATMAN", city: "Batman", type: "STATE", domains: ["batman.edu.tr"] },
  { name: "Hakkari Üniversitesi", shortName: "HAKKARİ", city: "Hakkari", type: "STATE", domains: ["hakkari.edu.tr"] },
  { name: "Van Yüzüncü Yıl Üniversitesi", shortName: "YYÜ", city: "Van", type: "STATE", domains: ["yyu.edu.tr"] },
  { name: "Ağrı İbrahim Çeçen Üniversitesi", shortName: "AİÇÜ", city: "Ağrı", type: "STATE", domains: ["agri.edu.tr"] },
  { name: "Iğdır Üniversitesi", shortName: "IĞDIR", city: "Iğdır", type: "STATE", domains: ["igdir.edu.tr"] },
  { name: "Kafkas Üniversitesi", shortName: "KAÜ", city: "Kars", type: "STATE", domains: ["kafkas.edu.tr"] },
  { name: "Ardahan Üniversitesi", shortName: "ARDAHAN", city: "Ardahan", type: "STATE", domains: ["ardahan.edu.tr"] },
  { name: "Harran Üniversitesi", shortName: "HRÜ", city: "Şanlıurfa", type: "STATE", domains: ["harran.edu.tr"] },
  { name: "Adıyaman Üniversitesi", shortName: "ADYÜ", city: "Adıyaman", type: "STATE", domains: ["adiyaman.edu.tr"] },
  { name: "Kahramanmaraş Sütçü İmam Üniversitesi", shortName: "KSÜ", city: "Kahramanmaraş", type: "STATE", domains: ["ksu.edu.tr"] },
  { name: "Kahramanmaraş İstiklal Üniversitesi", shortName: "İSTİKLAL", city: "Kahramanmaraş", type: "STATE", domains: ["istiklal.edu.tr"] },
  { name: "Hatay Mustafa Kemal Üniversitesi", shortName: "MKÜ", city: "Hatay", type: "STATE", domains: ["mku.edu.tr"] },
  { name: "İskenderun Teknik Üniversitesi", shortName: "İSTE", city: "Hatay", type: "STATE", domains: ["iste.edu.tr"] },
  { name: "Osmaniye Korkut Ata Üniversitesi", shortName: "OKÜ", city: "Osmaniye", type: "STATE", domains: ["osmaniye.edu.tr"] },
  { name: "Kilis 7 Aralık Üniversitesi", shortName: "KİLİS", city: "Kilis", type: "STATE", domains: ["kilis.edu.tr"] },

  // ---------------------------------------------------------------- KKTC
  { name: "Doğu Akdeniz Üniversitesi", shortName: "DAÜ", city: "Gazimağusa (KKTC)", type: "OTHER", domains: ["emu.edu.tr"] },
  { name: "Yakın Doğu Üniversitesi", shortName: "YDÜ", city: "Lefkoşa (KKTC)", type: "OTHER", domains: ["neu.edu.tr"] },
  { name: "Uluslararası Kıbrıs Üniversitesi", shortName: "UKÜ", city: "Lefkoşa (KKTC)", type: "OTHER", domains: ["ciu.edu.tr"] },
  { name: "Girne Amerikan Üniversitesi", shortName: "GAÜ", city: "Girne (KKTC)", type: "OTHER", domains: ["gau.edu.tr"] },
];

/** domain -> üniversite (hızlı arama için) */
const DOMAIN_INDEX: Map<string, UniversitySeed> = (() => {
  const map = new Map<string, UniversitySeed>();
  for (const uni of UNIVERSITIES) {
    for (const domain of uni.domains) map.set(domain.toLowerCase(), uni);
  }
  return map;
})();

/** Bu alt alan adları öğrenci hesabı işaretidir (personel değil). */
const STUDENT_SUBDOMAINS = new Set([
  "ogr", "ogrenci", "ogrenciler", "student", "students", "stu", "std", "posta",
]);

export function extractDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 1 || at === email.length - 1) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

/**
 * Alan adına (ya da onun üst alan adlarından birine) karşılık gelen üniversiteyi
 * bulur. `ogr.karabuk.edu.tr` -> `karabuk.edu.tr` eşleşmesini sağlar.
 */
export function findUniversityByDomain(domain: string): UniversitySeed | null {
  const clean = domain.trim().toLowerCase().replace(/\.$/, "");
  const parts = clean.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join(".");
    const hit = DOMAIN_INDEX.get(candidate);
    if (hit) return hit;
  }
  return null;
}

export function findUniversityByEmail(email: string): UniversitySeed | null {
  const domain = extractDomain(email);
  return domain ? findUniversityByDomain(domain) : null;
}

/** ALLOWED_DOMAIN_MODE="edu" modunda kullanılır. */
export function looksLikeAcademicDomain(domain: string): boolean {
  const clean = domain.trim().toLowerCase();
  return /\.edu\.tr$/.test(clean) || /\.edu$/.test(clean) || /\.ac\.[a-z]{2}$/.test(clean);
}

/** Adres `@ogr.*` gibi bir öğrenci alt alan adından mı geliyor? */
export function isStudentSubdomain(domain: string): boolean {
  const first = domain.trim().toLowerCase().split(".")[0];
  return STUDENT_SUBDOMAINS.has(first);
}
