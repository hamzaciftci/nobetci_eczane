export interface SourceMeta {
  sourceName: string;
  sourceType: "health_directorate" | "pharmacists_chamber" | "official_integration" | "manual";
  sourceUrl: string;
  authorityWeight: number;
  sourceEndpointId?: number;
  parserKey?: string;
}

export interface SourceRecord {
  provinceSlug: string;
  districtName: string;
  districtSlug: string;
  pharmacyName: string;
  normalizedName: string;
  address: string;
  phone: string;
  lat: number | null;
  lng: number | null;
  dutyDate: string;
  fetchedAt: string;
}

export interface SourceBatch {
  source: SourceMeta;
  records: SourceRecord[];
}

export interface EvidenceItem {
  sourceName: string;
  sourceUrl: string;
  sourceType: SourceMeta["sourceType"];
  authorityWeight: number;
  fetchedAt: string;
}

export interface VerifiedRecord {
  provinceSlug: string;
  districtName: string;
  districtSlug: string;
  pharmacyName: string;
  normalizedName: string;
  address: string;
  phone: string;
  lat: number | null;
  lng: number | null;
  dutyDate: string;
  confidenceScore: number;
  verificationSourceCount: number;
  isDegraded: boolean;
  evidence: EvidenceItem[];
}

export interface ConflictItem {
  provinceSlug: string;
  districtSlug: string;
  dutyDate: string;
  reason: string;
  payload: unknown;
}

export type SourceFormat = "html" | "html_table" | "html_js" | "pdf" | "image" | "api";

export interface SourceEndpointConfig {
  sourceEndpointId: number;
  sourceId: number;
  provinceSlug: string;
  sourceName: string;
  sourceType: SourceMeta["sourceType"];
  authorityWeight: number;
  endpointUrl: string;
  format: SourceFormat;
  parserKey: string;
  isPrimary: boolean;
}

export interface AdapterFetchResult {
  batch: SourceBatch;
  httpStatus?: number;
  etag?: string | null;
  lastModified?: string | null;
  rawPayload?: string;
  dateValidation?: {
    expectedDate: string;
    acceptedDates: string[];
    scrapedDate: string | null;
    status: "valid" | "missing" | "outdated";
    isValid: boolean;
    strict: boolean;
    source: string;
  };
  fetchUrl?: string;
}
