import { SourceEndpointConfig } from "./types";

export function getDefaultEndpoints(provinceSlug: string): SourceEndpointConfig[] {
  if (provinceSlug === "adana") {
    return [
      {
        sourceEndpointId: -101,
        sourceId: -11,
        provinceSlug,
        sourceName: "Adana Il Saglik Mudurlugu",
        sourceType: "health_directorate",
        authorityWeight: 90,
        endpointUrl: "https://nobetcieczane.adanasm.gov.tr/",
        format: "html_js",
        parserKey: "adana_primary_v1",
        isPrimary: true
      },
      {
        sourceEndpointId: -102,
        sourceId: -12,
        provinceSlug,
        sourceName: "Adana Eczaci Odasi",
        sourceType: "pharmacists_chamber",
        authorityWeight: 80,
        endpointUrl: "https://www.adanaeo.org.tr/nobetci-eczaneler",
        format: "html",
        parserKey: "adana_secondary_v1",
        isPrimary: false
      }
    ];
  }

  if (provinceSlug === "istanbul") {
    return [
      {
        sourceEndpointId: -201,
        sourceId: -21,
        provinceSlug,
        sourceName: "Istanbul Il Saglik Mudurlugu",
        sourceType: "health_directorate",
        authorityWeight: 90,
        endpointUrl: "https://istanbulism.saglik.gov.tr/TR-108128/nobetci-eczane.html",
        format: "html",
        parserKey: "istanbul_primary_v1",
        isPrimary: true
      },
      {
        sourceEndpointId: -202,
        sourceId: -22,
        provinceSlug,
        sourceName: "Istanbul Eczaci Odasi",
        sourceType: "pharmacists_chamber",
        authorityWeight: 80,
        endpointUrl: "https://www.istanbuleczaciodasi.org.tr/nobetci-eczane/",
        format: "html",
        parserKey: "istanbul_secondary_v1",
        isPrimary: false
      }
    ];
  }

  if (provinceSlug === "osmaniye") {
    return [
      {
        sourceEndpointId: -301,
        sourceId: -31,
        provinceSlug,
        sourceName: "Osmaniye Eczaci Odasi",
        sourceType: "pharmacists_chamber",
        authorityWeight: 90,
        endpointUrl: "https://www.osmaniyeeczaciodasi.org.tr/nobetci-eczaneler",
        format: "html",
        parserKey: "osmaniye_eo_v1",
        isPrimary: true
      }
    ];
  }

  return [];
}
