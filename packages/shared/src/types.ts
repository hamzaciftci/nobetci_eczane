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
  lat: number | null;
  lng: number | null;
  kaynak: string;
  kaynak_url: string;
  son_guncelleme: string;
  dogruluk_puani: number;
  dogrulama_kaynagi_sayisi: number;
  is_degraded: boolean;
}

export interface CorrectionReportDto {
  il: string;
  ilce?: string;
  eczane_adi: string;
  sorun_turu: "telefon_yanlis" | "adres_yanlis" | "nobette_degil" | "kapali" | "diger";
  not?: string;
  iletisim_izni: boolean;
}
