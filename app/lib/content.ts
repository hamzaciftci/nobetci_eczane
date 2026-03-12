/**
 * Programmatic SEO — Otomatik İçerik ve FAQ Üreticileri
 *
 * Her il / ilçe için:
 *  - SEO metin blokları (H2 altı paragraflar)
 *  - FAQ soruları + cevapları (FAQPage schema ile uyumlu)
 *
 * Tüm içerik server-side üretilir; client JS gerekmez.
 */

export interface FaqItem {
  question: string;
  answer: string;
}

// ─── İL (ŞEHİR) içerikleri ────────────────────────────────────────────────────

/**
 * İl sayfası SEO metin blokları.
 * 3-4 paragraf: liste tanımı, güncelleme bilgisi, kullanım ipuçları.
 */
export function citySeoBlocks(
  ilName: string,
  date: string,       // "12.03.2026"
  dateLong: string,   // "12 Mart 2026"
  count: number
): string[] {
  const countText =
    count > 0 ? `${count} eczane` : "eczaneler";

  return [
    `Bugün ${ilName} ilinde nöbetçi olan eczaneleri aşağıda bulabilirsiniz. ${dateLong} tarihi itibarıyla ${ilName} ilinde ${countText} nöbet tutmaktadır.`,

    `En yakın nöbetçi eczaneyi adres ve telefon bilgileri ile hızlıca öğrenebilirsiniz. Eczane kartındaki harita bağlantısına tıklayarak Google Haritalar üzerinden yol tarifi alabilirsiniz.`,

    `${ilName} nöbetçi eczane listesi, ${ilName} Eczacılar Odası'nın resmi kaynaklarından saatlik olarak güncellenmektedir. Veriler her gün nöbet saatine göre otomatik yenilenmektedir.`,

    `Nöbetçi eczaneler gece, hafta sonu ve resmi tatillerde de hizmet vermektedir. Acil ilaç ihtiyacı durumunda yukarıdaki listeden size en yakın eczaneye ulaşabilirsiniz.`,
  ];
}

/**
 * İl sayfası SSS (Sık Sorulan Sorular) listesi.
 * FAQPage schema ile doğrudan uyumludur.
 */
export function cityFaqs(
  ilName: string,
  dateLong: string,
  count: number
): FaqItem[] {
  const countAnswer =
    count > 0
      ? `Evet, ${dateLong} tarihinde ${ilName} ilinde ${count} eczane nöbet tutmaktadır.`
      : `${ilName} ili için güncel nöbet listesi hazırlanmaktadır. Lütfen birkaç dakika sonra tekrar deneyin.`;

  return [
    {
      question: `${ilName}'de bugün nöbetçi eczane var mı?`,
      answer: `${countAnswer} Listedeki eczanelerin adres ve telefon bilgilerine sayfa üzerinden ulaşabilirsiniz.`,
    },
    {
      question: `${ilName}'de en yakın nöbetçi eczaneyi nasıl bulurum?`,
      answer: `Konum hizmetinizi etkinleştirerek sayfanın üstündeki "En Yakın Nöbetçi Eczane" butonuna tıklayın. Sistem konumunuza en yakın nöbetçi eczaneleri harita üzerinde gösterecektir.`,
    },
    {
      question: `Nöbetçi eczaneler kaçta kapanır?`,
      answer: `Nöbetçi eczaneler 24 saat açık olup gece, hafta sonu ve resmi tatillerde kesintisiz hizmet vermektedir. Nöbet süresi genellikle sabah 09:00'dan ertesi sabah 09:00'a kadardır.`,
    },
    {
      question: `${ilName} nöbetçi eczane listesi ne zaman güncellenir?`,
      answer: `${ilName} ili nöbetçi eczane listesi, ${ilName} Eczacılar Odası'nın resmi sisteminden saatlik olarak otomatik güncellenmektedir. Sayfa her saat yeniden oluşturulmaktadır.`,
    },
    {
      question: `Nöbetçi eczane telefon numarasını nasıl öğrenebilirim?`,
      answer: `Yukarıdaki listede her eczanenin yanında telefon numarası yer almaktadır. Telefon numarasına tıklayarak doğrudan arama yapabilirsiniz.`,
    },
  ];
}

// ─── İLÇE içerikleri ─────────────────────────────────────────────────────────

/**
 * İlçe sayfası SEO metin blokları.
 */
export function districtSeoBlocks(
  ilceName: string,
  ilName: string,
  date: string,
  dateLong: string,
  count: number
): string[] {
  const countText =
    count > 0 ? `${count} eczane` : "eczaneler";

  return [
    `Bugün ${ilceName} ilçesinde nöbetçi olan eczaneleri aşağıda bulabilirsiniz. ${dateLong} tarihi itibarıyla ${ilName} ili ${ilceName} ilçesinde ${countText} nöbet tutmaktadır.`,

    `En yakın nöbetçi eczaneyi adres ve telefon bilgileri ile hızlıca öğrenebilirsiniz. Google Haritalar üzerinden yol tarifi alabilirsiniz.`,

    `${ilceName} nöbetçi eczane listesi, ${ilName} Eczacılar Odası'nın resmi kaynaklarından alınmaktadır. Liste saatlik olarak güncellenmektedir.`,
  ];
}

/**
 * İlçe sayfası SSS listesi.
 */
export function districtFaqs(
  ilceName: string,
  ilName: string,
  dateLong: string,
  count: number
): FaqItem[] {
  const countAnswer =
    count > 0
      ? `Evet, ${dateLong} tarihinde ${ilceName} ilçesinde ${count} eczane nöbet tutmaktadır.`
      : `${ilceName} ilçesi için güncel nöbet listesi hazırlanmaktadır.`;

  return [
    {
      question: `${ilceName}'de bugün nöbetçi eczane var mı?`,
      answer: `${countAnswer} Adres ve telefon bilgilerine sayfa üzerinden ulaşabilirsiniz.`,
    },
    {
      question: `${ilceName} ${ilName} nöbetçi eczane nereden öğrenilir?`,
      answer: `${ilName} ili ${ilceName} ilçesindeki nöbetçi eczane bilgileri bu sayfada günlük olarak yayınlanmaktadır. Eczane adı, adresi, telefon numarası ve harita bilgisi yer almaktadır.`,
    },
    {
      question: `Nöbetçi eczaneler kaçta kapanır?`,
      answer: `Nöbetçi eczaneler 24 saat hizmet vermektedir. Nöbet süresi genellikle sabah 09:00'dan ertesi sabah 09:00'a kadardır.`,
    },
    {
      question: `${ilceName} nöbetçi eczane telefon numarası nedir?`,
      answer: `${ilceName} ilçesindeki nöbetçi eczanelerin telefon numaraları yukarıdaki listede yer almaktadır. Numaraya tıklayarak doğrudan arayabilirsiniz.`,
    },
  ];
}
