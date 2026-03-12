/**
 * Türkçe tarih formatları — Next.js server component'larında kullanılır.
 * Tüm fonksiyonlar İstanbul saatine (UTC+3) göre çalışır.
 */

const TR_MONTHS_LONG = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

/** Şu anki İstanbul saatini Date olarak döner. */
export function nowIstanbul(): Date {
  // Node.js ortamında TZ=Europe/Istanbul yoksa manuel hesapla
  const now = new Date();
  const offset = 3 * 60; // UTC+3 dakika cinsinden
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  return new Date(utcMs + offset * 60_000);
}

/** "DD.MM.YYYY" formatı — başlık/title için. */
export function formatDDMMYYYY(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${mon}.${d.getFullYear()}`;
}

/** "D Ay YYYY" formatı — meta description için. */
export function formatLong(d: Date): string {
  return `${d.getDate()} ${TR_MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** "YYYY-MM-DD" ISO formatı — sitemap lastmod için. */
export function formatISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Tüm formatlarda bugünün tarihini döner. */
export function getToday() {
  const d = nowIstanbul();
  return {
    date: d,
    ddmmyyyy: formatDDMMYYYY(d),
    long: formatLong(d),
    iso: formatISO(d),
  };
}
