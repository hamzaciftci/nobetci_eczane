/**
 * Confidence score hesaplama.
 *
 * Mevcut sistem upsertLayer.js'de sabit 80 yazıyordu.
 * Bu modül dinamik skor üretir:
 *
 *   Eşleşme kalitesi    → max 50 puan
 *   Kaynak otoritesi    → max 20 puan   (sources.authority_weight / 10 * 20)
 *   İlçe çözüm güveni  → max 15 puan
 *   Multi-source bonus  → max 15 puan   (her ekstra kaynak +5, max 3)
 */

/**
 * @typedef {"exact"|"normalized"|"alias"|"fuzzy"|"fallback"|"none"} DistrictConfidence
 *
 * @param {{
 *   matchSimilarity: number,          // 0–1  (matchPharmacies'den gelen confidence)
 *   sourceAuthorityWeight: number,    // 1–10 (sources.authority_weight)
 *   districtConfidence: DistrictConfidence,
 *   verificationSourceCount: number   // mevcut + 1
 * }} params
 * @returns {number}  0–100 tam sayı
 */
export function computeConfidenceScore({
  matchSimilarity,
  sourceAuthorityWeight,
  districtConfidence,
  verificationSourceCount,
}) {
  // 1. Eşleşme kalitesi (0–50)
  const matchScore = Math.round(
    Math.min(Math.max(Number(matchSimilarity) || 0, 0), 1) * 50
  );

  // 2. Kaynak otoritesi (0–20)
  const authorityScore = Math.round(
    (Math.min(Math.max(Number(sourceAuthorityWeight) || 5, 1), 10) / 10) * 20
  );

  // 3. İlçe çözüm güveni (0–15)
  const districtScoreMap = {
    exact:      15,
    normalized: 12,
    alias:      10,
    fuzzy:       6,
    fallback:    2,
    none:        0,
  };
  const districtScore = districtScoreMap[districtConfidence] ?? 0;

  // 4. Multi-source bonus (0–15, her kaynak +5, max 3 kaynak)
  const multiSourceBonus = Math.min(Math.max(Number(verificationSourceCount) || 1, 1), 4) * 5 - 5;
  // verificationSourceCount=1 → 0 bonus, =2 → 5, =3 → 10, ≥4 → 15

  const total = matchScore + authorityScore + districtScore + multiSourceBonus;
  return Math.min(Math.max(Math.round(total), 0), 100);
}

/**
 * Fallback: hiç matching verisi yoksa otorite ağırlığına göre temel skor.
 * @param {number} authorityWeight  1–10
 * @returns {number}
 */
export function baseConfidenceScore(authorityWeight) {
  return computeConfidenceScore({
    matchSimilarity: 1.0,          // kaynaktan doğrudan geldi, exact
    sourceAuthorityWeight: authorityWeight,
    districtConfidence: "normalized",
    verificationSourceCount: 1,
  });
}
