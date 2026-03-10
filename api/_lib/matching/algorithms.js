/**
 * String similarity algorithms.
 * Tüm fonksiyonlar pure — side-effect yok, dış bağımlılık yok.
 */

/**
 * Levenshtein edit distance.
 * O(a.length * b.length) — normalleştirilmiş skorlar için levenshteinNorm kullanın.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levenshtein(a, b) {
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

/**
 * Normalize edilmiş Levenshtein similarity (0–1).
 * @param {string} a
 * @param {string} b
 * @returns {number} 1.0 = mükemmel eşleşme
 */
export function levenshteinSimilarity(a, b) {
  if (a === b) return 1.0;
  if (!a && !b) return 1.0;
  const maxLen = Math.max(a.length, b.length);
  if (!maxLen) return 1.0;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * Jaro-Winkler similarity (0–1).
 * Kısa isimler ve ortak prefix'li isimler için daha doğru.
 * @param {string} s1
 * @param {string} s2
 * @param {number} [p=0.1]  Winkler prefix ağırlığı
 * @returns {number}
 */
export function jaroWinkler(s1, s2, p = 0.1) {
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  const matchDist = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);

  let matches      = 0;
  let transpositions = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchDist);
    const end   = Math.min(i + matchDist + 1, s2.length);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (!matches) return 0.0;

  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (
    matches / s1.length +
    matches / s2.length +
    (matches - transpositions / 2) / matches
  ) / 3;

  // Winkler prefix bonusu (max 4 karakter)
  let prefix = 0;
  const maxPrefix = Math.min(4, Math.min(s1.length, s2.length));
  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] !== s2[i]) break;
    prefix++;
  }

  return jaro + prefix * p * (1 - jaro);
}

/**
 * Token Set Ratio — fuzzywuzzy benzeri.
 * "MERKEZ AKSU ECZANE" vs "AKSU MERKEZ" için yüksek skor üretir.
 * Token sırasından bağımsız.
 * @param {string} a
 * @param {string} b
 * @returns {number} 0–1
 */
export function tokenSetRatio(a, b) {
  if (a === b) return 1.0;
  if (!a || !b) return 0.0;

  const tokensA = new Set(a.split(/\s+/).filter(Boolean));
  const tokensB = new Set(b.split(/\s+/).filter(Boolean));

  const intersection = [...tokensA].filter((t) => tokensB.has(t));
  const onlyA        = [...tokensA].filter((t) => !tokensB.has(t));
  const onlyB        = [...tokensB].filter((t) => !tokensA.has(t));

  // Üç kombinasyon:
  //   t0 = sadece ortak tokenlar
  //   t1 = ortak + sadece A
  //   t2 = ortak + sadece B
  const t0 = intersection.sort().join(" ");
  const t1 = [...intersection, ...onlyA].sort().join(" ");
  const t2 = [...intersection, ...onlyB].sort().join(" ");

  return Math.max(
    jaroWinkler(t0, t1),
    jaroWinkler(t0, t2),
    jaroWinkler(t1, t2)
  );
}

/**
 * En iyi similarity skoru: levenshtein + jaro-winkler + token set ratio maksimumu.
 * @param {string} a
 * @param {string} b
 * @returns {number} 0–1
 */
export function bestSimilarity(a, b) {
  if (a === b) return 1.0;
  if (!a || !b) return 0.0;
  return Math.max(
    levenshteinSimilarity(a, b),
    jaroWinkler(a, b),
    tokenSetRatio(a, b)
  );
}
