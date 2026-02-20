import type { DutyRecordDto, ProvinceDto } from "./shared";
import { publicEnv } from "./env";

const API_BASE_URL = publicEnv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:4000");

interface DutyResponse {
  status: "ok" | "degraded";
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
  const response = await fetch(`${API_BASE_URL}/api/il/${encodeURIComponent(ilSlug)}/nobetci`, {
    next: { revalidate: 120, tags: [`duty:${ilSlug}`] }
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch duty by province: ${response.status}`);
  }
  return response.json();
}

export async function fetchDutyByDistrict(ilSlug: string, ilceSlug: string): Promise<DutyResponse> {
  const response = await fetch(
    `${API_BASE_URL}/api/il/${encodeURIComponent(ilSlug)}/${encodeURIComponent(ilceSlug)}/nobetci`,
    {
      next: { revalidate: 120, tags: [`duty:${ilSlug}:${ilceSlug}`] }
    }
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch duty by district: ${response.status}`);
  }
  return response.json();
}
