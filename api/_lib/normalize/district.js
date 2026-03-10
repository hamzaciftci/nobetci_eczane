/**
 * District normalization + 4-seviyeli resolution.
 *
 * Seviyeler:
 *   1. Exact slug match
 *   2. Normalized text match (TR→ASCII lowercase)
 *   3. Alias lookup (bilinen alternatif yazımlar)
 *   4. Jaro-Winkler fuzzy match (eşik: 0.85, min 4 karakter)
 *   5. Merkez fallback (uyarı ile)
 *
 * @typedef {"exact"|"normalized"|"alias"|"fuzzy"|"fallback"|"none"} DistrictConfidence
 * @typedef {{ id: number|null, confidence: DistrictConfidence }} DistrictResolution
 */

import { slugify } from "../slug.js";
import { jaroWinkler } from "../matching/algorithms.js";

const TR_ASCII = { İ:"I",ı:"I",Ğ:"G",ğ:"G",Ş:"S",ş:"S",Ç:"C",ç:"C",Ö:"O",ö:"O",Ü:"U",ü:"U" };
const TR_RE = /[İıĞğŞşÇçÖöÜü]/g;

/**
 * İlçe adını normalize et (TR→ASCII, lowercase, suffix temizleme)
 * @param {string} raw
 * @returns {string}
 */
export function normalizeDistrictName(raw) {
  if (!raw) return "";
  let s = String(raw).trim()
    .replace(TR_RE, (c) => TR_ASCII[c] ?? c)
    .toLowerCase();

  // İlçe suffix'lerini temizle
  s = s
    .replace(/\s+ilcesi\s*$/i, "")
    .replace(/\s+ilcesi?\s*$/i, "")
    .replace(/\s+merkezi\s*$/i, "")
    .replace(/\s+belediyesi\s*$/i, "")
    .replace(/\s+beldesi\s*$/i, "");

  return s.replace(/\s+/g, " ").trim();
}

/**
 * Bilinen alternatif yazım → canonical slug map.
 * Kaynak verideki yaygın varyasyonları kapsar.
 */
const DISTRICT_ALIASES = {
  // Genel
  "merkez ilce":        "merkez",
  "il merkezi":         "merkez",
  "belediye merkezi":   "merkez",
  "sehir merkezi":      "merkez",
  "ilcemerkezi":        "merkez",

  // İstanbul
  "besiktas":           "besiktas",
  "kadikoy":            "kadikoy",
  "uskudar":            "uskudar",
  "sisli":              "sisli",
  "bayrampasa":         "bayrampasa",
  "fatih":              "fatih",

  // Ankara
  "cankaya":            "cankaya",
  "kecioren":           "kecioren",
  "mamak":              "mamak",
  "etimesgut":          "etimesgut",
  "sincan":             "sincan",

  // İzmir
  "bornova":            "bornova",
  "buca":               "buca",
  "karsiyaka":          "karsiyaka",
  "konak":              "konak",
  "cigli":              "cigli",

  // Yaygın ek yazım hataları
  "gokcebey":           "gokcebey",
  "golbasi":            "golbasi",
  "gölbasi":            "golbasi",
  "golhisar":           "golhisar",
};

/**
 * 4+1 seviyeli district ID resolution.
 *
 * @param {Array<{id: number, name: string, slug: string}>} districts  İl'e ait tüm ilçeler
 * @param {string} rawDistrict  Kaynaktan gelen ham ilçe adı
 * @param {{ allowMerkezFallback?: boolean }} [opts]
 * @returns {DistrictResolution}
 */
export function resolveDistrictWithConfidence(districts, rawDistrict, opts = {}) {
  const { allowMerkezFallback = true } = opts;

  if (!districts.length) return { id: null, confidence: "none" };

  const raw = (rawDistrict || "").trim();

  if (raw) {
    // Level 1: Exact slug match
    const needle = slugify(raw);
    const bySlug = districts.find((d) => d.slug === needle);
    if (bySlug) return { id: bySlug.id, confidence: "exact" };

    // Level 2: Normalized text match
    const normNeedle = normalizeDistrictName(raw);
    const byNorm = districts.find((d) => normalizeDistrictName(d.name) === normNeedle);
    if (byNorm) return { id: byNorm.id, confidence: "normalized" };

    // Level 3: Alias lookup
    const aliasSlug = DISTRICT_ALIASES[normNeedle];
    if (aliasSlug) {
      const byAlias = districts.find((d) => d.slug === aliasSlug);
      if (byAlias) return { id: byAlias.id, confidence: "alias" };
    }
    // Slug → alias da dene
    const aliasSlug2 = DISTRICT_ALIASES[needle];
    if (aliasSlug2) {
      const byAlias2 = districts.find((d) => d.slug === aliasSlug2);
      if (byAlias2) return { id: byAlias2.id, confidence: "alias" };
    }

    // Level 4: Jaro-Winkler fuzzy (en az 4 karakter)
    if (normNeedle.length >= 4) {
      let bestScore = 0;
      let bestDistrict = null;
      for (const d of districts) {
        const score = jaroWinkler(normNeedle, normalizeDistrictName(d.name));
        if (score > bestScore) { bestScore = score; bestDistrict = d; }
      }
      if (bestScore >= 0.85 && bestDistrict) {
        return { id: bestDistrict.id, confidence: "fuzzy" };
      }
    }
  }

  // Level 5: Merkez fallback
  if (allowMerkezFallback) {
    const merkez = districts.find(
      (d) => d.slug === "merkez" || d.slug.endsWith("-merkez") || normalizeDistrictName(d.name) === "merkez"
    );
    if (merkez) return { id: merkez.id, confidence: "fallback" };
    if (districts[0]) return { id: districts[0].id, confidence: "fallback" };
  }

  return { id: null, confidence: "none" };
}

/**
 * Backward-compatible: sadece ID döndürür.
 * Mevcut upsertLayer.js bu fonksiyonu kullanır (tam geçişe kadar).
 */
export function resolveDistrictId(districts, rawDistrict) {
  return resolveDistrictWithConfidence(districts, rawDistrict).id;
}
