/**
 * Pharmacy matching engine.
 *
 * Kaynak verisi (RawPharmacy[]) ile DB verisi (DBPharmacy[]) arasında
 * weighted multi-signal matching yapar.
 *
 * Signal ağırlıkları:
 *   name    0.60  — en kritik
 *   phone   0.25  — güçlü ikincil sinyal
 *   district 0.15 — destekleyici
 *
 * Skor 0.50 altı → no_match.
 */
import { normalizePharmacyName } from "../normalize/pharmacyName.js";
import { normalizeDistrictName } from "../normalize/district.js";
import { bestSimilarity, jaroWinkler } from "./algorithms.js";

/**
 * @typedef {{
 *   name: string,
 *   district?: string,
 *   phone?: string,
 * }} RawPharmacy
 *
 * @typedef {{
 *   canonical_name: string,
 *   district_name?: string,
 *   phone?: string,
 * }} DBPharmacy
 *
 * @typedef {{
 *   field: "name"|"phone"|"district",
 *   type: "exact"|"partial"|"fuzzy"|"none",
 *   score: number
 * }} MatchSignal
 *
 * @typedef {{
 *   sourceItem: RawPharmacy,
 *   dbItem: DBPharmacy|null,
 *   matchType: "exact"|"normalized"|"fuzzy"|"no_match",
 *   confidence: number,
 *   signals: MatchSignal[]
 * }} MatchResult
 */

const WEIGHTS = { name: 0.60, phone: 0.25, district: 0.15 };
const NO_MATCH_THRESHOLD = 0.50;

/**
 * Ham telefonu karşılaştırılabilir formata indir.
 * @param {string} phone
 * @returns {string}
 */
function cleanPhoneForMatch(phone) {
  return String(phone || "").replace(/[^\d]/g, "");
}

/**
 * Tek bir kaynak kaydını DB kayıtları içinde en iyi eşleşmeyle eşleştirir.
 * @param {RawPharmacy} src
 * @param {DBPharmacy[]} candidates
 * @returns {MatchResult}
 */
function findBestMatch(src, candidates) {
  const srcNameNorm = normalizePharmacyName(src.name);
  const srcPhone    = cleanPhoneForMatch(src.phone || "");
  const srcDistrict = normalizeDistrictName(src.district || "");

  let bestScore    = 0;
  let bestMatch    = null;
  let bestSignals  = [];
  let bestMatchType = "no_match";

  for (const candidate of candidates) {
    const signals = [];
    let totalScore = 0;

    // ── İsim skoru ─────────────────────────────────────
    const candNameNorm = normalizePharmacyName(candidate.canonical_name);
    let nameSim;
    let nameType;

    if (srcNameNorm === candNameNorm) {
      nameSim  = 1.0;
      nameType = "exact";
    } else {
      nameSim  = bestSimilarity(srcNameNorm, candNameNorm);
      nameType = nameSim >= 0.90 ? "fuzzy" : "partial";
    }
    signals.push({ field: "name", type: nameType, score: nameSim });
    totalScore += nameSim * WEIGHTS.name;

    // ── Telefon skoru ───────────────────────────────────
    const candPhone = cleanPhoneForMatch(candidate.phone || "");
    if (srcPhone && candPhone) {
      let phoneSim = 0;
      let phoneType = "none";
      if (srcPhone === candPhone) {
        phoneSim  = 1.0;
        phoneType = "exact";
      } else if (srcPhone.length >= 7 && candPhone.length >= 7 &&
                 srcPhone.slice(-7) === candPhone.slice(-7)) {
        phoneSim  = 0.8;
        phoneType = "partial";
      }
      signals.push({ field: "phone", type: phoneType, score: phoneSim });
      totalScore += phoneSim * WEIGHTS.phone;
    }

    // ── İlçe skoru ─────────────────────────────────────
    const candDistrict = normalizeDistrictName(candidate.district_name || "");
    if (srcDistrict && candDistrict) {
      const distSim  = srcDistrict === candDistrict ? 1.0 : jaroWinkler(srcDistrict, candDistrict);
      const distType = distSim >= 0.90 ? "exact" : distSim >= 0.70 ? "fuzzy" : "none";
      signals.push({ field: "district", type: distType, score: distSim });
      totalScore += distSim * WEIGHTS.district;
    }

    if (totalScore > bestScore) {
      bestScore     = totalScore;
      bestMatch     = candidate;
      bestSignals   = signals;
      const nSig    = signals.find((s) => s.field === "name");
      bestMatchType = bestScore >= 0.95 ? "exact"
        : bestScore >= 0.75 ? "fuzzy"
        : "normalized";
    }
  }

  if (bestScore < NO_MATCH_THRESHOLD || !bestMatch) {
    return { sourceItem: src, dbItem: null, matchType: "no_match", confidence: bestScore, signals: bestSignals };
  }

  return {
    sourceItem: src,
    dbItem:     bestMatch,
    matchType:  bestMatchType,
    confidence: Math.round(bestScore * 1000) / 1000,
    signals:    bestSignals
  };
}

/**
 * Kaynak listesini DB listesiyle eşleştirir.
 * @param {RawPharmacy[]} sourceRows
 * @param {DBPharmacy[]}  dbRows
 * @returns {MatchResult[]}
 */
export function matchPharmacies(sourceRows, dbRows) {
  if (!sourceRows?.length || !dbRows?.length) return [];
  return sourceRows.map((src) => findBestMatch(src, dbRows));
}

/**
 * Eşleşme sonuçlarından özet istatistik üretir.
 * @param {MatchResult[]} results
 * @returns {{ total, exact, fuzzy, no_match, avg_confidence }}
 */
export function summarizeMatches(results) {
  let exact = 0, fuzzy = 0, noMatch = 0, totalConf = 0;
  for (const r of results) {
    if (r.matchType === "exact")    exact++;
    else if (r.matchType === "no_match") noMatch++;
    else fuzzy++;
    totalConf += r.confidence;
  }
  return {
    total:          results.length,
    exact,
    fuzzy,
    no_match:       noMatch,
    avg_confidence: results.length ? Math.round(totalConf / results.length * 100) / 100 : 0
  };
}
