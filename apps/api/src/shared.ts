import { DateTime } from "luxon";

export interface ProvinceDto {
  code: string;
  name: string;
  slug: string;
}

export interface DutyRecordDto {
  eczane_adi: string;
  il: string;
  ilce: string;
  adres: string;
  telefon: string;
  nobet_saatleri?: string | null;
  lat: number | null;
  lng: number | null;
  kaynak: string;
  kaynak_url: string;
  son_guncelleme: string;
  dogruluk_puani: number;
  dogrulama_kaynagi_sayisi: number;
  is_degraded: boolean;
}

const ISTANBUL_TZ = "Europe/Istanbul";

export function resolveActiveDutyWindow(now = DateTime.now().setZone(ISTANBUL_TZ)) {
  const local = now.setZone(ISTANBUL_TZ);
  const dutyDate = local.toISODate();
  if (!dutyDate) {
    throw new Error("Cannot resolve dutyDate");
  }

  const start = DateTime.fromISO(`${dutyDate}T00:00:00`, { zone: ISTANBUL_TZ });
  const end = start.plus({ days: 1 }).set({
    hour: 0,
    minute: 0,
    second: 0,
    millisecond: 0
  });

  return {
    dutyDate,
    startIso: start.toISO() ?? "",
    endIso: end.toISO() ?? ""
  };
}

export function toSlug(value: string): string {
  return value
    .trim()
    .replace(/[İIı]/g, "i")
    .replace(/[Şş]/g, "s")
    .replace(/[Ğğ]/g, "g")
    .replace(/[Üü]/g, "u")
    .replace(/[Öö]/g, "o")
    .replace(/[Çç]/g, "c")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizePharmacyName(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFKD")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
