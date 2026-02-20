import { DutyRecordDto } from "@nobetci/shared";

export function pharmacyJsonLd(item: DutyRecordDto) {
  return {
    "@context": "https://schema.org",
    "@type": "Pharmacy",
    name: item.eczane_adi,
    telephone: item.telefon,
    address: {
      "@type": "PostalAddress",
      streetAddress: item.adres,
      addressLocality: item.ilce,
      addressRegion: item.il,
      addressCountry: "TR"
    },
    geo:
      item.lat !== null && item.lng !== null
        ? {
            "@type": "GeoCoordinates",
            latitude: item.lat,
            longitude: item.lng
          }
        : undefined,
    dateModified: item.son_guncelleme,
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "Kaynak",
        value: item.kaynak
      },
      {
        "@type": "PropertyValue",
        name: "Dogruluk Puani",
        value: item.dogruluk_puani
      }
    ]
  };
}
