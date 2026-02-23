export interface Pharmacy {
  id: string;
  name: string;
  address: string;
  addressDetail?: string; // optional detail line (e.g. landmark)
  phone: string;
  city: string;
  district: string;
  lat: number | null;
  lng: number | null;
  source: string;
  sourceUrl: string | null;
  lastUpdated: string;
  verificationCount: number;
  accuracyScore: number;
  isDegraded?: boolean;
  distance?: number; // km, for nearest results
}

export interface City {
  code?: string;
  slug: string;
  name: string;
  districts?: District[];
  popular?: boolean;
}

export interface District {
  slug: string;
  name: string;
}

export interface ReportFormData {
  il: string;
  ilce?: string;
  eczane_adi: string;
  sorun_turu: "telefon_yanlis" | "adres_yanlis" | "nobette_degil" | "kapali" | "diger";
  not?: string;
  iletisim_izni: boolean;
}

export interface SourceInfo {
  name: string;
  url: string | null;
  lastUpdated: string;
  verificationCount: number;
  status: "normal" | "degraded";
  staleMinutes?: number | null;
  recentAlert?: string | null;
  hint?: string | null;
  lastSuccessfulUpdate?: string;
}

export interface IngestionOverview {
  il: string;
  success_count: number;
  failed_count: number;
  partial_count: number;
  last_run_at: string | null;
  alert_count: number;
}

export interface IngestionAlert {
  id: number;
  il: string;
  source_endpoint_id: number | null;
  alert_type: string;
  severity: string;
  message: string;
  payload?: Record<string, unknown> | null;
  created_at: string;
}
