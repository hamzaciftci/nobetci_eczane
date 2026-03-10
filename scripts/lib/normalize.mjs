/**
 * normalize.mjs
 *
 * Eczane ismi normalizasyon yardımcıları.
 * İki kaynaktan gelen isimler (API ve canlı scrape) karşılaştırılırken
 * aşağıdaki varyasyonların görmezden gelinmesi sağlanır:
 *
 *   - Türkçe karakter farkı   : İ/I, ş/s, ç/c, ğ/g, ö/o, ü/u
 *   - ECZANESİ / ECZANESI     : suffix olarak iki form da aynı
 *   - ECZANESİ suffix olmayan : "ABI HAYAT" == "ABI HAYAT ECZANESİ"
 *   - Fazla boşluk / trim
 *   - Noktalama farklılıkları : "SOFUOĞLU" == "SOFUOGLU"
 */

/** Türkçe büyük harf → ASCII eşleme */
const TR_ASCII = {
  "İ": "I", "ı": "I", "i": "I",
  "Ğ": "G", "ğ": "G",
  "Ş": "S", "ş": "S",
  "Ç": "C", "ç": "C",
  "Ö": "O", "ö": "O",
  "Ü": "U", "ü": "U",
};

const TR_RE = /[İıiĞğŞşÇçÖöÜü]/g;

/**
 * Tek bir eczane ismini karşılaştırma için normalize eder.
 *
 * Sıralama:
 *   1. Türkçe → ASCII (büyük harf)
 *   2. toUpperCase
 *   3. Noktalama boşluğa çevir (., -, ', /)
 *   4. ECZANESI / ECZANE suffix kaldır
 *   5. Boşlukları collapse et / trim
 */
export function normalizeName(raw) {
  if (!raw) return "";

  let s = String(raw)
    .trim()
    .replace(TR_RE, (c) => TR_ASCII[c] ?? c)
    .toUpperCase();

  // Noktalama → boşluk
  s = s.replace(/[.,\-'/\\]+/g, " ");

  // Trailing ECZANE suffix'ini kaldır (karşılaştırma amaçlı)
  // Sıralama önemli: önce uzun form
  s = s
    .replace(/\s+ECZANESI\s*$/, "")
    .replace(/\s+ECZANE\s*$/, "")
    .replace(/\s+ECZ\s*$/, "");

  // Boşlukları topla
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

/**
 * Bir isim listesini normalize edip deduplikasyon yapar ve sıralar.
 * @param {string[]} names
 * @returns {string[]}
 */
export function normalizeList(names) {
  return [...new Set(names.map(normalizeName).filter(Boolean))].sort();
}

/**
 * İki isim listesini karşılaştırır (normalizasyon sonrası).
 *
 * @param {string[]} apiNames   - Bizim API / DB'den gelen isimler
 * @param {string[]} liveNames  - Canlı kaynaktan scrape edilen isimler
 * @returns {{
 *   missing: string[],   // Canlı kaynakta var, API'de yok
 *   extra:   string[],   // API'de var, canlı kaynakta yok
 *   matched: number      // Eşleşen sayısı
 * }}
 */
export function diffLists(apiNames, liveNames) {
  const { missing, extra, matched } = classifyDiff(apiNames, liveNames);
  return { missing, extra, matched };
}

/**
 * İki listeyi MISSING / EXTRA / MISMATCH olarak sınıflandırır.
 * MISMATCH: normalize sonrası eşleşmeyen fakat Levenshtein <= maxDistance.
 *
 * @param {string[]} apiNames
 * @param {string[]} liveNames
 * @param {number} [maxDistance=2]
 */
export function classifyDiff(apiNames, liveNames, maxDistance = 2) {
  const apiSet  = new Set(apiNames.map(normalizeName).filter(Boolean));
  const liveSet = new Set(liveNames.map(normalizeName).filter(Boolean));

  const missingNorm = [...liveSet].filter((n) => !apiSet.has(n));
  const extraNorm   = [...apiSet].filter((n) => !liveSet.has(n));
  const matched = [...liveSet].filter((n) => apiSet.has(n)).length;

  const mismatch = pairNearMatches(missingNorm, extraNorm, maxDistance).map((pair) => ({
    official: pair.a,
    api: pair.b,
    distance: pair.distance
  }));

  const mismatchOfficial = new Set(mismatch.map((m) => m.official));
  const mismatchApi = new Set(mismatch.map((m) => m.api));

  const missing = missingNorm.filter((name) => !mismatchOfficial.has(name));
  const extra = extraNorm.filter((name) => !mismatchApi.has(name));

  return { missing, extra, mismatch, matched };
}

/**
 * Normalize edilmiş isimler arasında fuzzy (Levenshtein) benzerlik arar.
 * Tam eşleşmeye ek olarak "1-2 harf farkı" uyarısı üretmek için kullanılır.
 *
 * @param {string} name
 * @param {Set<string>} candidateSet
 * @returns {string|null}  En yakın eşleşme veya null
 */
export function findClosestMatch(name, candidateSet) {
  const n = normalizeName(name);
  let bestDist = Infinity;
  let bestMatch = null;
  for (const c of candidateSet) {
    const d = levenshtein(n, c);
    if (d < bestDist && d <= 2) {
      bestDist = d;
      bestMatch = c;
    }
  }
  return bestMatch;
}

// ─── Levenshtein (iterative, O(m·n)) ─────────────────────────────────────

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

function pairNearMatches(aList, bList, maxDistance) {
  if (!aList.length || !bList.length || maxDistance < 1) return [];

  const candidates = [];
  for (const a of aList) {
    for (const b of bList) {
      const distance = levenshtein(a, b);
      if (distance <= maxDistance) {
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
