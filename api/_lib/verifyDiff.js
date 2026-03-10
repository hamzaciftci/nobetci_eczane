// Kapsamlı normalizasyon — normalize/pharmacyName.js'den import
import { normalizePharmacyName, normalizeNameList, toNormalizedMap as _toNormalizedMap } from "./normalize/pharmacyName.js";

export { normalizePharmacyName, normalizeNameList };

/**
 * Returns a dynamic max Levenshtein distance based on normalised name length.
 * Short names (≤6 chars) allow 1 error; each 4 extra chars add 1 more, capped at 5.
 * @param {string} a  @param {string} b
 * @returns {number}
 */
export function dynamicFuzzyDistance(a, b) {
  const len = Math.min(a.length, b.length);
  if (len <= 6)  return 1;
  if (len <= 10) return 2;
  if (len <= 16) return 3;
  if (len <= 22) return 4;
  return 5;
}

/**
 * @param {string[]} apiNames
 * @param {string[]} officialNames
 * @param {{ fuzzyDistance?: number }} [options]
 */
export function classifyNameDiff(apiNames, officialNames, options = {}) {
  // When no explicit distance supplied we compute dynamically per-pair (see pairNearMatches).
  const fixedDistance = Number.isInteger(options.fuzzyDistance) ? options.fuzzyDistance : null;

  const apiMap = toNormalizedMap(apiNames);
  const officialMap = toNormalizedMap(officialNames);

  const apiSet = new Set(apiMap.keys());
  const officialSet = new Set(officialMap.keys());

  const missingNorm = [...officialSet].filter((name) => !apiSet.has(name));
  const extraNorm = [...apiSet].filter((name) => !officialSet.has(name));

  const mismatch = pairNearMatches(missingNorm, extraNorm, fixedDistance).map((pair) => ({
    official: officialMap.get(pair.a) ?? pair.a,
    api: apiMap.get(pair.b) ?? pair.b,
    distance: pair.distance
  }));

  const mismatchOfficialSet = new Set(mismatch.map((m) => normalizePharmacyName(m.official)));
  const mismatchApiSet = new Set(mismatch.map((m) => normalizePharmacyName(m.api)));

  const missing = missingNorm
    .filter((name) => !mismatchOfficialSet.has(name))
    .map((name) => officialMap.get(name) ?? name)
    .sort((a, b) => a.localeCompare(b, "tr-TR"));

  const extra = extraNorm
    .filter((name) => !mismatchApiSet.has(name))
    .map((name) => apiMap.get(name) ?? name)
    .sort((a, b) => a.localeCompare(b, "tr-TR"));

  const matched = [...officialSet].filter((name) => apiSet.has(name)).length;
  const mismatchSorted = mismatch.sort((a, b) => a.distance - b.distance || a.official.localeCompare(b.official, "tr-TR"));

  return {
    matched,
    missing,
    extra,
    mismatch: mismatchSorted
  };
}

/**
 * @param {{missing: string[], extra: string[], mismatch: Array}} diff
 */
export function diffSeverity(diff) {
  if (diff.missing.length || diff.extra.length) return "high";
  if (diff.mismatch.length) return "medium";
  return "low";
}

function toNormalizedMap(names) {
  return _toNormalizedMap(names);
}

/**
 * @param {string[]} aList
 * @param {string[]} bList
 * @param {number|null} fixedMaxDistance  null → compute dynamically per pair
 */
function pairNearMatches(aList, bList, fixedMaxDistance) {
  if (!aList.length || !bList.length) return [];

  const candidates = [];
  for (const a of aList) {
    for (const b of bList) {
      const maxDist = fixedMaxDistance != null ? fixedMaxDistance : dynamicFuzzyDistance(a, b);
      if (maxDist < 1) continue;
      const distance = levenshtein(a, b);
      if (distance <= maxDist) {
        candidates.push({ a, b, distance });
      }
    }
  }

  candidates.sort((x, y) => x.distance - y.distance || x.a.localeCompare(y.a, "tr-TR"));

  const usedA = new Set();
  const usedB = new Set();
  const pairs = [];

  for (const candidate of candidates) {
    if (usedA.has(candidate.a) || usedB.has(candidate.b)) continue;
    usedA.add(candidate.a);
    usedB.add(candidate.b);
    pairs.push(candidate);
  }

  return pairs;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev.splice(0, prev.length, ...curr);
  }
  return prev[b.length];
}
