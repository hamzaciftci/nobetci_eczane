/**
 * JSON-LD Structured Data üreticileri — Local SEO odaklı
 *
 * Schema katmanları:
 *  1. pharmacySchema()        → MedicalBusiness + Pharmacy + LocalBusiness
 *  2. breadcrumbSchema()      → BreadcrumbList
 *  3. faqSchema()             → FAQPage (People Also Ask)
 *  4. websiteSchema()         → WebSite + SearchAction
 *  5. localBusinessSchema()   → Site geneli LocalBusiness (root layout'a eklenir)
 *  6. nearestPageSchema()     → /en-yakin için HealthAndBeautyBusiness aggregate
 */

import type { Pharmacy } from "./duty";

const SITE_URL  = "https://www.bugunnobetcieczaneler.com";
const SITE_NAME = "Bugün Nöbetçi Eczaneler";

// ─── Eczane şeması ─────────────────────────────────────────────────────────────

/**
 * Tek eczane için tam Local SEO şeması.
 *
 * @type   MedicalBusiness + Pharmacy + LocalBusiness
 * Sinyal  address, telephone, geo, hasMap, openingHours, areaServed
 */
export function pharmacySchema(p: Pharmacy) {
  const hasGeo = p.lat != null && p.lng != null;
  const mapsUrl = hasGeo
    ? `https://www.google.com/maps?q=${p.lat},${p.lng}`
    : `https://www.google.com/maps/search/${encodeURIComponent(
        `${p.eczane_adi} ${p.adres} ${p.il}`
      )}`;

  return {
    "@context": "https://schema.org",
    "@type": ["MedicalBusiness", "Pharmacy", "LocalBusiness"],
    name: p.eczane_adi,
    // ── Adres ────────────────────────────────────────────────────────────────
    address: {
      "@type": "PostalAddress",
      streetAddress: p.adres,
      addressLocality: p.ilce,
      addressRegion: p.il,
      addressCountry: "TR",
    },
    // ── İletişim ─────────────────────────────────────────────────────────────
    ...(p.telefon ? { telephone: p.telefon } : {}),
    // ── Konum (Local SEO sinyali) ─────────────────────────────────────────────
    ...(hasGeo
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: p.lat,
            longitude: p.lng,
          },
          hasMap: mapsUrl,
        }
      : {}),
    // ── Çalışma saatleri ─────────────────────────────────────────────────────
    openingHours: "Mo-Su 00:00-23:59",
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday", "Tuesday", "Wednesday",
        "Thursday", "Friday", "Saturday", "Sunday",
      ],
      opens: "00:00",
      closes: "23:59",
    },
    // ── Ek sınıflandırma ──────────────────────────────────────────────────────
    additionalType: "https://schema.org/EmergencyService",
    // ── Hizmet bölgesi ────────────────────────────────────────────────────────
    areaServed: {
      "@type": "AdministrativeArea",
      name: p.ilce ? `${p.ilce}, ${p.il}` : p.il,
    },
    // ── Dil ──────────────────────────────────────────────────────────────────
    inLanguage: "tr",
  };
}

// ─── Breadcrumb şeması ────────────────────────────────────────────────────────

export function breadcrumbSchema(items: { name: string; href: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.href}`,
    })),
  };
}

// ─── FAQ şeması ───────────────────────────────────────────────────────────────

export function faqSchema(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(({ question, answer }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}

// ─── WebSite şeması ───────────────────────────────────────────────────────────

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: "Türkiye'nin 81 ilinde resmi kaynaklardan alınan güncel nöbetçi eczane bilgisi.",
    inLanguage: "tr",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/nobetci-eczane/{il_slug}`,
      },
      "query-input": "required name=il_slug",
    },
  };
}

// ─── Site geneli LocalBusiness şeması ────────────────────────────────────────

/**
 * Root layout'a eklenir — sitenin kendisi Türkiye çapında bir LocalBusiness.
 * "yakınımdaki nöbetçi eczane" sorgularında brand authority sağlar.
 */
export function localBusinessSchema() {
  return {
    "@context": "https://schema.org",
    "@type": ["LocalBusiness", "HealthAndBeautyBusiness"],
    name: SITE_NAME,
    description: "Türkiye'nin 81 ilinde güncel nöbetçi eczane rehberi. Adres, telefon ve harita bilgileri.",
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.svg`,
    // ── Hizmet bölgesi ────────────────────────────────────────────────────
    areaServed: {
      "@type": "Country",
      name: "Turkey",
      "@id": "https://www.wikidata.org/wiki/Q43",
    },
    // ── Çalışma saatleri (7/24 dijital hizmet) ───────────────────────────
    openingHours: "Mo-Su 00:00-23:59",
    // ── Dil ve bölge ──────────────────────────────────────────────────────
    inLanguage: "tr",
    // ── sameAs: varsa sosyal medya / Wikipedia linkleri ───────────────────
    sameAs: [SITE_URL],
  };
}

// ─── /en-yakin sayfası şeması ─────────────────────────────────────────────────

/**
 * "yakınımdaki nöbetçi eczane" ve "en yakın nöbetçi eczane" sorgularını hedefler.
 * SpecialAnnouncement Google'ın sağlık kategori sonuçlarında görünür.
 */
export function nearestPageSchema() {
  return {
    "@context": "https://schema.org",
    "@type": ["WebPage", "MedicalWebPage"],
    name: "En Yakın Nöbetçi Eczane",
    description:
      "Konumunuza en yakın nöbetçi eczaneleri GPS ile otomatik bulun. Yakınımdaki nöbetçi eczane listesi.",
    url: `${SITE_URL}/en-yakin`,
    inLanguage: "tr",
    specialty: "Pharmacy",
    audience: {
      "@type": "MedicalAudience",
      audienceType: "Patient",
    },
  };
}
