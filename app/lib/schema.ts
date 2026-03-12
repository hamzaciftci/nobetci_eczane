/**
 * JSON-LD Structured Data üreticileri.
 * Google'ın MedicalBusiness, Pharmacy ve BreadcrumbList şemalarını üretir.
 */

import type { Pharmacy } from "./duty";

const SITE_URL = "https://www.bugunnobetcieczaneler.com";

/** Tek bir eczane için MedicalBusiness + Pharmacy şeması. */
export function pharmacySchema(p: Pharmacy) {
  return {
    "@context": "https://schema.org",
    "@type": ["MedicalBusiness", "Pharmacy"],
    name: p.eczane_adi,
    address: {
      "@type": "PostalAddress",
      streetAddress: p.adres,
      addressLocality: p.ilce,
      addressRegion: p.il,
      addressCountry: "TR",
    },
    telephone: p.telefon || undefined,
    ...(p.lat != null && p.lng != null
      ? { geo: { "@type": "GeoCoordinates", latitude: p.lat, longitude: p.lng } }
      : {}),
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday", "Tuesday", "Wednesday", "Thursday",
        "Friday", "Saturday", "Sunday",
      ],
      opens: "00:00",
      closes: "23:59",
    },
    additionalType: "https://schema.org/EmergencyService",
  };
}

/** Breadcrumb şeması. */
export function breadcrumbSchema(
  items: { name: string; href: string }[]
) {
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

/** WebSite şeması — ana sayfada kullanılır. */
export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Bugün Nöbetçi Eczaneler",
    url: SITE_URL,
    description:
      "Türkiye'nin 81 ilinde resmi kaynaklardan alınan güncel nöbetçi eczane bilgisi.",
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
