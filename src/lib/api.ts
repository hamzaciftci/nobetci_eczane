import { City, District, IngestionAlert, IngestionOverview, Pharmacy, ReportFormData, SourceInfo } from "@/types/pharmacy";
import { toSlug } from "./slug";

type DutyRecordDto = {
  eczane_adi: string;
  il: string;
  ilce: string;
  adres: string;
  telefon: string;
  lat: number | null;
  lng: number | null;
  kaynak: string;
  kaynak_url: string;
  son_guncelleme: string;
  dogruluk_puani: number;
  dogrulama_kaynagi_sayisi: number;
  is_degraded: boolean;
};

type DutyResponseDto = {
  status: "ok" | "degraded";
  duty_date: string | null;
  son_guncelleme: string | null;
  degraded_info: {
    last_successful_update: string | null;
    stale_minutes: number | null;
    recent_alert: string | null;
    hint: string;
  } | null;
  data: DutyRecordDto[];
};

type NearestResponseDto = {
  status: "ok" | "degraded";
  data: Array<
    Omit<DutyRecordDto, "is_degraded"> & {
      distance_km: number;
    }
  >;
};

type ProvinceDto = {
  code: string;
  name: string;
  slug: string;
};

type ResolveAlertResponse = {
  resolved: boolean;
  id: number;
};

const POPULAR_CITY_SLUGS = new Set(["istanbul", "ankara", "izmir", "antalya", "bursa", "gaziantep", "adana"]);
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/$/, "");

export type DutyPayload = {
  status: "ok" | "degraded";
  duty_date: string | null;
  son_guncelleme: string | null;
  degraded_info: DutyResponseDto["degraded_info"];
  data: Pharmacy[];
};

export async function fetchCities(): Promise<City[]> {
  const rows = await requestJson<ProvinceDto[]>("/api/iller");
  return rows.map((row) => ({
    code: row.code,
    slug: row.slug,
    name: row.name,
    popular: POPULAR_CITY_SLUGS.has(row.slug)
  }));
}

export async function fetchDutyByProvince(il: string): Promise<DutyPayload> {
  const payload = await requestJson<DutyResponseDto>(`/api/il/${encodeURIComponent(il)}/nobetci`);
  return mapDutyPayload(payload);
}

export async function fetchDutyByDistrict(il: string, ilce: string): Promise<DutyPayload> {
  const payload = await requestJson<DutyResponseDto>(`/api/il/${encodeURIComponent(il)}/${encodeURIComponent(ilce)}/nobetci`);
  return mapDutyPayload(payload);
}

export async function fetchNearest(lat: number, lng: number): Promise<Pharmacy[]> {
  const payload = await requestJson<NearestResponseDto>(
    `/api/nearest?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`
  );
  return payload.data.map((item, index) =>
    mapDutyRecord(
      {
        ...item,
        is_degraded: false
      },
      index,
      item.distance_km
    )
  );
}

export async function postCorrectionReport(payload: ReportFormData) {
  return requestJson<{ id: string; status: string }>("/api/yanlis-bilgi", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function fetchAdminOverview(adminToken?: string): Promise<IngestionOverview[]> {
  return requestJson<IngestionOverview[]>("/api/admin/ingestion/overview", {
    headers: resolveAdminHeaders(adminToken)
  });
}

export async function fetchAdminOpenAlerts(adminToken?: string): Promise<IngestionAlert[]> {
  return requestJson<IngestionAlert[]>("/api/admin/ingestion/alerts/open", {
    headers: resolveAdminHeaders(adminToken)
  });
}

export async function resolveAdminAlert(alertId: number, adminToken?: string) {
  return requestJson<ResolveAlertResponse>(`/api/admin/ingestion/alerts/${alertId}/resolve`, {
    method: "POST",
    headers: resolveAdminHeaders(adminToken),
    body: JSON.stringify({
      resolved_by: "web-admin"
    })
  });
}

export async function triggerAdminRecovery(ilSlug: string, adminToken?: string) {
  return requestJson<{ queued?: boolean; jobId?: string }>(`/api/admin/ingestion/recovery/${encodeURIComponent(ilSlug)}/trigger`, {
    method: "POST",
    headers: resolveAdminHeaders(adminToken)
  });
}

export function buildSourceInfo(payload: DutyPayload): SourceInfo {
  const latestRecord = payload.data[0] ?? null;
  const verificationCount = payload.data.length
    ? Math.max(...payload.data.map((item) => item.verificationCount))
    : 0;

  return {
    name: latestRecord?.source ?? "Bilinmiyor",
    url: latestRecord?.sourceUrl ?? null,
    lastUpdated: payload.son_guncelleme ?? latestRecord?.lastUpdated ?? new Date().toISOString(),
    verificationCount,
    status: payload.status === "degraded" ? "degraded" : "normal",
    lastSuccessfulUpdate: payload.degraded_info?.last_successful_update ?? undefined,
    staleMinutes: payload.degraded_info?.stale_minutes ?? null,
    recentAlert: payload.degraded_info?.recent_alert ?? null,
    hint: payload.degraded_info?.hint ?? null
  };
}

export function extractDistricts(pharmacies: Pharmacy[]): District[] {
  const map = new Map<string, District>();
  for (const pharmacy of pharmacies) {
    const slug = toSlug(pharmacy.district);
    if (!map.has(slug)) {
      map.set(slug, {
        slug,
        name: pharmacy.district
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "tr-TR"));
}

function mapDutyPayload(payload: DutyResponseDto): DutyPayload {
  return {
    status: payload.status,
    duty_date: payload.duty_date ?? null,
    son_guncelleme: payload.son_guncelleme,
    degraded_info: payload.degraded_info,
    data: payload.data.map((row, index) => mapDutyRecord(row, index))
  };
}

function mapDutyRecord(record: DutyRecordDto, index: number, distanceKm?: number): Pharmacy {
  return {
    id: `${toSlug(record.il)}-${toSlug(record.ilce)}-${toSlug(record.eczane_adi)}-${index}`,
    name: record.eczane_adi,
    address: record.adres,
    phone: record.telefon,
    city: record.il,
    district: record.ilce,
    lat: record.lat ?? null,
    lng: record.lng ?? null,
    source: record.kaynak,
    sourceUrl: record.kaynak_url || null,
    lastUpdated: record.son_guncelleme,
    verificationCount: record.dogrulama_kaynagi_sayisi,
    accuracyScore: record.dogruluk_puani,
    isDegraded: Boolean(record.is_degraded),
    distance: distanceKm
  };
}

function resolveAdminHeaders(adminToken?: string): HeadersInit {
  const envToken = (import.meta.env.VITE_ADMIN_API_TOKEN ?? "").trim();
  const token = (adminToken ?? envToken).trim();
  return token ? { "Authorization": `Bearer ${token}` } : {};
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(resolveUrl(path), {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const details = await safeText(response);
    throw new Error(`${response.status} ${response.statusText}${details ? ` - ${details}` : ""}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function resolveUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (!API_BASE_URL) {
    return path;
  }

  return `${API_BASE_URL}${path}`;
}

async function safeText(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.trim().slice(0, 240);
  } catch {
    return "";
  }
}

