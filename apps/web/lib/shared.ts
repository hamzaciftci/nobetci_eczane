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
