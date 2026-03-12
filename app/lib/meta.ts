/**
 * Next.js Metadata API için dinamik meta üretici.
 * Her sayfa için title + description + OpenGraph + canonical URL üretir.
 */

import type { Metadata } from "next";
import { getToday } from "./date";
import { getProvinceName } from "./provinces";

const SITE_NAME = "Bugün Nöbetçi Eczaneler";
const SITE_URL = "https://www.bugunnobetcieczaneler.com";

/** Ana sayfa metadata. */
export function homeMeta(): Metadata {
  const { ddmmyyyy, long } = getToday();
  const title = `${ddmmyyyy} Nöbetçi Eczane – Bugün Türkiye Nöbetçi Eczane Listesi`;
  const description = `${long} tarihinde Türkiye'nin 81 ilinde nöbetçi olan eczanelerin güncel listesi. Adres, telefon ve harita bilgileri ile en yakın nöbetçi eczaneyi hemen bulun.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: SITE_URL,
      siteName: SITE_NAME,
      locale: "tr_TR",
      type: "website",
    },
    alternates: { canonical: SITE_URL },
  };
}

/** İl sayfası metadata. */
export function cityMeta(ilSlug: string): Metadata {
  const { ddmmyyyy, long } = getToday();
  const ilName = getProvinceName(ilSlug);
  const title = `${ddmmyyyy} ${ilName} Nöbetçi Eczaneler – Bugün Açık Eczaneler`;
  const description = `${long} tarihinde ${ilName} ilinde nöbetçi olan eczanelerin güncel listesi. Adres, telefon ve harita bilgileri ile en yakın nöbetçi eczaneyi hemen bulun.`;
  const url = `${SITE_URL}/nobetci-eczane/${ilSlug}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: "tr_TR",
      type: "website",
    },
    alternates: { canonical: url },
  };
}

/** İlçe sayfası metadata. */
export function districtMeta(ilSlug: string, ilceName: string): Metadata {
  const { ddmmyyyy, long } = getToday();
  const ilName = getProvinceName(ilSlug);
  // İlçe adını başlık case'e getir (API'dan gelen tam ad)
  const ilceTitle = ilceName
    ? ilceName.charAt(0).toUpperCase() + ilceName.slice(1).toLowerCase()
    : ilSlug;

  const title = `${ddmmyyyy} ${ilceTitle} ${ilName} Nöbetçi Eczaneler – Bugün Açık Eczane Listesi`;
  const description = `${long} tarihinde ${ilName} ili ${ilceTitle} ilçesinde nöbetçi olan eczanelerin güncel listesi. Adres ve telefon bilgileri.`;
  const url = `${SITE_URL}/nobetci-eczane/${ilSlug}/${ilceName.toLowerCase().replace(/\s+/g, "-")}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: "tr_TR",
      type: "website",
    },
    alternates: { canonical: url },
  };
}
