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
  return response.json();
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
  return response.json();
}
