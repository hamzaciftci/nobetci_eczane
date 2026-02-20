import { normalizePharmacyName, resolveActiveDutyWindow } from "@nobetci/shared";
import { SourceAdapter } from "./adapter.interface";
import { AdapterFetchResult, SourceBatch, SourceEndpointConfig } from "../core/types";

export class StaticFallbackAdapter implements SourceAdapter {
  supports(): boolean {
    return true;
  }

  async fetch(endpoint: SourceEndpointConfig): Promise<AdapterFetchResult> {
    const { dutyDate } = resolveActiveDutyWindow();
    const fetchedAt = new Date().toISOString();
    const rows = fallbackRows(endpoint.provinceSlug);

    const batch: SourceBatch = {
      source: {
        sourceName: `${endpoint.sourceName} (fallback)`,
        sourceType: endpoint.sourceType,
        sourceUrl: endpoint.endpointUrl,
        authorityWeight: Math.max(endpoint.authorityWeight - 20, 25),
        sourceEndpointId: endpoint.sourceEndpointId,
        parserKey: "static_fallback"
      },
      records: rows.map((row) => ({
        provinceSlug: endpoint.provinceSlug,
        districtName: row.districtName,
        districtSlug: row.districtSlug,
        pharmacyName: row.pharmacyName,
        normalizedName: normalizePharmacyName(row.pharmacyName),
        address: row.address,
        phone: row.phone,
        lat: row.lat,
        lng: row.lng,
        dutyDate,
        fetchedAt
      }))
    };

    return {
      batch,
      rawPayload: JSON.stringify({ fallback: true, province: endpoint.provinceSlug, count: rows.length }),
      httpStatus: 200
    };
  }
}

function fallbackRows(provinceSlug: string) {
  if (provinceSlug === "istanbul") {
    return [
      {
        districtName: "Kadikoy",
        districtSlug: "kadikoy",
        pharmacyName: "Moda Eczanesi",
        address: "Caferaga Mah. Moda Cad. No:12",
        phone: "02163445566",
        lat: 40.9882,
        lng: 29.0306
      }
    ];
  }

  if (provinceSlug === "ankara") {
    return [
      {
        districtName: "Cankaya",
        districtSlug: "cankaya",
        pharmacyName: "Kizilay Eczanesi",
        address: "Kizilay Mah. Ataturk Blv. No:101",
        phone: "03124112233",
        lat: 39.9208,
        lng: 32.8541
      }
    ];
  }

  return [
    {
      districtName: "Konak",
      districtSlug: "konak",
      pharmacyName: "Alsancak Eczanesi",
      address: "Alsancak Mah. Kibris Sehitleri Cad. No:20",
      phone: "02324667788",
      lat: 38.4348,
      lng: 27.1455
    }
  ];
}
