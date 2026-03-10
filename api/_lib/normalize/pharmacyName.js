/**
 * Pharmacy name normalization — production-grade.
 *
 * Kurallar (sırayla uygulanır):
 *   1. Boşluk trim
 *   2. TR karakter → ASCII
 *   3. BÜYÜK HARF
 *   4. Noktalama → boşluk (tire hariç)
 *   5. Parantez içi temizleme
 *   6. Suffix kaldırma (ECZANESI, ECZANE, ECZ…)
 *   7. Prefix temizleme (1. , NÖBETÇİ)
 *   8. Token alias normalleştirmesi (DR. → DOKTOR)
 *   9. Çoklu boşluk temizle
 */

const TR_ASCII = {
  İ: "I", ı: "I",
  Ğ: "G", ğ: "G",
  Ş: "S", ş: "S",
  Ç: "C", ç: "C",
  Ö: "O", ö: "O",
  Ü: "U", ü: "U",
};

const TR_RE = /[İıĞğŞşÇçÖöÜü]/g;

// Uzundan kısaya sıralanmış suffix'ler — ilk eşleşmede dur
const SUFFIXES = [
  "ECZANESI",
  "ECZANELERÎ",
  "ECZANELERI",
  "ECZÂNESI",
  "ECZANELERE",
  "ECZANE",
  "ECZÂNE",
  "ECZ.",
  "ECZ",
];

const SUFFIX_RE = new RegExp(
  `\\s+(${SUFFIXES.join("|")})\\s*$`
);

// Token alias map — normalize için
const TOKEN_ALIASES = {
  "DR.":    "DOKTOR",
  "DR":     "DOKTOR",
  "AV.":    "AVUKAT",
  "AV":     "AVUKAT",
  "MAH.":   "MAHALLE",
  "MH.":    "MAHALLE",
  "CAD.":   "CADDE",
  "CD.":    "CADDE",
  "BLV.":   "BULVAR",
  "SK.":    "SOKAK",
  "SOK.":   "SOKAK",
  "NO:":    "",
  "NO.":    "",
  "NO":     "",
};

/**
 * Tek bir eczane ismini normalleştirir.
 * @param {string} raw
 * @returns {string}  Normalize edilmiş büyük harfli string, boş string mümkün
 */
export function normalizePharmacyName(raw) {
  if (!raw) return "";

  let s = String(raw).trim();
  if (!s) return "";

  // 1–3: TR → ASCII + büyük harf
  s = s.replace(TR_RE, (c) => TR_ASCII[c] ?? c).toUpperCase();

  // 4: Noktalama → boşluk (tire dahil: "ECZ. CELIK-OZKAN" bozulmasın istenirse
  //    hariç tutulabilir ama normalizasyon için dahil ediyoruz)
  s = s.replace(/[.,'/\\]+/g, " ");

  // 5: Parantez içi temizle "AKSU (MERKEZ)" → "AKSU"
  s = s.replace(/\([^)]{0,40}\)/g, " ");

  // 6: Suffix kaldır
  s = s.replace(SUFFIX_RE, "");

  // 7: Prefix temizle
  s = s
    .replace(/^\d+\.\s+/, "")     // "1. KONAK" → "KONAK"
    .replace(/^NOBETCI\s+/, "");  // "NOBETCI AKSU" → "AKSU"

  // 8: Token alias
  const tokens = s.split(/\s+/).map((t) => {
    const alias = TOKEN_ALIASES[t];
    return alias !== undefined ? alias : t;
  }).filter(Boolean);
  s = tokens.join(" ");

  return s.trim();
}

/**
 * İsim listesini normalleştirir, tekrarları kaldırır ve sıralar.
 * @param {string[]} names
 * @returns {string[]}
 */
export function normalizeNameList(names) {
  return [...new Set((names || []).map(normalizePharmacyName).filter(Boolean))].sort();
}

/**
 * Ham isim ile normalize edilmiş isim arasında Map oluşturur.
 * normalizePharmacyName(raw) → raw (ilk karşılaşılan raw tutulur)
 * @param {string[]} names
 * @returns {Map<string, string>}
 */
export function toNormalizedMap(names) {
  const map = new Map();
  for (const raw of names || []) {
    const norm = normalizePharmacyName(raw);
    if (!norm || map.has(norm)) continue;
    map.set(norm, String(raw).trim());
  }
  return map;
}
