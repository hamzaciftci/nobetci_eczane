/**
 * Dinamik SEO metadata sistemi — Next.js Metadata API
 *
 * KURAL SETİ
 * ─────────────────────────────────────────────────────
 *  • Title   ≤ 60 karakter  (SERP truncation'ı önler)
 *  • Desc    ≤ 160 karakter
 *  • Her sayfa benzersiz: tarih prefixi (DD.MM.YYYY) günlük rotasyonu sağlar
 *  • Slug bazlı canonical URL → duplicate content riski sıfır
 *
 * TITLE FALLBACK KASKADI
 * ─────────────────────────────────────────────────────
 *  İl sayfaları (3 seviye):
 *   L1: "{date} {İl} Nöbetçi Eczaneler – Bugün Açık Eczaneler"   (≤60)
 *   L2: "{date} {İl} Nöbetçi Eczaneler – Bugün Açık"             (≤60)
 *   L3: "{date} {İl} Nöbetçi Eczaneler"                          (her zaman ≤60)
 *
 *  İlçe sayfaları (4 seviye):
 *   L1: "{date} {İlçe} {İl} Nöbetçi Eczaneler – En Yakın Nöbetçi Eczane" (≤60)
 *   L2: "{date} {İlçe} {İl} Nöbetçi Eczaneler"                            (≤60)
 *   L3: "{date} {İlçe} Nöbetçi Eczaneler – En Yakın Nöbetçi Eczane"       (≤60)
 *   L4: "{date} {İlçe} Nöbetçi Eczaneler"                                  (her zaman ≤60)
 */

import type { Metadata } from "next";
import { getToday } from "./date";
import { getProvinceName } from "./provinces";

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const SITE_NAME = "Bugün Nöbetçi Eczaneler";
const SITE_URL  = "https://www.bugunnobetcieczaneler.com";

/** Google SERP karakter limitleri */
const TITLE_MAX = 60;
const DESC_MAX  = 160;

// ─── Yardımcı fonksiyonlar ────────────────────────────────────────────────────

/**
 * Verilen string'i max karakter sayısına sığdırır.
 * Türkçe karakterler doğru sayılır (JS string.length = code unit, BMP için güvenli).
 */
function cap(str: string, max: number): string {
  if (str.length <= max) return str;
  // Kelime sınırında kes
  const cut = str.slice(0, max - 1).replace(/\s+\S*$/, "");
  return cut + "…";
}

/**
 * İlk uygun seçeneği (≤ max char) döner.
 * Hiçbiri uymuyorsa son seçeneği kısaltarak döner.
 */
function firstFit(candidates: string[], max: number): string {
  for (const c of candidates) {
    if (c.length <= max) return c;
  }
  return cap(candidates[candidates.length - 1], max);
}

/** İlçe adını normalize eder (API'dan gelen büyük harf → Title Case). */
function normalizeIlceName(raw: string): string {
  if (!raw) return raw;
  // Türkçe Title Case: her kelimenin ilk harfi büyük (tr-TR locale ile)
  return raw
    .toLocaleLowerCase("tr-TR")
    .replace(/(?:^|\s)\S/g, (c) => c.toLocaleUpperCase("tr-TR"));
}

// ─── Meta üreticiler ──────────────────────────────────────────────────────────

/** Ana sayfa — sabit + günlük tarih. */
export function homeMeta(): Metadata {
  const { ddmmyyyy, long } = getToday();

  const title = firstFit(
    [
      `${ddmmyyyy} Nöbetçi Eczane – Türkiye Güncel Listesi`,
      `${ddmmyyyy} Nöbetçi Eczane Listesi`,
    ],
    TITLE_MAX
  );

  const desc = cap(
    `${long} tarihinde Türkiye'nin 81 ilinde nöbetçi eczanelerin güncel listesi. Telefon, adres ve harita bilgileri ile en yakın nöbetçi eczaneyi hemen bulun.`,
    DESC_MAX
  );

  return buildMeta(title, desc, SITE_URL);
}

/**
 * İl (şehir) sayfası metadata.
 * Günlük otomatik güncellenir — tarih prefixi benzersizlik garantisi verir.
 */
export function cityMeta(ilSlug: string): Metadata {
  const { ddmmyyyy, long } = getToday();
  const ilName = getProvinceName(ilSlug);

  // Kaskad: L1 → L2 → L3
  const title = firstFit(
    [
      `${ddmmyyyy} ${ilName} Nöbetçi Eczaneler – Bugün Açık Eczaneler`,  // L1
      `${ddmmyyyy} ${ilName} Nöbetçi Eczaneler – Bugün Açık`,             // L2
      `${ddmmyyyy} ${ilName} Nöbetçi Eczaneler`,                          // L3
    ],
    TITLE_MAX
  );

  const desc = cap(
    `${long} tarihinde ${ilName} ilinde nöbetçi olan eczanelerin güncel listesi. Telefon, adres ve harita bilgileri ile en yakın nöbetçi eczaneyi hemen bulun.`,
    DESC_MAX
  );

  const url = `${SITE_URL}/nobetci-eczane/${ilSlug}`;
  return buildMeta(title, desc, url);
}

/**
 * İlçe sayfası metadata.
 * İlçe adı API'dan gelir (Türkçe tam ad, örn. "Düziçi").
 */
export function districtMeta(ilSlug: string, ilceSlug: string, ilceNameRaw: string): Metadata {
  const { ddmmyyyy, long } = getToday();
  const ilName   = getProvinceName(ilSlug);
  const ilceName = normalizeIlceName(ilceNameRaw) || ilceSlug;

  // Kaskad: L1 → L2 → L3 → L4
  const title = firstFit(
    [
      `${ddmmyyyy} ${ilceName} ${ilName} Nöbetçi Eczaneler – En Yakın Nöbetçi Eczane`, // L1
      `${ddmmyyyy} ${ilceName} ${ilName} Nöbetçi Eczaneler`,                            // L2
      `${ddmmyyyy} ${ilceName} Nöbetçi Eczaneler – En Yakın Nöbetçi Eczane`,            // L3
      `${ddmmyyyy} ${ilceName} Nöbetçi Eczaneler`,                                      // L4
    ],
    TITLE_MAX
  );

  const desc = cap(
    `${long} tarihinde ${ilceName} ${ilName} bölgesinde açık olan nöbetçi eczaneleri listeledik. Adres, telefon ve konum bilgileri.`,
    DESC_MAX
  );

  const url = `${SITE_URL}/nobetci-eczane/${ilSlug}/${ilceSlug}`;
  return buildMeta(title, desc, url);
}

// ─── İç yardımcı ──────────────────────────────────────────────────────────────

function buildMeta(title: string, description: string, url: string): Metadata {
  return {
    // `absolute` → layout template'ini bypass et, tam title kullan
    title: { absolute: title },
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: "tr_TR",
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
    alternates: { canonical: url },
  };
}

// ─── Geliştirici araçları ─────────────────────────────────────────────────────

/**
 * Tüm il slug'ları için title uzunluklarını döner.
 * Geliştirme ortamında `node -e "require('./app/lib/meta').auditTitleLengths()"` ile çalıştır.
 */
export function auditTitleLengths(provinceSlugs: string[]): {
  slug: string;
  title: string;
  length: number;
  ok: boolean;
}[] {
  return provinceSlugs.map((slug) => {
    const meta = cityMeta(slug);
    const title = typeof meta.title === "string" ? meta.title : "";
    return {
      slug,
      title,
      length: title.length,
      ok: title.length <= TITLE_MAX,
    };
  });
}
