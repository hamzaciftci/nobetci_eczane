import type { DutyRecordDto, ProvinceDto } from "./shared";
import { publicEnv } from "./env";

const API_BASE_URL = publicEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:4000");

interface DutyResponse {
  status: "ok" | "degraded";
  duty_date: string;
  available_dates: string[];
  son_guncelleme: string | null;
  degraded_info: {
    last_successful_update: string | null;
    stale_minutes: number | null;
    recent_alert: string | null;
    hint: string;
  } | null;
  data: DutyRecordDto[];
}

type RawDutyResponse = Partial<DutyResponse> & {
  data?: unknown;
  degraded_info?: unknown;
};

export async function fetchProvinces(): Promise<ProvinceDto[]> {
  const response = await fetch(`${API_BASE_URL}/api/iller`, {
    next: { revalidate: 86400, tags: ["provinces"] }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch provinces: ${response.status}`);
  }
  return response.json();
}

export async function fetchDutyByProvince(ilSlug: string): Promise<DutyResponse> {
  return fetchDutyByProvinceDate(ilSlug);
}

export async function fetchDutyByProvinceDate(ilSlug: string, dutyDate?: string): Promise<DutyResponse> {
  const query = dutyDate ? `?date=${encodeURIComponent(dutyDate)}` : "";
  const response = await fetch(`${API_BASE_URL}/api/il/${encodeURIComponent(ilSlug)}/nobetci${query}`, {
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch duty by province: ${response.status}`);
  }
  const raw = (await response.json()) as RawDutyResponse;
  return normalizeDutyResponse(raw, dutyDate);
}

export async function fetchDutyByDistrict(ilSlug: string, ilceSlug: string): Promise<DutyResponse> {
  return fetchDutyByDistrictDate(ilSlug, ilceSlug);
}

export async function fetchDutyByDistrictDate(
  ilSlug: string,
  ilceSlug: string,
  dutyDate?: string
): Promise<DutyResponse> {
  const query = dutyDate ? `?date=${encodeURIComponent(dutyDate)}` : "";
  const response = await fetch(
    `${API_BASE_URL}/api/il/${encodeURIComponent(ilSlug)}/${encodeURIComponent(ilceSlug)}/nobetci${query}`,
    {
      cache: "no-store"
    }
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch duty by district: ${response.status}`);
  }
  const raw = (await response.json()) as RawDutyResponse;
  return normalizeDutyResponse(raw, dutyDate);
}

function normalizeDutyResponse(raw: RawDutyResponse, requestedDate?: string): DutyResponse {
  const fallbackDate = isIsoDate(requestedDate) ? requestedDate : resolveIstanbulDate();
  const dutyDate = isIsoDate(raw.duty_date) ? raw.duty_date : fallbackDate;
  const availableDates = Array.isArray(raw.available_dates)
    ? raw.available_dates.filter((item): item is string => isIsoDate(item))
    : [];

  if (!availableDates.includes(dutyDate)) {
    availableDates.push(dutyDate);
  }

  return {
    status: raw.status === "degraded" ? "degraded" : "ok",
    duty_date: dutyDate,
    available_dates: availableDates.sort(),
    son_guncelleme: typeof raw.son_guncelleme === "string" ? raw.son_guncelleme : null,
    degraded_info: normalizeDegradedInfo(raw.degraded_info),
    data: Array.isArray(raw.data) ? (raw.data as DutyRecordDto[]) : []
  };
}

function normalizeDegradedInfo(value: unknown): DutyResponse["degraded_info"] {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  return {
    last_successful_update:
      typeof raw.last_successful_update === "string" ? raw.last_successful_update : null,
    stale_minutes: typeof raw.stale_minutes === "number" ? raw.stale_minutes : null,
    recent_alert: typeof raw.recent_alert === "string" ? raw.recent_alert : null,
    hint:
      typeof raw.hint === "string" && raw.hint.trim().length
        ? raw.hint
        : "Kaynaklar yenileniyor. Biraz sonra tekrar kontrol edin."
  };
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function resolveIstanbulDate(): string {
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());

  return isIsoDate(formatted) ? formatted : new Date().toISOString().slice(0, 10);
}
