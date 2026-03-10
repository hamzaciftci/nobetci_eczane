/**
 * Tüm parser'ların ortak kullandığı yardımcı fonksiyonlar.
 * ingest/utils.js + normalizeLayer.js'den re-export.
 */
export { stripTags, decodeEntities, clean, cleanPhone } from "../ingest/utils.js";
export { normalizeText } from "../ingest/normalizeLayer.js";

/**
 * Google Maps href'inden koordinat çıkarır.
 * @param {string} html
 * @returns {{ lat: number, lng: number } | null}
 */
export function extractCoords(html) {
  const m = html.match(
    /href="https?:\/\/(?:maps\.google\.com|www\.google\.com\/maps)[^"]*[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/i
  );
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) };
  return null;
}
